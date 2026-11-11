/**
 * Rule-based natural-language log parser (fallback when there is no AI key).
 * Handles common patterns like "ran 3 miles", "studied 45 min",
 * "scored 1320 on the test", "weighed 152.4", "went to the gym".
 */
import type { Metric, ParsedLog, Task } from "@/lib/data/types";

type MetricLike = Pick<Metric, "id" | "name" | "unit" | "baseline" | "target" | "aggregation">;
type TaskLike = Pick<Task, "id" | "title">;

/** Words that mean the same thing for matching purposes. */
const SYNONYMS: Record<string, string> = {
  ran: "run",
  running: "run",
  jog: "run",
  jogged: "run",
  jogging: "run",
  runs: "run",
  studied: "study",
  studying: "study",
  studies: "study",
  scored: "score",
  scoring: "score",
  got: "score",
  weighed: "weight",
  weigh: "weight",
  weighing: "weight",
  scale: "weight",
  saved: "save",
  saving: "save",
  savings: "save",
  deposited: "save",
  lifted: "gym",
  lift: "gym",
  lifting: "gym",
  workout: "gym",
  worked: "gym",
  trained: "gym",
  training: "gym",
  session: "gym",
  sessions: "gym",
  read: "read",
  reading: "read",
  pages: "page",
  walked: "walk",
  walking: "walk",
  steps: "step",
  slept: "sleep",
  sleeping: "sleep",
  practiced: "practice",
  practicing: "practice",
  exam: "test",
  tests: "test",
  hit: "hit",
  swam: "swim",
  swimming: "swim",
  biked: "bike",
  cycled: "bike",
  cycling: "bike",
  rode: "bike",
  meditated: "meditate",
  meditation: "meditate",
};

const STOP = new Set([
  "i",
  "a",
  "an",
  "the",
  "on",
  "my",
  "of",
  "to",
  "for",
  "and",
  "did",
  "do",
  "today",
  "this",
  "morning",
  "at",
  "in",
  "was",
  "had",
  "per",
  "week",
  "day",
  "daily",
  "with",
  "went",
  "full",
  "goal",
  "1",
  "times",
  "x",
]);

const DURATION_UNITS: Record<string, number> = {
  // value in minutes
  min: 1,
  mins: 1,
  minute: 1,
  minutes: 1,
  m: 1,
  h: 60,
  hr: 60,
  hrs: 60,
  hour: 60,
  hours: 60,
};
const DISTANCE_UNITS: Record<string, number> = {
  // value in km
  km: 1,
  k: 1,
  kms: 1,
  kilometers: 1,
  kilometres: 1,
  mi: 1.609344,
  mile: 1.609344,
  miles: 1.609344,
  m: 0.001,
  meters: 0.001,
  metres: 0.001,
};
const WEIGHT_UNITS: Record<string, number> = {
  lb: 1,
  lbs: 1,
  pound: 1,
  pounds: 1,
  kg: 2.20462,
  kgs: 2.20462,
};

export function stem(word: string): string {
  const w = word.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (SYNONYMS[w]) return SYNONYMS[w];
  let s = w;
  if (s.length > 5 && s.endsWith("ing")) s = s.slice(0, -3);
  else if (s.length > 4 && s.endsWith("ed")) s = s.slice(0, -2);
  else if (s.length > 4 && s.endsWith("es")) s = s.slice(0, -2);
  else if (s.length > 3 && s.endsWith("s")) s = s.slice(0, -1);
  return SYNONYMS[s] ?? s;
}

function tokens(text: string): string[] {
  return text
    .split(/[^A-Za-z0-9$]+/)
    .map(stem)
    .filter((t) => t && !STOP.has(t) && !/^\d+$/.test(t));
}

function metricTokens(m: MetricLike): Set<string> {
  const t = new Set(tokens(`${m.name} ${m.unit}`));
  // A unit implies an activity.
  const unit = m.unit.toLowerCase();
  if (unit in DISTANCE_UNITS) t.add("run");
  if (unit in DURATION_UNITS) t.add("study");
  if (unit in WEIGHT_UNITS) t.add("weight");
  if (unit === "$" || unit === "usd" || unit === "dollars") t.add("save");
  return t;
}

