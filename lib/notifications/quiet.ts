/** Quiet hours: is "HH:MM" inside [start, end)? Handles windows that cross midnight. */
import type { QuietHours } from "@/lib/data/types";

const mins = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};

export function inQuietHours(now: string, q: QuietHours): boolean {
  if (!q.enabled) return false;
  const n = mins(now);
  const s = mins(q.start);
  const e = mins(q.end);
  if (s === e) return false;
  return s < e ? n >= s && n < e : n >= s || n < e;
}
