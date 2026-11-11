# Decisions log

Judgment calls made while building Goal Tracker, with the reasoning. Newest concerns at the bottom of each section.

## Stack & tooling

1. **Next.js 16.4 (latest stable), Turbopack, no Cache Components.** The template enables `cacheComponents`; it was turned off because almost every page is client-rendered from the local/Supabase store, and the classic model is simpler to reason about.
2. **`middleware.ts` is `proxy.ts`** (renamed in Next 16). It only refreshes the Supabase session and redirects signed-out users; it's a no-op in demo mode.
3. **shadcn/ui components were hand-written** in the shadcn style (Radix primitives + CVA + `cn`) because the shadcn registry was unreachable from the build sandbox. `components/ui/*` can be swapped for CLI-generated versions later.
4. **Hand-written service worker (`public/sw.js`) instead of Serwist.** `@serwist/next` hooks into webpack, while Next 16 builds with Turbopack by default. A ~120-line SW covers precaching, network-first pages, cache-first assets, push and notification clicks with no build coupling. The spec allows "Serwist or equivalent".
5. **Fonts via the `geist` npm package** (local files) so builds never need network access to Google Fonts.
6. **Playwright pinned to 1.63.0** to match the preinstalled Chromium. `jsdom` was skipped (registry mirror issue); unit tests run in Node.
7. **AI SDK v7 API**: `generateText({ output: Output.object({ schema }) })` for structured output (replaces `generateObject`), `instructions` instead of `system`, `streamText(...).toTextStreamResponse()` for chat. Plain text streaming keeps the client simple (no `useChat` transport coupling).
8. **Default OpenAI model** when `AI_PROVIDER=openai` and no `AI_MODEL`: `gpt-4.1-mini` (overridable).

## Data & architecture

9. **Generic, Op-based repository.** Instead of dozens of CRUD methods, the `Repository` has `loadAll()`, `apply(op)`, plus share/cheer/delete. Ops (`insert`/`update`/`remove`/`profile`) are applied optimistically in memory, persisted by the active repository, and are exactly what the offline outbox stores. Both implementations (`LocalRepository`, `SupabaseRepository`) are small and the UI can't tell them apart.
10. **Client-generated UUIDs** so offline-created rows already have their final ids.
11. **Every table has `user_id`** (even child tables). This makes RLS uniform ("own rows") and lets `loadAll` filter cheaply. Restrictive insert policies additionally require that the parent row (goal/metric/task) is owned by the user.
12. **Partner access**: `partnerships.goal_ids uuid[]` lists exactly which goals are shared. A `SECURITY DEFINER` helper `shared_goal_ids()` powers read-only RLS policies for signed-in partners; anonymous share links use `get_shared_view(token)`/`send_cheer(...)` RPCs that validate the token. Revoking sets `status='revoked'`, which immediately disables both paths.
13. **OAuth tokens live in `integration_tokens`** (RLS on, no policies → service role only), AES-256-GCM encrypted. The client-visible `integrations` table never contains tokens.
14. **Gamification runs client-side** (XP, coins, badges computed in `lib/store/actions.ts`). For a portfolio app this is fine; a determined user could edit their own XP. Moving awards to Postgres functions is the upgrade path.
15. **Offline**: the outbox queues _all_ writes while offline (not only logs) to keep ordering consistent; once anything is queued, later writes queue behind it. Supabase mode also caches the last loaded snapshot in IndexedDB so the app is viewable offline. Demo mode also queues while `navigator.onLine` is false, so the "queued" badge is visible there too.
16. **Demo seed is relative to the first-run date** and deterministic (seeded PRNG), so unit tests and `supabase/seed.sql` match the demo exactly. `seed.sql` expresses dates as `current_date + N`.
17. **RLS is tested without Docker** by applying the real migrations + seed to PGlite (Postgres in WASM) with a minimal `auth` schema stub (`tests/sql/supabase-stub.sql`).

## Formulas (section 4) — interpretations

