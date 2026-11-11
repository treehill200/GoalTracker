/** Strava (real OAuth via server routes). Imports activities as distance/time metrics. */
import type { IntegrationAdapter, MappedEntry } from "./types";

export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  start_date_local: string;
  distance: number; // meters
  moving_time: number; // seconds
}

export interface StravaMapping {
  distanceMetricId: string | null;
  timeMetricId: string | null;
  /** Only these activity types (e.g. ["Run"]); empty = all. */
  types: string[];
  /** Skip activities already imported. */
  importedIds: number[];
}

const DIST: Record<string, number> = { km: 1000, kilometers: 1000, mi: 1609.344, miles: 1609.344, mile: 1609.344, m: 1, meters: 1 };
const TIME: Record<string, number> = { min: 60, mins: 60, minutes: 60, h: 3600, hr: 3600, hrs: 3600, hours: 3600, s: 1 };

export function mapStravaActivities(acts: StravaActivity[], m: StravaMapping, units: { distance: string; time: string }): MappedEntry[] {
  const out: MappedEntry[] = [];
  const done = new Set(m.importedIds);
  for (const a of acts) {
    if (done.has(a.id) || (m.types.length && !m.types.includes(a.type))) continue;
    const date = a.start_date_local.slice(0, 10);
    const note = `Strava #${a.id}: ${a.name}`;
    if (m.distanceMetricId) out.push({ metricId: m.distanceMetricId, value: Math.round((a.distance / (DIST[units.distance.toLowerCase()] ?? 1000)) * 100) / 100, date, source: "strava", note });
    if (m.timeMetricId) out.push({ metricId: m.timeMetricId, value: Math.round((a.moving_time / (TIME[units.time.toLowerCase()] ?? 60)) * 100) / 100, date, source: "strava", note });
  }
  return out;
}

export const stravaAdapter: IntegrationAdapter<StravaActivity, StravaMapping & { units: { distance: string; time: string } }> = {
  id: "strava",
  name: "Strava",
  description: "Import runs, rides and other activities as distance and time.",
  isEnabled: (f) => f.strava,
  async connect() {
    // A full navigation is required: this API route redirects to Strava's OAuth page.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/api/integrations/strava/connect";
  },
  async sync() {
    const res = await fetch("/api/integrations/strava/sync");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Strava sync failed");
    return json.activities as StravaActivity[];
  },
  mapToMetrics: (raw, m) => mapStravaActivities(raw, m, m.units),
};
