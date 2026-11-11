/**
 * Demo seed data: two goals with ~6 weeks of realistic history, generated
 * relative to `today` so the charts always look "live". Deterministic: the
 * same `today` always produces the same data (seeded PRNG), which keeps unit
 * tests stable and lets scripts/generate-seed-sql.ts emit a matching seed.sql.
 */
import { addDays, weekday, type DateStr } from "@/lib/engine/dates";
import { isDueOn } from "@/lib/engine/recurrence";
import type {
  AppData,
  Checkin,
  CoachMessage,
  Goal,
  Metric,
  MetricEntry,
  Milestone,
  Profile,
  Task,
  TaskCompletion,
  WeeklyReview,
  XpEvent,
} from "./types";

export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";
export const DEMO_SHARE_TOKEN = "demo-share-alex-7f3k2";
export const HISTORY_DAYS = 42;

/** mulberry32: tiny deterministic PRNG. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic UUID (v4 layout) from a label, so ids are stable across runs. */
export function seedId(label: string): string {
  let h = 2166136261;
  for (let i = 0; i < label.length; i++) h = Math.imul(h ^ label.charCodeAt(i), 16777619);
  const r = prng(h >>> 0);
  const hex = Array.from({ length: 32 }, () => Math.floor(r() * 16).toString(16));
  hex[12] = "4";
  hex[16] = "89ab"[Math.floor(r() * 4)];
  const s = hex.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

const at = (date: DateStr, time: string) => `${date}T${time}:00.000Z`;

export const SEED_IDS = {
  goalSat: seedId("goal-sat"),
  goalMuscle: seedId("goal-muscle"),
  mSat: seedId("m-sat-score"),
  mHours: seedId("m-study-hours"),
  mWeight: seedId("m-body-weight"),
  mGym: seedId("m-gym"),
  mProtein: seedId("m-protein"),
  tSection: seedId("t-section"),
  tFullTest: seedId("t-full-test"),
  tReview: seedId("t-review"),
  tLift: seedId("t-lift"),
  tWeigh: seedId("t-weigh"),
  partnership: seedId("partner-alex"),
};

export function buildSeed(today: DateStr): AppData {
  const rand = prng(20260101);
  const u = DEMO_USER_ID;
  const start = addDays(today, -HISTORY_DAYS);
  const created = at(start, "09:00");
  const I = SEED_IDS;

  const goals: Goal[] = [
    {
      id: I.goalSat,
      userId: u,
      title: "Get a 1500+ on the SAT",
      description: "Raise my practice test score from 1180 to 1500 before test day.",
      category: "Education",
      status: "active",
      startDate: start,
      deadline: addDays(today, 150),
      isOpenEnded: false,
      suggestedDeadline: addDays(today, 150),
      plannedWeeklyEffort: 6,
      expectedCurve: "linear",
      createdVia: "ai",
      milestoneWeight: 0.3,
      taskWeight: 0,
      reminderTime: "18:00",
      color: "#E5484D",
      completedAt: null,
      createdAt: created,
    },
    {
      id: I.goalMuscle,
      userId: u,
      title: "Gain 20 lbs of lean muscle",
      description: "Slow, steady lean bulk. No deadline — consistency wins.",
      category: "Fitness",
      status: "active",
      startDate: start,
      deadline: null,
      isOpenEnded: true,
      suggestedDeadline: addDays(start, 280),
      plannedWeeklyEffort: 5,
      expectedCurve: "linear",
      createdVia: "weighted",
      milestoneWeight: 0,
      taskWeight: 0,
      reminderTime: "07:30",
      color: "#3E8EF7",
      completedAt: null,
      createdAt: created,
    },
  ];

  const metric = (m: Omit<Metric, "userId" | "createdAt" | "source">): Metric => ({
    ...m,
    userId: u,
    createdAt: created,
    source: "manual",
  });
  const metrics: Metric[] = [
    metric({
      id: I.mSat,
      goalId: I.goalSat,
      name: "Practice test score",
      unit: "points",
      baseline: 1180,
      target: 1500,
      direction: "increase",
      weight: 0.5,
      aggregation: "latest",
      weeklyTarget: null,
      isKey: true,
    }),
    metric({
      id: I.mHours,
      goalId: I.goalSat,
      name: "Study hours",
      unit: "hours",
      baseline: 0,
      target: 6,
      direction: "increase",
      weight: 0.2,
      aggregation: "weekly_sum",
      weeklyTarget: null,
      isKey: false,
    }),
    metric({
      id: I.mWeight,
      goalId: I.goalMuscle,
      name: "Body weight",
      unit: "lb",
      baseline: 150,
      target: 170,
      direction: "increase",
      weight: 0.4,
      aggregation: "latest",
      weeklyTarget: 0.5,
      isKey: true,
    }),
    metric({
      id: I.mGym,
      goalId: I.goalMuscle,
      name: "Gym sessions",
      unit: "sessions",
      baseline: 0,
      target: 4,
      direction: "increase",
      weight: 0.3,
      aggregation: "weekly_sum",
      weeklyTarget: null,
      isKey: false,
    }),
    metric({
      id: I.mProtein,
      goalId: I.goalMuscle,
      name: "Protein goal days",
      unit: "days",
      baseline: 0,
      target: 6,
      direction: "increase",
      weight: 0.3,
      aggregation: "weekly_sum",
      weeklyTarget: null,
      isKey: false,
    }),
  ];

  const entries: MetricEntry[] = [];
  const completions: TaskCompletion[] = [];
  const entry = (
    metricId: string,
    date: DateStr,
    value: number,
    time = "19:00",
    note: string | null = null,
  ) =>
    entries.push({
      id: seedId(`e-${metricId}-${date}-${entries.length}`),
      userId: u,
      metricId,
      value,
      date,
      recordedAt: at(date, time),
      source: "seed",
      note,
    });
  const complete = (taskId: string, date: DateStr, time = "19:30") =>
    completions.push({
      id: seedId(`c-${taskId}-${date}`),
      userId: u,
      taskId,
      date,
      completedAt: at(date, time),
    });

  // --- Goal A: SAT (slightly behind pace) -------------------------------
  // Quiet patch 3 days ago keeps the streak short so the coach looks worried.
  const satGap = new Set([addDays(today, -3), addDays(today, -4)]);
  const satScores: [number, number][] = [
    [0, 1180],
    [7, 1190],
    [14, 1210],
    [21, 1200],
    [28, 1220],
    [35, 1230],
    [41, 1240],
  ];
  for (const [offset, score] of satScores)
    entry(
      I.mSat,
      addDays(start, offset),
      score,
      "12:30",
      offset === 0 ? "Diagnostic test" : "Full practice test",
    );
  // First Saturday on/after start anchors the "every other Saturday" test.
  let anchor = start;
  while (weekday(anchor) !== 6) anchor = addDays(anchor, 1);
  for (let d = 0; d < HISTORY_DAYS; d++) {
    const date = addDays(start, d);
    if (satGap.has(date)) continue;
    if (rand() < 0.82) {
      complete(I.tSection, date, "17:45");
      entry(I.mHours, date, Math.round((0.5 + rand() * 0.6) * 4) / 4, "18:30");
    }
    if ([1, 3, 5].includes(weekday(date)) && rand() < 0.75) complete(I.tReview, date, "20:00");
    if (isDueOn({ type: "every_n_weeks", weekday: 6, interval: 2, anchor }, date) && rand() < 0.9)
      complete(I.tFullTest, date, "12:00");
  }

  // --- Goal B: muscle (on track / slightly ahead) ------------------------
  // One full rest day (the most recent Sunday at least a week ago) keeps the
  // streak in the 7–13 day range, so the coach is happy rather than ecstatic.
  let gymGap = addDays(today, -7);
  while (weekday(gymGap) !== 0) gymGap = addDays(gymGap, -1);
  let weight = 150;
  for (let d = 0; d <= HISTORY_DAYS; d++) {
    const date = addDays(start, d);
    if (date === gymGap) continue;
    const wd = weekday(date);
    weight += 0.082 + (rand() - 0.5) * 0.04;
    // Weigh in Mon / Wed / Fri (+ today) with scale noise.
    if ([1, 3, 5].includes(wd) || date === today) {
      const noisy = Math.round((weight + (rand() - 0.5) * 0.4) * 10) / 10;
      entry(I.mWeight, date, noisy, "07:15");
      complete(I.tWeigh, date, "07:16");
    }
    // Lift Mon / Tue / Thu / Sat with the occasional swap.
    let active = [1, 3, 5].includes(wd) || date === today;
    if ([1, 2, 4, 6].includes(wd) && rand() < 0.92) {
      entry(I.mGym, date, 1, "17:30");
      complete(I.tLift, date, "17:31");
      active = true;
    }
    // Protein is logged at night; on days without other activity it's always logged.
    if (date !== today && (!active || rand() < 0.86)) entry(I.mProtein, date, 1, "21:30");
  }

  const milestones: Milestone[] = [
    ...[
      ["Diagnostic test done", 0, null],
      ["Score 1300", 60, 1300],
      ["Score 1400", 115, 1400],
      ["Score 1450", 160, 1450],
      ["Score 1500", HISTORY_DAYS + 150, 1500],
    ].map(([title, offset, threshold], i): Milestone => ({
      id: seedId(`ms-sat-${i}`),
      userId: u,
      goalId: I.goalSat,
      title: title as string,
      targetDate: addDays(start, offset as number),
      order: i,
      weight: 1,
      completedAt: i === 0 ? at(start, "12:45") : null,
      metricId: threshold === null ? null : I.mSat,
      thresholdValue: threshold as number | null,
    })),
    ...[5, 10, 15, 20].map((gain, i): Milestone => ({
      id: seedId(`ms-muscle-${i}`),
      userId: u,
      goalId: I.goalMuscle,
      title: `+${gain} lb`,
      targetDate: null,
      order: i,
      weight: 1,
      completedAt: null,
      metricId: I.mWeight,
      thresholdValue: 150 + gain,
    })),
  ];

  const task = (t: Omit<Task, "userId" | "createdAt" | "active">): Task => ({
    ...t,
    userId: u,
    createdAt: created,
    active: true,
  });
  const tasks: Task[] = [
    task({
      id: I.tSection,
      goalId: I.goalSat,
      title: "1 practice section",
      recurrence: { type: "daily" },
      xpValue: 15,
    }),
    task({
      id: I.tFullTest,
      goalId: I.goalSat,
      title: "Full practice test",
      recurrence: { type: "every_n_weeks", weekday: 6, interval: 2, anchor },
      xpValue: 60,
    }),
    task({
      id: I.tReview,
      goalId: I.goalSat,
      title: "Review mistakes",
      recurrence: { type: "times_per_week", times: 3 },
      xpValue: 20,
    }),
    task({
      id: I.tLift,
      goalId: I.goalMuscle,
      title: "Lift weights",
      recurrence: { type: "times_per_week", times: 4 },
      xpValue: 25,
    }),
    task({
      id: I.tWeigh,
      goalId: I.goalMuscle,
      title: "Log body weight",
      recurrence: { type: "times_per_week", times: 3 },
      xpValue: 10,
    }),
  ];

  const checkins: Checkin[] = [];
  const notes = [
    "Felt focused today.",
    "Tired but showed up.",
    "Great session!",
    "Busy day, kept it short.",
    null,
    null,
  ];
  for (let d = 1; d < HISTORY_DAYS; d++) {
    if (rand() < 0.25) continue;
    const date = addDays(start, d);
    checkins.push({
      id: seedId(`ci-${date}`),
      userId: u,
      date,
      mood: Math.min(5, Math.max(1, Math.round(3.4 + (rand() - 0.5) * 2.4))),
      note: notes[Math.floor(rand() * notes.length)],
      parsed: null,
      createdAt: at(date, "21:00"),
    });
  }

  const reviews: WeeklyReview[] = [1, 2, 3, 4].map((w) => {
    const ws = addDays(today, -7 * w - ((weekday(today) + 6) % 7));
    return {
      id: seedId(`review-${w}`),
      userId: u,
      goalId: null,
      weekStart: ws,
      rating: [4, 3, 4, 3][w - 1],
      reflection: [
        "Solid week. Lifting felt strong; SAT practice was a bit rushed.",
        "Missed two study sessions because of exams at school.",
        "Good momentum on both goals.",
        "First full week — still building the habit.",
      ][w - 1],
      wins: [
        ["4 gym sessions", "Protein 6/7 days"],
        ["Kept the streak alive"],
        ["New best practice score"],
        ["Started both goals"],
      ][w - 1],
      misses: [["Only 4.5 study hours"], ["Skipped review sessions"], [], ["Logged weight late"]][
        w - 1
      ],
      stats: {
        weekStart: ws,
        logs: 18 - w,
        tasksDone: 14 - w,
        tasksScheduled: 17,
        xpEarned: 320 - w * 20,
        goals: [],
      },
      aiSuggestion: "Block two 45-minute SAT sessions on weekends to make up the study-hour gap.",
      createdAt: at(addDays(ws, 6), "19:00"),
    };
  });

  const xpEvents: XpEvent[] = [];
  let xpTotal = 0;
  for (let d = 0; d < HISTORY_DAYS; d += 3) {
    const amount = 30 + Math.floor(rand() * 40);
    xpTotal += amount;
    xpEvents.push({
      id: seedId(`xp-${d}`),
      userId: u,
      amount,
      coins: Math.round(amount / 2),
      reason: "Logging & tasks",
      refId: null,
      createdAt: at(addDays(start, d), "20:00"),
    });
  }
  xpEvents.push({
    id: seedId("xp-ms"),
    userId: u,
    amount: 100,
    coins: 50,
    reason: "Milestone: Diagnostic test done",
    refId: milestones[0].id,
    createdAt: at(start, "12:45"),
  });
  xpTotal += 100;
  const xp = Math.max(xpTotal, 1720);

  const profile: Profile = {
    id: u,
    email: "demo@goaltracker.local",
    displayName: "Demo User",
    timezone: "UTC",
    coachId: "blaze",
    xp,
    level: 0, // recomputed by the store from xp
    coins: 640,
    streakFreezes: 1,
    onboarded: true,
    createdAt: created,
    settings: {
      theme: "dark",
      checkinTime: "21:00",
      weeklyReviewDay: 0,
      quietHours: { enabled: true, start: "22:30", end: "07:00" },
      notify: {
        push: false,
        drift: true,
        reminders: true,
        checkin: true,
        weeklyReview: true,
        cheers: true,
      },
      focusGoalId: I.goalSat,
      frozenDays: [],
      freezeAward: null,
      reducedMotion: false,
    },
  };

  const coachMessages: CoachMessage[] = [
    {
      id: seedId("cm-1"),
      userId: u,
      goalId: I.goalSat,
      role: "assistant",
      content:
        "Your practice scores are climbing, but a bit slower than the plan. Two extra focused sections this week would close the gap. You've got this!",
      mood: "worried",
      coachId: "blaze",
      kind: "proactive",
      createdAt: at(addDays(today, -2), "18:05"),
    },
    {
      id: seedId("cm-2"),
      userId: u,
      goalId: I.goalMuscle,
      role: "assistant",
      content:
        "Body weight is trending up right on schedule. Keep stacking those lifting sessions!",
      mood: "happy",
      coachId: "blaze",
      kind: "proactive",
      createdAt: at(addDays(today, -1), "08:00"),
    },
  ];

  return {
    profile,
    goals,
    metrics,
    entries,
    milestones,
    tasks,
    completions,
    checkins,
    reviews,
    adjustments: [],
    xpEvents,
    userBadges: [
      "first_log",
      "streak_7",
      "first_milestone",
      "first_checkin",
      "ai_planner",
      "early_bird",
      "first_review",
    ].map((k, i) => ({
      id: seedId(`ub-${k}`),
      userId: u,
      badgeKey: k,
      earnedAt: at(addDays(start, i * 5), "20:00"),
    })),
    rewards: [
      ["Watch a movie", 200, "🎬"],
      ["Pizza night", 350, "🍕"],
      ["Guilt-free day off", 500, "🛋️"],
      ["New running shoes", 2000, "👟"],
    ].map(([title, coinCost, emoji], i) => ({
      id: seedId(`reward-${i}`),
      userId: u,
      title: title as string,
      coinCost: coinCost as number,
      emoji: emoji as string,
      archived: false,
      createdAt: created,
    })),
    redemptions: [
      {
        id: seedId("redeem-1"),
        userId: u,
        rewardId: seedId("reward-0"),
        title: "Watch a movie",
        coinCost: 200,
        redeemedAt: at(addDays(today, -14), "20:30"),
      },
    ],
    coachMessages,
    partnerships: [
      {
        id: I.partnership,
        userId: u,
        partnerId: null,
        inviteEmail: "alex@example.com",
        partnerName: "Alex",
        shareToken: DEMO_SHARE_TOKEN,
        goalIds: [I.goalMuscle],
        status: "active",
        createdAt: at(addDays(today, -20), "10:00"),
      },
    ],
    cheers: [
      {
        id: seedId("cheer-1"),
        userId: u,
        partnershipId: I.partnership,
        goalId: I.goalMuscle,
        fromName: "Alex",
        emoji: "💪",
        message: "Look at that trend line!",
        createdAt: at(addDays(today, -6), "12:00"),
      },
      {
        id: seedId("cheer-2"),
        userId: u,
        partnershipId: I.partnership,
        goalId: I.goalMuscle,
        fromName: "Alex",
        emoji: "🔥",
        message: null,
        createdAt: at(addDays(today, -1), "09:30"),
      },
    ],
    integrations: [],
    notifications: [
      {
        id: seedId("n-1"),
        userId: u,
        kind: "cheer",
        title: "Alex cheered you on 🔥",
        body: "Gain 20 lbs of lean muscle",
        goalId: I.goalMuscle,
        href: `/goals/${I.goalMuscle}`,
        read: false,
        dedupeKey: null,
        createdAt: at(addDays(today, -1), "09:30"),
      },
      {
        id: seedId("n-2"),
        userId: u,
        kind: "coach",
        title: "Blaze has a tip for your SAT goal",
        body: "Two extra focused sections this week would close the gap.",
        goalId: I.goalSat,
        href: "/coach",
        read: true,
        dedupeKey: null,
        createdAt: at(addDays(today, -2), "18:05"),
      },
    ],
  };
}
