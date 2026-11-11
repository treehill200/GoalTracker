/**
 * Apple Health: a web app can't read HealthKit, so we support
 *  (a) uploading the Health app's export.zip / export.xml, and
 *  (b) a per-user webhook an iOS Shortcut can POST to (see the API route).
 */
import { unzipSync, strFromU8 } from "fflate";
import type { IntegrationAdapter, MappedEntry } from "./types";

export interface HealthRecord {
  kind: "body_mass" | "steps" | "workout";
  date: string; // YYYY-MM-DD
  value: number; // lb/kg for body mass, steps, minutes for workouts
  unit: string;
  label?: string;
}

const TYPE_MAP: Record<string, HealthRecord["kind"]> = {
  HKQuantityTypeIdentifierBodyMass: "body_mass",
  HKQuantityTypeIdentifierStepCount: "steps",
};

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\b${name}="([^"]*)"`).exec(tag);
  return m ? m[1] : null;
}

/** Streaming-friendly regex parse of export.xml (handles very large files reasonably). */
export function parseAppleHealthXml(xml: string): HealthRecord[] {
  const out: HealthRecord[] = [];
  const recordRe = /<Record\s[^>]*?\/?>/g;
  for (const m of xml.matchAll(recordRe)) {
    const tag = m[0];
    const type = attr(tag, "type");
    const kind = type ? TYPE_MAP[type] : undefined;
    if (!kind) continue;
    const value = Number(attr(tag, "value"));
    const date = (attr(tag, "startDate") ?? "").slice(0, 10);
    if (!Number.isFinite(value) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    out.push({ kind, date, value, unit: attr(tag, "unit") ?? "" });
  }
  const workoutRe = /<Workout\s[^>]*?>/g;
  for (const m of xml.matchAll(workoutRe)) {
    const tag = m[0];
    const date = (attr(tag, "startDate") ?? "").slice(0, 10);
    let minutes = Number(attr(tag, "duration"));
    if (attr(tag, "durationUnit") === "s") minutes /= 60;
    if (attr(tag, "durationUnit") === "hr") minutes *= 60;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    out.push({ kind: "workout", date, value: Number.isFinite(minutes) ? minutes : 0, unit: "min", label: (attr(tag, "workoutActivityType") ?? "").replace("HKWorkoutActivityType", "") });
  }
  return out;
}

export async function readHealthFile(file: File): Promise<HealthRecord[]> {
  const buf = new Uint8Array(await file.arrayBuffer());
  if (file.name.toLowerCase().endsWith(".zip")) {
    const files = unzipSync(buf, { filter: (f) => /export\.xml$/i.test(f.name) && !/cda/i.test(f.name) });
    const name = Object.keys(files)[0];
    if (!name) throw new Error("No export.xml found in the zip");
    return parseAppleHealthXml(strFromU8(files[name]));
  }
  return parseAppleHealthXml(new TextDecoder().decode(buf));
}

export interface HealthMapping {
  bodyMassMetricId?: string | null;
  bodyMassUnit?: "lb" | "kg";
  stepsMetricId?: string | null;
  workoutMetricId?: string | null;
  workoutMode?: "count" | "minutes";
  since?: string | null;
}

/** Body mass → last value per day; steps → daily total; workouts → count or minutes per day. */
export function mapHealthRecords(records: HealthRecord[], mapping: HealthMapping): MappedEntry[] {
  const out: MappedEntry[] = [];
  const since = mapping.since ?? "0000-00-00";
  const byDay = <T,>(kind: HealthRecord["kind"], reduce: (vals: HealthRecord[]) => T) => {
    const groups = new Map<string, HealthRecord[]>();
    for (const r of records) if (r.kind === kind && r.date >= since) groups.set(r.date, [...(groups.get(r.date) ?? []), r]);
    return [...groups.entries()].sort().map(([date, vals]) => ({ date, value: reduce(vals) }));
  };
  if (mapping.bodyMassMetricId) {
    for (const d of byDay("body_mass", (v) => v[v.length - 1])) {
      let value = d.value.value;
      const from = d.value.unit.toLowerCase();
      if (mapping.bodyMassUnit === "lb" && from === "kg") value *= 2.20462;
      if (mapping.bodyMassUnit === "kg" && from === "lb") value /= 2.20462;
      out.push({ metricId: mapping.bodyMassMetricId, value: Math.round(value * 10) / 10, date: d.date, source: "health", note: "Apple Health" });
    }
  }
  if (mapping.stepsMetricId) {
    for (const d of byDay("steps", (v) => v.reduce((a, r) => a + r.value, 0))) out.push({ metricId: mapping.stepsMetricId, value: Math.round(d.value), date: d.date, source: "health", note: "Apple Health" });
  }
  if (mapping.workoutMetricId) {
    for (const d of byDay("workout", (v) => (mapping.workoutMode === "minutes" ? v.reduce((a, r) => a + r.value, 0) : v.length))) {
      out.push({ metricId: mapping.workoutMetricId, value: Math.round(d.value * 10) / 10, date: d.date, source: "health", note: "Apple Health workout" });
    }
  }
  return out;
}

export const appleHealthAdapter: IntegrationAdapter<HealthRecord, HealthMapping> = {
  id: "apple_health",
  name: "Apple Health",
  description: "Import your Health export (weight, steps, workouts) or connect an iOS Shortcut webhook.",
  isEnabled: () => true,
  async connect() {
    /* nothing to connect: upload or webhook */
  },
  async sync(input) {
    if (!(input instanceof File)) throw new Error("Choose your export.zip or export.xml");
    return readHealthFile(input);
  },
  mapToMetrics: mapHealthRecords,
};
