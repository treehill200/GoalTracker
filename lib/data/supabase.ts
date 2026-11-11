/**
 * Supabase repository. Runs in the browser with the user's session; Row Level
 * Security guarantees each user can only touch their own rows.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Op } from "./ops";
import type { CheerInput, Repository, SharedView } from "./repository";
import { fromRow, toRow } from "./mapping";
import { TABLE_NAMES, TABLE_TO_KEY, type AppData, type Profile, type TableName } from "./types";
import { defaultSettings } from "./defaults";

/** Columns stored as Postgres numeric (PostgREST returns them as strings). */
const NUMERIC: Partial<Record<TableName, string[]>> = {
  metrics: ["baseline", "target", "weight", "weeklyTarget"],
  metric_entries: ["value"],
  milestones: ["weight", "thresholdValue"],
  goals: ["plannedWeeklyEffort", "milestoneWeight", "taskWeight"],
};

function normalize<T>(table: TableName, row: Record<string, unknown>): T {
  const obj = fromRow<Record<string, unknown>>(row);
  for (const k of NUMERIC[table] ?? []) if (obj[k] !== null && obj[k] !== undefined) obj[k] = Number(obj[k]);
  return obj as T;
}

export class SupabaseRepository implements Repository {
  readonly kind = "supabase" as const;

  constructor(
    private readonly sb: SupabaseClient,
    readonly userId: string,
    private readonly email: string | null,
  ) {}

  private check<T>(res: { data: T; error: { message: string } | null }): T {
    if (res.error) throw new Error(res.error.message);
    return res.data;
  }

  async loadAll(): Promise<AppData> {
    const profileRes = await this.sb.from("profiles").select("*").eq("id", this.userId).maybeSingle();
    let profileRow = this.check(profileRes) as Record<string, unknown> | null;
    if (!profileRow) {
      // The signup trigger normally creates this; create it if it is missing.
      const fresh = {
        id: this.userId,
        email: this.email,
        display_name: this.email?.split("@")[0] ?? "Goal getter",
        settings: defaultSettings(),
      };
      profileRow = this.check(await this.sb.from("profiles").upsert(fresh).select("*").single()) as Record<string, unknown>;
    }
    const profile = fromRow<Profile>(profileRow);
    profile.settings = { ...defaultSettings(), ...(profile.settings ?? {}) };

    const tables = await Promise.all(
      TABLE_NAMES.map(async (t) => {
        const rows = this.check(await this.sb.from(t).select("*").eq("user_id", this.userId)) as Record<string, unknown>[];
        return [t, rows.map((r) => normalize(t, r))] as const;
      }),
    );
    const data = { profile } as AppData;
    for (const [t, rows] of tables) (data as unknown as Record<string, unknown>)[TABLE_TO_KEY[t]] = rows;
    return data;
  }

  async apply(op: Op): Promise<void> {
    switch (op.kind) {
      case "profile":
        this.check(await this.sb.from("profiles").update(toRow(op.patch)).eq("id", this.userId));
        return;
      case "insert":
        this.check(await this.sb.from(op.table).upsert({ ...toRow(op.row), user_id: this.userId }));
        return;
      case "update":
        this.check(await this.sb.from(op.table).update(toRow(op.patch)).eq("id", op.id));
        return;
      case "remove":
        this.check(await this.sb.from(op.table).delete().eq("id", op.id));
        return;
    }
  }

  async getSharedView(token: string): Promise<SharedView | null> {
    return fetchSharedView(this.sb, token);
  }

  async sendCheer(token: string, cheer: CheerInput): Promise<void> {
    return sendCheerRpc(this.sb, token, cheer);
  }

  async deleteAccount(): Promise<void> {
    const res = await fetch("/api/account", { method: "DELETE" });
    if (!res.ok) throw new Error("Could not delete account");
    await this.sb.auth.signOut();
  }
}

/** Shared view via a SECURITY DEFINER function, so anonymous partners can use share links. */
export async function fetchSharedView(sb: SupabaseClient, token: string): Promise<SharedView | null> {
  const { data, error } = await sb.rpc("get_shared_view", { p_token: token });
  if (error) throw new Error(error.message);
  if (!data) return null;
  const raw = data as {
    owner_name: string;
    partner_name: string | null;
    partnership_id: string;
    level: number;
    goals: { goal: Record<string, unknown>; metrics: Record<string, unknown>[]; entries: Record<string, unknown>[]; milestones: Record<string, unknown>[]; tasks: Record<string, unknown>[]; completions: Record<string, unknown>[] }[];
    cheers: Record<string, unknown>[];
  };
  return {
    ownerName: raw.owner_name,
    partnerName: raw.partner_name,
    partnershipId: raw.partnership_id,
    level: raw.level,
    goals: raw.goals.map((g) => ({
      goal: normalize("goals", g.goal),
      metrics: (g.metrics ?? []).map((r) => normalize("metrics", r)),
      entries: (g.entries ?? []).map((r) => normalize("metric_entries", r)),
      milestones: (g.milestones ?? []).map((r) => normalize("milestones", r)),
      tasks: (g.tasks ?? []).map((r) => normalize("tasks", r)),
      completions: (g.completions ?? []).map((r) => normalize("task_completions", r)),
    })),
    cheers: (raw.cheers ?? []).map((r) => normalize("cheers", r)),
  };
}

export async function sendCheerRpc(sb: SupabaseClient, token: string, cheer: CheerInput): Promise<void> {
  const { error } = await sb.rpc("send_cheer", {
    p_token: token,
    p_from_name: cheer.fromName,
    p_emoji: cheer.emoji,
    p_message: cheer.message,
    p_goal_id: cheer.goalId,
  });
  if (error) throw new Error(error.message);
}
