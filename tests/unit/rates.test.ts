import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/engine/dates";
import {
  ewma,
  hasReached,
  interpolateDaily,
  observedRateLevel,
  observedRateSum,
  projectCompletion,
} from "@/lib/engine/rates";

const T = "2026-03-01";

describe("interpolateDaily", () => {
  it("fills days linearly between observations", () => {
    const s = interpolateDaily([
      { date: "2026-01-01", value: 0 },
      { date: "2026-01-05", value: 8 },
    ]);
    expect(s.map((p) => p.value)).toEqual([0, 2, 4, 6, 8]);
  });
  it("keeps the last value for duplicate days", () => {
    const s = interpolateDaily([
      { date: "2026-01-01", value: 1 },
      { date: "2026-01-01", value: 3 },
    ]);
    expect(s).toEqual([{ date: "2026-01-01", value: 3 }]);
  });
  it("returns [] for no points", () => expect(interpolateDaily([])).toEqual([]));
});

describe("ewma", () => {
  it("weights recent samples more (half-life)", () => {
    const r = ewma([
      { age: 0, value: 10 },
      { age: 7, value: 0 },
    ])!;
    // weights 1 and 0.5 → (10) / 1.5
    expect(r.perDay).toBeCloseTo(10 / 1.5);
  });
  it("has zero sd for constant samples", () => {
    const r = ewma(Array.from({ length: 10 }, (_, i) => ({ age: i, value: 2 })))!;
    expect(r.perDay).toBeCloseTo(2);
    expect(r.sd).toBeCloseTo(0);
  });
  it("returns null for no samples", () => expect(ewma([])).toBeNull());
});

describe("observedRateLevel", () => {
  it("recovers a steady linear trend", () => {
    const pts = Array.from({ length: 10 }, (_, i) => ({
      date: addDays(T, -27 + i * 3),
      value: 100 + i * 3,
    }));
    const r = observedRateLevel(pts, T)!;
    expect(r.perDay).toBeCloseTo(1, 5);
    expect(r.sd).toBeCloseTo(0, 5);
  });
  it("is negative for a falling series", () => {
    const pts = [
      { date: addDays(T, -20), value: 200 },
      { date: addDays(T, -10), value: 195 },
      { date: T, value: 190 },
    ];
    expect(observedRateLevel(pts, T)!.perDay).toBeCloseTo(-0.5);
  });
  it("needs at least two points", () => {
    expect(observedRateLevel([], T)).toBeNull();
    expect(observedRateLevel([{ date: T, value: 1 }], T)).toBeNull();
  });
  it("falls back to the last slope when data is stale", () => {
    const pts = [
      { date: addDays(T, -100), value: 10 },
      { date: addDays(T, -90), value: 20 },
    ];
    expect(observedRateLevel(pts, T)!.perDay).toBeCloseTo(1);
  });
  it("ignores entries in the future", () => {
    const pts = [
      { date: addDays(T, -10), value: 0 },
      { date: T, value: 10 },
      { date: addDays(T, 5), value: 1000 },
    ];
    expect(observedRateLevel(pts, T)!.perDay).toBeCloseTo(1);
  });
});

describe("observedRateSum", () => {
  it("averages daily totals including zero days", () => {
    // 2 per day every day for 28 days
    const pts = Array.from({ length: 28 }, (_, i) => ({ date: addDays(T, -i), value: 2 }));
    expect(observedRateSum(pts, T, addDays(T, -100))!.perDay).toBeCloseTo(2);
  });
  it("only counts days since the goal started", () => {
    const pts = [{ date: T, value: 7 }];
    const r = observedRateSum(pts, T, addDays(T, -6))!;
    expect(r.samples).toBe(7);
  });
  it("returns null when the goal starts in the future", () => {
    expect(observedRateSum([], T, addDays(T, 3))).toBeNull();
  });
});

describe("projectCompletion", () => {
  it("projects now + (T − C) / rate", () => {
    const p = projectCompletion(1200, 1500, { perDay: 3, sd: 0, samples: 20 }, T);
    expect(p.converging).toBe(true);
    expect(p.date).toBe(addDays(T, 100));
    expect(p.daysToGo).toBe(100);
  });
  it("builds a confidence band from rate ± 1 SD", () => {
    const p = projectCompletion(0, 100, { perDay: 2, sd: 0.5, samples: 20 }, T);
    expect(p.low).toBe(addDays(T, 40)); // 100 / 2.5
    expect(p.high).toBe(addDays(T, 67)); // 100 / 1.5 → ceil
  });
  it("leaves the slow side open when rate − sd doesn't converge", () => {
    const p = projectCompletion(0, 100, { perDay: 1, sd: 2, samples: 3 }, T);
    expect(p.high).toBeNull();
    expect(p.date).toBe(addDays(T, 100));
  });
  it("reports not converging when the rate is ≤ 0", () => {
    expect(projectCompletion(10, 20, { perDay: 0, sd: 0, samples: 5 }, T).converging).toBe(false);
    expect(projectCompletion(10, 20, { perDay: -1, sd: 0, samples: 5 }, T).date).toBeNull();
    expect(projectCompletion(10, 20, null, T).converging).toBe(false);
  });
  it("works for decreasing goals", () => {
    const p = projectCompletion(190, 180, { perDay: -0.5, sd: 0, samples: 10 }, T);
    expect(p.date).toBe(addDays(T, 20));
    expect(projectCompletion(190, 180, { perDay: 0.5, sd: 0, samples: 10 }, T).converging).toBe(
      false,
    );
  });
  it("is reached when current equals target", () => {
    expect(projectCompletion(5, 5, null, T).reached).toBe(true);
  });
  it("hasReached respects direction", () => {
    expect(hasReached(0, 10, 11)).toBe(true);
    expect(hasReached(0, 10, 9)).toBe(false);
    expect(hasReached(10, 0, -1)).toBe(true);
    expect(hasReached(10, 0, 1)).toBe(false);
  });
});
