/**
 * Auto-adjusting targets (section 4.3).
 *
 * When a goal is Behind or At risk, spread the remaining gap over the remaining
 * weeks. Increases are capped at 1.5× the original weekly target. If the deadline
 * would need more than that, we don't silently raise targets: the user chooses
 * between pushing the deadline and committing to the higher pace.
 */
import { addDays, diffDays, type DateStr } from "./dates";

export const ADJUST_CAP = 1.5;

export type AdjustResult =
  | { kind: "none"; reason: string }
  | {
      kind: "adjusted";
      originalWeekly: number;
      previousWeekly: number;
      newWeekly: number;
      remainingWeeks: number;
    }
  | {
      kind: "choice";
      originalWeekly: number;
      requiredWeekly: number;
      capWeekly: number;
      /** Deadline that keeps the pace at the 1.5× cap. */
      pushDeadlineTo: DateStr;
      remainingWeeks: number;
    };

export interface AdjustInput {
  baseline: number;
  target: number;
  current: number;
  startDate: DateStr;
  deadline: DateStr;
  today: DateStr;
  /** Current planned weekly change (may already be adjusted). Null → derived from the plan. */
  currentWeekly: number | null;
  /** Weekly target the plan started with. Null → (T − B) / total weeks. */
  originalWeekly: number | null;
}

export function originalWeeklyTarget(
  baseline: number,
  target: number,
  startDate: DateStr,
  deadline: DateStr,
): number {
  const weeks = Math.max(diffDays(deadline, startDate) / 7, 1 / 7);
  return (target - baseline) / weeks;
}

export function computeAdjustment(input: AdjustInput): AdjustResult {
  const { baseline, target, current, today, deadline } = input;
  const dir = Math.sign(target - baseline);
  if (dir === 0) return { kind: "none", reason: "Target equals baseline." };
  const gap = target - current;
  if (Math.sign(gap) !== dir || gap === 0)
    return { kind: "none", reason: "Target already reached." };
  const daysLeft = diffDays(deadline, today);
  const original =
    input.originalWeekly ?? originalWeeklyTarget(baseline, target, input.startDate, deadline);
  const previous = input.currentWeekly ?? original;
  const capWeekly = original * ADJUST_CAP;
  if (daysLeft <= 0) {
    // Deadline passed: the only sensible options are a new deadline or a big push.
    return {
      kind: "choice",
      originalWeekly: original,
      requiredWeekly: gap, // the whole gap "this week"
      capWeekly,
      pushDeadlineTo: addDays(today, Math.ceil((gap / capWeekly) * 7)),
      remainingWeeks: 0,
    };
  }
  const remainingWeeks = daysLeft / 7;
  const required = gap / remainingWeeks;
  if (Math.abs(required) <= Math.abs(capWeekly) + 1e-9) {
    return {
      kind: "adjusted",
      originalWeekly: original,
      previousWeekly: previous,
      newWeekly: required,
      remainingWeeks,
    };
  }
  return {
    kind: "choice",
    originalWeekly: original,
    requiredWeekly: required,
    capWeekly,
    pushDeadlineTo: addDays(today, Math.ceil((gap / capWeekly) * 7)),
    remainingWeeks,
  };
}

/** Only re-adjust when the new target differs meaningfully (>2%) from the current one. */
export function isMeaningfulChange(previous: number, next: number): boolean {
  if (previous === 0) return next !== 0;
  return Math.abs(next - previous) / Math.abs(previous) > 0.02;
}