/** Convert a number from the unit the user typed into the metric's unit. */
function convert(value: number, typedUnit: string | null, metricUnit: string): number | null {
  const mu = metricUnit.toLowerCase();
  const tu = typedUnit?.toLowerCase() ?? null;
  if (!tu || tu === mu) return value;
  for (const table of [DURATION_UNITS, DISTANCE_UNITS, WEIGHT_UNITS]) {
    if (tu in table && mu in table) return (value * table[tu]) / table[mu];
  }
  return value;
}

function plausible(m: MetricLike, value: number): boolean {
  if (m.aggregation !== "latest") return value >= 0 && value < 1e7;
  const lo = Math.min(m.baseline, m.target);
  const hi = Math.max(m.baseline, m.target);
  const span = Math.max(hi - lo, Math.abs(hi) * 0.1, 1);
  return value >= lo - span && value <= hi + span;
}

const NUMBER_RE = /(\$)?\s?(\d+(?:[.,]\d+)?)\s?(k\b)?\s*([a-zA-Z]+)?/g;

export function splitClauses(text: string): string[] {
  return text
    .split(/,|;|\.(?!\d)|\band\b|\bthen\b|\balso\b|\n/i)
    .map((c) => c.trim())
    .filter(Boolean);
}

export function parseLogText(text: string, metrics: MetricLike[], tasks: TaskLike[]): ParsedLog {
  const result: ParsedLog = { entries: [], completions: [], unmatched: [] };
  const usedTasks = new Set<string>();
  for (const clause of splitClauses(text)) {
    const ct = new Set(tokens(clause));
    let matched = false;

    // 1) Task completion: most of the task's meaningful words appear in the clause.
    let bestTask: { task: TaskLike; score: number } | null = null;
    for (const t of tasks) {
      const tt = tokens(t.title);
      if (tt.length === 0) continue;
      const hits = tt.filter((w) => ct.has(w)).length;
      const score = hits / tt.length;
      // Most of the task's words, or its leading verb ("Lift weights" ← "went to the gym").
      const qualifies = (hits >= Math.min(2, tt.length) && score >= 0.5) || ct.has(tt[0]);
      if (qualifies && (!bestTask || score > bestTask.score)) bestTask = { task: t, score };
    }
    if (bestTask && !usedTasks.has(bestTask.task.id)) {
      usedTasks.add(bestTask.task.id);
      result.completions.push({ taskId: bestTask.task.id, label: bestTask.task.title });
      matched = true;
    }

    // 2) Metric entries: numbers in the clause, matched to the best metric.
    const numbers: { value: number; unit: string | null; dollar: boolean }[] = [];
    for (const m of clause.matchAll(NUMBER_RE)) {
      let value = Number(m[2].replace(",", "."));
      if (m[3]) value = m[4] ? value * 1000 : value; // "5k" alone = 5 km; "5k steps" = 5000
      const unit = m[3] && !m[4] ? "km" : (m[4] ?? null);
      numbers.push({ value, unit, dollar: Boolean(m[1]) });
    }
    const ranked = metrics
      .map((m) => {
        const mt = metricTokens(m);
        let score = 0;
        for (const w of ct) if (mt.has(w)) score += 1;
        return { m, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);

    let metricMatched = false;
    for (const n of numbers) {
      for (const { m } of ranked) {
        const unit = n.dollar ? "$" : n.unit;
        const value = convert(n.value, unit, m.unit);
        if (value === null || !plausible(m, value)) continue;
        // If the task already explains this number ("did 2 practice sections"), don't
        // also log it to a metric unless the metric clearly matches the unit.
        if (matched && !(n.unit && metricTokens(m).has(stem(n.unit)))) continue;
        if (result.entries.some((e) => e.metricId === m.id)) continue;
        result.entries.push({
          metricId: m.id,
          value: Math.round(value * 100) / 100,
          label: m.name,
        });
        metricMatched = true;
        break;
      }
      if (metricMatched) break;
    }
    // "went to the gym" with no number → +1 on a count-style weekly metric.
    if (!metricMatched && numbers.length === 0 && ranked.length) {
      const top = ranked[0].m;
      if (top.aggregation === "weekly_sum" && !/hour|hr|min|\$/i.test(top.unit)) {
        result.entries.push({ metricId: top.id, value: 1, label: top.name });
        metricMatched = true;
      }
    }
    if (!matched && !metricMatched) result.unmatched.push(clause);
  }
  return result;
}
