/**
 * A tiny "operation" language for writes. Every mutation in the app is an Op,
 * which lets us (1) apply it optimistically in memory, (2) send it to any
 * repository implementation, and (3) store it in the offline outbox.
 */
import { TABLE_TO_KEY, type AppData, type Profile, type TableMap, type TableName } from "./types";

export type Op =
  | { kind: "insert"; table: TableName; row: TableMap[TableName] }
  | { kind: "update"; table: TableName; id: string; patch: Partial<TableMap[TableName]> }
  | { kind: "remove"; table: TableName; id: string }
  | { kind: "profile"; patch: Partial<Profile> };

export const insertOp = <T extends TableName>(table: T, row: TableMap[T]): Op => ({ kind: "insert", table, row });
export const updateOp = <T extends TableName>(table: T, id: string, patch: Partial<TableMap[T]>): Op => ({
  kind: "update",
  table,
  id,
  patch,
});
export const removeOp = (table: TableName, id: string): Op => ({ kind: "remove", table, id });
export const profileOp = (patch: Partial<Profile>): Op => ({ kind: "profile", patch });

type Row = { id: string };

/** Pure: returns a new AppData with the op applied. Inserts with an existing id act as upserts. */
export function applyOp(data: AppData, op: Op): AppData {
  if (op.kind === "profile") {
    return { ...data, profile: { ...data.profile, ...op.patch, settings: { ...data.profile.settings, ...(op.patch.settings ?? {}) } } };
  }
  const key = TABLE_TO_KEY[op.table];
  const rows = data[key] as unknown as Row[];
  let next: Row[];
  switch (op.kind) {
    case "insert": {
      const row = op.row as Row;
      next = rows.some((r) => r.id === row.id) ? rows.map((r) => (r.id === row.id ? row : r)) : [...rows, row];
      break;
    }
    case "update":
      next = rows.map((r) => (r.id === op.id ? { ...r, ...op.patch } : r));
      break;
    case "remove":
      next = rows.filter((r) => r.id !== op.id);
      break;
  }
  const out = { ...data, [key]: next } as AppData;
  return op.kind === "remove" ? cascade(out, op.table, op.id) : out;
}

export function applyOps(data: AppData, ops: Op[]): AppData {
  return ops.reduce(applyOp, data);
}

/** Tables whose writes are "logs" (shown as queued while offline). */
export const LOG_TABLES: TableName[] = ["metric_entries", "task_completions", "checkins"];

/** Mirror the database's ON DELETE CASCADE rules for in-memory/local data. */
function cascade(d: AppData, table: TableName, id: string): AppData {
  if (table === "goals") {
    const metricIds = new Set(d.metrics.filter((m) => m.goalId === id).map((m) => m.id));
    const taskIds = new Set(d.tasks.filter((t) => t.goalId === id).map((t) => t.id));
    return {
      ...d,
      metrics: d.metrics.filter((m) => m.goalId !== id),
      entries: d.entries.filter((e) => !metricIds.has(e.metricId)),
      milestones: d.milestones.filter((m) => m.goalId !== id),
      tasks: d.tasks.filter((t) => t.goalId !== id),
      completions: d.completions.filter((c) => !taskIds.has(c.taskId)),
      adjustments: d.adjustments.filter((a) => a.goalId !== id),
      reviews: d.reviews.filter((r) => r.goalId !== id),
      partnerships: d.partnerships.map((p) => (p.goalIds.includes(id) ? { ...p, goalIds: p.goalIds.filter((g) => g !== id) } : p)),
    };
  }
  if (table === "metrics") {
    return {
      ...d,
      entries: d.entries.filter((e) => e.metricId !== id),
      milestones: d.milestones.map((m) => (m.metricId === id ? { ...m, metricId: null } : m)),
    };
  }
  if (table === "tasks") return { ...d, completions: d.completions.filter((c) => c.taskId !== id) };
  return d;
}
