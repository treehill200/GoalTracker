import { describe, expect, it } from "vitest";
import { addDays, dateRange, weekStart, weekday } from "@/lib/engine/dates";
import { countInstances, describeRecurrence, dueToday, isDueOn } from "@/lib/engine/recurrence";
import {
  expectedMilestones,
  goalScore,
  logDayConsistency,
  milestoneComponent,
  taskComponent,
} from "@/lib/engine/score";
import type { Task } from "@/lib/data/types";

const today = "2026-03-11"; // a Wednesday

describe("dates", () => {
  it("computes weekdays and Monday week starts", () => {
    expect(weekday("2026-03-11")).toBe(3);
    expect(weekStart("2026-03-11")).toBe("2026-03-09");
    expect(weekStart("2026-03-15")).toBe("2026-03-09"); // Sunday belongs to the week before
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });
});

describe("recurrence", () => {
  it("handles weekdays and every-n-weeks", () => {
    expect(isDueOn({ type: "weekdays", days: [1, 3] }, today)).toBe(true);
    expect(isDueOn({ type: "weekdays", days: [2] }, today)).toBe(false);
    const rec = { type: "every_n_weeks" as const, weekday: 6, interval: 2, anchor: "2026-03-07" };
    expect(isDueOn(rec, "2026-03-07")).toBe(true);
    expect(isDueOn(rec, "2026-03-14")).toBe(false);
    expect(isDueOn(rec, "2026-03-21")).toBe(true);
    expect(isDueOn(rec, "2026-02-21")).toBe(true);
  });
  it("doesn't count today as missed before it's done", () => {
    const r = countInstances({ type: "daily" }, new Set(), addDays(today, -2), today, today);
    expect(r).toEqual({ scheduled: 2, completed: 0 });
    const r2 = countInstances(
      { type: "daily" },
      new Set([today]),
      addDays(today, -2),
      today,
      today,
    );
    expect(r2).toEqual({ scheduled: 3, completed: 1 });
  });
  it("prorates times-per-week over partial weeks and caps extra completions", () => {
    const done = new Set(dateRange("2026-03-02", "2026-03-08")); // 7 completions in a full week
    const r = countInstances(
      { type: "times_per_week", times: 3 },
      done,
      "2026-03-02",
      "2026-03-08",
      today,
    );
    expect(r.scheduled).toBeCloseTo(3);
    expect(r.completed).toBeCloseTo(3);
  });
  it("reports today's list for flexible tasks", () => {
    const rec = { type: "times_per_week" as const, times: 2 };
    expect(dueToday(rec, new Set(["2026-03-09"]), today)).toMatchObject({
      due: true,
      remainingThisWeek: 1,
    });
    expect(dueToday(rec, new Set(["2026-03-09", "2026-03-10"]), today)).toMatchObject({
      due: false,
      remainingThisWeek: 0,
    });
  });
  it("describes recurrences", () => {
    expect(describeRecurrence({ type: "times_per_week", times: 3 })).toBe("3× per week");
    expect(
      describeRecurrence({ type: "every_n_weeks", weekday: 6, interval: 2, anchor: today }),
    ).toBe("Every 2 weeks on Sat");
  });
});

describe("goal score", () => {
  it("is 100 × Σ(w·p) / Σw", () => {
    expect(
      goalScore([
        { weight: 0.5, progress: 1 },
        { weight: 0.5, progress: 0 },
      ]),
    ).toBeCloseTo(50);
    expect(
      goalScore([
        { weight: 3, progress: 0.5 },
        { weight: 1, progress: 1 },
      ]),
    ).toBeCloseTo(62.5);
  });
  it("ignores zero weights and handles no components", () => {
    expect(goalScore([{ weight: 0, progress: 1 }])).toBe(0);
    expect(goalScore([])).toBe(0);
  });
});

describe("milestone component", () => {
  it("is completed ÷ total, optionally weighted", () => {
    expect(
      milestoneComponent([
        { weight: 1, completedAt: "2026-01-01" },
        { weight: 1, completedAt: null },
      ]),
    ).toBe(0.5);
    expect(
      milestoneComponent([
        { weight: 3, completedAt: "2026-01-01" },
        { weight: 1, completedAt: null },
      ]),
    ).toBe(0.75);
    expect(milestoneComponent([])).toBeNull();
  });
  it("respects asOf for history", () => {
    expect(
      milestoneComponent([{ weight: 1, completedAt: "2026-02-01T10:00:00Z" }], "2026-01-31"),
    ).toBe(0);
  });
  it("expects milestones whose date has passed", () => {
    expect(
      expectedMilestones(
        [
          { weight: 1, targetDate: "2026-01-01" },
          { weight: 1, targetDate: "2027-01-01" },
        ],
        today,
        0.3,
      ),
    ).toBe(0.5);
    expect(expectedMilestones([{ weight: 1, targetDate: null }], today, 0.3)).toBeCloseTo(0.3);
  });
});

describe("task component / consistency", () => {
  const task: Task = {
    id: "t",
    userId: "u",
    goalId: "g",
    title: "x",
    recurrence: { type: "daily" },
    xpValue: 10,
    active: true,
    createdAt: "2026-01-01T00:00:00Z",
  };
  it("is completed ÷ scheduled over the last 14 days", () => {
    const comps = dateRange(addDays(today, -13), addDays(today, -1))
      .filter((_, i) => i % 2 === 0)
      .map((date) => ({ taskId: "t", date }));
    // 13 past days scheduled (today not done yet), 7 completed
    expect(taskComponent([task], comps, today, "2026-01-01")).toBeCloseTo(7 / 13);
  });
  it("only counts from the goal start", () => {
    expect(
      taskComponent([task], [{ taskId: "t", date: addDays(today, -1) }], today, addDays(today, -1)),
    ).toBe(1);
  });
  it("returns null without tasks and falls back to log days", () => {
    expect(taskComponent([], [], today, "2026-01-01")).toBeNull();
    const logs = new Set([addDays(today, -1), addDays(today, -2)]);
    expect(logDayConsistency(logs, today, addDays(today, -3))).toBeCloseTo(2 / 3);
  });
  it("ignores inactive tasks", () => {
    expect(taskComponent([{ ...task, active: false }], [], today, "2026-01-01")).toBeNull();
  });
});
