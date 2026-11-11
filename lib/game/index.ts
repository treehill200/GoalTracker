/**
 * Gamification orchestration: turns events into repository Ops (XP events,
 * profile updates, badges) plus "celebrations" for the UI.
 */
import type { GoalAnalysis } from "@/lib/engine/analyze";
import { badgeByKey, newlyEarnedBadges, type BadgeStats } from "@/lib/engine/badges";
import { addDays, diffDays, timeInZone, weekStart, type DateStr } from "@/lib/engine/dates";
import { countInstances } from "@/lib/engine/recurrence";
import { computeStreak, type StreakInfo } from "@/lib/engine/streaks";
import { coinsForXp, levelForXp, levelsGained } from "@/lib/engine/xp";
import { insertOp, profileOp, type Op } from "@/lib/data/ops";
import { uid } from "@/lib/data/ids";
import type { AppData } from "@/lib/data/types";

export type Celebration =
  | { id: string; type: "level"; level: number }
  | { id: string; type: "badge"; badgeKey: string }
  | { id: string; type: "milestone"; title: string; goalTitle: string; xp: number }
  | { id: string; type: "goal"; goalId: string; title: string }
  | { id: string; type: "xp"; amount: number; coins: number; reason: string };

export interface Effects {
  ops: Op[];
  celebrations: Celebration[];
}

export const emptyEffects = (): Effects => ({ ops: [], celebrations: [] });

/**
 * Award XP (and coins = XP/2). Works on a running profile copy so several
 * awards in one action stack correctly.
 */
export function awardXp(data: AppData, amount: number, reason: string, refId: string | null = null, coinsOverride?: number): Effects & { data: AppData } {
  const coins = coinsOverride ?? (amount > 0 ? coinsForXp(amount) : -coinsForXp(-amount));
  const before = data.profile.xp;
  const xp = Math.max(0, before + amount);
  const level = levelForXp(xp);
  const newCoins = Math.max(0, data.profile.coins + coins);
  const event = { id: uid(), userId: data.profile.id, amount, coins, reason, refId, createdAt: new Date().toISOString() };
  const ops = [insertOp("xp_events", event), profileOp({ xp, level, coins: newCoins })];
  const celebrations: Celebration[] = levelsGained(before, xp).map((l) => ({ id: uid(), type: "level" as const, level: l }));
  if (amount > 0) celebrations.unshift({ id: uid(), type: "xp", amount, coins, reason });
  return {
    ops,
    celebrations,
    data: { ...data, profile: { ...data.profile, xp, level, coins: newCoins }, xpEvents: [...data.xpEvents, event] },
  };
}

/** All activity dates (entries, task completions, check-ins) across goals. */
export function activityDates(data: AppData): Set<DateStr> {
  return new Set([...data.entries.map((e) => e.date), ...data.completions.map((c) => c.date), ...data.checkins.map((c) => c.date)]);
}

export function overallStreak(data: AppData, today: DateStr): StreakInfo {
  return computeStreak(activityDates(data), today, new Set(data.profile.settings.frozenDays));
}

function hourIn(iso: string, tz: string) {
  return Number(timeInZone(tz, new Date(iso)).slice(0, 2));
}

export function badgeStats(data: AppData, analyses: Map<string, GoalAnalysis>, today: DateStr): BadgeStats {
  const tz = data.profile.timezone;
  const days = [...activityDates(data)].sort();
  let comeback = false;
  for (let i = 1; i < days.length; i++) if (diffDays(days[i], days[i - 1]) >= 8) comeback = true;
  const userLogs = data.entries.filter((e) => e.source !== "seed");
  // Perfect week: any of the last 8 full weeks with every scheduled task done (≥5 scheduled).
  let perfectWeek = false;
  for (let w = 1; w <= 8 && !perfectWeek; w++) {
    const ws = addDays(weekStart(today), -7 * w);
    const we = addDays(ws, 6);
    let scheduled = 0;
    let completed = 0;
    for (const t of data.tasks.filter((x) => x.active)) {
      const done = new Set(data.completions.filter((c) => c.taskId === t.id).map((c) => c.date));
      const r = countInstances(t.recurrence, done, ws, we, today);
      scheduled += r.scheduled;
      completed += r.completed;
    }
    if (scheduled >= 5 && completed >= scheduled - 1e-9) perfectWeek = true;
  }
  return {
    totalLogs: data.entries.length,
    totalCheckins: data.checkins.length,
    totalTasksDone: data.completions.length,
    longestStreak: overallStreak(data, today).longest,
    milestonesCompleted: data.milestones.filter((m) => m.completedAt).length,
    goalsCompleted: data.goals.filter((g) => g.status === "completed").length,
    activeGoals: data.goals.filter((g) => g.status === "active").length,
    level: levelForXp(data.profile.xp),
    reviewsDone: data.reviews.length,
    rewardsRedeemed: data.redemptions.length,
    anyAheadOfPace: [...analyses.values()].some((a) => a.status === "ahead" && !a.completed),
    comeback,
    earlyBird: userLogs.some((e) => hourIn(e.recordedAt, tz) < 7),
    nightOwl: userLogs.some((e) => hourIn(e.recordedAt, tz) >= 22),
    perfectWeek,
    cheersReceived: data.cheers.length,
    integrationsConnected: data.integrations.filter((i) => i.connected).length,
    aiGoalsCreated: data.goals.filter((g) => g.createdVia === "ai").length,
    rescuesStarted: data.adjustments.filter((a) => a.kind === "rescue").length,
  };
}

/** New badges → user_badges rows, a notification each, and a celebration. */
export function checkBadges(data: AppData, analyses: Map<string, GoalAnalysis>, today: DateStr): Effects {
  const owned = new Set(data.userBadges.map((b) => b.badgeKey));
  const keys = newlyEarnedBadges(badgeStats(data, analyses, today), owned);
  const now = new Date().toISOString();
  const ops: Op[] = [];
  const celebrations: Celebration[] = [];
  for (const key of keys) {
    const def = badgeByKey(key)!;
    ops.push(insertOp("user_badges", { id: uid(), userId: data.profile.id, badgeKey: key, earnedAt: now }));
    ops.push(
      insertOp("notifications", {
        id: uid(),
        userId: data.profile.id,
        kind: "badge",
        title: `Badge unlocked: ${def.name}`,
        body: def.description,
        goalId: null,
        href: "/rewards",
        read: false,
        dedupeKey: `badge-${key}`,
        createdAt: now,
      }),
    );
    celebrations.push({ id: uid(), type: "badge", badgeKey: key });
  }
  return { ops, celebrations };
}
