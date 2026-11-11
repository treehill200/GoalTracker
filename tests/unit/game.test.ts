import { describe, expect, it } from "vitest";
import { addDays, dateRange } from "@/lib/engine/dates";
import { computeStreak, freezesNeeded, freezesToAward, MAX_FREEZES } from "@/lib/engine/streaks";
import {
  coinsForXp,
  levelForXp,
  levelProgress,
  levelsGained,
  milestoneXp,
  xpForLevel,
} from "@/lib/engine/xp";
import { averageMood, computeMood } from "@/lib/engine/mood";
import { BADGES, newlyEarnedBadges, type BadgeStats } from "@/lib/engine/badges";

const today = "2026-03-11";

describe("xp & levels", () => {
  it("uses round(100 × n^1.5)", () => {
    expect(xpForLevel(0)).toBe(0);
    expect(xpForLevel(1)).toBe(100);
    expect(xpForLevel(2)).toBe(283);
    expect(xpForLevel(10)).toBe(3162);
  });
  it("finds the level for an XP total", () => {
    expect(levelForXp(0)).toBe(0);
    expect(levelForXp(99)).toBe(0);
    expect(levelForXp(100)).toBe(1);
    expect(levelForXp(282)).toBe(1);
    expect(levelForXp(283)).toBe(2);
  });
  it("reports progress to the next level", () => {
    const p = levelProgress(150);
    expect(p.level).toBe(1);
    expect(p.intoLevel).toBe(50);
    expect(p.needed).toBe(183);
    expect(p.fraction).toBeCloseTo(50 / 183);
  });
  it("lists levels gained", () => {
    expect(levelsGained(90, 300)).toEqual([1, 2]);
    expect(levelsGained(300, 301)).toEqual([]);
  });
  it("scales milestone XP by difficulty and gives half as coins", () => {
    expect(milestoneXp(0, 5)).toBe(100);
    expect(milestoneXp(4, 5)).toBe(200);
    expect(milestoneXp(0, 1)).toBe(150);
    expect(coinsForXp(15)).toBe(8);
  });
});

describe("streaks", () => {
  const days = (n: number, end = today) => new Set(dateRange(addDays(end, -(n - 1)), end));
  it("counts consecutive days ending today or yesterday", () => {
    expect(computeStreak(days(5), today).current).toBe(5);
    expect(computeStreak(days(5, addDays(today, -1)), today).current).toBe(5);
    expect(computeStreak(days(5, addDays(today, -2)), today).current).toBe(0);
  });
  it("bridges frozen days without counting them", () => {
    const active = new Set([...days(3, addDays(today, -2)), today]);
    const s = computeStreak(active, today, new Set([addDays(today, -1)]));
    expect(s.current).toBe(4);
    expect(s.longest).toBe(4);
  });
  it("tracks the longest run", () => {
    const active = new Set([...days(10, addDays(today, -20)), ...days(2)]);
    const s = computeStreak(active, today);
    expect(s.current).toBe(2);
    expect(s.longest).toBe(10);
  });
  it("handles no activity", () => {
    expect(computeStreak(new Set(), today)).toMatchObject({
      current: 0,
      longest: 0,
      lastActive: null,
    });
  });
  it("spends freezes only when they save the whole gap", () => {
    const active = days(6, addDays(today, -2)); // yesterday missed
    expect(freezesNeeded(active, new Set(), 1, today)).toEqual([addDays(today, -1)]);
    const active2 = days(6, addDays(today, -4)); // 3 days missed
    expect(freezesNeeded(active2, new Set(), 2, today)).toEqual([]);
    expect(freezesNeeded(days(3), new Set(), 2, today)).toEqual([]); // nothing missed
  });
  it("awards one freeze per 7 days, max 2 banked, once per run", () => {
    const s = computeStreak(days(14), today);
    const a = freezesToAward(s, null, 0);
    expect(a.award).toBe(2);
    const again = freezesToAward(s, a.record, 2);
    expect(again.award).toBe(0);
    const s21 = computeStreak(days(21), today);
    expect(
      freezesToAward(s21, { streakStart: s21.startedOn!, awarded: 2 }, MAX_FREEZES).award,
    ).toBe(0);
    expect(freezesToAward(s21, { streakStart: s21.startedOn!, awarded: 2 }, 1).award).toBe(1);
    expect(freezesToAward(computeStreak(days(6), today), null, 0).award).toBe(0);
  });
});

