/**
 * The repository interface. The UI only ever talks to this; it never knows
 * whether data lives in the browser (demo mode) or in Supabase.
 */
import type { Op } from "./ops";
import type { AppData, Cheer, GoalBundle } from "./types";

export interface SharedView {
  ownerName: string;
  partnerName: string | null;
  partnershipId: string;
  level: number;
  goals: GoalBundle[];
  cheers: Cheer[];
}

export interface CheerInput {
  fromName: string;
  emoji: string;
  message: string | null;
  goalId: string | null;
}

export interface Repository {
  readonly kind: "local" | "supabase";
  readonly userId: string;
  /** Load everything for the signed-in (or demo) user. */
  loadAll(): Promise<AppData>;
  /** Apply one write. Throws on network failure so the outbox can retry. */
  apply(op: Op): Promise<void>;
  /** Read-only partner view by share token. */
  getSharedView(token: string): Promise<SharedView | null>;
  sendCheer(token: string, cheer: CheerInput): Promise<void>;
  /** Permanently delete all of the user's data. */
  deleteAccount(): Promise<void>;
  /** Demo only: wipe and re-seed. */
  reset?(): Promise<void>;
}

/** Errors that mean "try again later" (offline, timeouts), as opposed to bad data. */
export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /fetch|network|failed to fetch|load failed|timeout|offline/i.test(msg);
}
