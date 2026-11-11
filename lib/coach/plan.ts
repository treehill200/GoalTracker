/**
 * Plan changes the coach can suggest. The AI appends a fenced ```plan block
 * with JSON; the client validates it with Zod and asks the user to confirm.
 */
import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const RecurrenceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("daily") }),
  z.object({ type: z.literal("times_per_week"), times: z.number().int().min(1).max(7) }),
  z.object({ type: z.literal("weekdays"), days: z.array(z.number().int().min(0).max(6)).min(1) }),
  z.object({ type: z.literal("every_n_weeks"), weekday: z.number().int().min(0).max(6), interval: z.number().int().min(1).max(8), anchor: date }),
]);

export const PlanChangeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("set_weekly_target"), goalId: z.string(), metricId: z.string(), value: z.number(), reason: z.string().max(300) }),
  z.object({ type: z.literal("set_target"), goalId: z.string(), metricId: z.string(), value: z.number(), reason: z.string().max(300) }),
  z.object({ type: z.literal("set_deadline"), goalId: z.string(), deadline: date, reason: z.string().max(300) }),
  z.object({ type: z.literal("add_task"), goalId: z.string(), title: z.string().min(1).max(120), recurrence: RecurrenceSchema, reason: z.string().max(300) }),
  z.object({ type: z.literal("pause_goal"), goalId: z.string(), reason: z.string().max(300) }),
]);

export type PlanChange = z.infer<typeof PlanChangeSchema>;

const BLOCK = /```plan\s*([\s\S]*?)```/;

/** Split a coach reply into visible text and an optional validated plan change. */
export function extractPlanChange(text: string): { text: string; change: PlanChange | null; pending: boolean } {
  const m = BLOCK.exec(text);
  if (!m) {
    // While streaming, hide a half-written block.
    const open = text.indexOf("```plan");
    return { text: open >= 0 ? text.slice(0, open).trimEnd() : text, change: null, pending: open >= 0 };
  }
  const visible = (text.slice(0, m.index) + text.slice(m.index + m[0].length)).trim();
  try {
    const parsed = PlanChangeSchema.safeParse(JSON.parse(m[1]));
    return { text: visible, change: parsed.success ? parsed.data : null, pending: false };
  } catch {
    return { text: visible, change: null, pending: false };
  }
}

export function describePlanChange(c: PlanChange, names: { goal?: string; metric?: string }): string {
  switch (c.type) {
    case "set_weekly_target":
      return `Set ${names.metric ?? "metric"} weekly target to ${c.value}`;
    case "set_target":
      return `Change ${names.metric ?? "metric"} target to ${c.value}`;
    case "set_deadline":
      return `Move the deadline of “${names.goal ?? "goal"}” to ${c.deadline}`;
    case "add_task":
      return `Add task “${c.title}” to ${names.goal ?? "goal"}`;
    case "pause_goal":
      return `Pause “${names.goal ?? "goal"}”`;
  }
}
