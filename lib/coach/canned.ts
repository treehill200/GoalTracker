/**
 * Persona-specific canned messages, chosen by mood and event. Used whenever no
 * AI key is configured (and as instant proactive messages).
 */
import type { CoachMood } from "@/lib/data/types";
import type { CoachId } from "./personas";

export type CoachEvent =
  | "drift_nudge"
  | "drift_sad"
  | "rescue"
  | "milestone"
  | "level_up"
  | "weekly_review"
  | "log"
  | "goal_complete";

export interface MessageVars {
  name?: string;
  goal?: string;
  streak?: number;
  next?: string;
  pace?: string;
  milestone?: string;
  level?: number;
}

type Table = { mood: Record<CoachMood, string[]>; events: Record<CoachEvent, string[]> };

const T: Record<CoachId, Table> = {
  blaze: {
    mood: {
      ecstatic: [
        "You're ON FIRE with {goal}! Ahead of pace and stacking wins. Keep the heat coming 🔥",
        "{streak}-day streak and climbing — this is what unstoppable looks like!",
      ],
      happy: [
        "Right on track with {goal}. Momentum is real — next up: {next}!",
        "Love this rhythm! Keep showing up and {goal} doesn't stand a chance.",
      ],
      neutral: [
        "Solid base on {goal}. Let's light it up today: {next}.",
        "Steady is good — let's turn steady into SURGE. {next}.",
      ],
      worried: [
        "{goal} is slipping a bit behind pace. No panic — one big session today flips the script!",
        "We're a little behind on {goal}. Comebacks are my favorite genre. {next}!",
      ],
      sad: [
        "Hey, I miss our sessions on {goal}. One tiny log today and the fire's back.",
        "It's been quiet. No guilt — just one small step and we're rolling again.",
      ],
    },
    events: {
      drift_nudge: ["Three days off {goal}? Let's spark it back up with something small today!"],
      drift_sad: [
        "A week away from {goal}. I'm still here, still believing. One log — that's all it takes.",
      ],
      rescue: ["Time for a COMEBACK plan. Smaller target, quick win, big energy. Let's go!"],
      milestone: ["MILESTONE SMASHED: {milestone}! That's what I'm talking about! 🚀"],
      level_up: ["LEVEL {level}! You just leveled up your life. Keep climbing!"],
      weekly_review: [
        "Weekly review time! Let's look at the highlight reel and plan the next big week.",
      ],
      log: ["Logged! Every entry is fuel."],
      goal_complete: ["YOU DID IT! {goal} is DONE! Absolute legend behavior!"],
    },
  },
  sage: {
    mood: {
      ecstatic: [
        "You are moving ahead of your plan on {goal}. Enjoy it, and keep the pace gentle enough to last.",
        "A {streak}-day streak is a well-worn path. Walk it with pride.",
      ],
      happy: [
        "{goal} is on track. The quiet consistency is doing its work. Next: {next}.",
        "Steady progress. This is how lasting change looks.",
      ],
      neutral: [
        "Each day is a small stone on the path to {goal}. Today's stone: {next}.",
        "Nothing urgent, nothing wrong. Simply continue: {next}.",
      ],
      worried: [
        "{goal} is drifting a little behind. That is information, not failure. Perhaps adjust the plan to fit your season.",
        "The pace has slowed. Let's look at what got in the way, kindly.",
      ],
      sad: [
        "It has been a while. The path is still here, and so am I. Begin again with something small.",
        "Rest is part of every journey. When you're ready, one gentle step on {goal}.",
      ],
    },
    events: {
      drift_nudge: ["A few quiet days on {goal}. A small return today keeps the thread unbroken."],
      drift_sad: ["A week has passed. Let's not judge it — just choose one easy action for today."],
      rescue: [
        "When the river is too wide, we find a narrower crossing. Here is a smaller restart.",
      ],
      milestone: ["You reached {milestone}. Pause and notice how far you've come."],
      level_up: ["Level {level}. Growth that you earned, one day at a time."],
      weekly_review: [
        "A good week deserves reflection. Let's look back calmly and choose next week's focus.",
      ],
      log: ["Noted. Another step taken."],
      goal_complete: ["{goal} is complete. Take a breath and honor the work."],
    },
  },
  sarge: {
    mood: {
      ecstatic: [
        "Outstanding, recruit! {goal} is ahead of schedule. Do not get comfortable. Maintain.",
        "{streak} days without breaking formation. That's discipline.",
      ],
      happy: [
        "{goal}: on track. Good work. Next objective: {next}. Move out.",
        "Consistent execution. That's what I want to see.",
      ],
      neutral: [
        "Status: holding. Today's objective: {next}. Report back when complete.",
        "No medals for average, but no demerits either. Push today.",
      ],
      worried: [
        "{goal} is falling behind pace. I'm not mad, I'm mobilizing you. Double down today.",
        "Behind schedule. We fix it with action, not excuses. {next}.",
      ],
      sad: [
        "Recruit, it's been too long. I don't need perfect — I need you back on the field. One log.",
        "The mission isn't over. Regroup, report in, and we march again.",
      ],
    },
    events: {
      drift_nudge: [
        "Three days off {goal}. Get back in formation today. Small mission, full effort.",
      ],
      drift_sad: ["Seven days of radio silence. I'm still here. Check in, soldier."],
      rescue: ["New battle plan: smaller objective, tighter timeline. Execute."],
      milestone: ["Objective secured: {milestone}. Well done. Next target acquired."],
      level_up: ["Promotion! Level {level}. You earned that rank."],
      weekly_review: ["After-action report time. Wins, misses, adjustments. Let's go."],
      log: ["Logged. Good."],
      goal_complete: ["Mission accomplished: {goal}. Proud of you, recruit."],
    },
  },
  pip: {
    mood: {
      ecstatic: [
        "WHEEE! You're ahead on {goal}! I'm doing cartwheels over here 🎉",
        "{streak}-day streak?! You're streak-tacular! ✨",
      ],
      happy: [
        "Yay, {goal} is right on track! Gimme a G-O-A-L! Next: {next} 📣",
        "You're doing amazing, sweetie-pie! Keep it up!",
      ],
      neutral: [
        "Hi hi! Ready for some {goal} fun? Today's mini-quest: {next}!",
        "Let's make today a little bit legendary! {next} 🌟",
      ],
      worried: [
        "Uh-oh, {goal} is a teeny bit behind. That's okay — we've got pom-poms AND a plan! {next}",
        "Little slump? Let's bounce back like a happy kangaroo! 🦘",
      ],
      sad: [
        "I miss you! 🥺 No pressure — just one tiny log and I'll do my happy dance again.",
        "My pom-poms are droopy... but one small step on {goal} would totally fluff them up!",
      ],
    },
    events: {
      drift_nudge: ["Psst! {goal} misses you! Tiny log today? Pretty please? 🌈"],
      drift_sad: [
        "It's been a week and I'm sad-ish! But zero judgment — come back whenever, I'll be here cheering.",
      ],
      rescue: ["Rescue mission! Smaller goal, quicker win, maximum confetti!"],
      milestone: ["{milestone}?! Confetti cannon: ACTIVATED! 🎊"],
      level_up: ["Level {level}! Level-tastic! Leveliscious! 🎉"],
      weekly_review: ["Weekly review party! Let's look at your wins (and snacks, probably)."],
      log: ["Logged! You're a log-ical genius!"],
      goal_complete: ["{goal} is DONE! Best. Day. EVER! 🎉🎉🎉"],
    },
  },
};

