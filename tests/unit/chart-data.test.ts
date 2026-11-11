import { describe, expect, it } from "vitest";
import { buildSeed, SEED_IDS } from "@/lib/data/seed";
import { bundleFor } from "@/lib/data/types";
import { analyzeGoal } from "@/lib/engine/analyze";
import { buildForecast } from "@/lib/engine/chart-data";

const today = "2026-11-10";

describe("buildForecast", () => {
  const d = buildSeed(today);
  const b = bundleFor(d, SEED_IDS.goalSat)!;
  const a = analyzeGoal(b, { today });
  const m = a.metrics.find((x) => x.metric.id === SEED_IDS.mSat)!;
  const { points, end } = buildForecast(m, { start: b.goal.startDate, deadline: b.goal.deadline!, today, curve: "linear" });

  it("is sorted and spans past the deadline to the forecast", () => {
    expect(points.map((p) => p.x)).toEqual([...points.map((p) => p.x)].sort((x, y) => x - y));
    expect(end >= b.goal.deadline!).toBe(true);
  });
  it("plots actuals up to today and the plan to the deadline", () => {
    expect(points.find((p) => p.date === today)!.actual).toBe(1240);
    expect(points.filter((p) => p.date > today && p.actual !== undefined)).toHaveLength(0);
    expect(points.find((p) => p.date === b.goal.deadline)!.plan).toBeCloseTo(1500);
  });
  it("projects forward with a band that contains the projection and never passes the target", () => {
    const future = points.filter((p) => p.projection !== undefined);
    expect(future.length).toBeGreaterThan(5);
    for (const p of future) {
      expect(p.band![0]).toBeLessThanOrEqual(p.projection! + 1e-9);
      expect(p.band![1]).toBeGreaterThanOrEqual(p.projection! - 1e-9);
      expect(p.band![1]).toBeLessThanOrEqual(1500);
    }
  });
});
