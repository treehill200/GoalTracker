/**
 * Section 4.1 formulas: metric progress, expected progress, pace ratio and status.
 * All functions are pure.
 */
import { clamp, diffDays, type DateStr } from "./dates";

export type PaceStatus = "ahead" | "on_track" | "behind" | "at_risk";
export type ExpectedCurve = "linear" | "slow_start";

/**
 * Metric progress p = clamp((C − B) / (T − B), 0, 1).
 * Works for increasing AND decreasing targets because the sign of (T − B)
 * flips with the direction. When T == B the goal is "already there" if the
 * current value matches (or passed) it, otherwise 0.
 */
export function metricProgress(baseline: number, target: number, current: number): number {
  const span = target - baseline;
  if (span === 0 || !Number.isFinite(span)) {
    // Degenerate goal: treat as complete once current equals the target.
    return current === target ? 1 : 0;
  }
  return clamp((current - baseline) / span, 0, 1);
}

/** Fraction of the timeline elapsed, x = (now − t0) / (tD − t0), clamped to [0, 1]. */
export function timeFraction(start: DateStr, deadline: DateStr, today: DateStr): number {
  const total = diffDays(deadline, start);
  if (total <= 0) return today >= deadline ? 1 : 0;
  return clamp(diffDays(today, start) / total, 0, 1);
}

/**
 * Expected progress. Linear: e = x. Slow start: e = x^1.3 (less is expected
 * early on, more later).
 */
export function expectedProgress(
  start: DateStr,
  deadline: DateStr,
  today: DateStr,
  curve: ExpectedCurve = "linear",
): number {
  const x = timeFraction(start, deadline, today);
  return curve === "slow_start" ? Math.pow(x, 1.3) : x;
}

/** Pace ratio r = p / max(e, 0.01). */
export function paceRatio(progress: number, expected: number): number {
  return progress / Math.max(expected, 0.01);
}

export function statusFromPace(r: number): PaceStatus {
  if (r >= 1.05) return "ahead";
  if (r >= 0.9) return "on_track";
  if (r >= 0.7) return "behind";
  return "at_risk";
}

/**
 * Open-ended goals are judged on momentum (0–1) instead of the calendar.
 * Thresholds are documented in DECISIONS.md.
 */
export function statusFromMomentum(m: number): PaceStatus {
  if (m >= 0.95) return "ahead";
  if (m >= 0.8) return "on_track";
  if (m >= 0.6) return "behind";
  return "at_risk";
}

/**
 * Required rate (T − C) / daysRemaining, in metric units per day and per week.
 * Returns null when there is no time left (deadline today or past) so the UI
 * can say "deadline passed" instead of showing an infinite rate.
 */
export function requiredRate(
  target: number,
  current: number,
  today: DateStr,
  deadline: DateStr,
): { perDay: number; perWeek: number } | null {
  const daysRemaining = diffDays(deadline, today);
  if (daysRemaining <= 0) return null;
  const perDay = (target - current) / daysRemaining;
  return { perDay, perWeek: perDay * 7 };
}

/** Momentum = 0.6 × consistency + 0.4 × min(observedRate / plannedRate, 1). */
export function momentum(
  consistency: number,
  observedRate: number | null,
  plannedRate: number | null,
): number {
  const c = clamp(consistency, 0, 1);
  let rateTerm = 0;
  if (observedRate !== null && plannedRate !== null && plannedRate !== 0) {
    // Rates may be negative for decreasing goals; compare in the goal's direction.
    rateTerm = clamp(observedRate / plannedRate, 0, 1);
  }
  return 0.6 * c + 0.4 * rateTerm;
}
