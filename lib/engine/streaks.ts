/**
 * Streaks with streak freezes.
 *
 * A day "counts" when it has activity. A frozen day doesn't add to the streak
 * but doesn't break it either. Users earn 1 freeze per 7 days of streak, with
 * at most 2 banked.
 */
import { addDays, diffDays, type DateStr } from "./dates";

export const MAX_FREEZES = 2;
export const FREEZE_EVERY_DAYS = 7;

export interface StreakInfo {
  current: number;
  longest: number;
  /** First active day of the current streak run (null when current = 0). */
  startedOn: DateStr | null;
  lastActive: DateStr | null;
  /** True when today already has activity. */
  activeToday: boolean;
}

export function computeStreak(active: Set<DateStr>, today: DateStr, frozen: Set<DateStr> = new Set()): StreakInfo {
  const activeToday = active.has(today);
  let cursor = activeToday ? today : addDays(today, -1);
  let current = 0;
  let startedOn: DateStr | null = null;
  // Walk backwards while days are active or frozen.
  while (active.has(cursor) || frozen.has(cursor)) {
    if (active.has(cursor)) {
      current += 1;
      startedOn = cursor;
    }
    cursor = addDays(cursor, -1);
  }
  // Longest run across all history.
  const days = [...active].sort();
  let longest = 0;
  let run = 0;
  let prev: DateStr | null = null;
  for (const d of days) {
    if (prev !== null) {
      // Bridge over frozen days between prev and d.
      let bridged = true;
      for (let x = addDays(prev, 1); x < d; x = addDays(x, 1)) {
        if (!frozen.has(x)) {
          bridged = false;
          break;
        }
      }
      run = bridged ? run + 1 : 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    prev = d;
  }
  return {
    current,
    longest: Math.max(longest, current),
    startedOn: current > 0 ? startedOn : null,
    lastActive: days.length ? days[days.length - 1] : null,
    activeToday,
  };
}

/**
 * Decide which missed days (between the last active/frozen day and today,
 * exclusive) should be covered by freezes. Freezes are only spent when they
 * can save the *whole* gap, and only when there is a streak worth saving.
 */
export function freezesNeeded(
  active: Set<DateStr>,
  frozen: Set<DateStr>,
  freezesAvailable: number,
  today: DateStr,
): DateStr[] {
  const yesterday = addDays(today, -1);
  if (active.has(yesterday) || frozen.has(yesterday)) return [];
  // Find the most recent covered day before today.
  const covered = [...active, ...frozen].filter((d) => d < today).sort();
  if (covered.length === 0) return [];
  const last = covered[covered.length - 1];
  const gap = diffDays(today, last) - 1;
  if (gap <= 0 || gap > freezesAvailable) return [];
  // There must be a real streak before the gap.
  const before = computeStreak(active, addDays(last, 1), frozen);
  if (before.current === 0) return [];
  const days: DateStr[] = [];
  for (let i = 1; i <= gap; i++) days.push(addDays(last, i));
  return days;
}

/**
 * Freezes to grant for the current streak run: one per completed 7 days,
 * never more than MAX_FREEZES banked.
 */
export function freezesToAward(
  streak: StreakInfo,
  record: { streakStart: DateStr; awarded: number } | null,
  banked: number,
): { award: number; record: { streakStart: DateStr; awarded: number } | null } {
  if (!streak.startedOn || streak.current === 0) return { award: 0, record };
  const sameRun = record && record.streakStart === streak.startedOn;
  const already = sameRun ? record.awarded : 0;
  const earned = Math.floor(streak.current / FREEZE_EVERY_DAYS);
  const newOnes = Math.max(earned - already, 0);
  const award = Math.max(Math.min(newOnes, MAX_FREEZES - banked), 0);
  return {
    award,
    // Record what was *earned* so a full bank doesn't keep re-granting later.
    record: { streakStart: streak.startedOn, awarded: already + newOnes },
  };
}