18. **Metric aggregation types** were added so any goal works: `latest` (level, e.g. body weight), `sum_total` (baseline + Σ entries, e.g. miles, dollars), `weekly_sum` (rolling 28-day total per week vs a weekly target, e.g. gym sessions/week). For `weekly_sum`, progress = current ÷ weekly target and **expected = 1** (a habit is expected to be on target every week).
19. **Milestone expected progress** = share of milestones whose target date has passed (undated milestones use the time-based expectation). **Task component expected = 1**.
20. **Goal pace ratio** = goal score ÷ weighted expected score (same weights). Status thresholds exactly as specified.
21. **Observed rate**: EWMA (half-life 7 days) over the last 28 days. For `latest` metrics the daily changes come from **linear interpolation between entries** (so a biweekly test score doesn't look like 13 zero days + 1 spike), and days after the last entry are excluded. For `sum_total`, daily totals including zero days. The baseline counts as the first observation at the start date.
22. **Confidence band "±1 SD"** uses the standard error of the EWMA rate (weighted SD ÷ √effective-N). Using the raw SD of daily changes makes the band useless (it almost always includes 0). If rate − SD doesn't converge, the pessimistic edge is shown as open-ended.
23. **Projections are capped at 20 years**; charts extend to at most 3× the plan length.
24. **Key metric** (drives "finish on…"): the metric flagged `isKey`, else the heaviest non-weekly metric. Goals without one project the goal-score trend toward 100.
25. **Open-ended goals**: soft deadline = start + |T − B| ÷ planned weekly pace (key metric's `weeklyTarget`), else the suggested deadline, else 12 weeks. Status uses **momentum** with thresholds ≥0.95 ahead, ≥0.80 on track, ≥0.60 behind, else at risk. They still get a pace ratio vs the soft deadline (used by the mood engine).
26. **Suggested deadline heuristic** (`lib/engine/suggest.ts`): planned pace if known → typical sustainable pace for the unit (0.5 lb/wk, 0.25 kg/wk, 15 SAT points/wk, scaled a little by weekly hours) → otherwise 12 × √(5 ÷ hours/week) weeks, clamped to 4–52.
27. **Consistency** = task component over 14 days; goals without tasks fall back to the share of days with any log. Today only counts once done (the day isn't over). `N× per week` tasks are prorated for partial weeks.
28. **Levels**: literal formula, cumulative XP for level n = round(100 × n^1.5), so everyone starts at **level 0** (0 XP) and reaches level 1 at 100 XP.
29. **XP rules**: log 10, check-in 5, task = its XP value (default 15), weekly target hit 50 (once per metric per week), milestone 100–200 (ramps with position = difficulty), weekly review 30, rescue plan 20, goal complete 500. **Coins = XP ÷ 2**. Unchecking a task removes its XP (no farming). Imported data (Strava/Health/CSV) earns no XP.
30. **Streaks** count days with any activity (entry, task completion, check-in). A frozen day bridges the streak without adding to it. Freezes are spent automatically only if they can cover the _whole_ gap; 1 earned per 7 streak days (per streak run), max 2 banked.
31. **Mood engine** scoring (pace ±, streak +, recency −, recent wins + capped at 2): ecstatic ≥ 4, happy ≥ 1.5, neutral ≥ 0, worried ≥ −2, else sad. Hard rules: 7+ days since last log → always sad; 3+ days → never above neutral.
32. **Auto-adjust**: runs in maintenance for Behind/At-risk goals with a real deadline, on the key metric, at most once a week. Within the 1.5× cap the new weekly target is applied and logged. Above the cap a pending adjustment asks the user: **push deadline** (to the date reachable at the 1.5× cap pace) or **commit** to the required pace. Every change goes into `target_adjustments` and the dashboard's "Plan history".
33. **Rescue plan** (14+ days away): a restart milestone at half the planned weekly pace for 2 weeks (or 10% of the gap), and the deadline moves by the days missed.
34. **Realism guard rules**: lean muscle > 1 lb (0.45 kg)/wk, weight loss > 2 lb (0.9 kg)/wk, SAT > 100 pts/month for > 8 weeks, ACT > 3 pts/month, > 60 hours/week, or a plan > 3× the observed pace. Warnings suggest a realistic weekly rate and deadline; coaches never give medical advice.

## Product

35. **Goal creation methods share one editor**: each method is a preset (single metric, milestones-first, weighted, manual, AI-prefilled). Users can mix components freely, matching "can mix them in one goal".
36. **AI wizard without a key** uses a rule-based breakdown (detects SAT / weight / money / running / reading from the goal text) so the full flow is demoable.
37. **Natural-language logging** always shows an editable confirmation card. The AI route itself falls back to the regex parser; offline, the regex parser runs in the browser.
38. **Coach plan changes**: the model appends a fenced ` ```plan ` JSON block; the client validates it with Zod, shows an "Apply" card, and requires confirmation. Applied blocks are marked so they can't be applied twice.
39. **Partner invite by email** opens the user's email client (`mailto:`) with the share link — no email provider is required. Signing in and opening the link links the partner account (`accept_partnership`).
40. **Demo-mode share links** work only in the same browser (data is local). The share page explains this.
41. **Apple Health webhook in demo mode** stores entries in an in-memory server inbox that the app drains every 30 s (single-process dev server). In Supabase mode it writes straight to the database with the service role.
42. **Strava in demo mode** keeps tokens in an encrypted httpOnly cookie; in Supabase mode in `integration_tokens`.
43. **Vercel Cron** runs `/api/cron/notify` once a day by default (Hobby plans only allow daily crons). On Pro, change the schedule in `vercel.json` to hourly for precise reminder times. While the app is open, reminders/drift alerts are also generated client-side every minute.
44. **In-app notifications are deduplicated** with a `dedupe_key` (unique per user in Postgres).
45. **Delete account** requires the service-role key (server route); in demo mode it resets local data.
46. **Badges**: 25 original badges (lucide icons in an original hexagon frame), catalogue in code and mirrored into the `badges` table by a generated migration.
47. **Weekly review** is user-level (not per goal) to keep the ritual short; the table supports per-goal reviews later.
48. **Charts**: red = your actual, gray = plan, dashed blue + 10% blue band = projection/confidence; yellow only for targets/rewards (it fails the categorical lightness check as a series color in dark mode). Every chart has an aria label; the main forecast also has a data table.
