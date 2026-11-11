/**
 * Zod schemas for every user/AI input that becomes data.
 */
import { z } from "zod";
import { RecurrenceSchema } from "@/lib/coach/plan";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const finite = z.number().refine(Number.isFinite, "Must be a number");

export const MetricDraftSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(1, "Name the metric").max(120),
    unit: z.string().trim().max(30).default(""),
    baseline: finite,
    target: finite,
    weight: z.number().min(0).max(100).default(1),
    aggregation: z.enum(["latest", "sum_total", "weekly_sum"]).default("latest"),
    weeklyTarget: finite.nullable().default(null),
    isKey: z.boolean().default(false),
  })
  .refine((m) => m.aggregation !== "weekly_sum" || m.target > 0, {
    message: "Weekly target must be above 0",
    path: ["target"],
  });

export const MilestoneDraftSchema = z.object({
  id: z.string().optional(),
  completedAt: z.string().nullable().optional(),
  title: z.string().trim().min(1).max(160),
  targetDate: date.nullable().default(null),
  weight: z.number().min(0).max(100).default(1),
  /** Auto-complete when the metric at this index reaches the value. */
  metricIndex: z.number().int().min(0).nullable().default(null),
  thresholdValue: finite.nullable().default(null),
});

export const TaskDraftSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1).max(120),
  recurrence: RecurrenceSchema,
  xpValue: z.number().int().min(0).max(500).default(15),
});

export const GoalDraftSchema = z
  .object({
    title: z.string().trim().min(1, "Give your goal a title").max(200),
    description: z.string().max(2000).default(""),
    category: z.string().max(40).default("General"),
    createdVia: z.enum(["ai", "milestones", "single_metric", "weighted", "manual"]),
    startDate: date,
    deadline: date.nullable(),
    isOpenEnded: z.boolean(),
    suggestedDeadline: date.nullable().default(null),
    plannedWeeklyEffort: z.number().min(0).max(168).nullable().default(null),
    expectedCurve: z.enum(["linear", "slow_start"]).default("linear"),
    milestoneWeight: z.number().min(0).max(100).default(0),
    taskWeight: z.number().min(0).max(100).default(0),
    reminderTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .nullable()
      .default(null),
    color: z.string().nullable().default(null),
    metrics: z.array(MetricDraftSchema).max(12),
    milestones: z.array(MilestoneDraftSchema).max(30),
    tasks: z.array(TaskDraftSchema).max(20),
  })
  .refine((g) => g.isOpenEnded || g.deadline !== null, {
    message: "Pick a deadline or make it open-ended",
    path: ["deadline"],
  })
  .refine((g) => !g.deadline || g.deadline > g.startDate, {
    message: "Deadline must be after the start date",
    path: ["deadline"],
  })
  .refine((g) => g.metrics.length + g.milestones.length + g.tasks.length > 0, {
    message: "Add at least one metric, milestone or task",
    path: ["metrics"],
  })
  .refine(
    (g) =>
      g.metrics.reduce((a, m) => a + m.weight, 0) +
        (g.milestones.length ? g.milestoneWeight : 0) +
        (g.tasks.length ? g.taskWeight : 0) >
      0,
    { message: "At least one component needs a weight above 0", path: ["metrics"] },
  );

export type GoalDraft = z.infer<typeof GoalDraftSchema>;
export type GoalDraftInput = z.input<typeof GoalDraftSchema>;

export const EntryInputSchema = z.object({
  metricId: z.string().min(1),
  value: finite,
  date: date,
  note: z.string().max(500).nullable().default(null),
});

export const CheckinInputSchema = z.object({
  mood: z.number().int().min(1).max(5),
  note: z.string().max(2000).nullable().default(null),
});

export const RewardInputSchema = z.object({
  title: z.string().trim().min(1, "Name the reward").max(120),
  coinCost: z.number().int().min(1).max(1_000_000),
  emoji: z.string().max(16).default("🎁"),
});

export const ParsedLogSchema = z.object({
  entries: z
    .array(z.object({ metricId: z.string(), value: finite, label: z.string().optional() }))
    .max(20),
  completions: z.array(z.object({ taskId: z.string(), label: z.string().optional() })).max(20),
  unmatched: z.array(z.string()).max(20),
});

/** What the AI returns for a goal breakdown (validated before the user sees it). */
export const AiBreakdownSchema = z.object({
  title: z.string().min(1).max(200),
  summary: z.string().max(1000),
  category: z.string().max(40),
  suggestedDeadline: date.nullable(),
  plannedWeeklyEffort: z.number().min(0).max(80).nullable(),
  metrics: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        unit: z.string().max(30),
        baseline: z.number(),
        target: z.number(),
        weight: z.number().min(0).max(1),
        aggregation: z.enum(["latest", "sum_total", "weekly_sum"]),
        weeklyTarget: z.number().nullable(),
        isKey: z.boolean(),
      }),
    )
    .min(1)
    .max(6),
  milestones: z
    .array(
      z.object({
        title: z.string().min(1).max(160),
        weeksFromStart: z.number().min(0).max(520),
        thresholdValue: z.number().nullable(),
      }),
    )
    .max(10),
  milestoneWeight: z.number().min(0).max(1),
  tasks: z
    .array(
      z.object({
        title: z.string().min(1).max(120),
        frequency: z.enum(["daily", "times_per_week", "weekdays"]),
        timesPerWeek: z.number().int().min(1).max(7).nullable(),
        weekdays: z.array(z.number().int().min(0).max(6)).nullable(),
        xpValue: z.number().int().min(5).max(100),
      }),
    )
    .max(8),
  realismNote: z.string().max(500).nullable(),
});
export type AiBreakdown = z.infer<typeof AiBreakdownSchema>;

export const AiQuestionsSchema = z.object({
  questions: z
    .array(
      z.object({ id: z.string(), question: z.string().max(200), placeholder: z.string().max(100) }),
    )
    .max(3),
});
export type AiQuestions = z.infer<typeof AiQuestionsSchema>;
