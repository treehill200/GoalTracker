/**
 * Suggested deadline for goals without one (section 4.2): from the planned
 * pace when known, else a typical pace for the unit, else effort per week.
 */
import { addDays, type DateStr } from "./dates";

/** Typical sustainable weekly change for common units. */
export const TYPICAL_WEEKLY: Record<string, number> = {
  lb: 0.5,
  lbs: 0.5,
  kg: 0.25,
  points: 15,
  "%": 2,
};

export function suggestDeadline(args: {
  startDate: DateStr;
  baseline: number | null;
  target: number | null;
  unit: string | null;
  weeklyTarget: number | null;
  plannedWeeklyEffort: number | null;
}): { date: DateStr; basis: "plan" | "typical" | "effort" } {
  const gap =
    args.baseline !== null && args.target !== null ? Math.abs(args.target - args.baseline) : null;
  if (gap && args.weeklyTarget) {
    return {
      date: addDays(args.startDate, Math.ceil((gap / Math.abs(args.weeklyTarget)) * 7)),
      basis: "plan",
    };
  }
  const typical = args.unit ? TYPICAL_WEEKLY[args.unit.toLowerCase()] : undefined;
  if (gap && typical) {
    // More weekly effort → a little faster, within reason.
    const boost = args.plannedWeeklyEffort
      ? Math.min(Math.max(Math.sqrt(args.plannedWeeklyEffort / 5), 0.75), 1.5)
      : 1;
    return {
      date: addDays(args.startDate, Math.ceil((gap / (typical * boost)) * 7)),
      basis: "typical",
    };
  }
  const h = Math.max(args.plannedWeeklyEffort ?? 3, 1);
  const weeks = Math.round(12 * Math.sqrt(5 / h));
  return { date: addDays(args.startDate, Math.min(Math.max(weeks, 4), 52) * 7), basis: "effort" };
}

/** Weekly / daily targets between consecutive milestones that have numeric thresholds. */
export function milestoneTargets(
  start: DateStr,
  baseline: number,
  milestones: { title: string; targetDate: DateStr | null; thresholdValue: number | null }[],
): { title: string; perWeek: number | null; perDay: number | null }[] {
  let prevDate = start;
  let prevValue = baseline;
  return milestones.map((m) => {
    if (!m.targetDate || m.thresholdValue === null)
      return { title: m.title, perWeek: null, perDay: null };
    const days = Math.max((Date.parse(m.targetDate) - Date.parse(prevDate)) / 86_400_000, 1);
    const perDay = (m.thresholdValue - prevValue) / days;
    prevDate = m.targetDate;
    prevValue = m.thresholdValue;
    return { title: m.title, perWeek: perDay * 7, perDay };
  });
}
