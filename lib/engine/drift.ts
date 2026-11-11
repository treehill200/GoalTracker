/**
 * Drift detection and the rescue plan for goals that have gone quiet.
 */
import { addDays, diffDays, type DateStr } from "./dates";

export type DriftLevel = "none" | "nudge" | "sad" | "rescue";

/** Days since the last log. A goal that was never logged counts from its start date. */
export function daysSince(lastLogDate: DateStr | null, today: DateStr, startDate: DateStr): number {
  return Math.max(diffDays(today, lastLogDate ?? startDate), 0);
}

/** 3 days → gentle nudge · 7 days → sad coach + push · 14 days → rescue plan. */
export function driftLevel(days: number): DriftLevel {
  if (days >= 14) return "rescue";
  if (days >= 7) return "sad";
  if (days >= 3) return "nudge";
  return "none";
}

export interface RescuePlan {
  /** A small, reachable restart target for the next two weeks. */
  restartTarget: number;
  restartBy: DateStr;
  /** Suggested new deadline (deadline + the time lost), or null for open-ended goals. */
  newDeadline: DateStr | null;
  summary: string;
}

/**
 * Offer a smaller restart: aim for half the planned weekly pace for two weeks
 * (or 10% of the remaining gap if there is no plan), and push the deadline by
 * the number of days lost.
 */
export function rescuePlan(args: {
  current: number;
  target: number;
  weeklyTarget: number | null;
  today: DateStr;
  deadline: DateStr | null;
  daysAway: number;
  unit: string;
}): RescuePlan {
  const gap = args.target - args.current;
  const dir = Math.sign(gap) || 1;
  const halfPace = args.weeklyTarget ? Math.abs(args.weeklyTarget) * 0.5 * 2 : Math.abs(gap) * 0.1;
  const step = Math.min(Math.abs(gap), halfPace);
  const restartTarget = roundNice(args.current + dir * step);
  const restartBy = addDays(args.today, 14);
  const newDeadline = args.deadline
    ? addDays(args.deadline > args.today ? args.deadline : args.today, args.daysAway)
    : null;
  return {
    restartTarget,
    restartBy,
    newDeadline,
    summary: `Restart small: reach ${restartTarget} ${args.unit} in the next 2 weeks.`,
  };
}

/** Round to a "human" precision based on magnitude. */
export function roundNice(x: number): number {
  const abs = Math.abs(x);
  if (abs >= 100) return Math.round(x);
  if (abs >= 10) return Math.round(x * 10) / 10;
  return Math.round(x * 100) / 100;
}
