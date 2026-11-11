/**
 * Domain actions. Each one builds a list of Ops (plus side-effects like XP and
 * badges), then hands them to `commit`, which applies them optimistically and
 * persists them (or queues them while offline).
 */
import { toast } from "sonner";
import { analyzeGoal, type GoalAnalysis } from "@/lib/engine/analyze";
import { addDays, diffDays, weekStart, type DateStr } from "@/lib/engine/dates";
import { rescuePlan } from "@/lib/engine/drift";
import { hasReached } from "@/lib/engine/rates";
import { XP_RULES, milestoneXp } from "@/lib/engine/xp";
import { cannedEventMessage, type CoachEvent, type MessageVars } from "@/lib/coach/canned";
import type { CoachId } from "@/lib/coach/personas";
import type { PlanChange } from "@/lib/coach/plan";
import { applyOps, insertOp, profileOp, removeOp, updateOp, type Op } from "@/lib/data/ops";
import { randomToken, uid } from "@/lib/data/ids";
import { GoalDraftSchema, type GoalDraftInput } from "@/lib/data/schemas";
import {
  bundleFor,
  type AppData,
  type AppNotification,
  type CoachMessage,
  type DataSource,
  type Goal,
  type Integration,
  type Metric,
  type Milestone,
  type NotificationKind,
  type ParsedLog,
  type ProfileSettings,
  type Recurrence,
  type Reward,
  type Task,
  type WeeklyReview,
} from "@/lib/data/types";
import { awardXp, checkBadges, type Celebration } from "@/lib/game";

export interface ActionContext {
  get: () => AppData;
  commit: (ops: Op[]) => Promise<void>;
  today: () => DateStr;
  celebrate: (c: Celebration[]) => void;
  analyzeAll: (d: AppData) => Map<string, GoalAnalysis>;
  /** Show a system notification (respecting settings/quiet hours). */
  systemNotify: (title: string, body: string, href?: string) => void;
}

const nowIso = () => new Date().toISOString();

