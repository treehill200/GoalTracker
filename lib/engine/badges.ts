/**
 * Badge catalogue + evaluation. All badges are original; icons come from lucide.
 */

export type BadgeTier = "bronze" | "silver" | "gold" | "epic";

export interface BadgeDef {
  key: string;
  name: string;
  description: string;
  icon: string; // lucide icon name
  tier: BadgeTier;
}

export interface BadgeStats {
  totalLogs: number;
  totalCheckins: number;
  totalTasksDone: number;
  longestStreak: number;
  milestonesCompleted: number;
  goalsCompleted: number;
  activeGoals: number;
  level: number;
  reviewsDone: number;
  rewardsRedeemed: number;
  anyAheadOfPace: boolean;
  comeback: boolean;
  earlyBird: boolean;
  nightOwl: boolean;
  perfectWeek: boolean;
  cheersReceived: number;
  integrationsConnected: number;
  aiGoalsCreated: number;
  rescuesStarted: number;
}

export const BADGES: (BadgeDef & { earned: (s: BadgeStats) => boolean })[] = [
  {
    key: "first_log",
    name: "First Step",
    description: "Log your first entry.",
    icon: "Footprints",
    tier: "bronze",
    earned: (s) => s.totalLogs >= 1,
  },
  {
    key: "streak_7",
    name: "Week Warrior",
    description: "Keep a 7-day streak.",
    icon: "Flame",
    tier: "bronze",
    earned: (s) => s.longestStreak >= 7,
  },
  {
    key: "streak_30",
    name: "Monthly Machine",
    description: "Keep a 30-day streak.",
    icon: "Flame",
    tier: "silver",
    earned: (s) => s.longestStreak >= 30,
  },
  {
    key: "streak_100",
    name: "Centurion Flame",
    description: "Keep a 100-day streak.",
    icon: "Flame",
    tier: "epic",
    earned: (s) => s.longestStreak >= 100,
  },
  {
    key: "first_milestone",
    name: "Flag Planted",
    description: "Complete your first milestone.",
    icon: "Flag",
    tier: "bronze",
    earned: (s) => s.milestonesCompleted >= 1,
  },
  {
    key: "milestones_10",
    name: "Summit Seeker",
    description: "Complete 10 milestones.",
    icon: "Mountain",
    tier: "gold",
    earned: (s) => s.milestonesCompleted >= 10,
  },
  {
    key: "comeback",
    name: "Comeback Kid",
    description: "Log again after 7+ days away.",
    icon: "RotateCcw",
    tier: "silver",
    earned: (s) => s.comeback,
  },
  {
    key: "ahead_of_pace",
    name: "Ahead of the Curve",
    description: "Get a goal ahead of pace.",
    icon: "Rocket",
    tier: "silver",
    earned: (s) => s.anyAheadOfPace,
  },
  {
    key: "goal_complete",
    name: "Mission Complete",
    description: "Finish a goal.",
    icon: "Trophy",
    tier: "gold",
    earned: (s) => s.goalsCompleted >= 1,
  },
  {
    key: "first_checkin",
    name: "Checking In",
    description: "Do your first daily check-in.",
    icon: "MessageCircleHeart",
    tier: "bronze",
    earned: (s) => s.totalCheckins >= 1,
  },
  {
    key: "checkins_30",
    name: "Self-Aware",
    description: "Do 30 daily check-ins.",
    icon: "Brain",
    tier: "silver",
    earned: (s) => s.totalCheckins >= 30,
  },
  {
    key: "logs_100",
    name: "Data Hoarder",
    description: "Log 100 entries.",
    icon: "Database",
    tier: "gold",
    earned: (s) => s.totalLogs >= 100,
  },
  {
    key: "tasks_50",
    name: "Task Crusher",
    description: "Complete 50 tasks.",
    icon: "ListChecks",
    tier: "silver",
    earned: (s) => s.totalTasksDone >= 50,
  },
  {
    key: "level_5",
    name: "Rising Star",
    description: "Reach level 5.",
    icon: "Star",
    tier: "silver",
    earned: (s) => s.level >= 5,
  },
  {
    key: "level_10",
    name: "Legend in Progress",
    description: "Reach level 10.",
    icon: "Crown",
    tier: "epic",
    earned: (s) => s.level >= 10,
  },
  {
    key: "first_review",
    name: "Reflector",
    description: "Finish a weekly review.",
    icon: "NotebookPen",
    tier: "bronze",
    earned: (s) => s.reviewsDone >= 1,
  },
  {
    key: "reward_redeemed",
    name: "Treat Yourself",
    description: "Redeem a reward from the shop.",
    icon: "Gift",
    tier: "bronze",
    earned: (s) => s.rewardsRedeemed >= 1,
  },
  {
    key: "early_bird",
    name: "Early Bird",
    description: "Log something before 7am.",
    icon: "Sunrise",
    tier: "bronze",
    earned: (s) => s.earlyBird,
  },
  {
    key: "night_owl",
    name: "Night Owl",
    description: "Log something after 10pm.",
    icon: "Moon",
    tier: "bronze",
    earned: (s) => s.nightOwl,
  },
  {
    key: "perfect_week",
    name: "Perfect Week",
    description: "Complete every scheduled task in a week.",
    icon: "CalendarCheck",
    tier: "gold",
    earned: (s) => s.perfectWeek,
  },
  {
    key: "multi_goal",
    name: "Juggler",
    description: "Run 3 active goals at once.",
    icon: "Layers",
    tier: "silver",
    earned: (s) => s.activeGoals >= 3,
  },
  {
    key: "cheered",
    name: "Squad Support",
    description: "Receive a cheer from a partner.",
    icon: "PartyPopper",
    tier: "bronze",
    earned: (s) => s.cheersReceived >= 1,
  },
  {
    key: "connected",
    name: "Plugged In",
    description: "Connect an integration.",
    icon: "Plug",
    tier: "bronze",
    earned: (s) => s.integrationsConnected >= 1,
  },
  {
    key: "ai_planner",
    name: "Master Planner",
    description: "Create a goal with the AI breakdown.",
    icon: "Sparkles",
    tier: "bronze",
    earned: (s) => s.aiGoalsCreated >= 1,
  },
  {
    key: "rescuer",
    name: "Never Give Up",
    description: "Start a rescue plan for a drifting goal.",
    icon: "LifeBuoy",
    tier: "silver",
    earned: (s) => s.rescuesStarted >= 1,
  },
];

export function badgeByKey(key: string): BadgeDef | undefined {
  return BADGES.find((b) => b.key === key);
}

/** Keys of badges that are earned by `stats` but not in `owned`. */
export function newlyEarnedBadges(stats: BadgeStats, owned: Set<string>): string[] {
  return BADGES.filter((b) => !owned.has(b.key) && b.earned(stats)).map((b) => b.key);
}
