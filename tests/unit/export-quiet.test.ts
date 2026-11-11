import { describe, expect, it } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { buildSeed } from "@/lib/data/seed";
import { buildExportZip } from "@/lib/export";
import { inQuietHours } from "@/lib/notifications/quiet";
import { applyOp } from "@/lib/data/ops";
import { SEED_IDS } from "@/lib/data/seed";

describe("CSV export", () => {
  it("zips one CSV per table with headers", () => {
    const files = unzipSync(buildExportZip(buildSeed("2026-11-10")));
    expect(Object.keys(files)).toEqual(
      expect.arrayContaining([
        "goals.csv",
        "metric_entries.csv",
        "tasks.csv",
        "weekly_reviews.csv",
      ]),
    );
    const goals = strFromU8(files["goals.csv"]);
    expect(goals.split("\n")[0]).toContain("title");
    expect(goals).toContain("Get a 1500+ on the SAT");
  });
});

describe("quiet hours", () => {
  const q = { enabled: true, start: "22:00", end: "07:00" };
  it("handles windows across midnight", () => {
    expect(inQuietHours("23:30", q)).toBe(true);
    expect(inQuietHours("06:59", q)).toBe(true);
    expect(inQuietHours("07:00", q)).toBe(false);
    expect(inQuietHours("12:00", q)).toBe(false);
  });
  it("handles same-day windows and disabled", () => {
    expect(inQuietHours("13:00", { enabled: true, start: "12:00", end: "14:00" })).toBe(true);
    expect(inQuietHours("23:30", { ...q, enabled: false })).toBe(false);
  });
});

describe("ops cascade", () => {
  it("removing a goal removes its metrics, entries, tasks and completions", () => {
    const d = applyOp(buildSeed("2026-11-10"), {
      kind: "remove",
      table: "goals",
      id: SEED_IDS.goalSat,
    });
    expect(d.goals).toHaveLength(1);
    expect(d.metrics.every((m) => m.goalId !== SEED_IDS.goalSat)).toBe(true);
    expect(d.entries.some((e) => e.metricId === SEED_IDS.mSat)).toBe(false);
    expect(d.completions.some((c) => c.taskId === SEED_IDS.tSection)).toBe(false);
  });
});
