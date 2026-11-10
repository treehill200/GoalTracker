/**
 * analyzeGoal(): turns one goal's raw data into everything the dashboard shows.
 * Pure: same input → same output. `today` is always passed in.
 */
import type { GoalBundle, Metric, MetricEntry, Milestone, Task } from "@/lib/data/types";
import { addDays, clamp, dateRange, diffDays, maxDate, minDate, weekStart, type DateStr } from "./dates";
import { daysSince, driftLevel, type DriftLevel } from "./drift";
import { computeMood, type MoodResult } from "./mood";
import {
  expectedProgress,
  metricProgress,
  momentum as momentumFormula,
  paceRatio as paceRatioFormula,
  requiredRate,
  statusFromMomentum,
  statusFromPace,
  type PaceStatus,
} from "./progress";
import {
  hasReached,
  observedRateLevel,
  observedRateSum,
  projectCompletion,
  type Point,
  type Projection,
  type RateEstimate,
} from "./rates";
import { dueToday } from "./recurrence";
import { expectedMilestones, goalScore, logDayConsistency, milestoneComponent, taskComponent, weightedMean } from "./score";
import { computeStreak, type StreakInfo } from "./streaks";

export interface MetricAnalysis {
  metric: Metric;
  current: number;
  progress: number;
  expected: number;
  paceRatio: number;
  status: PaceStatus;
  required: { perDay: number; perWeek: number } | null;
  observed: RateEstimate | null;
  observedPerWeek: number | null;
  plannedPerWeek: number | null;
  projection: Projection | null;
  /** Values over time in metric units (cumulative for sum_total, weekly totals for weekly_sum). */
  series: Point[];
  lastEntryDate: DateStr | null;
  thisWeek: { value: number; target: number | null; hit: boolean };
  reached: boolean;
}

export interface ComponentAnalysis {
  kind: "metric" | "milestones" | "tasks";
  id: string;
  label: string;
  weight: number;
  progress: number;
  expected: number;
}

export type MilestoneState = "completed" | "next" | "upcoming" | "overdue";

export interface TodayTask {
  task: Task;
  due: boolean;
  doneToday: boolean;
  remainingThisWeek: number | null;
}

export interface GoalAnalysis {
  goalId: string;
  score: number; // 0–100
  expectedScore: number; // 0–100
  paceRatio: number;
  status: PaceStatus;
  statusBasis: "pace" | "momentum";
  completed: boolean;
  isOpenEnded: boolean;
  effectiveDeadline: DateStr;
  softDeadline: DateStr | null;
  daysRemaining: number;
  momentum: number | null;
  consistency: number;
  components: ComponentAnalysis[];
  metrics: MetricAnalysis[];
  keyMetricId: string | null;
  projection: Projection;
  /** Positive = projected to finish this many days before the (soft) deadline. */
  daysAheadBehind: number | null;
  streak: StreakInfo;
  lastLogDate: DateStr | null;
  daysSinceLastLog: number;
  drift: DriftLevel;
  history: { date: DateStr; actual: number; expected: number }[];
  heatmap: { date: DateStr; count: number }[];
  weeklyEffort: { weekStart: DateStr; tasks: number; logs: number }[];
  todayTasks: TodayTask[];
  milestones: { milestone: Milestone; state: MilestoneState }[];
  recentWins: number;
  nextAction: string;
  mood: MoodResult;
}

export interface AnalyzeOptions {
  today: DateStr;
  frozenDays?: DateStr[];
  /** Extra wins from outside the goal (badges, weekly targets) in the last 7 days. */
  extraWins?: number;
  /** Skip the per-day history (faster, for list views). */
  skipHistory?: boolean;
}

const DEFAULT_PLAN_WEEKS = 12;

function entriesUpTo(entries: MetricEntry[], metricId: string, asOf: DateStr): MetricEntry[] {
  return entries
    .filter((e) => e.metricId === metricId && e.date <= asOf)
    .sort((a, b) => (a.date === b.date ? a.recordedAt.localeCompare(b.recordedAt) : a.date < b.date ? -1 : 1));
}

