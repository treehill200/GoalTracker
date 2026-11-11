/**
 * Applies the real migrations + seed.sql to an in-process Postgres (PGlite)
 * with a tiny Supabase auth stub, then checks Row Level Security.
 */
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { DEMO_SHARE_TOKEN, DEMO_USER_ID, SEED_IDS } from "@/lib/data/seed";

const ALICE = DEMO_USER_ID; // owns the seed data
const BOB = "22222222-2222-4222-8222-222222222222";
const TABLES = [
  "goals", "metrics", "metric_entries", "milestones", "tasks", "task_completions", "checkins", "weekly_reviews",
  "xp_events", "user_badges", "rewards", "reward_redemptions", "coach_messages", "partnerships", "cheers", "notifications",
];

let db: PGlite;

async function as(user: string | null, sql: string, params: unknown[] = []) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? ""]);
  await db.exec(user ? "set role authenticated" : "set role anon");
  try {
    return await db.query<Record<string, unknown>>(sql, params);
  } finally {
    await db.exec("reset role");
  }
}

beforeAll(async () => {
  db = new PGlite();
  const read = (p: string) => fs.readFileSync(path.resolve(p), "utf8");
  await db.exec(read("tests/sql/supabase-stub.sql"));
  for (const f of fs.readdirSync("supabase/migrations").sort()) await db.exec(read(`supabase/migrations/${f}`));
  await db.exec(read("tests/sql/grants.sql"));
  await db.exec(read("supabase/seed.sql"));
  await db.query("insert into auth.users (id, email) values ($1, 'bob@example.com')", [BOB]);
}, 60_000);

describe("seed.sql", () => {
  it("loads the two demo goals with history", async () => {
    const r = await db.query<{ n: number }>("select count(*)::int as n from goals");
    expect(r.rows[0].n).toBe(2);
    const e = await db.query<{ n: number }>("select count(*)::int as n from metric_entries");
    expect(e.rows[0].n).toBeGreaterThan(80);
    const b = await db.query<{ n: number }>("select count(*)::int as n from badges");
    expect(b.rows[0].n).toBeGreaterThanOrEqual(15);
  });
  it("auto-creates a profile on signup", async () => {
    const r = await db.query("select display_name from profiles where id = $1", [BOB]);
    expect(r.rows).toEqual([{ display_name: "bob" }]);
  });
});

describe("row level security", () => {
  it("lets the owner read their own rows", async () => {
    for (const t of TABLES) {
      const r = await as(ALICE, `select count(*)::int as n from ${t}`);
      expect((r.rows[0] as { n: number }).n, t).toBeGreaterThanOrEqual(t === "user_badges" || t === "cheers" ? 1 : 0);
    }
    expect((await as(ALICE, "select count(*)::int as n from goals")).rows[0]).toEqual({ n: 2 });
  });

  it("prevents another user from reading anything that isn't shared", async () => {
    for (const t of TABLES) {
      if (["goals", "metrics", "metric_entries", "milestones", "tasks", "task_completions"].includes(t)) continue;
      const r = await as(BOB, `select count(*)::int as n from ${t}`);
      expect((r.rows[0] as { n: number }).n, t).toBe(0);
    }
    expect((await as(BOB, "select count(*)::int as n from goals")).rows[0]).toEqual({ n: 0 });
    expect((await as(BOB, "select count(*)::int as n from metric_entries")).rows[0]).toEqual({ n: 0 });
    expect((await as(BOB, "select count(*)::int as n from profiles")).rows[0]).toEqual({ n: 1 }); // only his own
  });

  it("prevents anonymous visitors from reading tables directly", async () => {
    expect((await as(null, "select count(*)::int as n from goals")).rows[0]).toEqual({ n: 0 });
    expect((await as(null, "select count(*)::int as n from profiles")).rows[0]).toEqual({ n: 0 });
  });

  it("prevents writing into someone else's goal", async () => {
    await expect(
      as(BOB, "insert into metrics (user_id, goal_id, name, target) values ($1, $2, 'hack', 1)", [BOB, SEED_IDS.goalSat]),
    ).rejects.toThrow(/row-level security/);
    await expect(
      as(BOB, "insert into goals (user_id, title) values ($1, 'spoof')", [ALICE]),
    ).rejects.toThrow(/row-level security/);
    const upd = await as(BOB, "update goals set title = 'pwned' where id = $1 returning id", [SEED_IDS.goalSat]);
    expect(upd.rows).toEqual([]);
    const del = await as(BOB, "delete from metric_entries returning id");
    expect(del.rows).toEqual([]);
  });

  it("hides integration tokens from everyone but the server", async () => {
    await db.query("insert into integration_tokens (user_id, provider, tokens_encrypted) values ($1, 'strava', 'x')", [ALICE]);
    expect((await as(ALICE, "select count(*)::int as n from integration_tokens")).rows[0]).toEqual({ n: 0 });
  });

  it("lets a partner read only the goals explicitly shared with them", async () => {
    await as(BOB, "select accept_partnership($1)", [DEMO_SHARE_TOKEN]);
    const goals = await as(BOB, "select id from goals");
    expect(goals.rows).toEqual([{ id: SEED_IDS.goalMuscle }]);
    const metrics = await as(BOB, "select distinct goal_id from metrics");
    expect(metrics.rows).toEqual([{ goal_id: SEED_IDS.goalMuscle }]);
    const entries = await as(BOB, "select count(*)::int as n from metric_entries");
    expect((entries.rows[0] as { n: number }).n).toBeGreaterThan(0);
    // Read-only: partners can't edit shared goals.
    const upd = await as(BOB, "update goals set title = 'x' where id = $1 returning id", [SEED_IDS.goalMuscle]);
    expect(upd.rows).toEqual([]);
    // Other private data stays private.
    expect((await as(BOB, "select count(*)::int as n from checkins")).rows[0]).toEqual({ n: 0 });
  });

  it("serves the share-link view and cheers to anonymous visitors, until revoked", async () => {
    const view = await as(null, "select get_shared_view($1) as v", [DEMO_SHARE_TOKEN]);
    const v = (view.rows[0] as { v: { goals: { goal: { id: string } }[] } }).v;
    expect(v.goals.map((g) => g.goal.id)).toEqual([SEED_IDS.goalMuscle]);

    await as(null, "select send_cheer($1, 'Sam', '🎉', 'Go go go', $2)", [DEMO_SHARE_TOKEN, SEED_IDS.goalMuscle]);
    const cheers = await as(ALICE, "select from_name from cheers where from_name = 'Sam'");
    expect(cheers.rows).toHaveLength(1);
    await expect(as(null, "select send_cheer($1, 'Sam', '🎉', null, $2)", [DEMO_SHARE_TOKEN, SEED_IDS.goalSat])).rejects.toThrow(/not shared/);

    await as(ALICE, "update partnerships set status = 'revoked' where share_token = $1", [DEMO_SHARE_TOKEN]);
    const after = await as(null, "select get_shared_view($1) as v", [DEMO_SHARE_TOKEN]);
    expect((after.rows[0] as { v: unknown }).v).toBeNull();
    expect((await as(BOB, "select count(*)::int as n from goals")).rows[0]).toEqual({ n: 0 });
    await expect(as(null, "select send_cheer($1, 'Sam', '🎉', null, null)", [DEMO_SHARE_TOKEN])).rejects.toThrow(/no longer active/);
  });
});
