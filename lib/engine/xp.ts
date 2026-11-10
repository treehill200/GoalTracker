/**
 * XP, levels and coins.
 * Cumulative XP needed for level n = round(100 × n^1.5). Everyone starts at level 0.
 */

export function xpForLevel(n: number): number {
  if (n <= 0) return 0;
  return Math.round(100 * Math.pow(n, 1.5));
}

export function levelForXp(xp: number): number {
  let n = 0;
  while (xpForLevel(n + 1) <= xp) n++;
  return n;
}

export interface LevelProgress {
  level: number;
  intoLevel: number; // XP earned since the current level started
  needed: number; // XP between current level and next
  fraction: number; // 0–1
  nextLevelAt: number;
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelForXp(xp);
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return {
    level,
    intoLevel: xp - base,
    needed: next - base,
    fraction: (xp - base) / (next - base),
    nextLevelAt: next,
  };
}

/** XP awarded per action. Coins are always half the XP (rounded). */
export const XP_RULES = {
  log: 10,
  checkin: 5,
  taskDefault: 15,
  weeklyTarget: 50,
  milestoneBase: 100,
  weeklyReview: 30,
  goalComplete: 500,
  rescue: 20,
} as const;

export function coinsForXp(xp: number): number {
  return Math.round(xp / 2);
}

/**
 * Milestone XP scales with difficulty: later milestones in a goal are harder,
 * so difficulty ramps linearly from 1× (first) to 2× (last).
 */
export function milestoneXp(index: number, total: number): number {
  const difficulty = total <= 1 ? 1.5 : 1 + index / (total - 1);
  return Math.round(XP_RULES.milestoneBase * difficulty);
}

/** Returns the levels crossed when going from `before` to `after` XP (for celebrations). */
export function levelsGained(before: number, after: number): number[] {
  const a = levelForXp(before);
  const b = levelForXp(after);
  const out: number[] = [];
  for (let l = a + 1; l <= b; l++) out.push(l);
  return out;
}
