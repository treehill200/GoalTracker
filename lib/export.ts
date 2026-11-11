/** CSV export of everything, zipped in the browser (no server needed). */
import { strToU8, zipSync } from "fflate";
import Papa from "papaparse";
import type { AppData } from "@/lib/data/types";

function csv(rows: object[]): string {
  return Papa.unparse(rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v !== null && typeof v === "object" ? JSON.stringify(v) : v]))));
}

export function buildExportZip(data: AppData): Uint8Array {
  const files: Record<string, Uint8Array> = {
    "goals.csv": strToU8(csv(data.goals)),
    "metrics.csv": strToU8(csv(data.metrics)),
    "metric_entries.csv": strToU8(csv(data.entries)),
    "milestones.csv": strToU8(csv(data.milestones)),
    "tasks.csv": strToU8(csv(data.tasks)),
    "task_completions.csv": strToU8(csv(data.completions)),
    "checkins.csv": strToU8(csv(data.checkins)),
    "weekly_reviews.csv": strToU8(csv(data.reviews)),
    "target_adjustments.csv": strToU8(csv(data.adjustments)),
    "xp_events.csv": strToU8(csv(data.xpEvents)),
    "rewards.csv": strToU8(csv(data.rewards)),
    "reward_redemptions.csv": strToU8(csv(data.redemptions)),
    "README.txt": strToU8(`Goal Tracker export — ${new Date().toISOString()}\nOne CSV per table. JSON columns (recurrence, stats…) are JSON strings.\n`),
  };
  return zipSync(files, { level: 6 });
}

export function downloadExport(data: AppData) {
  const bytes = buildExportZip(data);
  const blob = new Blob([bytes as BlobPart], { type: "application/zip" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `goal-tracker-export-${new Date().toISOString().slice(0, 10)}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
