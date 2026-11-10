/**
 * Date helpers that work on plain "YYYY-MM-DD" strings.
 *
 * The engine never touches Date objects with local time zones directly: every
 * calendar date is a string, converted to an integer "day number" (days since
 * 1970-01-01, UTC) for arithmetic. This keeps all formulas deterministic and
 * easy to unit test.
 */

const MS_PER_DAY = 86_400_000;

export type DateStr = string; // "YYYY-MM-DD"

export function toDayNum(date: DateStr): number {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

export function fromDayNum(n: number): DateStr {
  return new Date(n * MS_PER_DAY).toISOString().slice(0, 10);
}

export function addDays(date: DateStr, days: number): DateStr {
  return fromDayNum(toDayNum(date) + Math.round(days));
}

/** a − b in whole days. */
export function diffDays(a: DateStr, b: DateStr): number {
  return toDayNum(a) - toDayNum(b);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(date: DateStr): number {
  // 1970-01-01 was a Thursday (4).
  return (((toDayNum(date) + 4) % 7) + 7) % 7;
}

/** Monday of the week containing `date`. */
export function weekStart(date: DateStr): DateStr {
  const wd = weekday(date);
  const offset = wd === 0 ? 6 : wd - 1;
  return addDays(date, -offset);
}

export function minDate(a: DateStr, b: DateStr): DateStr {
  return a <= b ? a : b;
}

export function maxDate(a: DateStr, b: DateStr): DateStr {
  return a >= b ? a : b;
}

/** Inclusive list of dates from `start` to `end`. */
export function dateRange(start: DateStr, end: DateStr): DateStr[] {
  const out: DateStr[] = [];
  for (let n = toDayNum(start); n <= toDayNum(end); n++) out.push(fromDayNum(n));
  return out;
}

/** Today's calendar date in the given IANA time zone (defaults to the runtime's zone). */
export function todayInZone(timeZone?: string, now: Date = new Date()): DateStr {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
    return parts; // en-CA formats as YYYY-MM-DD
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** Local "HH:MM" time in a zone. */
export function timeInZone(timeZone?: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now);
  } catch {
    return now.toISOString().slice(11, 16);
  }
}

/** Calendar date of an ISO timestamp in a zone. */
export function isoToDateInZone(iso: string, timeZone?: string): DateStr {
  return todayInZone(timeZone, new Date(iso));
}

export function clamp(x: number, lo: number, hi: number): number {
  if (Number.isNaN(x)) return lo;
  return Math.min(hi, Math.max(lo, x));
}
