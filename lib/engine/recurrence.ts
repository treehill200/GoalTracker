/**
 * Recurring task scheduling: which days a task is due and how many instances
 * were scheduled vs completed in a window (for the task component and consistency).
 */
import type { Recurrence } from "@/lib/data/types";
import { addDays, dateRange, diffDays, maxDate, weekStart, weekday, type DateStr } from "./dates";

/** True when a fixed-schedule task is due on `date`. times_per_week returns true every day (flexible). */
export function isDueOn(rec: Recurrence, date: DateStr): boolean {
  switch (rec.type) {
    case "daily":
      return true;
    case "weekdays":
      return rec.days.includes(weekday(date));
    case "every_n_weeks": {
      if (weekday(date) !== rec.weekday) return false;
      const weeks = Math.round(diffDays(weekStart(date), weekStart(rec.anchor)) / 7);
      return ((weeks % rec.interval) + rec.interval) % rec.interval === 0;
    }
    case "times_per_week":
      return true;
  }
}

export interface ScheduleCount {
  scheduled: number;
  completed: number;
}

/**
 * Scheduled vs completed instances for one task between start and end (inclusive).
 * - Fixed schedules: each due day counts once; today only counts if already done
 *   (the day isn't over yet).
 * - times_per_week: each calendar week expects `times`, prorated for partial weeks.
 */
export function countInstances(
  rec: Recurrence,
  completedDates: Set<DateStr>,
  start: DateStr,
  end: DateStr,
  today: DateStr,
): ScheduleCount {
  if (start > end) return { scheduled: 0, completed: 0 };
  if (rec.type === "times_per_week") {
    let scheduled = 0;
    let completed = 0;
    let ws = weekStart(start);
    while (ws <= end) {
      const we = addDays(ws, 6);
      const from = maxDate(ws, start);
      const to = we < end ? we : end;
      const days = diffDays(to, from) + 1;
      const expected = (rec.times * days) / 7;
      const done = dateRange(from, to).filter((d) => completedDates.has(d)).length;
      scheduled += expected;
      completed += Math.min(done, expected);
      ws = addDays(ws, 7);
    }
    return { scheduled, completed };
  }
  let scheduled = 0;
  let completed = 0;
  for (const d of dateRange(start, end)) {
    if (!isDueOn(rec, d)) continue;
    const done = completedDates.has(d);
    if (d === today && !done) continue; // today isn't over yet
    scheduled += 1;
    if (done) completed += 1;
  }
  return { scheduled, completed };
}

/** For "today's list": is the task due today, and how many are left this week? */
export function dueToday(
  rec: Recurrence,
  completedDates: Set<DateStr>,
  today: DateStr,
): { due: boolean; doneToday: boolean; remainingThisWeek: number | null } {
  const doneToday = completedDates.has(today);
  if (rec.type === "times_per_week") {
    const ws = weekStart(today);
    const doneThisWeek = dateRange(ws, today).filter((d) => completedDates.has(d)).length;
    const remaining = Math.max(rec.times - doneThisWeek, 0);
    return { due: remaining > 0 || doneToday, doneToday, remainingThisWeek: remaining };
  }
  return { due: isDueOn(rec, today), doneToday, remainingThisWeek: null };
}

export function describeRecurrence(rec: Recurrence): string {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  switch (rec.type) {
    case "daily":
      return "Every day";
    case "times_per_week":
      return `${rec.times}× per week`;
    case "weekdays":
      return rec.days.map((d) => names[d]).join(", ");
    case "every_n_weeks":
      return rec.interval === 1 ? `Every ${names[rec.weekday]}` : `Every ${rec.interval} weeks on ${names[rec.weekday]}`;
  }
}
