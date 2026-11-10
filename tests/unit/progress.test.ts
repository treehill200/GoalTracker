import { describe, expect, it } from "vitest";
import {
  expectedProgress,
  metricProgress,
  momentum,
  paceRatio,
  requiredRate,
  statusFromMomentum,
  statusFromPace,
  timeFraction,
} from "@/lib/engine/progress";

describe("metricProgress", () => {
  it("is linear between baseline and target for increasing goals", () => {
    expect(metricProgress(1180, 1500, 1180)).toBe(0);
    expect(metricProgress(1180, 1500, 1340)).toBeCloseTo(0.5);
    expect(metricProgress(1180, 1500, 1500)).toBe(1);
  });
  it("works for decreasing goals", () => {
    expect(metricProgress(200, 180, 190)).toBeCloseTo(0.5);
    expect(metricProgress(200, 180, 180)).toBe(1);
  });
  it("clamps to [0, 1]", () => {
    expect(metricProgress(0, 10, -5)).toBe(0);
    expect(metricProgress(0, 10, 25)).toBe(1);
    expect(metricProgress(200, 180, 210)).toBe(0);
    expect(metricProgress(200, 180, 150)).toBe(1);
  });
  it("guards against T == B", () => {
    expect(metricProgress(5, 5, 5)).toBe(1);
    expect(metricProgress(5, 5, 4)).toBe(0);
    expect(Number.isNaN(metricProgress(5, 5, 7))).toBe(false);
  });
});

describe("expectedProgress", () => {
  it("is linear by default", () => {
    expect(expectedProgress("2026-01-01", "2026-01-11", "2026-01-06")).toBeCloseTo(0.5);
  });
  it("supports the slow-start curve x^1.3", () => {
    expect(expectedProgress("2026-01-01", "2026-01-11", "2026-01-06", "slow_start")).toBeCloseTo(Math.pow(0.5, 1.3));
  });
  it("clamps before start and after the deadline", () => {
    expect(expectedProgress("2026-01-10", "2026-01-20", "2026-01-01")).toBe(0);
    expect(expectedProgress("2026-01-10", "2026-01-20", "2026-03-01")).toBe(1);
  });
  it("handles zero-length timelines", () => {
    expect(timeFraction("2026-01-10", "2026-01-10", "2026-01-09")).toBe(0);
    expect(timeFraction("2026-01-10", "2026-01-10", "2026-01-10")).toBe(1);
  });
});

describe("pace ratio and status", () => {
  it("divides by max(e, 0.01)", () => {
    expect(paceRatio(0.5, 0.5)).toBe(1);
    expect(paceRatio(0.05, 0)).toBeCloseTo(5);
  });
  it("maps thresholds exactly as specified", () => {
    expect(statusFromPace(1.05)).toBe("ahead");
    expect(statusFromPace(1.049)).toBe("on_track");
    expect(statusFromPace(0.9)).toBe("on_track");
    expect(statusFromPace(0.899)).toBe("behind");
    expect(statusFromPace(0.7)).toBe("behind");
    expect(statusFromPace(0.699)).toBe("at_risk");
  });
  it("maps momentum to a status", () => {
    expect(statusFromMomentum(0.97)).toBe("ahead");
    expect(statusFromMomentum(0.85)).toBe("on_track");
    expect(statusFromMomentum(0.65)).toBe("behind");
    expect(statusFromMomentum(0.2)).toBe("at_risk");
  });
});

describe("requiredRate", () => {
  it("returns per-day and per-week rates", () => {
    const r = requiredRate(1500, 1220, "2026-01-01", "2026-01-29")!;
    expect(r.perDay).toBeCloseTo(10);
    expect(r.perWeek).toBeCloseTo(70);
  });
  it("is negative for decreasing goals", () => {
    expect(requiredRate(180, 190, "2026-01-01", "2026-01-11")!.perDay).toBeCloseTo(-1);
  });
  it("returns null when the deadline has passed", () => {
    expect(requiredRate(10, 5, "2026-02-01", "2026-01-01")).toBeNull();
    expect(requiredRate(10, 5, "2026-01-01", "2026-01-01")).toBeNull();
  });
});

describe("momentum", () => {
  it("is 0.6 × consistency + 0.4 × min(observed/planned, 1)", () => {
    expect(momentum(1, 1, 1)).toBeCloseTo(1);
    expect(momentum(0.5, 0.5, 1)).toBeCloseTo(0.5);
    expect(momentum(0.8, 3, 1)).toBeCloseTo(0.88);
  });
  it("handles missing or opposite-direction rates", () => {
    expect(momentum(1, null, 1)).toBeCloseTo(0.6);
    expect(momentum(1, -1, 1)).toBeCloseTo(0.6);
    expect(momentum(1, -1, -0.5)).toBeCloseTo(1);
    expect(momentum(1, 1, 0)).toBeCloseTo(0.6);
  });
});