/** Current value of a metric as of a date, based on its aggregation. */
export function currentValue(metric: Metric, entries: MetricEntry[], asOf: DateStr, goalStart: DateStr): number {
  const es = entriesUpTo(entries, metric.id, asOf);
  switch (metric.aggregation) {
    case "latest":
      return es.length ? es[es.length - 1].value : metric.baseline;
    case "sum_total":
      return metric.baseline + es.reduce((a, e) => a + e.value, 0);
    case "weekly_sum": {
      // Rolling 28-day total expressed per week (shorter if the goal is younger).
      const windowDays = clamp(diffDays(asOf, goalStart) + 1, 1, 28);
      const from = addDays(asOf, -(windowDays - 1));
      const total = es.filter((e) => e.date >= from).reduce((a, e) => a + e.value, 0);
      return total / Math.max(windowDays / 7, 1);
    }
  }
}

/** The key metric drives projections: flagged isKey, else the heaviest non-weekly metric. */
export function keyMetric(metrics: Metric[]): Metric | null {
  const flagged = metrics.find((m) => m.isKey && m.aggregation !== "weekly_sum");
  if (flagged) return flagged;
  const candidates = metrics.filter((m) => m.aggregation !== "weekly_sum").sort((a, b) => b.weight - a.weight);
  return candidates[0] ?? null;
}

/**
 * Soft deadline for open-ended goals: start + gap / planned weekly pace.
 * Falls back to the suggested deadline, then to a 12-week default.
 */
export function softDeadlineFor(bundle: GoalBundle): DateStr {
  const { goal } = bundle;
  const key = keyMetric(bundle.metrics);
  if (key && key.weeklyTarget && key.weeklyTarget !== 0) {
    const weeks = Math.abs((key.target - key.baseline) / key.weeklyTarget);
    if (Number.isFinite(weeks) && weeks > 0) return addDays(goal.startDate, Math.ceil(weeks * 7));
  }
  return goal.suggestedDeadline ?? addDays(goal.startDate, DEFAULT_PLAN_WEEKS * 7);
}

export function effectiveDeadlineFor(bundle: GoalBundle): { deadline: DateStr; soft: DateStr | null } {
  if (bundle.goal.deadline && !bundle.goal.isOpenEnded) return { deadline: bundle.goal.deadline, soft: null };
  const soft = softDeadlineFor(bundle);
  return { deadline: soft, soft };
}

function metricExpected(metric: Metric, start: DateStr, deadline: DateStr, asOf: DateStr, curve: GoalBundle["goal"]["expectedCurve"]) {
  // Weekly habits are expected to be on target every week.
  if (metric.aggregation === "weekly_sum") return asOf >= start ? 1 : 0;
  return expectedProgress(start, deadline, asOf, curve);
}

function metricProgressFor(metric: Metric, current: number): number {
  if (metric.aggregation === "weekly_sum") {
    return metric.target === 0 ? 1 : clamp(current / metric.target, 0, 1);
  }
  return metricProgress(metric.baseline, metric.target, current);
}

/** Score components as of one date (used for today and for the history line). */
function componentsAt(bundle: GoalBundle, asOf: DateStr, deadline: DateStr): ComponentAnalysis[] {
  const { goal } = bundle;
  const out: ComponentAnalysis[] = [];
  const timeExpected = expectedProgress(goal.startDate, deadline, asOf, goal.expectedCurve);
  for (const m of bundle.metrics) {
    const c = currentValue(m, bundle.entries, asOf, goal.startDate);
    out.push({
      kind: "metric",
      id: m.id,
      label: m.name,
      weight: m.weight,
      progress: metricProgressFor(m, c),
      expected: metricExpected(m, goal.startDate, deadline, asOf, goal.expectedCurve),
    });
  }
  const ms = milestoneComponent(bundle.milestones, asOf);
  if (ms !== null && goal.milestoneWeight > 0) {
    out.push({
      kind: "milestones",
      id: "milestones",
      label: "Milestones",
      weight: goal.milestoneWeight,
      progress: ms,
      expected: expectedMilestones(bundle.milestones, asOf, timeExpected) ?? timeExpected,
    });
  }
  if (goal.taskWeight > 0 && bundle.tasks.length > 0) {
    out.push({
      kind: "tasks",
      id: "tasks",
      label: "Tasks",
      weight: goal.taskWeight,
      progress: taskComponent(bundle.tasks, bundle.completions, asOf, goal.startDate) ?? 0,
      expected: 1,
    });
  }
  return out;
}

