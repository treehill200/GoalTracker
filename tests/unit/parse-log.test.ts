import { describe, expect, it } from "vitest";
import { parseLogText, splitClauses, stem } from "@/lib/engine/parse-log";
import { buildSeed, SEED_IDS } from "@/lib/data/seed";

const seed = buildSeed("2026-11-10");
const I = SEED_IDS;

describe("regex log parser", () => {
  it("stems and splits", () => {
    expect(stem("Ran")).toBe("run");
    expect(stem("sections")).toBe("section");
    expect(splitClauses("did 2 practice sections, scored 1320 on the test")).toHaveLength(2);
  });
  it("parses the SAT example into a task + a score", () => {
    const r = parseLogText(
      "did 2 practice sections, scored 1320 on the test",
      seed.metrics,
      seed.tasks,
    );
    expect(r.completions.map((c) => c.taskId)).toEqual([I.tSection]);
    expect(r.entries).toEqual([expect.objectContaining({ metricId: I.mSat, value: 1320 })]);
    expect(r.unmatched).toEqual([]);
  });
  it("converts minutes into an hours metric", () => {
    const r = parseLogText("studied 45 min", seed.metrics, seed.tasks);
    expect(r.entries).toEqual([expect.objectContaining({ metricId: I.mHours, value: 0.75 })]);
  });
  it("parses body weight and gym sessions without numbers", () => {
    const r = parseLogText("weighed 153.4 lbs and went to the gym", seed.metrics, seed.tasks);
    expect(r.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metricId: I.mWeight, value: 153.4 }),
        expect.objectContaining({ metricId: I.mGym, value: 1 }),
      ]),
    );
    expect(r.completions.map((c) => c.taskId)).toContain(I.tLift);
  });
  it("handles running distances with unit conversion", () => {
    const metrics = [
      {
        id: "run",
        name: "Distance run",
        unit: "km",
        baseline: 0,
        target: 100,
        aggregation: "sum_total" as const,
      },
    ];
    expect(parseLogText("ran 3 miles", metrics, []).entries[0].value).toBeCloseTo(4.83, 1);
    expect(parseLogText("ran a 5k", metrics, []).entries[0].value).toBe(5);
  });
  it("handles money", () => {
    const metrics = [
      {
        id: "s",
        name: "Savings",
        unit: "$",
        baseline: 0,
        target: 5000,
        aggregation: "sum_total" as const,
      },
    ];
    expect(parseLogText("saved $50 today", metrics, []).entries[0]).toMatchObject({
      metricId: "s",
      value: 50,
    });
  });
  it("rejects implausible values and reports unmatched text", () => {
    const r = parseLogText("scored 3 on a quiz, watched a movie", seed.metrics, seed.tasks);
    expect(r.entries).toEqual([]);
    expect(r.unmatched).toContain("watched a movie");
  });
});