describe("mood engine", () => {
  it("is ecstatic when ahead with a long streak", () => {
    expect(
      computeMood({ paceRatio: 1.2, streak: 20, daysSinceLastLog: 0, recentWins: 2 }).mood,
    ).toBe("ecstatic");
  });
  it("is happy when on track", () => {
    expect(computeMood({ paceRatio: 1, streak: 8, daysSinceLastLog: 0, recentWins: 1 }).mood).toBe(
      "happy",
    );
  });
  it("is neutral with no data", () => {
    expect(
      computeMood({ paceRatio: null, streak: 1, daysSinceLastLog: 1, recentWins: 0 }).mood,
    ).toBe("neutral");
  });
  it("is worried when behind", () => {
    expect(
      computeMood({ paceRatio: 0.8, streak: 2, daysSinceLastLog: 1, recentWins: 0 }).mood,
    ).toBe("worried");
  });
  it("is sad when at risk and away", () => {
    expect(
      computeMood({ paceRatio: 0.5, streak: 0, daysSinceLastLog: 5, recentWins: 0 }).mood,
    ).toBe("sad");
  });
  it("is always sad after 7+ days away, even if ahead", () => {
    expect(computeMood({ paceRatio: 2, streak: 0, daysSinceLastLog: 7, recentWins: 3 }).mood).toBe(
      "sad",
    );
  });
  it("is never better than neutral after 3+ days away", () => {
    expect(computeMood({ paceRatio: 2, streak: 30, daysSinceLastLog: 3, recentWins: 3 }).mood).toBe(
      "neutral",
    );
  });
  it("averages moods", () => {
    expect(averageMood(["sad", "ecstatic"])).toBe("neutral");
    expect(averageMood([])).toBe("neutral");
  });
});

describe("badges", () => {
  const zero: BadgeStats = {
    totalLogs: 0,
    totalCheckins: 0,
    totalTasksDone: 0,
    longestStreak: 0,
    milestonesCompleted: 0,
    goalsCompleted: 0,
    activeGoals: 0,
    level: 0,
    reviewsDone: 0,
    rewardsRedeemed: 0,
    anyAheadOfPace: false,
    comeback: false,
    earlyBird: false,
    nightOwl: false,
    perfectWeek: false,
    cheersReceived: 0,
    integrationsConnected: 0,
    aiGoalsCreated: 0,
    rescuesStarted: 0,
  };
  it("has at least 15 unique badges", () => {
    expect(BADGES.length).toBeGreaterThanOrEqual(15);
    expect(new Set(BADGES.map((b) => b.key)).size).toBe(BADGES.length);
  });
  it("awards nothing for a brand-new user", () => {
    expect(newlyEarnedBadges(zero, new Set())).toEqual([]);
  });
  it("awards first log, streaks and comeback", () => {
    const got = newlyEarnedBadges(
      { ...zero, totalLogs: 1, longestStreak: 30, comeback: true },
      new Set(["streak_7"]),
    );
    expect(got).toEqual(expect.arrayContaining(["first_log", "streak_30", "comeback"]));
    expect(got).not.toContain("streak_7");
    expect(got).not.toContain("streak_100");
  });
});

describe("canned coach messages", async () => {
  const { cannedMoodMessage, cannedEventMessage, cannedChatReply } =
    await import("@/lib/coach/canned");
  const { PERSONA_LIST } = await import("@/lib/coach/personas");
  const { MOODS } = await import("@/lib/engine/mood");
  it("has a message for every persona × mood and never leaves placeholders", () => {
    for (const p of PERSONA_LIST)
      for (const m of MOODS)
        for (let seed = 0; seed < 4; seed++) {
          const msg = cannedMoodMessage(p.id, m, { goal: "SAT" }, seed);
          expect(msg).not.toMatch(/\{\w+\}/);
          expect(msg).not.toMatch(/^-day/);
        }
  });
  it("fills event messages and chat replies", () => {
    expect(cannedEventMessage("sarge", "milestone", { milestone: "Score 1300" })).toContain(
      "Score 1300",
    );
    expect(
      cannedChatReply("sage", "worried", "I'm behind, how do I catch up?", { goal: "SAT" }),
    ).toMatch(/1\.5×/);
  });
});