function metricSeries(metric: Metric, entries: MetricEntry[], start: DateStr, today: DateStr): Point[] {
  const es = entriesUpTo(entries, metric.id, today);
  if (metric.aggregation === "latest") {
    return [{ date: start, value: metric.baseline }, ...es.map((e) => ({ date: e.date, value: e.value }))].filter(
      (p, i, arr) => i === 0 || p.date >= arr[0].date,
    );
  }
  if (metric.aggregation === "sum_total") {
    const out: Point[] = [{ date: start, value: metric.baseline }];
    let total = metric.baseline;
    for (const e of es) {
      total += e.value;
      out.push({ date: e.date, value: total });
    }
    return out;
  }
  // weekly_sum: totals per calendar week
  const weeks = new Map<string, number>();
  for (let ws = weekStart(start); ws <= today; ws = addDays(ws, 7)) weeks.set(ws, 0);
  for (const e of es) {
    const ws = weekStart(e.date);
    weeks.set(ws, (weeks.get(ws) ?? 0) + e.value);
  }
  return [...weeks.entries()].map(([date, value]) => ({ date, value }));
}

function thisWeekFor(metric: Metric, entries: MetricEntry[], today: DateStr, plannedPerWeek: number | null) {
  const ws = weekStart(today);
  const es = entriesUpTo(entries, metric.id, today);
  if (metric.aggregation === "weekly_sum") {
    const value = es.filter((e) => e.date >= ws).reduce((a, e) => a + e.value, 0);
    return { value, target: metric.target, hit: value >= metric.target };
  }
  if (metric.aggregation === "sum_total") {
    const value = es.filter((e) => e.date >= ws).reduce((a, e) => a + e.value, 0);
    return { value, target: plannedPerWeek, hit: plannedPerWeek !== null && Math.abs(value) >= Math.abs(plannedPerWeek) && Math.sign(value) === Math.sign(plannedPerWeek) };
  }
  const before = es.filter((e) => e.date < ws);
  const startValue = before.length ? before[before.length - 1].value : metric.baseline;
  const inWeek = es.filter((e) => e.date >= ws);
  const value = inWeek.length ? inWeek[inWeek.length - 1].value - startValue : 0;
  return {
    value,
    target: plannedPerWeek,
    hit: plannedPerWeek !== null && inWeek.length > 0 && value * Math.sign(plannedPerWeek) >= Math.abs(plannedPerWeek),
  };
}

export function analyzeMetric(bundle: GoalBundle, metric: Metric, today: DateStr, deadline: DateStr): MetricAnalysis {
  const { goal } = bundle;
  const current = currentValue(metric, bundle.entries, today, goal.startDate);
  const progress = metricProgressFor(metric, current);
  const expected = metricExpected(metric, goal.startDate, deadline, today, goal.expectedCurve);
  const pr = paceRatioFormula(progress, expected);
  const es = entriesUpTo(bundle.entries, metric.id, today);
  const points = es.map((e) => ({ date: e.date, value: e.value }));
  let observed: RateEstimate | null = null;
  let required: { perDay: number; perWeek: number } | null = null;
  let projection: Projection | null = null;
  let plannedPerWeek: number | null = null;
  if (metric.aggregation === "weekly_sum") {
    observed = { perDay: current / 7, sd: 0, samples: es.length };
    required = { perDay: metric.target / 7, perWeek: metric.target };
    plannedPerWeek = metric.target;
  } else {
    // For "latest" metrics the baseline acts as the first observation.
    observed =
      metric.aggregation === "latest"
        ? observedRateLevel([{ date: goal.startDate, value: metric.baseline }, ...points], today)
        : observedRateSum(points, today, goal.startDate);
    required = requiredRate(metric.target, current, today, deadline);
    const weeks = Math.max(diffDays(deadline, goal.startDate) / 7, 1 / 7);
    plannedPerWeek = metric.weeklyTarget ?? (metric.target - metric.baseline) / weeks;
    projection = projectCompletion(current, metric.target, observed, today);
    if (hasReached(metric.baseline, metric.target, current)) {
      projection = { converging: true, reached: true, date: today, low: today, high: today, daysToGo: 0 };
    }
  }
  return {
    metric,
    current,
    progress,
    expected,
    paceRatio: pr,
    status: statusFromPace(pr),
    required,
    observed,
    observedPerWeek: observed ? observed.perDay * 7 : null,
    plannedPerWeek,
    projection,
    series: metricSeries(metric, bundle.entries, goal.startDate, today),
    lastEntryDate: es.length ? es[es.length - 1].date : null,
    thisWeek: thisWeekFor(metric, bundle.entries, today, plannedPerWeek),
    reached: metric.aggregation === "weekly_sum" ? progress >= 1 : hasReached(metric.baseline, metric.target, current),
  };
}

