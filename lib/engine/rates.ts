/**
 * Observed rates (EWMA of daily change) and completion projections.
 */
import { addDays, diffDays, fromDayNum, toDayNum, type DateStr } from "./dates";

export interface Point {
  date: DateStr;
  value: number;
}

export interface RateEstimate {
  /** Weighted mean change per day, in metric units. */
  perDay: number;
  /** Standard error of the rate (±1 SD of the estimate), per day. */
  sd: number;
  /** Number of daily samples that went into the estimate. */
  samples: number;
}

export const DEFAULT_WINDOW_DAYS = 28;
export const DEFAULT_HALF_LIFE_DAYS = 7;

/** Collapse multiple observations on the same day to the last one, sorted by date. */
export function dailyLast(points: Point[]): Point[] {
  const byDay = new Map<string, number>();
  for (const p of [...points].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))) {
    byDay.set(p.date, p.value);
  }
  return [...byDay.entries()].map(([date, value]) => ({ date, value }));
}

/** Linear interpolation between observations, one value per day from first to last. */
export function interpolateDaily(points: Point[]): Point[] {
  const pts = dailyLast(points);
  if (pts.length === 0) return [];
  const out: Point[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const span = diffDays(b.date, a.date);
    for (let k = 0; k < span; k++) {
      out.push({ date: addDays(a.date, k), value: a.value + ((b.value - a.value) * k) / span });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/**
 * Exponentially weighted mean + standard error of a set of (age, value) samples.
 * weight = 0.5^(age / halfLife)
 */
export function ewma(
  samples: { age: number; value: number }[],
  halfLifeDays = DEFAULT_HALF_LIFE_DAYS,
): RateEstimate | null {
  if (samples.length === 0) return null;
  let sw = 0;
  let sw2 = 0;
  let swx = 0;
  for (const s of samples) {
    const w = Math.pow(0.5, s.age / halfLifeDays);
    sw += w;
    sw2 += w * w;
    swx += w * s.value;
  }
  const mean = swx / sw;
  let swVar = 0;
  for (const s of samples) {
    const w = Math.pow(0.5, s.age / halfLifeDays);
    swVar += w * (s.value - mean) ** 2;
  }
  const variance = swVar / sw;
  const nEff = (sw * sw) / sw2;
  const se = Math.sqrt(variance / Math.max(nEff, 1));
  return { perDay: mean, sd: se, samples: samples.length };
}

/**
 * Observed rate for "level" metrics (the latest value matters, e.g. body weight).
 * Daily changes come from the interpolated series inside the last `windowDays`
 * days. Days after the most recent entry are not counted (we don't know yet).
 */
export function observedRateLevel(
  points: Point[],
  today: DateStr,
  windowDays = DEFAULT_WINDOW_DAYS,
  halfLifeDays = DEFAULT_HALF_LIFE_DAYS,
): RateEstimate | null {
  const pts = dailyLast(points.filter((p) => p.date <= today));
  if (pts.length < 2) return null;
  const series = interpolateDaily(pts);
  const windowStart = toDayNum(today) - windowDays;
  const samples: { age: number; value: number }[] = [];
  for (let i = 1; i < series.length; i++) {
    const day = toDayNum(series[i].date);
    if (day <= windowStart) continue;
    samples.push({ age: toDayNum(today) - day, value: series[i].value - series[i - 1].value });
  }
  if (samples.length === 0) {
    // Data is stale (nothing in the window): fall back to the slope of the last two entries.
    const a = pts[pts.length - 2];
    const b = pts[pts.length - 1];
    const slope = (b.value - a.value) / Math.max(diffDays(b.date, a.date), 1);
    return { perDay: slope, sd: Math.abs(slope), samples: 1 };
  }
  return ewma(samples, halfLifeDays);
}

/**
 * Observed rate for cumulative metrics (miles run, dollars saved): the daily
 * total of entries, including zero days, for each day of the window since `startDate`.
 */
export function observedRateSum(
  points: Point[],
  today: DateStr,
  startDate: DateStr,
  windowDays = DEFAULT_WINDOW_DAYS,
  halfLifeDays = DEFAULT_HALF_LIFE_DAYS,
): RateEstimate | null {
  const totals = new Map<string, number>();
  for (const p of points) totals.set(p.date, (totals.get(p.date) ?? 0) + p.value);
  const first = Math.max(toDayNum(today) - windowDays + 1, toDayNum(startDate));
  const last = toDayNum(today);
  if (first > last) return null;
  const samples: { age: number; value: number }[] = [];
  for (let d = first; d <= last; d++) {
    samples.push({ age: last - d, value: totals.get(fromDayNum(d)) ?? 0 });
  }
  return ewma(samples, halfLifeDays);
}

export interface Projection {
  /** false → "Not converging at current pace" */
  converging: boolean;
  /** Already at or past the target. */
  reached: boolean;
  date: DateStr | null;
  /** Optimistic date (rate + 1 SD). */
  low: DateStr | null;
  /** Pessimistic date (rate − 1 SD). null when the slow case never converges. */
  high: DateStr | null;
  daysToGo: number | null;
}

/** Days until `remaining` is covered at `perDay` (remaining and perDay share a sign when converging). */
function daysAt(remaining: number, perDay: number): number | null {
  if (perDay === 0 || Math.sign(perDay) !== Math.sign(remaining)) return null;
  return remaining / perDay;
}

/**
 * Projected completion: now + (T − C) / observedRate. Converging only if the
 * rate moves toward the target. The confidence band uses rate ± 1 SD.
 */
export function projectCompletion(
  current: number,
  target: number,
  rate: RateEstimate | null,
  today: DateStr,
): Projection {
  const remaining = target - current;
  if (remaining === 0) {
    return { converging: true, reached: true, date: today, low: today, high: today, daysToGo: 0 };
  }
  if (!rate)
    return { converging: false, reached: false, date: null, low: null, high: null, daysToGo: null };
  const mid = daysAt(remaining, rate.perDay);
  if (mid === null)
    return { converging: false, reached: false, date: null, low: null, high: null, daysToGo: null };
  const dir = Math.sign(remaining);
  const fast = daysAt(remaining, rate.perDay + dir * rate.sd);
  const slow = daysAt(remaining, rate.perDay - dir * rate.sd);
  // Cap projections at ~20 years so charts stay sane.
  const cap = (d: number) => Math.min(Math.ceil(d), 365 * 20);
  return {
    converging: true,
    reached: false,
    date: addDays(today, cap(mid)),
    low: fast === null ? addDays(today, cap(mid)) : addDays(today, cap(fast)),
    high: slow === null ? null : addDays(today, cap(slow)),
    daysToGo: cap(mid),
  };
}

/** Has the value reached (or passed) the target, respecting direction? */
export function hasReached(baseline: number, target: number, current: number): boolean {
  if (target >= baseline) return current >= target;
  return current <= target;
}
