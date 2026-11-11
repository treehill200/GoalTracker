/**
 * Compact JSON summary of the user's goals, passed to the AI as context.
 * Keeps prompts small: numbers are rounded and history is summarised.
 */
import type { GoalAnalysis } from "@/lib/engine/analyze";
import type { AppData } from "@/lib/data/types";

const r = (x: number | null | undefined, d = 1) =>
  x === null || x === undefined || !Number.isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d;

export function buildCoachContext(
  data: AppData,
  analyses: Map<string, GoalAnalysis>,
  today: string,
) {
  const recentMoods = data.checkins
    .filter((c) => c.date > today.slice(0, 8) + "00")
    .map((c) => c.mood);
  return {
    today,
    user: {
      name: data.profile.displayName,
      level: data.profile.level,
      xp: data.profile.xp,
      coins: data.profile.coins,
      streakFreezes: data.profile.streakFreezes,
      avgMoodThisMonth: recentMoods.length
        ? r(recentMoods.reduce((a, b) => a + b, 0) / recentMoods.length)
        : null,
    },
    goals: data.goals
      .filter((g) => g.status === "active" || g.status === "paused")
      .map((g) => {
        const a = analyses.get(g.id);
        return {
          id: g.id,
          title: g.title,
          status: g.status,
          pace: a?.status,
          score: r(a?.score, 0),
          expectedScore: r(a?.expectedScore, 0),
          deadline: g.deadline,
          openEnded: g.isOpenEnded,
          softDeadline: a?.softDeadline,
          projectedFinish: a?.projection.date ?? "not converging",
          daysAheadBehind: a?.daysAheadBehind,
          momentum: r(a?.momentum, 2),
          consistency: r(a?.consistency, 2),
          streak: a?.streak.current,
          daysSinceLastLog: a?.daysSinceLastLog,
          metrics: a?.metrics.map((m) => ({
            id: m.metric.id,
            name: m.metric.name,
            unit: m.metric.unit,
            kind: m.metric.aggregation,
            baseline: m.metric.baseline,
            target: m.metric.target,
            current: r(m.current, 2),
            requiredPerWeek: r(m.required?.perWeek, 2),
            observedPerWeek: r(m.observedPerWeek, 2),
            weeklyTarget: r(m.plannedPerWeek, 2),
          })),
          nextMilestone:
            a?.milestones.find((m) => m.state === "next" || m.state === "overdue")?.milestone
              .title ?? null,
          tasksDueToday: a?.todayTasks
            .filter((t) => t.due && !t.doneToday)
            .map((t) => t.task.title),
        };
      }),
  };
}

export type CoachContext = ReturnType<typeof buildCoachContext>;