export function heatmapFor(activityDates: DateStr[], today: DateStr, weeks = 26): { date: DateStr; count: number }[] {
  const start = addDays(weekStart(today), -(weeks - 1) * 7);
  const counts = new Map<string, number>();
  for (const d of activityDates) if (d >= start && d <= today) counts.set(d, (counts.get(d) ?? 0) + 1);
  return dateRange(start, today).map((date) => ({ date, count: counts.get(date) ?? 0 }));
}

export function weeklyEffortFor(entryDates: DateStr[], taskDates: DateStr[], today: DateStr, weeks = 12) {
  const out: { weekStart: DateStr; tasks: number; logs: number }[] = [];
  const first = addDays(weekStart(today), -(weeks - 1) * 7);
  for (let i = 0; i < weeks; i++) {
    const ws = addDays(first, i * 7);
    const we = addDays(ws, 6);
    out.push({
      weekStart: ws,
      tasks: taskDates.filter((d) => d >= ws && d <= we).length,
      logs: entryDates.filter((d) => d >= ws && d <= we).length,
    });
  }
  return out;
}

function nextActionFor(a: Pick<GoalAnalysis, "drift" | "todayTasks" | "metrics" | "milestones" | "completed">, today: DateStr): string {
  if (a.completed) return "Goal complete — celebrate and set the next one!";
  if (a.drift === "rescue") return "Start your rescue plan";
  const pending = a.todayTasks.find((t) => t.due && !t.doneToday);
  if (pending) return `Do: ${pending.task.title}`;
  const stale = a.metrics.find((m) => m.metric.aggregation === "latest" && (!m.lastEntryDate || diffDays(today, m.lastEntryDate) >= 3));
  if (stale) return `Log your ${stale.metric.name.toLowerCase()}`;
  const next = a.milestones.find((m) => m.state === "next" || m.state === "overdue");
  if (next) return `Next milestone: ${next.milestone.title}`;
  return "You're all caught up today";
}

