import type { ProfileSettings } from "./types";

export function defaultSettings(): ProfileSettings {
  return {
    theme: "dark",
    checkinTime: "21:00",
    weeklyReviewDay: 0,
    quietHours: { enabled: true, start: "22:00", end: "07:00" },
    notify: { push: false, drift: true, reminders: true, checkin: true, weeklyReview: true, cheers: true },
    focusGoalId: null,
    frozenDays: [],
    freezeAward: null,
    reducedMotion: false,
  };
}
