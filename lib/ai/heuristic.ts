/**
 * Rule-based stand-in for the AI goal breakdown, used when no AI key is set.
 * Pulls numbers out of the goal text and builds a sensible plan.
 */
import type { AiBreakdown, AiQuestions } from "@/lib/data/schemas";
import { addDays, todayInZone } from "@/lib/engine/dates";
import { suggestDeadline } from "@/lib/engine/suggest";

export function heuristicQuestions(goal: string): AiQuestions {
  const g = goal.toLowerCase();
  const unitHint = /sat\b/.test(g)
    ? "e.g. 1180"
    : /lb|pound|kg|weight|muscle/.test(g)
      ? "e.g. 150 lb"
      : /\$|save|saving/.test(g)
        ? "e.g. $500 saved"
        : "e.g. 20%";
  return {
    questions: [
      {
        id: "current",
        question: "Where are you today? (current level or number)",
        placeholder: unitHint,
      },
      { id: "hours", question: "How many hours per week can you put in?", placeholder: "e.g. 5" },
      {
        id: "deadline",
        question: "Is there a deadline? (date, or leave blank)",
        placeholder: "e.g. 2027-06-01",
      },
    ],
  };
}

const num = (s: string | undefined) => {
  const m = s?.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};

export function heuristicBreakdown(
  goal: string,
  answers: Record<string, string>,
  today = todayInZone(),
): AiBreakdown {
  const g = goal.toLowerCase();
  const hours = num(answers.hours) ?? 4;
  const current = num(answers.current);
  const deadlineAnswer = answers.deadline?.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
  const goalNumber = num(goal.replace(/\d+\s*(x|times)\b/i, ""));

  let metric: AiBreakdown["metrics"][number];
  let category = "General";
  if (/\bsat\b/.test(g)) {
    category = "Education";
    metric = {
      name: "Practice test score",
      unit: "points",
      baseline: current ?? 1100,
      target: goalNumber ?? 1400,
      weight: 0.5,
      aggregation: "latest",
      weeklyTarget: null,
      isKey: true,
    };
  } else if (/\b(lb|lbs|pound|kg)\b/.test(g) || /muscle|weight/.test(g)) {
    category = "Fitness";
    const unit = /\bkg\b/.test(g) ? "kg" : "lb";
    const start = current ?? (unit === "kg" ? 70 : 150);
    const delta = goalNumber ?? 10;
    const losing = /lose|drop|cut/.test(g);
    metric = {
      name: "Body weight",
      unit,
      baseline: start,
      target: losing ? start - delta : start + delta,
      weight: 0.5,
      aggregation: "latest",
      weeklyTarget: losing ? -1 : 0.5,
      isKey: true,
    };
  } else if (/\$|save|saving|money/.test(g)) {
    category = "Finance";
    metric = {
      name: "Savings",
      unit: "$",
      baseline: current ?? 0,
      target: goalNumber ?? 5000,
      weight: 0.6,
      aggregation: "sum_total",
      weeklyTarget: null,
      isKey: true,
    };
  } else if (/\b(run|km|mile|marathon)\b/.test(g)) {
    category = "Fitness";
    metric = {
      name: "Distance run",
      unit: /km/.test(g) ? "km" : "miles",
      baseline: 0,
      target: goalNumber ?? 100,
      weight: 0.5,
      aggregation: "sum_total",
      weeklyTarget: null,
      isKey: true,
    };
  } else if (/\bbooks?\b|read/.test(g)) {
    category = "Learning";
    metric = {
      name: "Books read",
      unit: "books",
      baseline: 0,
      target: goalNumber ?? 12,
      weight: 0.5,
      aggregation: "sum_total",
      weeklyTarget: null,
      isKey: true,
    };
  } else {
    metric = {
      name: "Progress",
      unit: "%",
      baseline: current ?? 0,
      target: 100,
      weight: 0.5,
      aggregation: "latest",
      weeklyTarget: null,
      isKey: true,
    };
  }

  const suggested =
    deadlineAnswer ??
    suggestDeadline({
      startDate: today,
      baseline: metric.baseline,
      target: metric.target,
      unit: metric.unit,
      weeklyTarget: metric.weeklyTarget,
      plannedWeeklyEffort: hours,
    }).date;
  const weeks = Math.max(
    Math.round((Date.parse(suggested) - Date.parse(today)) / (7 * 86_400_000)),
    1,
  );
  const gap = metric.target - metric.baseline;
  const sessions = Math.min(Math.max(Math.round(hours), 2), 7);
  return {
    title: goal.trim().slice(0, 200),
    summary: `A ${weeks}-week plan: move ${metric.name.toLowerCase()} from ${metric.baseline} to ${metric.target} ${metric.unit} with ${hours} hours of focused work per week.`,
    category,
    suggestedDeadline: suggested,
    plannedWeeklyEffort: hours,
    metrics: [
      metric,
      {
        name: "Focused hours",
        unit: "hours",
        baseline: 0,
        target: hours,
        weight: 0.2,
        aggregation: "weekly_sum",
        weeklyTarget: null,
        isKey: false,
      },
    ],
    milestones: [0.25, 0.5, 0.75, 1].map((f) => ({
      title: `${metric.name}: ${Math.round((metric.baseline + gap * f) * 10) / 10} ${metric.unit}`,
      weeksFromStart: Math.round(weeks * f),
      thresholdValue: Math.round((metric.baseline + gap * f) * 10) / 10,
    })),
    milestoneWeight: 0.3,
    tasks: [
      {
        title: `Work session: ${goal.trim().slice(0, 60)}`,
        frequency: "times_per_week",
        timesPerWeek: sessions,
        weekdays: null,
        xpValue: 20,
      },
      {
        title: `Log ${metric.name.toLowerCase()}`,
        frequency: "times_per_week",
        timesPerWeek: 2,
        weekdays: null,
        xpValue: 10,
      },
    ],
    realismNote: null,
  };
}

export function addWeeks(date: string, w: number) {
  return addDays(date, Math.round(w * 7));
}