export function analyzeGoal(bundle: GoalBundle, opts: AnalyzeOptions): GoalAnalysis {
  const { goal } = bundle;
  const today = opts.today;
  const { deadline: effDeadline, soft } = effectiveDeadlineFor(bundle);
  const metrics = bundle.metrics.map((m) => analyzeMetric(bundle, m, today, effDeadline));
  const components = componentsAt(bundle, today, effDeadline);
  const score = goalScore(components);
  const expectedScore = 100 * weightedMean(components.map((c) => ({ weight: c.weight, progress: c.expected })));
  const completed = goal.status === "completed" || (components.length > 0 && score >= 99.999);
  const pr = paceRatioFormula(score / 100, expectedScore / 100);

  // Activity (for streaks, drift, heatmap).
  const metricIds = new Set(bundle.metrics.map((m) => m.id));
  const entryDates = bundle.entries.filter((e) => metricIds.has(e.metricId) && e.date <= today).map((e) => e.date);
  const taskIds = new Set(bundle.tasks.map((t) => t.id));
  const taskDates = bundle.completions.filter((c) => taskIds.has(c.taskId) && c.date <= today).map((c) => c.date);
  const activity = new Set([...entryDates, ...taskDates]);
  const lastLogDate = activity.size ? [...activity].sort().at(-1)! : null;
  const streak = computeStreak(activity, today, new Set(opts.frozenDays ?? []));
  const away = daysSince(lastLogDate, today, goal.startDate);

  const taskC = taskComponent(bundle.tasks, bundle.completions, today, goal.startDate);
  const consistency = taskC ?? logDayConsistency(activity, today, goal.startDate);

  const key = keyMetric(bundle.metrics);
  const keyA = key ? metrics.find((m) => m.metric.id === key.id) ?? null : null;

  let momentum: number | null = null;
  const isOpenEnded = goal.isOpenEnded || !goal.deadline;
  if (isOpenEnded) {
    const planned = keyA?.plannedPerWeek ?? null;
    momentum = momentumFormula(consistency, keyA?.observedPerWeek ?? null, planned);
  }

  // History of actual vs expected score, one point per day.
  const history: GoalAnalysis["history"] = [];
  if (!opts.skipHistory) {
    const end = minDate(today, goal.completedAt ? maxDate(goal.completedAt.slice(0, 10), goal.startDate) : today);
    for (const d of dateRange(goal.startDate, end)) {
      const cs = componentsAt(bundle, d, effDeadline);
      history.push({
        date: d,
        actual: goalScore(cs),
        expected: 100 * weightedMean(cs.map((c) => ({ weight: c.weight, progress: c.expected }))),
      });
    }
  }

  // Projection: key metric if there is one, otherwise the trend of the score itself.
  let projection: Projection;
  if (completed) projection = { converging: true, reached: true, date: today, low: today, high: today, daysToGo: 0 };
  else if (keyA?.projection) projection = keyA.projection;
  else {
    const pts = (history.length ? history : [{ date: today, actual: score }]).map((h) => ({ date: h.date, value: h.actual }));
    projection = projectCompletion(score, 100, observedRateLevel(pts, today), today);
  }
  const daysAheadBehind = projection.date ? diffDays(effDeadline, projection.date) : null;

  const status: PaceStatus = completed
    ? "ahead"
    : isOpenEnded && momentum !== null
      ? statusFromMomentum(momentum)
      : statusFromPace(pr);

  const todayTasks: TodayTask[] = bundle.tasks
    .filter((t) => t.active)
    .map((t) => {
      const done = new Set(bundle.completions.filter((c) => c.taskId === t.id).map((c) => c.date));
      return { task: t, ...dueToday(t.recurrence, done, today) };
    });

  let nextAssigned = false;
  const milestones = bundle.milestones.map((m) => {
    let state: MilestoneState;
    if (m.completedAt) state = "completed";
    else if (m.targetDate && m.targetDate < today) state = "overdue";
    else if (!nextAssigned) {
      state = "next";
      nextAssigned = true;
    } else state = "upcoming";
    if (state === "overdue") nextAssigned = true;
    return { milestone: m, state };
  });

  const weekAgo = addDays(today, -7);
  const recentWins =
    bundle.milestones.filter((m) => m.completedAt && m.completedAt.slice(0, 10) > weekAgo).length +
    metrics.filter((m) => m.thisWeek.hit).length +
    (opts.extraWins ?? 0);

  const mood = computeMood({
    // Open-ended goals still have a pace ratio against their soft deadline.
    paceRatio: pr,
    streak: streak.current,
    daysSinceLastLog: away,
    recentWins,
  });

  const partial = {
    drift: driftLevel(away),
    todayTasks,
    metrics,
    milestones,
    completed,
  };

  return {
    goalId: goal.id,
    score,
    expectedScore,
    paceRatio: pr,
    status,
    statusBasis: isOpenEnded ? "momentum" : "pace",
    completed,
    isOpenEnded,
    effectiveDeadline: effDeadline,
    softDeadline: soft,
    daysRemaining: diffDays(effDeadline, today),
    momentum,
    consistency,
    components,
    metrics,
    keyMetricId: key?.id ?? null,
    projection,
    daysAheadBehind,
    streak,
    lastLogDate,
    daysSinceLastLog: away,
    drift: partial.drift,
    history,
    heatmap: heatmapFor([...entryDates, ...taskDates], today),
    weeklyEffort: weeklyEffortFor(entryDates, taskDates, today),
    todayTasks,
    milestones,
    recentWins,
    nextAction: nextActionFor(partial, today),
    mood,
  };
}
