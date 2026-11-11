/**
 * Domain types shared by the engine, the repository layer and the UI.
 * Field names are camelCase here; the Supabase repository converts them to
 * snake_case columns.
 */
import type { DateStr } from "@/lib/engine/dates";
import type { ExpectedCurve } from "@/lib/engine/progress";

export type GoalStatus = "active" | "paused" | "completed" | "archived";
export type CreatedVia = "ai" | "milestones" | "single_metric" | "weighted" | "manual";
export type MetricDirection = "increase" | "decrease";
/**
 * How entries turn into the metric's "current value":
 * - latest: the most recent entry (body weight, test score)
 * - sum_total: baseline + sum of all entries (miles run, dollars saved)
 * - weekly_sum: average weekly total over the last 4 weeks vs a weekly target (gym sessions / week)
 */
export type MetricAggregation = "latest" | "sum_total" | "weekly_sum";
export type DataSource =
  "manual" | "strava" | "health" | "csv" | "bank" | "webhook" | "ai" | "seed";

export type Recurrence =
  | { type: "daily" }
  | { type: "times_per_week"; times: number }
  | { type: "weekdays"; days: number[] } // 0 = Sunday
  | { type: "every_n_weeks"; weekday: number; interval: number; anchor: DateStr };

export interface Goal {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: string;
  status: GoalStatus;
  startDate: DateStr;
  deadline: DateStr | null;
  isOpenEnded: boolean;
  suggestedDeadline: DateStr | null;
  plannedWeeklyEffort: number | null; // hours per week
  expectedCurve: ExpectedCurve;
  createdVia: CreatedVia;
  milestoneWeight: number; // weight of the milestone component in the goal score
  taskWeight: number; // weight of the task component in the goal score
  reminderTime: string | null; // "HH:MM" local
  color: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface Metric {
  id: string;
  userId: string;
  goalId: string;
  name: string;
  unit: string;
  baseline: number;
  target: number;
  direction: MetricDirection;
  weight: number;
  aggregation: MetricAggregation;
  source: DataSource;
  /** Planned change per week (latest/sum_total). Auto-adjust rewrites this. */
  weeklyTarget: number | null;
  isKey: boolean;
  createdAt: string;
}

export interface MetricEntry {
  id: string;
  userId: string;
  metricId: string;
  value: number;
  date: DateStr; // local calendar date of the entry
  recordedAt: string; // ISO timestamp
  source: DataSource;
  note: string | null;
}

export interface Milestone {
  id: string;
  userId: string;
  goalId: string;
  title: string;
  targetDate: DateStr | null;
  order: number;
  weight: number;
  completedAt: string | null;
  /** Optional: auto-complete when this metric reaches `thresholdValue`. */
  metricId: string | null;
  thresholdValue: number | null;
}

export interface Task {
  id: string;
  userId: string;
  goalId: string;
  title: string;
  recurrence: Recurrence;
  xpValue: number;
  active: boolean;
  createdAt: string;
}

export interface TaskCompletion {
  id: string;
  userId: string;
  taskId: string;
  date: DateStr;
  completedAt: string;
}

export interface ParsedLog {
  entries: { metricId: string; value: number; label?: string }[];
  completions: { taskId: string; label?: string }[];
  unmatched: string[];
}

export interface Checkin {
  id: string;
  userId: string;
  date: DateStr;
  mood: number; // 1–5
  note: string | null;
  parsed: ParsedLog | null;
  createdAt: string;
}

export interface WeeklyReviewStats {
  weekStart: DateStr;
  logs: number;
  tasksDone: number;
  tasksScheduled: number;
  xpEarned: number;
  goals: { goalId: string; title: string; score: number; scoreChange: number; status: string }[];
}

export interface WeeklyReview {
  id: string;
  userId: string;
  goalId: string | null;
  weekStart: DateStr;
  rating: number;
  reflection: string;
  wins: string[];
  misses: string[];
  stats: WeeklyReviewStats;
  aiSuggestion: string | null;
  createdAt: string;
}

export type AdjustmentKind =
  "auto" | "push_deadline" | "commit_pace" | "rescue" | "coach" | "manual";

export interface TargetAdjustment {
  id: string;
  userId: string;
  goalId: string;
  metricId: string | null;
  kind: AdjustmentKind;
  reason: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  /** null = waiting for the user's choice, true = applied, false = declined */
  accepted: boolean | null;
  createdAt: string;
}

export interface XpEvent {
  id: string;
  userId: string;
  amount: number;
  coins: number;
  reason: string;
  refId: string | null;
  createdAt: string;
}

export interface UserBadge {
  id: string;
  userId: string;
  badgeKey: string;
  earnedAt: string;
}

export interface Reward {
  id: string;
  userId: string;
  title: string;
  coinCost: number;
  emoji: string;
  archived: boolean;
  createdAt: string;
}

export interface RewardRedemption {
  id: string;
  userId: string;
  rewardId: string;
  title: string;
  coinCost: number;
  redeemedAt: string;
}

export type CoachMood = "ecstatic" | "happy" | "neutral" | "worried" | "sad";

export interface CoachMessage {
  id: string;
  userId: string;
  goalId: string | null;
  role: "user" | "assistant";
  content: string;
  mood: CoachMood | null;
  coachId: string;
  kind: "chat" | "proactive";
  createdAt: string;
}

export interface Partnership {
  id: string;
  userId: string; // owner
  partnerId: string | null;
  inviteEmail: string | null;
  partnerName: string | null;
  shareToken: string;
  goalIds: string[];
  status: "pending" | "active" | "revoked";
  createdAt: string;
}

export interface Cheer {
  id: string;
  userId: string; // owner who receives the cheer
  partnershipId: string;
  goalId: string | null;
  fromName: string;
  emoji: string;
  message: string | null;
  createdAt: string;
}

export type IntegrationProvider = "strava" | "apple_health" | "csv" | "bank_csv" | "plaid";

export interface Integration {
  id: string;
  userId: string;
  provider: IntegrationProvider;
  connected: boolean;
  webhookSecret: string | null;
  /** Provider config, e.g. which metric receives Strava distance. Never tokens. */
  config: Record<string, unknown>;
  lastSyncedAt: string | null;
  createdAt: string;
}

export type NotificationKind =
  | "drift"
  | "reminder"
  | "checkin"
  | "weekly_review"
  | "milestone"
  | "level_up"
  | "badge"
  | "cheer"
  | "coach"
  | "adjustment"
  | "system";

export interface AppNotification {
  id: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  goalId: string | null;
  href: string | null;
  read: boolean;
  dedupeKey: string | null;
  createdAt: string;
}

export interface QuietHours {
  enabled: boolean;
  start: string; // "22:00"
  end: string; // "07:00"
}

export interface ProfileSettings {
  theme: "dark" | "light" | "system";
  checkinTime: string; // "HH:MM"
  weeklyReviewDay: number; // 0 = Sunday
  quietHours: QuietHours;
  notify: {
    push: boolean;
    drift: boolean;
    reminders: boolean;
    checkin: boolean;
    weeklyReview: boolean;
    cheers: boolean;
  };
  focusGoalId: string | null;
  /** Days covered by a streak freeze. */
  frozenDays: DateStr[];
  /** Tracks freezes already granted for the current streak run. */
  freezeAward: { streakStart: DateStr; awarded: number } | null;
  reducedMotion: boolean;
}

export interface Profile {
  id: string;
  email: string | null;
  displayName: string;
  timezone: string;
  coachId: string;
  xp: number;
  level: number;
  coins: number;
  streakFreezes: number;
  onboarded: boolean;
  settings: ProfileSettings;
  createdAt: string;
}

/** Everything the UI needs, loaded in one go. */
export interface AppData {
  profile: Profile;
  goals: Goal[];
  metrics: Metric[];
  entries: MetricEntry[];
  milestones: Milestone[];
  tasks: Task[];
  completions: TaskCompletion[];
  checkins: Checkin[];
  reviews: WeeklyReview[];
  adjustments: TargetAdjustment[];
  xpEvents: XpEvent[];
  userBadges: UserBadge[];
  rewards: Reward[];
  redemptions: RewardRedemption[];
  coachMessages: CoachMessage[];
  partnerships: Partnership[];
  cheers: Cheer[];
  integrations: Integration[];
  notifications: AppNotification[];
}

/** Everything about one goal, as the engine consumes it. */
export interface GoalBundle {
  goal: Goal;
  metrics: Metric[];
  entries: MetricEntry[];
  milestones: Milestone[];
  tasks: Task[];
  completions: TaskCompletion[];
}

/** Maps repository table names to their row types. */
export interface TableMap {
  goals: Goal;
  metrics: Metric;
  metric_entries: MetricEntry;
  milestones: Milestone;
  tasks: Task;
  task_completions: TaskCompletion;
  checkins: Checkin;
  weekly_reviews: WeeklyReview;
  target_adjustments: TargetAdjustment;
  xp_events: XpEvent;
  user_badges: UserBadge;
  rewards: Reward;
  reward_redemptions: RewardRedemption;
  coach_messages: CoachMessage;
  partnerships: Partnership;
  cheers: Cheer;
  integrations: Integration;
  notifications: AppNotification;
}

export type TableName = keyof TableMap;

/** Maps each table to its AppData key. */
export const TABLE_TO_KEY = {
  goals: "goals",
  metrics: "metrics",
  metric_entries: "entries",
  milestones: "milestones",
  tasks: "tasks",
  task_completions: "completions",
  checkins: "checkins",
  weekly_reviews: "reviews",
  target_adjustments: "adjustments",
  xp_events: "xpEvents",
  user_badges: "userBadges",
  rewards: "rewards",
  reward_redemptions: "redemptions",
  coach_messages: "coachMessages",
  partnerships: "partnerships",
  cheers: "cheers",
  integrations: "integrations",
  notifications: "notifications",
} as const satisfies Record<TableName, keyof AppData>;

export const TABLE_NAMES = Object.keys(TABLE_TO_KEY) as TableName[];

export function bundleFor(
  data: Pick<AppData, "goals" | "metrics" | "entries" | "milestones" | "tasks" | "completions">,
  goalId: string,
): GoalBundle | null {
  const goal = data.goals.find((g) => g.id === goalId);
  if (!goal) return null;
  const metrics = data.metrics.filter((m) => m.goalId === goalId);
  const metricIds = new Set(metrics.map((m) => m.id));
  const tasks = data.tasks.filter((t) => t.goalId === goalId);
  const taskIds = new Set(tasks.map((t) => t.id));
  return {
    goal,
    metrics,
    entries: data.entries.filter((e) => metricIds.has(e.metricId)),
    milestones: data.milestones
      .filter((m) => m.goalId === goalId)
      .sort((a, b) => a.order - b.order),
    tasks,
    completions: data.completions.filter((c) => taskIds.has(c.taskId)),
  };
}
