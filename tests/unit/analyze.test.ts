import { describe, expect, it } from "vitest";
import { buildSeed, SEED_IDS } from "@/lib/data/seed";
import { bundleFor, type GoalBundle } from "@/lib/data/types";
import {
  analyzeGoal,
  currentValue,
  effectiveDeadlineFor,
  heatmapFor,
  keyMetric,
} from "@/lib/engine/analyze";
import { addDays } from "@/lib/engine/dates";

const TODAY = "2026-11-10";
const I = SEED_IDS;

function analyze(today: string, goalId: string) {
  const d = buildSeed(today);
  return analyzeGoal(bundleFor(d, goalId)!, { today });
}

describe("seed goal A (SAT): slightly behind", () => {
  for (let i = 0; i < 7; i++) {
    const today = addDays(TODAY, i);
    it(`is behind with a worried coach (${today})`, () => {
      const a = analyze(today, I.goalSat);
      expect(a.status).toBe("behind");
      expect(a.mood.mood).toBe("worried");
      expect(a.isOpenEnded).toBe(false);
      expect(a.projection.converging).toBe(true);
      expect(a.daysAheadBehind!).toBeLessThan(0);
    });
  }
  it("has a key metric, history and a heatmap", () => {
    const a = analyze(TODAY, I.goalSat);
    expect(a.keyMetricId).toBe(I.mSat);
    expect(a.history.length).toBe(43);
    expect(a.heatmap.length).toBeGreaterThan(26 * 7 - 7);
    expect(a.weeklyEffort).toHaveLength(12);
    const key = a.metrics.find((m) => m.metric.id === I.mSat)!;
    expect(key.current).toBe(1240);
    expect(key.required!.perWeek).toBeGreaterThan(key.observedPerWeek!);
  });
});

describe("seed goal B (muscle): open-ended and on track", () => {
  for (let i = 0; i < 7; i++) {
    const today = addDays(TODAY, i);
    it(`is on track or ahead with a happy coach (${today})`, () => {
      const a = analyze(today, I.goalMuscle);
      expect(["on_track", "ahead"]).toContain(a.status);
      expect(a.mood.mood).toBe("happy");
      expect(a.isOpenEnded).toBe(true);
      expect(a.statusBasis).toBe("momentum");
      expect(a.momentum!).toBeGreaterThan(0.8);
      expect(a.softDeadline).toBe(addDays(today, -42 + 280));
      expect(a.projection.date).not.toBeNull();
    });
  }
});

describe("edge cases", () => {
  const base = (): GoalBundle => {
    const d = buildSeed(TODAY);
    return bundleFor(d, I.goalSat)!;
  };
  it("handles a goal with no entries at all", () => {
    const b = { ...base(), entries: [], completions: [] };
    const a = analyzeGoal(b, { today: TODAY });
    expect(a.metrics.find((m) => m.metric.id === I.mSat)!.current).toBe(1180);
    expect(a.projection.converging).toBe(false);
    expect(a.lastLogDate).toBeNull();
    expect(a.drift).toBe("rescue"); // 42 days since start with nothing logged
    expect(a.mood.mood).toBe("sad");
  });
  it("handles a past deadline", () => {
    const b = base();
    b.goal = { ...b.goal, deadline: addDays(TODAY, -1) };
    const a = analyzeGoal(b, { today: TODAY });
    expect(a.daysRemaining).toBe(-1);
    expect(a.metrics[0].required).toBeNull();
    expect(a.status).toBe("at_risk");
  });
  it("handles T == B", () => {
    const b = base();
    b.metrics = b.metrics.map((m) => (m.id === I.mSat ? { ...m, target: m.baseline } : m));
    const a = analyzeGoal(b, { today: TODAY });
    expect(Number.isFinite(a.score)).toBe(true);
  });
  it("handles decreasing goals", () => {
    const b = base();
    b.metrics = [
      { ...b.metrics[0], baseline: 200, target: 180, direction: "decrease", weeklyTarget: null },
    ];
    b.entries = [
      { ...b.entries[0], metricId: b.metrics[0].id, value: 195, date: addDays(TODAY, -21) },
      { ...b.entries[0], id: "x2", metricId: b.metrics[0].id, value: 190, date: TODAY },
    ];
    b.goal = { ...b.goal, milestoneWeight: 0 };
    const a = analyzeGoal(b, { today: TODAY });
    expect(a.metrics[0].progress).toBeCloseTo(0.5);
    expect(a.metrics[0].observed!.perDay).toBeLessThan(0);
    expect(a.projection.converging).toBe(true);
  });
  it("handles an open-ended goal with no plan using a 12-week soft deadline", () => {
    const b = base();
    b.goal = { ...b.goal, deadline: null, isOpenEnded: true, suggestedDeadline: null };
    expect(effectiveDeadlineFor(b).deadline).toBe(addDays(b.goal.startDate, 84));
  });
  it("marks a completed goal", () => {
    const b = base();
    b.goal = { ...b.goal, status: "completed", completedAt: `${TODAY}T10:00:00Z` };
    const a = analyzeGoal(b, { today: TODAY });
    expect(a.completed).toBe(true);
    expect(a.projection.reached).toBe(true);
  });
  it("computes current values per aggregation", () => {
    const d = buildSeed(TODAY);
    const gym = d.metrics.find((m) => m.id === I.mGym)!;
    const v = currentValue(gym, d.entries, TODAY, addDays(TODAY, -42));
    expect(v).toBeGreaterThan(2.5);
    expect(v).toBeLessThan(5);
    expect(keyMetric(d.metrics.filter((m) => m.goalId === I.goalMuscle))!.id).toBe(I.mWeight);
  });
  it("builds a 26-week heatmap", () => {
    const h = heatmapFor([TODAY, TODAY, addDays(TODAY, -400)], TODAY);
    expect(h.at(-1)).toEqual({ date: TODAY, count: 2 });
    expect(h.reduce((a, x) => a + x.count, 0)).toBe(2);
  });
});
