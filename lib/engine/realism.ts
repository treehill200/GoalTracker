/**
 * Realism guard (section 4.4): flag plans that imply an unrealistic pace and
 * suggest something more sustainable. This is general guidance, never medical advice.
 */
import { addDays, type DateStr } from "./dates";

export interface RealismInput {
  goalTitle: string;
  metricName: string;
  unit: string;
  baseline: number;
  target: number;
  /** Planned change per week in metric units (sign follows direction). */
  weeklyRate: number;
  /** Plan length in weeks (for "over a long stretch" rules). */
  durationWeeks: number;
  startDate: DateStr;
  /** Optional observed weekly rate for the generic "3× what you've been doing" check. */
  observedWeekly?: number | null;
  aggregation?: "latest" | "sum_total" | "weekly_sum";
}

export interface RealismWarning {
  rule: string;
  message: string;
  suggestedWeekly: number;
  suggestedDeadline: DateStr | null;
}

const has = (text: string, ...words: string[]) => words.some((w) => new RegExp(`\\b${w}\\b`, "i").test(text));

function deadlineFor(input: RealismInput, weekly: number): DateStr | null {
  if (weekly === 0) return null;
  const weeks = Math.abs((input.target - input.baseline) / weekly);
  return addDays(input.startDate, Math.ceil(weeks * 7));
}

export function checkRealism(input: RealismInput): RealismWarning[] {
  const warnings: RealismWarning[] = [];
  const text = `${input.goalTitle} ${input.metricName}`;
  const unit = input.unit.toLowerCase().trim();
  const isLb = ["lb", "lbs", "pound", "pounds"].includes(unit);
  const isKg = ["kg", "kgs", "kilogram", "kilograms"].includes(unit);
  const gaining = input.target > input.baseline;
  const weekly = Math.abs(input.weeklyRate);

  if (input.aggregation !== "weekly_sum" && (isLb || isKg) && gaining && has(text, "muscle", "lean", "bulk", "gain")) {
    const limit = isLb ? 1 : 0.45;
    const suggested = isLb ? 0.5 : 0.25;
    if (weekly > limit) {
      warnings.push({
        rule: "muscle_gain",
        message: `Gaining more than ${limit} ${unit} of lean muscle per week isn't realistic for most people. Around ${suggested} ${unit}/week keeps the gain mostly muscle.`,
        suggestedWeekly: suggested,
        suggestedDeadline: deadlineFor(input, suggested),
      });
    }
  }

  if (input.aggregation !== "weekly_sum" && (isLb || isKg) && !gaining && has(text, "weight", "lose", "fat", "body")) {
    const limit = isLb ? 2 : 0.9;
    const suggested = isLb ? 1 : 0.5;
    if (weekly > limit) {
      warnings.push({
        rule: "weight_loss",
        message: `Losing more than ${limit} ${unit} per week is hard to sustain. A steadier ${suggested} ${unit}/week is more likely to stick.`,
        suggestedWeekly: -suggested,
        suggestedDeadline: deadlineFor(input, suggested),
      });
    }
  }

  if (has(text, "SAT") && input.aggregation !== "weekly_sum") {
    const perMonth = weekly * (30 / 7);
    if (perMonth > 100 && input.durationWeeks > 8) {
      const suggested = 60 / (30 / 7);
      warnings.push({
        rule: "sat_points",
        message: `Improving more than 100 SAT points per month for ${Math.round(input.durationWeeks)} weeks is very ambitious. About 60 points a month is a strong, realistic pace.`,
        suggestedWeekly: suggested,
        suggestedDeadline: deadlineFor(input, suggested),
      });
    }
  }

  if (has(text, "ACT") && input.aggregation !== "weekly_sum") {
    const perMonth = weekly * (30 / 7);
    if (perMonth > 3 && input.durationWeeks > 8) {
      const suggested = 2 / (30 / 7);
      warnings.push({
        rule: "act_points",
        message: "More than 3 ACT points per month over a long stretch is rare. Around 2 points a month is realistic.",
        suggestedWeekly: suggested,
        suggestedDeadline: deadlineFor(input, suggested),
      });
    }
  }

  if (input.aggregation === "weekly_sum" && ["h", "hr", "hrs", "hour", "hours"].includes(unit) && input.target > 60) {
    warnings.push({
      rule: "hours_per_week",
      message: `${input.target} hours a week on one goal leaves little room for rest. Consider 20–30 focused hours.`,
      suggestedWeekly: 25,
      suggestedDeadline: null,
    });
  }

  if (input.observedWeekly != null && input.aggregation !== "weekly_sum") {
    const obs = Math.abs(input.observedWeekly);
    if (obs > 0 && weekly > obs * 3) {
      const suggested = obs * 1.5;
      warnings.push({
        rule: "vs_observed",
        message: `This plan needs ${round(weekly)} ${input.unit}/week, more than 3× what you've been doing (${round(obs)}/week). Ramping to ${round(suggested)}/week is more realistic.`,
        suggestedWeekly: Math.sign(input.weeklyRate) * suggested,
        suggestedDeadline: deadlineFor(input, suggested),
      });
    }
  }

  return warnings;
}

function round(x: number) {
  return Math.abs(x) >= 10 ? Math.round(x) : Math.round(x * 10) / 10;
}
