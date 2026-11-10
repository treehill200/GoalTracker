/**
 * Coach mood engine. Pure function of pace, streak, recency and recent wins.
 */
import type { CoachMood } from "@/lib/data/types";

export interface MoodInput {
  paceRatio: number | null;
  streak: number;
  daysSinceLastLog: number;
  /** Wins in the last 7 days: milestones, badges, weekly targets hit. */
  recentWins: number;
}

export interface MoodResult {
  mood: CoachMood;
  score: number;
  reasons: string[];
}

export const MOODS: CoachMood[] = ["sad", "worried", "neutral", "happy", "ecstatic"];

export function computeMood(input: MoodInput): MoodResult {
  const reasons: string[] = [];
  let s = 0;
  const r = input.paceRatio;
  if (r !== null && Number.isFinite(r)) {
    if (r >= 1.05) {
      s += 2;
      reasons.push("ahead of pace");
    } else if (r >= 0.9) {
      s += 1;
      reasons.push("on track");
    } else if (r >= 0.7) {
      s -= 1.5;
      reasons.push("a little behind");
    } else {
      s -= 2.5;
      reasons.push("at risk");
    }
  }
  if (input.streak >= 14) s += 1.5;
  else if (input.streak >= 7) s += 1;
  else if (input.streak >= 3) s += 0.5;
  else if (input.streak === 0) s -= 0.5;
  if (input.streak >= 3) reasons.push(`${input.streak}-day streak`);

  const d = input.daysSinceLastLog;
  if (d <= 1) s += 0.5;
  else if (d >= 14) s -= 3.5;
  else if (d >= 7) s -= 2.5;
  else if (d >= 3) s -= 1;
  if (d >= 3) reasons.push(`${d} days since last log`);

  const wins = Math.max(0, Math.min(input.recentWins, 2));
  s += wins * 0.5;
  if (wins > 0) reasons.push(`${input.recentWins} recent win${input.recentWins === 1 ? "" : "s"}`);

  let mood: CoachMood;
  if (s >= 4) mood = "ecstatic";
  else if (s >= 1.5) mood = "happy";
  else if (s >= 0) mood = "neutral";
  else if (s >= -2) mood = "worried";
  else mood = "sad";

  // Hard rules from the drift spec: 7+ days away → visibly sad; 3+ days → no better than neutral.
  if (d >= 7) mood = "sad";
  else if (d >= 3 && MOODS.indexOf(mood) > MOODS.indexOf("neutral")) mood = "neutral";

  return { mood, score: s, reasons };
}

/** Combine several moods (e.g. across goals) by averaging their position on the scale. */
export function averageMood(moods: CoachMood[]): CoachMood {
  if (moods.length === 0) return "neutral";
  const avg = moods.reduce((a, m) => a + MOODS.indexOf(m), 0) / moods.length;
  return MOODS[Math.round(avg)];
}
