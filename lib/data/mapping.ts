/**
 * camelCase (app) ↔ snake_case (Postgres) row conversion. Only top-level keys
 * are converted; jsonb values (settings, recurrence, stats…) are left as-is.
 */
const OVERRIDES: Record<string, string> = { order: "sort_order" };
const REVERSE: Record<string, string> = Object.fromEntries(Object.entries(OVERRIDES).map(([a, b]) => [b, a]));

export function toSnakeKey(k: string): string {
  return OVERRIDES[k] ?? k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

export function toCamelKey(k: string): string {
  return REVERSE[k] ?? k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

export function toRow(obj: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [toSnakeKey(k), v]));
}

export function fromRow<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    // Postgres numeric columns arrive as strings via PostgREST; dates stay strings.
    out[toCamelKey(k)] = v;
  }
  return out as T;
}