export function createActions(ctx: ActionContext) {
  /** Accumulates ops + celebrations against a working copy of the data. */
  class Tx {
    ops: Op[] = [];
    celebrations: Celebration[] = [];
    data: AppData;
    constructor() {
      this.data = ctx.get();
    }
    add(...ops: Op[]) {
      this.ops.push(...ops);
      this.data = applyOps(this.data, ops);
    }
    xp(amount: number, reason: string, refId: string | null = null) {
      const r = awardXp(this.data, amount, reason, refId);
      this.ops.push(...r.ops);
      this.celebrations.push(...r.celebrations);
      this.data = r.data;
      for (const c of r.celebrations) if (c.type === "level") this.coach(null, "level_up", { level: c.level });
    }
    notify(kind: NotificationKind, title: string, body: string, opts: { goalId?: string | null; href?: string | null; dedupeKey?: string | null } = {}) {
      if (opts.dedupeKey && this.data.notifications.some((n) => n.dedupeKey === opts.dedupeKey)) return false;
      const n: AppNotification = {
        id: uid(),
        userId: this.data.profile.id,
        kind,
        title,
        body,
        goalId: opts.goalId ?? null,
        href: opts.href ?? null,
        read: false,
        dedupeKey: opts.dedupeKey ?? null,
        createdAt: nowIso(),
      };
      this.add(insertOp("notifications", n));
      return true;
    }
    coach(goalId: string | null, event: CoachEvent, vars: MessageVars) {
      const coachId = this.data.profile.coachId as CoachId;
      const goal = goalId ? this.data.goals.find((g) => g.id === goalId) : null;
      const content = cannedEventMessage(coachId, event, { name: this.data.profile.displayName, goal: goal?.title, ...vars }, this.data.coachMessages.length);
      const msg: CoachMessage = {
        id: uid(),
        userId: this.data.profile.id,
        goalId,
        role: "assistant",
        content,
        mood: event === "drift_sad" ? "sad" : event === "drift_nudge" ? "worried" : "happy",
        coachId,
        kind: "proactive",
        createdAt: nowIso(),
      };
      this.add(insertOp("coach_messages", msg));
    }
    /** After logging: milestones, weekly targets, goal completion, badges. */
    goalEffects(goalId: string) {
      const today = ctx.today();
      const bundle = bundleFor(this.data, goalId);
      if (!bundle || bundle.goal.status !== "active") return;
      const ordered = bundle.milestones;
      // Auto-complete threshold milestones.
      for (const [i, m] of ordered.entries()) {
        if (m.completedAt || !m.metricId || m.thresholdValue === null) continue;
        const metric = bundle.metrics.find((x) => x.id === m.metricId);
        if (!metric) continue;
        const a = analyzeGoal(bundleFor(this.data, goalId)!, { today, skipHistory: true });
        const cur = a.metrics.find((x) => x.metric.id === metric.id)?.current ?? metric.baseline;
        if (hasReached(metric.baseline, m.thresholdValue, cur)) this.completeMilestone(m, i, ordered.length, bundle.goal);
      }
      const a = analyzeGoal(bundleFor(this.data, goalId)!, { today, skipHistory: true });
      // Weekly targets: once per metric per week.
      const ws = weekStart(today);
      for (const m of a.metrics) {
        const ref = `wk-${m.metric.id}-${ws}`;
        if (m.thisWeek.hit && !this.data.xpEvents.some((e) => e.refId === ref)) {
          this.xp(XP_RULES.weeklyTarget, `Weekly target: ${m.metric.name}`, ref);
        }
      }
      if (a.score >= 99.999 && bundle.goal.status === "active") this.completeGoal(bundle.goal);
    }
    completeMilestone(m: Milestone, index: number, total: number, goal: Goal) {
      const xp = milestoneXp(index, total);
      this.add(updateOp("milestones", m.id, { completedAt: nowIso() }));
      this.xp(xp, `Milestone: ${m.title}`, m.id);
      this.celebrations.push({ id: uid(), type: "milestone", title: m.title, goalTitle: goal.title, xp });
      this.notify("milestone", `Milestone reached: ${m.title}`, goal.title, { goalId: goal.id, href: `/goals/${goal.id}`, dedupeKey: `ms-${m.id}` });
      this.coach(goal.id, "milestone", { milestone: m.title });
    }
    completeGoal(goal: Goal) {
      this.add(updateOp("goals", goal.id, { status: "completed", completedAt: nowIso() }));
      this.xp(XP_RULES.goalComplete, `Goal complete: ${goal.title}`, goal.id);
      this.celebrations.push({ id: uid(), type: "goal", goalId: goal.id, title: goal.title });
      this.coach(goal.id, "goal_complete", {});
    }
    async done() {
      const badges = checkBadges(this.data, ctx.analyzeAll(this.data), ctx.today());
      this.add(...badges.ops);
      this.celebrations.push(...badges.celebrations);
      await ctx.commit(this.ops);
      if (this.celebrations.length) ctx.celebrate(this.celebrations);
    }
  }

  const goalOfMetric = (d: AppData, metricId: string) => d.metrics.find((m) => m.id === metricId)?.goalId ?? null;

  const actions = {
    // ------------------------------------------------------------ logging
    async logEntries(items: { metricId: string; value: number; date?: DateStr; note?: string | null; source?: DataSource; recordedAt?: string }[], opts: { xp?: boolean } = {}) {
      const tx = new Tx();
      const goals = new Set<string>();
      for (const it of items) {
        if (!Number.isFinite(it.value)) continue;
        const id = uid();
        tx.add(
          insertOp("metric_entries", {
            id,
            userId: tx.data.profile.id,
            metricId: it.metricId,
            value: it.value,
            date: it.date ?? ctx.today(),
            recordedAt: it.recordedAt ?? nowIso(),
            source: it.source ?? "manual",
            note: it.note ?? null,
          }),
        );
        const g = goalOfMetric(tx.data, it.metricId);
        if (g) goals.add(g);
        if (opts.xp !== false) tx.xp(XP_RULES.log, "Logged progress", id);
      }
      goals.forEach((g) => tx.goalEffects(g));
      await tx.done();
    },

    async logEntry(metricId: string, value: number, date?: DateStr, note?: string | null) {
      await actions.logEntries([{ metricId, value, date, note }]);
    },

    async deleteEntry(id: string) {
      await ctx.commit([removeOp("metric_entries", id)]);
    },

    async toggleTask(taskId: string, date: DateStr, done: boolean) {
      const tx = new Tx();
      const task = tx.data.tasks.find((t) => t.id === taskId);
      if (!task) return;
      const existing = tx.data.completions.find((c) => c.taskId === taskId && c.date === date);
      if (done && !existing) {
        const id = uid();
        tx.add(insertOp("task_completions", { id, userId: tx.data.profile.id, taskId, date, completedAt: nowIso() }));
        tx.xp(task.xpValue || XP_RULES.taskDefault, `Task: ${task.title}`, `task-${taskId}-${date}`);
        tx.goalEffects(task.goalId);
      } else if (!done && existing) {
        tx.add(removeOp("task_completions", existing.id));
        // Un-checking takes the XP back so it can't be farmed.
        const earned = tx.data.xpEvents.find((e) => e.refId === `task-${taskId}-${date}` && e.amount > 0);
        if (earned) tx.xp(-earned.amount, `Undo task: ${task.title}`, `undo-${taskId}-${date}`);
      }
      await tx.done();
    },

    /** Saves a confirmed natural-language parse (entries + task completions). */
    async saveParsed(parsed: ParsedLog, date?: DateStr) {
      const d = date ?? ctx.today();
      await actions.logEntries(parsed.entries.map((e) => ({ metricId: e.metricId, value: e.value, date: d, source: "ai" as const })));
      for (const c of parsed.completions) await actions.toggleTask(c.taskId, d, true);
    },

    async checkin(input: { mood: number; note: string | null; parsed: ParsedLog | null }) {
      const tx = new Tx();
      const today = ctx.today();
      const existing = tx.data.checkins.find((c) => c.date === today);
      const row = { id: existing?.id ?? uid(), userId: tx.data.profile.id, date: today, mood: input.mood, note: input.note, parsed: input.parsed, createdAt: nowIso() };
      tx.add(insertOp("checkins", row));
      if (!existing) tx.xp(XP_RULES.checkin, "Daily check-in", row.id);
      await tx.done();
      if (input.parsed) await actions.saveParsed(input.parsed, today);
    },

    // -------------------------------------------------------------- goals
    async createGoal(input: GoalDraftInput): Promise<string> {
      const draft = GoalDraftSchema.parse(input);
      const tx = new Tx();
      const u = tx.data.profile.id;
      const goalId = uid();
      const created = nowIso();
      tx.add(
        insertOp("goals", {
          id: goalId,
          userId: u,
          title: draft.title,
          description: draft.description,
          category: draft.category,
          status: "active",
          startDate: draft.startDate,
          deadline: draft.isOpenEnded ? null : draft.deadline,
          isOpenEnded: draft.isOpenEnded,
          suggestedDeadline: draft.suggestedDeadline,
          plannedWeeklyEffort: draft.plannedWeeklyEffort,
          expectedCurve: draft.expectedCurve,
          createdVia: draft.createdVia,
          milestoneWeight: draft.milestones.length ? draft.milestoneWeight : 0,
          taskWeight: draft.tasks.length ? draft.taskWeight : 0,
          reminderTime: draft.reminderTime,
          color: draft.color,
          completedAt: null,
          createdAt: created,
        }),
      );
      const metricIds: string[] = [];
      const hasKey = draft.metrics.some((m) => m.isKey);
      draft.metrics.forEach((m, i) => {
        const id = uid();
        metricIds.push(id);
        tx.add(
          insertOp("metrics", {
            id,
            userId: u,
            goalId,
            name: m.name,
            unit: m.unit,
            baseline: m.aggregation === "weekly_sum" ? 0 : m.baseline,
            target: m.target,
            direction: m.target >= m.baseline ? "increase" : "decrease",
            weight: m.weight,
            aggregation: m.aggregation,
            source: "manual",
            weeklyTarget: m.weeklyTarget,
            isKey: m.isKey || (!hasKey && i === 0 && m.aggregation !== "weekly_sum"),
            createdAt: created,
          }),
        );
      });
      draft.milestones.forEach((m, i) => {
        tx.add(
          insertOp("milestones", {
            id: uid(),
            userId: u,
            goalId,
            title: m.title,
            targetDate: m.targetDate,
            order: i,
            weight: m.weight,
            completedAt: null,
            metricId: m.metricIndex !== null ? (metricIds[m.metricIndex] ?? null) : null,
            thresholdValue: m.thresholdValue,
          }),
        );
      });
      draft.tasks.forEach((t) => {
        tx.add(insertOp("tasks", { id: uid(), userId: u, goalId, title: t.title, recurrence: t.recurrence, xpValue: t.xpValue, active: true, createdAt: created }));
      });
      if (!tx.data.profile.settings.focusGoalId) tx.add(profileOp({ settings: { ...tx.data.profile.settings, focusGoalId: goalId } }));
      await tx.done();
      return goalId;
    },

    /** Save an edited goal: keeps ids (and history) of existing metrics/milestones/tasks. */
    async updateGoalFromDraft(goalId: string, input: GoalDraftInput) {
      const draft = GoalDraftSchema.parse(input);
      const tx = new Tx();
      const u = tx.data.profile.id;
      const now = nowIso();
      const goal = tx.data.goals.find((g) => g.id === goalId);
      if (!goal) return;
      tx.add(
        updateOp("goals", goalId, {
          title: draft.title,
          description: draft.description,
          category: draft.category,
          startDate: draft.startDate,
          deadline: draft.isOpenEnded ? null : draft.deadline,
          isOpenEnded: draft.isOpenEnded,
          suggestedDeadline: draft.suggestedDeadline,
          plannedWeeklyEffort: draft.plannedWeeklyEffort,
          expectedCurve: draft.expectedCurve,
          milestoneWeight: draft.milestones.length ? draft.milestoneWeight : 0,
          taskWeight: draft.tasks.length ? draft.taskWeight : 0,
          reminderTime: draft.reminderTime,
        }),
      );
      const oldMetrics = tx.data.metrics.filter((m) => m.goalId === goalId);
      const metricIds = draft.metrics.map((m) => m.id ?? uid());
      for (const old of oldMetrics) if (!metricIds.includes(old.id)) tx.add(removeOp("metrics", old.id));
      draft.metrics.forEach((m, i) => {
        const prev = oldMetrics.find((o) => o.id === metricIds[i]);
        tx.add(
          insertOp("metrics", {
            id: metricIds[i], userId: u, goalId, name: m.name, unit: m.unit,
            baseline: m.aggregation === "weekly_sum" ? 0 : m.baseline, target: m.target,
            direction: m.target >= m.baseline ? "increase" : "decrease", weight: m.weight, aggregation: m.aggregation,
            source: prev?.source ?? "manual", weeklyTarget: m.weeklyTarget, isKey: m.isKey, createdAt: prev?.createdAt ?? now,
          }),
        );
      });
      const oldMs = tx.data.milestones.filter((m) => m.goalId === goalId);
      const msIds = draft.milestones.map((m) => m.id ?? uid());
      for (const old of oldMs) if (!msIds.includes(old.id)) tx.add(removeOp("milestones", old.id));
      draft.milestones.forEach((m, i) => {
        tx.add(
          insertOp("milestones", {
            id: msIds[i], userId: u, goalId, title: m.title, targetDate: m.targetDate, order: i, weight: m.weight,
            completedAt: m.completedAt ?? null, metricId: m.metricIndex !== null ? (metricIds[m.metricIndex] ?? null) : null, thresholdValue: m.thresholdValue,
          }),
        );
      });
      const oldTasks = tx.data.tasks.filter((t) => t.goalId === goalId);
      const taskIds = draft.tasks.map((t) => t.id ?? uid());
      for (const old of oldTasks) if (!taskIds.includes(old.id)) tx.add(removeOp("tasks", old.id));
      draft.tasks.forEach((t, i) => {
        const prev = oldTasks.find((o) => o.id === taskIds[i]);
        tx.add(insertOp("tasks", { id: taskIds[i], userId: u, goalId, title: t.title, recurrence: t.recurrence, xpValue: t.xpValue, active: true, createdAt: prev?.createdAt ?? now }));
      });
      if (draft.metrics.length) tx.goalEffects(goalId);
      await tx.done();
    },

    async updateGoal(id: string, patch: Partial<Goal>) {
      await ctx.commit([updateOp("goals", id, patch)]);
    },

    async setGoalStatus(id: string, status: Goal["status"]) {
      const tx = new Tx();
      const goal = tx.data.goals.find((g) => g.id === id);
      if (!goal) return;
      if (status === "completed" && goal.status !== "completed") tx.completeGoal(goal);
      else tx.add(updateOp("goals", id, { status, completedAt: status === "completed" ? goal.completedAt : null }));
      await tx.done();
    },

    async deleteGoal(id: string) {
      await ctx.commit([removeOp("goals", id)]);
    },

    async upsertMetric(m: Metric) {
      await ctx.commit([insertOp("metrics", m)]);
    },
    async removeMetric(id: string) {
      await ctx.commit([removeOp("metrics", id)]);
    },
    async upsertMilestone(m: Milestone) {
      await ctx.commit([insertOp("milestones", m)]);
    },
    async removeMilestone(id: string) {
      await ctx.commit([removeOp("milestones", id)]);
    },
    async toggleMilestone(id: string, done: boolean) {
      const tx = new Tx();
      const m = tx.data.milestones.find((x) => x.id === id);
      if (!m) return;
      const goal = tx.data.goals.find((g) => g.id === m.goalId)!;
      const all = tx.data.milestones.filter((x) => x.goalId === m.goalId).sort((a, b) => a.order - b.order);
      if (done && !m.completedAt) {
        tx.completeMilestone(m, all.findIndex((x) => x.id === id), all.length, goal);
        tx.goalEffects(goal.id);
      } else if (!done && m.completedAt) tx.add(updateOp("milestones", id, { completedAt: null }));
      await tx.done();
    },
    async upsertTask(t: Task) {
      await ctx.commit([insertOp("tasks", t)]);
    },
    async addTask(goalId: string, title: string, recurrence: Recurrence, xpValue = XP_RULES.taskDefault) {
      const d = ctx.get();
      await ctx.commit([insertOp("tasks", { id: uid(), userId: d.profile.id, goalId, title, recurrence, xpValue, active: true, createdAt: nowIso() })]);
    },
    async removeTask(id: string) {
      await ctx.commit([removeOp("tasks", id)]);
    },

    // ------------------------------------------------- adjustments & rescue
    /** Apply the user's choice on a pending "can't hit the deadline within the cap" adjustment. */
    async resolveAdjustment(id: string, choice: "push_deadline" | "commit_pace" | "dismiss") {
      const tx = new Tx();
      const adj = tx.data.adjustments.find((a) => a.id === id);
      if (!adj) return;
      const after = adj.after as { pushDeadlineTo?: string; requiredWeekly?: number };
      if (choice === "push_deadline" && after.pushDeadlineTo) {
        tx.add(updateOp("goals", adj.goalId, { deadline: after.pushDeadlineTo }));
        tx.add(updateOp("target_adjustments", id, { accepted: true, kind: "push_deadline" }));
        if (adj.metricId) tx.add(updateOp("metrics", adj.metricId, { weeklyTarget: null }));
      } else if (choice === "commit_pace" && adj.metricId && after.requiredWeekly !== undefined) {
        tx.add(updateOp("metrics", adj.metricId, { weeklyTarget: after.requiredWeekly }));
        tx.add(updateOp("target_adjustments", id, { accepted: true, kind: "commit_pace" }));
      } else {
        tx.add(updateOp("target_adjustments", id, { accepted: false }));
      }
      await tx.done();
    },

    /** Rescue plan: a smaller restart milestone, pushed deadline, logged in history. */
    async startRescue(goalId: string) {
      const tx = new Tx();
      const bundle = bundleFor(tx.data, goalId);
      if (!bundle) return;
      const today = ctx.today();
      const a = analyzeGoal(bundle, { today, skipHistory: true });
      const key = a.metrics.find((m) => m.metric.id === a.keyMetricId) ?? a.metrics[0];
      if (!key) return;
      const plan = rescuePlan({
        current: key.current,
        target: key.metric.target,
        weeklyTarget: key.plannedPerWeek,
        today,
        deadline: bundle.goal.deadline,
        daysAway: a.daysSinceLastLog,
        unit: key.metric.unit,
      });
      const ms: Milestone = {
        id: uid(),
        userId: tx.data.profile.id,
        goalId,
        title: `Restart: reach ${plan.restartTarget} ${key.metric.unit}`,
        targetDate: plan.restartBy,
        order: -1,
        weight: 1,
        completedAt: null,
        metricId: key.metric.aggregation === "weekly_sum" ? null : key.metric.id,
        thresholdValue: key.metric.aggregation === "weekly_sum" ? null : plan.restartTarget,
      };
      tx.add(insertOp("milestones", ms));
      if (plan.newDeadline) tx.add(updateOp("goals", goalId, { deadline: plan.newDeadline }));
      tx.add(
        insertOp("target_adjustments", {
          id: uid(),
          userId: tx.data.profile.id,
          goalId,
          metricId: key.metric.id,
          kind: "rescue",
          reason: plan.summary,
          before: { deadline: bundle.goal.deadline },
          after: { deadline: plan.newDeadline, restartTarget: plan.restartTarget, restartBy: plan.restartBy },
          accepted: true,
          createdAt: nowIso(),
        }),
      );
      tx.xp(XP_RULES.rescue, "Started a rescue plan", goalId);
      tx.coach(goalId, "rescue", {});
      await tx.done();
    },

    /** One-tap plan change suggested by the coach (after the user confirms). */
    async applyPlanChange(c: PlanChange) {
      const tx = new Tx();
      const goal = tx.data.goals.find((g) => g.id === c.goalId);
      if (!goal) throw new Error("That goal no longer exists");
      const log = (before: Record<string, unknown>, after: Record<string, unknown>, metricId: string | null = null) =>
        tx.add(insertOp("target_adjustments", { id: uid(), userId: tx.data.profile.id, goalId: goal.id, metricId, kind: "coach", reason: c.reason, before, after, accepted: true, createdAt: nowIso() }));
      switch (c.type) {
        case "set_weekly_target":
        case "set_target": {
          const m = tx.data.metrics.find((x) => x.id === c.metricId && x.goalId === goal.id);
          if (!m) throw new Error("That metric no longer exists");
          const field = c.type === "set_target" ? "target" : "weeklyTarget";
          log({ [field]: m[field] }, { [field]: c.value }, m.id);
          tx.add(updateOp("metrics", m.id, { [field]: c.value }));
          break;
        }
        case "set_deadline":
          log({ deadline: goal.deadline }, { deadline: c.deadline });
          tx.add(updateOp("goals", goal.id, { deadline: c.deadline, isOpenEnded: false }));
          break;
        case "add_task":
          tx.add(insertOp("tasks", { id: uid(), userId: tx.data.profile.id, goalId: goal.id, title: c.title, recurrence: c.recurrence, xpValue: XP_RULES.taskDefault, active: true, createdAt: nowIso() }));
          log({}, { task: c.title });
          break;
        case "pause_goal":
          tx.add(updateOp("goals", goal.id, { status: "paused" }));
          log({ status: goal.status }, { status: "paused" });
          break;
      }
      await tx.done();
    },

    // ------------------------------------------------------------- reviews
    async saveReview(review: Omit<WeeklyReview, "id" | "userId" | "createdAt">) {
      const tx = new Tx();
      const existing = tx.data.reviews.find((r) => r.weekStart === review.weekStart && r.goalId === review.goalId);
      const row: WeeklyReview = { id: existing?.id ?? uid(), userId: tx.data.profile.id, createdAt: nowIso(), ...review };
      tx.add(insertOp("weekly_reviews", row));
      if (!existing) tx.xp(XP_RULES.weeklyReview, "Weekly review", row.id);
      await tx.done();
    },

    // ------------------------------------------------------------- rewards
    async upsertReward(input: { id?: string; title: string; coinCost: number; emoji: string }) {
      const d = ctx.get();
      const existing = d.rewards.find((r) => r.id === input.id);
      const row: Reward = { id: existing?.id ?? uid(), userId: d.profile.id, archived: false, createdAt: existing?.createdAt ?? nowIso(), title: input.title, coinCost: input.coinCost, emoji: input.emoji };
      await ctx.commit([insertOp("rewards", row)]);
    },
    async archiveReward(id: string) {
      await ctx.commit([updateOp("rewards", id, { archived: true })]);
    },
    async redeemReward(id: string) {
      const tx = new Tx();
      const r = tx.data.rewards.find((x) => x.id === id);
      if (!r) return;
      if (tx.data.profile.coins < r.coinCost) {
        toast.error(`You need ${r.coinCost - tx.data.profile.coins} more coins`);
        return;
      }
      tx.add(insertOp("reward_redemptions", { id: uid(), userId: tx.data.profile.id, rewardId: r.id, title: r.title, coinCost: r.coinCost, redeemedAt: nowIso() }));
      tx.add(profileOp({ coins: tx.data.profile.coins - r.coinCost }));
      await tx.done();
      toast.success(`Enjoy: ${r.emoji} ${r.title}!`);
    },

    // --------------------------------------------------------------- coach
    async addCoachMessage(m: Omit<CoachMessage, "id" | "userId" | "createdAt">) {
      const d = ctx.get();
      const row: CoachMessage = { id: uid(), userId: d.profile.id, createdAt: nowIso(), ...m };
      await ctx.commit([insertOp("coach_messages", row)]);
      return row;
    },
    async updateCoachMessage(id: string, content: string) {
      await ctx.commit([updateOp("coach_messages", id, { content })]);
    },
    async clearChat() {
      const d = ctx.get();
      await ctx.commit(d.coachMessages.filter((m) => m.kind === "chat").map((m) => removeOp("coach_messages", m.id)));
    },

    // ------------------------------------------------------------ partners
    async createPartnership(input: { inviteEmail: string | null; partnerName: string | null; goalIds: string[] }) {
      const d = ctx.get();
      const row = { id: uid(), userId: d.profile.id, partnerId: null, shareToken: randomToken(16), status: "active" as const, createdAt: nowIso(), ...input };
      await ctx.commit([insertOp("partnerships", row)]);
      return row;
    },
    async updatePartnership(id: string, patch: { goalIds?: string[]; partnerName?: string | null; status?: "active" | "revoked" }) {
      await ctx.commit([updateOp("partnerships", id, patch)]);
    },

    // ------------------------------------------------------- notifications
    async notify(kind: NotificationKind, title: string, body: string, opts: { goalId?: string | null; href?: string | null; dedupeKey?: string | null; push?: boolean } = {}) {
      const tx = new Tx();
      const created = tx.notify(kind, title, body, opts);
      await tx.done();
      if (created && opts.push) ctx.systemNotify(title, body, opts.href ?? undefined);
    },
    async markRead(id: string) {
      await ctx.commit([updateOp("notifications", id, { read: true })]);
    },
    async markAllRead() {
      const d = ctx.get();
      await ctx.commit(d.notifications.filter((n) => !n.read).map((n) => updateOp("notifications", n.id, { read: true })));
    },

    // -------------------------------------------------------- integrations
    async upsertIntegration(input: Partial<Integration> & { provider: Integration["provider"] }) {
      const tx = new Tx();
      const existing = tx.data.integrations.find((i) => i.provider === input.provider);
      const row: Integration = {
        id: existing?.id ?? uid(),
        userId: tx.data.profile.id,
        connected: false,
        webhookSecret: null,
        config: {},
        lastSyncedAt: null,
        createdAt: existing?.createdAt ?? nowIso(),
        ...existing,
        ...input,
      };
      tx.add(insertOp("integrations", row));
      await tx.done();
      return row;
    },

    // ------------------------------------------------------------- profile
    async updateProfile(patch: Partial<Omit<AppData["profile"], "settings">>) {
      await ctx.commit([profileOp(patch)]);
    },
    async updateSettings(patch: Partial<ProfileSettings>) {
      const d = ctx.get();
      await ctx.commit([profileOp({ settings: { ...d.profile.settings, ...patch } })]);
    },
    async setCoach(coachId: CoachId) {
      await ctx.commit([profileOp({ coachId })]);
    },
  };
  return actions;
}

export type Actions = ReturnType<typeof createActions>;

/** Small helper for "x days ago" style checks in maintenance. */
export function daysAgo(iso: string, today: DateStr) {
  return diffDays(today, iso.slice(0, 10));
}
export { addDays };
