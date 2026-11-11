/** Auto-generated weekly stats, wins/misses and a rule-based suggestion. */
import type { GoalAnalysis } from "@/lib/engine/analyze";
import { addDays, type DateStr } from "@/lib/engine/dates";
import { countInstances } from "@/lib/engine/recurrence";
import type { AppData, WeeklyReviewStats } from "@/lib/data/types";

export function weeklyStats(data: AppData, analyses: Map<string, GoalAnalysis>, weekStart: DateStr, today: DateStr): WeeklyReviewStats {
  const end = addDays(weekStart, 6);
  const inWeek = (d: string) => d >= weekStart && d <= end;
  let scheduled = 0;
  let done = 0;
  for (const t of data.tasks.filter((x) => x.active)) {
    const dates = new Set(data.completions.filter((c) => c.taskId === t.id).map((c) => c.date));
    const r = countInstances(t.recurrence, dates, weekStart, end < today ? end : today, today);
    scheduled += r.scheduled;
    done += r.completed;
  }
  return {
    weekStart,
    logs: data.entries.filter((e) => inWeek(e.date)).length,
    tasksDone: Math.round(done),
    tasksScheduled: Math.round(scheduled),
    xpEarned: data.xpEvents.filter((e) => inWeek(e.createdAt.slice(0, 10)) && e.amount > 0).reduce((a, e) => a + e.amount, 0),
    goals: data.goals
      .filter((g) => g.status === "active")
      .map((g) => {
        const a = analyses.get(g.id);
        const before = a?.history.find((h) => h.date === addDays(weekStart, -1))?.actual ?? a?.history[0]?.actual ?? 0;
        return { goalId: g.id, title: g.title, score: Math.round(a?.score ?? 0), scoreChange: Math.round((a?.score ?? 0) - before), status: a?.status ?? "on_track" };
      }),
  };
}

export function suggestWinsMisses(data: AppData, analyses: Map<string, GoalAnalysis>, stats: WeeklyReviewStats) {
  const end = addDays(stats.weekStart, 6);
  const wins: string[] = [];
  const misses: string[] = [];
  for (const m of data.milestones) if (m.completedAt && m.completedAt.slice(0, 10) >= stats.weekStart && m.completedAt.slice(0, 10) <= end) wins.push(`Milestone: ${m.title}`);
  for (const a of analyses.values()) for (const m of a.metrics) if (m.thisWeek.hit) wins.push(`Hit weekly target: ${m.metric.name}`);
  for (const g of stats.goals) {
    if (g.scoreChange > 0) wins.push(`${g.title}: score +${g.scoreChange}`);
    if (g.status === "behind" || g.status === "at_risk") misses.push(`${g.title} is ${g.status === "behind" ? "behind" : "at risk"}`);
  }
  if (stats.tasksScheduled > 0 && stats.tasksDone < stats.tasksScheduled) misses.push(`${stats.tasksScheduled - stats.tasksDone} scheduled task${stats.tasksScheduled - stats.tasksDone === 1 ? "" : "s"} missed`);
  return { wins: [...new Set(wins)].slice(0, 6), misses: [...new Set(misses)].slice(0, 6) };
}

export function ruleSuggestion(stats: WeeklyReviewStats, analyses: Map<string, GoalAnalysis>): string {
  const behind = stats.goals.find((g) => g.status === "at_risk") ?? stats.goals.find((g) => g.status === "behind");
  const rate = stats.tasksScheduled ? stats.tasksDone / stats.tasksScheduled : 1;
  if (behind) {
    const a = analyses.get(behind.goalId);
    const task = a?.todayTasks[0]?.task.title;
    return `“${behind.title}” is ${behind.status === "at_risk" ? "at risk" : "behind pace"}. Next week, add one extra ${task ? `“${task}” session` : "focused session"} on a fixed day, and check the dashboard's plan adjustment.`;
  }
  if (rate < 0.7) return `You completed ${Math.round(rate * 100)}% of scheduled tasks. Make next week easier to win: trim one recurring task or lower its frequency, then aim for 100%.`;
  return "Strong week! Keep the same plan and protect your streak — consider raising one weekly target by 10%.";
}