function fill(template: string, vars: MessageVars): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = vars[k as keyof MessageVars];
    return v === undefined || v === null
      ? k === "next"
        ? "log one thing"
        : k === "goal"
          ? "your goal"
          : ""
      : String(v);
  });
}

const DEFAULTED = new Set(["next", "goal"]);

/**
 * Deterministic pick so messages don't flicker on re-render. Prefers templates
 * whose placeholders are all available (e.g. skips "{streak}-day…" without a streak).
 */
function pick(list: string[], seed: number, vars: MessageVars = {}) {
  const usable = list.filter((t) =>
    [...t.matchAll(/\{(\w+)\}/g)].every(
      ([, k]) =>
        DEFAULTED.has(k) ||
        (vars[k as keyof MessageVars] !== undefined &&
          vars[k as keyof MessageVars] !== null &&
          vars[k as keyof MessageVars] !== 0),
    ),
  );
  const pool = usable.length ? usable : list;
  return pool[Math.abs(Math.floor(seed)) % pool.length];
}

export function cannedMoodMessage(
  coach: CoachId,
  mood: CoachMood,
  vars: MessageVars,
  seed = 0,
): string {
  return fill(pick(T[coach].mood[mood], seed, vars), vars);
}

export function cannedEventMessage(
  coach: CoachId,
  event: CoachEvent,
  vars: MessageVars,
  seed = 0,
): string {
  return fill(pick(T[coach].events[event], seed, vars), vars);
}

/** Simple rule-based replies for chat when there is no AI key. */
export function cannedChatReply(
  coach: CoachId,
  mood: CoachMood,
  question: string,
  vars: MessageVars,
): string {
  const q = question.toLowerCase();
  const base = cannedMoodMessage(coach, mood, vars, question.length);
  if (/behind|catch up|slow|late/.test(q))
    return `${base}\n\nTo catch up: the goal dashboard automatically spreads the remaining gap over the weeks you have left (capped at 1.5× your original pace). If that isn't enough, it asks you to choose between pushing the deadline and committing to a higher pace.`;
  if (/motivat|tired|lazy|don't feel|unmotivated/.test(q))
    return `${base}\n\nTry the 2-minute rule: do the smallest possible version of the task right now. Starting is the hard part.`;
  if (/deadline|when.*finish|done by/.test(q))
    return `${base}\n\nYour projected finish date is on the goal dashboard ("At this pace you'll finish on…"). It updates every time you log.`;
  return `${base}\n\n(Running in offline coach mode — add an AI key in .env.local for full conversations.)`;
}
