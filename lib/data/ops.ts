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
  return { ...data, [key]: next };
}

export function applyOps(data: AppData, ops: Op[]): AppData {
  return ops.reduce(applyOp, data);
}

/** Tables whose writes are "logs" (shown as queued while offline). */
export const LOG_TABLES: TableName[] = ["metric_entries", "task_completions", "checkins"];
