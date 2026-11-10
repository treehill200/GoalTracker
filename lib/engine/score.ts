/**
 * Component scores and the 0–100 goal score.
 */
import type { Milestone, Task, TaskCompletion } from "@/lib/data/types";
import { addDays, maxDate, type DateStr } from "./dates";
import { countInstances } from "./recurrence";

export interface WeightedComponent {
  weight: number;
  progress: number; // 0–1
}

/** Goal score = 100 × Σ(wᵢ · pᵢ) / Σ wᵢ. Components with weight ≤ 0 are ignored. */
export function goalScore(components: WeightedComponent[]): number {
  let sw = 0;
  let swp = 0;
  for (const c of components) {
    if (!(c.weight > 0)) continue;
    sw += c.weight;
    swp += c.weight * c.progress;
  }
  return sw === 0 ? 0 : (100 * swp) / sw;
}

/** Same weighting, but returns a 0–1 value (used for expected progress). */
export function weightedMean(components: WeightedComponent[]): number {
  return goalScore(components) / 100;
}

/** Milestone component = completed ÷ total, weighted by each milestone's weight (default 1). */
export function milestoneComponent(milestones: Pick<Milestone, "weight" | "completedAt">[], asOf?: DateStr): number | null {
  if (milestones.length === 0) return null;
  let total = 0;
  let done = 0;
  for (const m of milestones) {
    const w = m.weight > 0 ? m.weight : 1;
    total += w;
    if (m.completedAt && (!asOf || m.completedAt.slice(0, 10) <= asOf)) done += w;
  }
  return total === 0 ? null : done / total;
}

/**
 * Expected milestone progress: share of milestones whose target date has passed.
 * Milestones without a date fall back to the time-based expectation `fallback`.
 */
export function expectedMilestones(milestones: Pick<Milestone, "weight" | "targetDate">[], today: DateStr, fallback: number): number | null {
  if (milestones.length === 0) return null;
  let total = 0;
  let due = 0;
  for (const m of milestones) {
    const w = m.weight > 0 ? m.weight : 1;
    total += w;
    if (m.targetDate === null) due += w * fallback;
    else if (m.targetDate <= today) due += w;
  }
  return due / total;
}

/**
 * Task component = completed instances ÷ scheduled instances over the last
 * `days` days (default 14). This is also the consistency score. Returns null
 * when nothing was scheduled.
 */
export function taskComponent(
  tasks: Pick<Task, "id" | "recurrence" | "active" | "createdAt">[],
  completions: Pick<TaskCompletion, "taskId" | "date">[],
  today: DateStr,
  goalStart: DateStr,
  days = 14,
): number | null {
  const windowStart = maxDate(addDays(today, -(days - 1)), goalStart);
  let scheduled = 0;
  let completed = 0;
  for (const t of tasks) {
    if (!t.active) continue;
    const done = new Set(completions.filter((c) => c.taskId === t.id).map((c) => c.date));
    // Tasks added mid-goal only count from the day they were created.
    const from = maxDate(windowStart, t.createdAt.slice(0, 10));
    const r = countInstances(t.recurrence, done, from, today, today);
    scheduled += r.scheduled;
    completed += r.completed;
  }
  return scheduled === 0 ? null : Math.min(completed / scheduled, 1);
}

/** Fallback consistency when a goal has no tasks: share of days with any log. */
export function logDayConsistency(logDates: Set<DateStr>, today: DateStr, goalStart: DateStr, days = 14): number {
  const from = maxDate(addDays(today, -(days - 1)), goalStart);
  let total = 0;
  let hit = 0;
  for (let d = from; d <= today; d = addDays(d, 1)) {
    if (d === today && !logDates.has(d)) continue;
    total += 1;
    if (logDates.has(d)) hit += 1;
  }
  return total === 0 ? 0 : hit / total;
}
