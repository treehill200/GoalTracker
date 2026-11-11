/**
 * Builds chart-ready series for the forecast chart: actual values, the plan
 * line, the projection to the forecast date and the ±1 SD confidence band.
 */
import type { MetricAnalysis } from "./analyze";
import { addDays, diffDays, fromDayNum, toDayNum, type DateStr } from "./dates";
import { expectedProgress, type ExpectedCurve } from "./progress";

export interface ForecastPoint {
  x: number; // day number
  date: DateStr;
  actual?: number;
  plan?: number;
  projection?: number;
  band?: [number, number];
}

function towards(value: number, target: number, dir: number) {
  return dir >= 0 ? Math.min(value, target) : Math.max(value, target);
}

export function buildForecast(
  m: MetricAnalysis,
  opts: {
    start: DateStr;
    deadline: DateStr;
    today: DateStr;
    curve: ExpectedCurve;
    maxPoints?: number;
  },
): { points: ForecastPoint[]; end: DateStr } {
  const { start, deadline, today, curve } = opts;
  const { baseline, target } = m.metric;
  const dir = Math.sign(target - baseline) || 1;
  const proj = m.projection;
  const span = Math.max(diffDays(deadline, start), 14);
  let end = deadline > today ? deadline : addDays(today, 14);
  const far = proj?.high ?? proj?.date ?? null;
  if (far && far > end) end = far;
  // Keep the chart readable: never more than 3× the plan length.
  const cap = addDays(start, span * 3);
  if (end > cap) end = cap;

  const dates = new Set<string>();
  const total = diffDays(end, start);
  const step = Math.max(1, Math.round(total / (opts.maxPoints ?? 120)));
  for (let d = 0; d <= total; d += step) dates.add(addDays(start, d));
  for (const p of m.series) if (p.date >= start && p.date <= today) dates.add(p.date);
  dates.add(today);
  dates.add(deadline <= end ? deadline : end);
  dates.add(end);
  if (proj?.date && proj.date <= end) dates.add(proj.date);

  const actualByDate = new Map(m.series.map((p) => [p.date, p.value]));
  const rate = m.observed?.perDay ?? 0;
  const sd = m.observed?.sd ?? 0;
  const fast = rate + dir * sd;
  const slow = rate - dir * sd;
  const converging = Boolean(proj?.converging && !proj.reached);

  const points = [...dates].sort().map((date): ForecastPoint => {
    const pt: ForecastPoint = { x: toDayNum(date), date };
    if (actualByDate.has(date)) pt.actual = actualByDate.get(date);
    if (date === today) pt.actual = m.current;
    if (date <= deadline)
      pt.plan = baseline + (target - baseline) * expectedProgress(start, deadline, date, curve);
    if (date >= today && converging) {
      const t = diffDays(date, today);
      if (!proj?.date || date <= proj.date)
        pt.projection = towards(m.current + rate * t, target, dir);
      const a = towards(m.current + fast * t, target, dir);
      const b = towards(m.current + slow * t, target, dir);
      pt.band = [Math.min(a, b), Math.max(a, b)];
    }
    return pt;
  });
  return { points, end };
}

export const dayToDate = fromDayNum;
