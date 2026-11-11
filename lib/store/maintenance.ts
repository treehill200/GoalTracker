/**
 * Background housekeeping that runs when the app opens and every minute:
 * level sync, streak freezes, auto-adjusting targets, drift detection,
 * reminders and weekly-review prompts. Pure: returns Ops to commit.
 */
import { computeAdjustment, isMeaningfulChange, originalWeeklyTarget } from "@/lib/engine/adjust";
import type { GoalAnalysis } from "@/lib/engine/analyze";
import { diffDays, weekStart, weekday, type DateStr } from "@/lib/engine/dates";
import { freezesNeeded, freezesToAward } from "@/lib/engine/streaks";
import { levelForXp } from "@/lib/engine/xp";
import { cannedEventMessage } from "@/lib/coach/canned";
import type { CoachId } from "@/lib/coach/personas";
import { applyOps, insertOp, profileOp, updateOp, type Op } from "@/lib/data/ops";
import { uid } from "@/lib/data/ids";
import type { AppData, NotificationKind } from "@/lib/data/types";
import { activityDates, overallStreak } from "@/lib/game";

export interface MaintenanceResult {
  ops: Op[];
  pushes: { title: string; body: string; href: string }[];
}

const nowIso = () => new Date().toISOString();

export function runMaintenance(
  input: AppData,
  analyses: Map<string, GoalAnalysis>,
  today: DateStr,
  nowTime: string,
): MaintenanceResult {
  let data = input;
  const ops: Op[] = [];
  const pushes: MaintenanceResult["pushes"] = [];
  const add = (...o: Op[]) => {
    ops.push(...o);
    data = applyOps(data, o);
  };
  const u = data.profile.id;
  const settings = () => data.profile.settings;
  const notify = (
    kind: NotificationKind,
    title: string,
    body: string,
    dedupeKey: string,
    href: string,
    goalId: string | null = null,
    push = false,
  ) => {
    if (data.notifications.some((n) => n.dedupeKey === dedupeKey)) return;
    add(
      insertOp("notifications", {
        id: uid(),
        userId: u,
        kind,
        title,
        body,
        goalId,
        href,
        read: false,
        dedupeKey,
        createdAt: nowIso(),
      }),
    );
    if (push) pushes.push({ title, body, href });
  };
  const coachSay = (
    goalId: string | null,
    event: Parameters<typeof cannedEventMessage>[1],
    mood: "sad" | "worried" | "neutral",
  ) => {
    const goal = data.goals.find((g) => g.id === goalId);
    const content = cannedEventMessage(
      data.profile.coachId as CoachId,
      event,
      { goal: goal?.title, name: data.profile.displayName },
      data.coachMessages.length,
    );
    add(
      insertOp("coach_messages", {
        id: uid(),
        userId: u,
        goalId,
        role: "assistant",
        content,
        mood,
        coachId: data.profile.coachId,
        kind: "proactive",
        createdAt: nowIso(),
      }),
    );
  };

  // 1) Level always matches XP.
  const level = levelForXp(data.profile.xp);
  if (level !== data.profile.level) add(profileOp({ level }));

  // 2) Spend streak freezes to cover missed days (only if it saves the whole gap).
  const activity = activityDates(data);
  const frozen = new Set(settings().frozenDays);
  const need = freezesNeeded(activity, frozen, data.profile.streakFreezes, today);
  if (need.length) {
    add(
      profileOp({
        streakFreezes: data.profile.streakFreezes - need.length,
        settings: { ...settings(), frozenDays: [...settings().frozenDays, ...need].slice(-60) },
      }),
    );
    notify(
      "system",
      "Streak freeze used ❄️",
      `Your streak survived ${need.length} missed day${need.length > 1 ? "s" : ""}.`,
      `freeze-${need[0]}`,
      "/rewards",
    );
  }

  // 3) Earn freezes: 1 per 7-day streak, max 2 banked.
  const streak = overallStreak(data, today);
  const award = freezesToAward(streak, settings().freezeAward, data.profile.streakFreezes);
  if (award.award > 0) {
    add(
      profileOp({
        streakFreezes: data.profile.streakFreezes + award.award,
        settings: { ...settings(), freezeAward: award.record },
      }),
    );
    notify(
      "system",
      "You earned a streak freeze ❄️",
      `${streak.current}-day streak! Freezes protect your streak on a missed day.`,
      `freeze-earned-${streak.startedOn}-${award.record?.awarded}`,
      "/rewards",
    );
  } else if (
    award.record &&
    JSON.stringify(award.record) !== JSON.stringify(settings().freezeAward)
  ) {
    add(profileOp({ settings: { ...settings(), freezeAward: award.record } }));
  }

  for (const goal of data.goals) {
    if (goal.status !== "active") continue;
    const a = analyses.get(goal.id);
    if (!a) continue;

    // 4) Auto-adjust targets for Behind / At-risk goals with a real deadline.
    if (
      !a.isOpenEnded &&
      goal.deadline &&
      (a.status === "behind" || a.status === "at_risk") &&
      a.keyMetricId
    ) {
      const key = a.metrics.find((m) => m.metric.id === a.keyMetricId)!;
      const recent = data.adjustments.filter(
        (x) =>
          x.goalId === goal.id &&
          (x.accepted === null || diffDays(today, x.createdAt.slice(0, 10)) < 7),
      );
      if (recent.length === 0 && key.metric.aggregation !== "weekly_sum") {
        const original = originalWeeklyTarget(
          key.metric.baseline,
          key.metric.target,
          goal.startDate,
          goal.deadline,
        );
        const r = computeAdjustment({
          baseline: key.metric.baseline,
          target: key.metric.target,
          current: key.current,
          startDate: goal.startDate,
          deadline: goal.deadline,
          today,
          currentWeekly: key.metric.weeklyTarget,
          originalWeekly: original,
        });
        const unit = key.metric.unit;
        if (
          r.kind === "adjusted" &&
          isMeaningfulChange(key.metric.weeklyTarget ?? original, r.newWeekly)
        ) {
          add(updateOp("metrics", key.metric.id, { weeklyTarget: r.newWeekly }));
          add(
            insertOp("target_adjustments", {
              id: uid(),
              userId: u,
              goalId: goal.id,
              metricId: key.metric.id,
              kind: "auto",
              reason: `Behind pace: spread the remaining ${round(key.metric.target - key.current)} ${unit} over ${Math.ceil(r.remainingWeeks)} weeks.`,
              before: { weeklyTarget: r.previousWeekly },
              after: { weeklyTarget: r.newWeekly, capWeekly: original * 1.5 },
              accepted: true,
              createdAt: nowIso(),
            }),
          );
          notify(
            "adjustment",
            `Plan adjusted: ${goal.title}`,
            `New weekly target: ${fmtRate(r.newWeekly)} ${unit}/week (was ${fmtRate(r.previousWeekly)}).`,
            `adj-${goal.id}-${today}`,
            `/goals/${goal.id}`,
            goal.id,
          );
        } else if (r.kind === "choice") {
          add(
            insertOp("target_adjustments", {
              id: uid(),
              userId: u,
              goalId: goal.id,
              metricId: key.metric.id,
              kind: "auto",
              reason: `Hitting the deadline needs ${fmtRate(r.requiredWeekly)} ${unit}/week, above the 1.5× cap (${fmtRate(r.capWeekly)}).`,
              before: {
                weeklyTarget: key.metric.weeklyTarget ?? original,
                deadline: goal.deadline,
              },
              after: {
                requiredWeekly: r.requiredWeekly,
                capWeekly: r.capWeekly,
                pushDeadlineTo: r.pushDeadlineTo,
              },
              accepted: null,
              createdAt: nowIso(),
            }),
          );
          notify(
            "adjustment",
            `Decision needed: ${goal.title}`,
            "Push the deadline or commit to a higher pace?",
            `adj-choice-${goal.id}-${today}`,
            `/goals/${goal.id}`,
            goal.id,
            true,
          );
        }
      }
    }

    // 5) Drift: 3 days → nudge · 7 → sad coach + push · 14 → rescue plan.
    const since = a.lastLogDate ?? "never";
    if (settings().notify.drift) {
      if (a.drift === "nudge") {
        notify(
          "drift",
          `Quick check-in on ${goal.title}?`,
          `It's been ${a.daysSinceLastLog} days. One small log keeps momentum alive.`,
          `drift-${goal.id}-nudge-${since}`,
          `/goals/${goal.id}`,
          goal.id,
        );
      } else if (a.drift === "sad") {
        if (!data.notifications.some((n) => n.dedupeKey === `drift-${goal.id}-sad-${since}`))
          coachSay(goal.id, "drift_sad", "sad");
        notify(
          "drift",
          `Your coach misses you 💙`,
          `${a.daysSinceLastLog} days since your last log on ${goal.title}.`,
          `drift-${goal.id}-sad-${since}`,
          `/goals/${goal.id}`,
          goal.id,
          true,
        );
      } else if (a.drift === "rescue") {
        if (!data.notifications.some((n) => n.dedupeKey === `drift-${goal.id}-rescue-${since}`))
          coachSay(goal.id, "rescue", "sad");
        notify(
          "drift",
          `Rescue plan ready for ${goal.title}`,
          "A smaller restart target to get you rolling again.",
          `drift-${goal.id}-rescue-${since}`,
          `/goals/${goal.id}?rescue=1`,
          goal.id,
          true,
        );
      }
    }

    // 6) Per-goal reminder time, if nothing was logged today.
    if (
      settings().notify.reminders &&
      goal.reminderTime &&
      nowTime >= goal.reminderTime &&
      !a.streak.activeToday
    ) {
      notify(
        "reminder",
        `Reminder: ${goal.title}`,
        a.nextAction,
        `reminder-${goal.id}-${today}`,
        `/goals/${goal.id}`,
        goal.id,
        true,
      );
    }
  }

  // 7) Daily check-in reminder.
  if (
    settings().notify.checkin &&
    nowTime >= settings().checkinTime &&
    !data.checkins.some((c) => c.date === today)
  ) {
    notify(
      "checkin",
      "Daily check-in",
      "How did today go? It takes 20 seconds.",
      `checkin-${today}`,
      "/log?tab=checkin",
      null,
      true,
    );
  }

  // 8) Weekly review on the chosen day.
  const ws = weekStart(today);
  if (
    settings().notify.weeklyReview &&
    weekday(today) === settings().weeklyReviewDay &&
    !data.reviews.some((r) => r.weekStart === ws)
  ) {
    if (!data.notifications.some((n) => n.dedupeKey === `review-${ws}`))
      coachSay(null, "weekly_review", "neutral");
    notify(
      "weekly_review",
      "Weekly review time",
      "Look back at your week and plan the next one.",
      `review-${ws}`,
      "/review",
      null,
      true,
    );
  }

  return { ops, pushes };
}

function round(x: number) {
  return Math.abs(x) >= 100 ? Math.round(x) : Math.round(x * 10) / 10;
}
function fmtRate(x: number) {
  return (x > 0 ? "+" : "") + round(x);
}
