/**
 * Starting drafts for each creation method, and converters between the
 * AI breakdown / stored goals and the editor's draft format.
 */
import type { AiBreakdown, GoalDraftInput } from "@/lib/data/schemas";
import type { GoalBundle } from "@/lib/data/types";
import { addDays } from "@/lib/engine/dates";

export type Method = "ai" | "single_metric" | "milestones" | "weighted" | "manual";

export function blankDraft(method: Method, today: string): GoalDraftInput {
  const base: GoalDraftInput = {
    title: "",
    description: "",
    category: "General",
    createdVia: method,
    startDate: today,
    deadline: addDays(today, 90),
    isOpenEnded: false,
    suggestedDeadline: null,
    plannedWeeklyEffort: 4,
    expectedCurve: "linear",
    milestoneWeight: 0,
    taskWeight: 0,
    reminderTime: null,
    color: null,
    metrics: [],
    milestones: [],
    tasks: [],
  };
  switch (method) {
    case "single_metric":
      return { ...base, metrics: [{ name: "", unit: "", baseline: 0, target: 100, weight: 1, aggregation: "latest", weeklyTarget: null, isKey: true }] };
    case "milestones":
      return {
        ...base,
        milestoneWeight: 1,
        milestones: [1, 2, 3].map((n) => ({ title: "", targetDate: addDays(today, n * 30), weight: 1, metricIndex: null, thresholdValue: null })),
      };
    case "weighted":
      return {
        ...base,
        metrics: [
          { name: "", unit: "", baseline: 0, target: 100, weight: 0.6, aggregation: "latest", weeklyTarget: null, isKey: true },
          { name: "", unit: "sessions", baseline: 0, target: 3, weight: 0.4, aggregation: "weekly_sum", weeklyTarget: null, isKey: false },
        ],
      };
    default:
      return base;
  }
}

export function draftFromAi(plan: AiBreakdown, today: string): GoalDraftInput {
  const keyIndex = Math.max(0, plan.metrics.findIndex((m) => m.isKey));
  return {
    title: plan.title,
    description: plan.summary,
    category: plan.category,
    createdVia: "ai",
    startDate: today,
    deadline: plan.suggestedDeadline ?? addDays(today, 90),
    isOpenEnded: false,
    suggestedDeadline: plan.suggestedDeadline,
    plannedWeeklyEffort: plan.plannedWeeklyEffort,
    expectedCurve: "linear",
    milestoneWeight: plan.milestones.length ? plan.milestoneWeight : 0,
    taskWeight: 0,
    reminderTime: null,
    color: null,
    metrics: plan.metrics.map((m, i) => ({ ...m, isKey: i === keyIndex && m.aggregation !== "weekly_sum" })),
    milestones: plan.milestones.map((m) => ({
      title: m.title,
      targetDate: addDays(today, Math.round(m.weeksFromStart * 7)),
      weight: 1,
      metricIndex: m.thresholdValue !== null ? keyIndex : null,
      thresholdValue: m.thresholdValue,
    })),
    tasks: plan.tasks.map((t) => ({
      title: t.title,
      xpValue: t.xpValue,
      recurrence:
        t.frequency === "daily"
          ? { type: "daily" as const }
          : t.frequency === "weekdays" && t.weekdays?.length
            ? { type: "weekdays" as const, days: t.weekdays }
            : { type: "times_per_week" as const, times: t.timesPerWeek ?? 3 },
    })),
  };
}

export function draftFromBundle(b: GoalBundle): GoalDraftInput {
  const metricIndex = new Map(b.metrics.map((m, i) => [m.id, i]));
  return {
    title: b.goal.title,
    description: b.goal.description,
    category: b.goal.category,
    createdVia: b.goal.createdVia,
    startDate: b.goal.startDate,
    deadline: b.goal.deadline,
    isOpenEnded: b.goal.isOpenEnded,
    suggestedDeadline: b.goal.suggestedDeadline,
    plannedWeeklyEffort: b.goal.plannedWeeklyEffort,
    expectedCurve: b.goal.expectedCurve,
    milestoneWeight: b.goal.milestoneWeight,
    taskWeight: b.goal.taskWeight,
    reminderTime: b.goal.reminderTime,
    color: b.goal.color,
    metrics: b.metrics.map((m) => ({ id: m.id, name: m.name, unit: m.unit, baseline: m.baseline, target: m.target, weight: m.weight, aggregation: m.aggregation, weeklyTarget: m.weeklyTarget, isKey: m.isKey })),
    milestones: b.milestones.map((m) => ({ id: m.id, completedAt: m.completedAt, title: m.title, targetDate: m.targetDate, weight: m.weight, metricIndex: m.metricId ? (metricIndex.get(m.metricId) ?? null) : null, thresholdValue: m.thresholdValue })),
    tasks: b.tasks.filter((t) => t.active).map((t) => ({ id: t.id, title: t.title, recurrence: t.recurrence, xpValue: t.xpValue })),
  };
}
