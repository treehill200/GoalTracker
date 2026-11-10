import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/engine/dates";
import { ADJUST_CAP, computeAdjustment, isMeaningfulChange, originalWeeklyTarget } from "@/lib/engine/adjust";
import { daysSince, driftLevel, rescuePlan, roundNice } from "@/lib/engine/drift";
import { checkRealism } from "@/lib/engine/realism";

const today = "2026-03-01";

describe("auto-adjust", () => {
  const base = { baseline: 0, target: 100, startDate: addDays(today, -50), deadline: addDays(today, 50), today, currentWeekly: null, originalWeekly: null };
  it("derives the original weekly target from the plan", () => {
    expect(originalWeeklyTarget(0, 100, base.startDate, base.deadline)).toBeCloseTo(7);
  });
  it("spreads the remaining gap when within the 1.5× cap", () => {
    const r = computeAdjustment({ ...base, current: 40 }); // 60 left over 50 days → 8.4/wk
    expect(r.kind).toBe("adjusted");
    if (r.kind === "adjusted") expect(r.newWeekly).toBeCloseTo(8.4);
  });
  it("offers a choice instead of exceeding the cap", () => {
    const r = computeAdjustment({ ...base, current: 10 }); // 90 left → 12.6/wk > 10.5
    expect(r.kind).toBe("choice");
    if (r.kind === "choice") {
      expect(r.capWeekly).toBeCloseTo(7 * ADJUST_CAP);
      expect(r.requiredWeekly).toBeCloseTo(12.6);
      expect(r.pushDeadlineTo).toBe(addDays(today, Math.ceil((90 / 10.5) * 7)));
    }
  });
  it("works for decreasing goals", () => {
    const r = computeAdjustment({ ...base, baseline: 200, target: 180, current: 195 }); // 15 left, orig -1.4/wk
    expect(r.kind).toBe("adjusted");
    if (r.kind === "adjusted") expect(r.newWeekly).toBeCloseTo(-2.1);
  });
  it("does nothing when the target is reached or T == B", () => {
    expect(computeAdjustment({ ...base, current: 100 }).kind).toBe("none");
    expect(computeAdjustment({ ...base, target: 0, current: 0 }).kind).toBe("none");
  });
  it("forces a choice once the deadline has passed", () => {
    expect(computeAdjustment({ ...base, deadline: addDays(today, -1), current: 50 }).kind).toBe("choice");
  });
  it("ignores tiny changes", () => {
    expect(isMeaningfulChange(10, 10.1)).toBe(false);
    expect(isMeaningfulChange(10, 11)).toBe(true);
    expect(isMeaningfulChange(0, 1)).toBe(true);
  });
});

describe("drift", () => {
  it("maps days away to levels", () => {
    expect(driftLevel(2)).toBe("none");
    expect(driftLevel(3)).toBe("nudge");
    expect(driftLevel(7)).toBe("sad");
    expect(driftLevel(14)).toBe("rescue");
  });
  it("counts from the start date when never logged", () => {
    expect(daysSince(null, today, addDays(today, -4))).toBe(4);
    expect(daysSince(addDays(today, 2), today, today)).toBe(0);
  });
  it("offers a smaller restart target and pushes the deadline", () => {
    const p = rescuePlan({ current: 1220, target: 1500, weeklyTarget: 12, today, deadline: addDays(today, 30), daysAway: 15, unit: "points" });
    expect(p.restartTarget).toBe(1232);
    expect(p.restartBy).toBe(addDays(today, 14));
    expect(p.newDeadline).toBe(addDays(today, 45));
    const open = rescuePlan({ current: 160, target: 150, weeklyTarget: null, today, deadline: null, daysAway: 20, unit: "lb" });
    expect(open.restartTarget).toBe(159);
    expect(open.newDeadline).toBeNull();
  });
  it("rounds nicely", () => {
    expect(roundNice(1234.56)).toBe(1235);
    expect(roundNice(12.345)).toBe(12.3);
    expect(roundNice(1.2345)).toBe(1.23);
  });
});

describe("realism guard", () => {
  const base = { goalTitle: "Gain 20 lbs of lean muscle", metricName: "Body weight", unit: "lb", baseline: 150, target: 170, durationWeeks: 10, startDate: today };
  it("warns about >1 lb/week muscle gain", () => {
    const w = checkRealism({ ...base, weeklyRate: 2 });
    expect(w.map((x) => x.rule)).toContain("muscle_gain");
    expect(w[0].suggestedWeekly).toBe(0.5);
    expect(w[0].suggestedDeadline).toBe(addDays(today, 280));
  });
  it("accepts a sane bulk", () => expect(checkRealism({ ...base, weeklyRate: 0.5 })).toEqual([]));
  it("warns about >100 SAT points a month over a long stretch", () => {
    const sat = { goalTitle: "Get a 1500+ on the SAT", metricName: "Practice test score", unit: "points", baseline: 1100, target: 1500, startDate: today };
    expect(checkRealism({ ...sat, weeklyRate: 40, durationWeeks: 10 }).map((w) => w.rule)).toContain("sat_points");
    expect(checkRealism({ ...sat, weeklyRate: 40, durationWeeks: 4 })).toEqual([]);
    expect(checkRealism({ ...sat, weeklyRate: 15, durationWeeks: 20 })).toEqual([]);
  });
  it("warns about fast weight loss", () => {
    const w = checkRealism({ goalTitle: "Lose weight", metricName: "Body weight", unit: "lb", baseline: 200, target: 170, weeklyRate: -3, durationWeeks: 10, startDate: today });
    expect(w[0].rule).toBe("weight_loss");
  });
  it("warns when the plan is 3× the observed pace", () => {
    const w = checkRealism({ goalTitle: "Read more", metricName: "Pages", unit: "pages", baseline: 0, target: 1000, weeklyRate: 100, durationWeeks: 10, startDate: today, observedWeekly: 20, aggregation: "sum_total" });
    expect(w[0].rule).toBe("vs_observed");
  });
});
