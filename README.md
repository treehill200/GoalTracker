# Goal Tracker

**Turn big, vague goals into numbers — and actually finish them.**

Goal Tracker takes a long-term goal like _"Get a 1500+ on the SAT"_ or _"Gain 20 lbs of lean muscle"_, breaks it into measurable metrics, milestones and habits, tracks your progress, predicts when you'll finish, and keeps you going with XP, streaks, badges, a reward shop, and AI coaches whose mood reacts to how you're doing.

It's a Progressive Web App: it works on your phone and computer, can be installed like a native app, and keeps working offline.

> 📸 _Screenshots: add yours to `docs/screenshots/` and link them here (home, goal dashboard, coach chat, rewards)._

---

## Features

- **Any goal, as numbers** — create goals with an AI breakdown (default), a single key metric + pace, milestones with dates, a weighted multi-metric score, or fully manual. Mix them freely.
- **Goals without deadlines still get finished** — a suggested deadline, a soft deadline from your planned pace, momentum tracking, and drift detection (nudge at 3 days, sad coach + push at 7, rescue plan at 14).
- **The dashboard** — animated score ring, actual vs plan with a forecast line and confidence band, required vs actual pace, projected finish date ("At this pace you'll finish on…"), milestone timeline, 26-week heatmap, metric sparklines and weekly effort bars.
- **Logging every way** — a big **+** button (pick a metric, type a number, save), recurring task checkboxes, a daily check-in with mood, and plain-English logging ("did 2 practice sections, scored 1320 on the test") with a confirmation card before anything is saved. Works offline; queued logs sync later.
- **Auto-adjusting plans** — when you fall behind, weekly targets are re-spread (capped at 1.5×). If that's not enough, you choose: push the deadline or commit to the higher pace. Every change is logged.
- **Gamification** — XP and levels with a full-screen level-up, per-goal and overall streaks with streak freezes, 25 original badges, coins, and a reward shop for real-life treats you define.
- **Four AI coaches** — Blaze (hype), Sage (calm mentor), Sarge (tough love), Pip (goofy cheerleader). Original animated SVG avatars that get visibly ecstatic, happy, neutral, worried or sad. Streaming chat that knows your goals and can suggest plan changes you apply with one tap.
- **Weekly review**, **reminders + quiet hours + Web Push**, **accountability partners** (read-only share links with cheers, revocable), **CSV export**, and **integrations**: Strava (OAuth), Apple Health (export upload + iOS Shortcut webhook), bank CSV for savings goals, and generic CSV.

---

## Run it in 60 seconds (demo mode, no setup)

You need **Node.js 20.9 or newer** (check with `node -v`).

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000. With no environment variables the app runs in **demo mode**:

- Your data lives in your browser (IndexedDB), pre-loaded with two example goals and ~6 weeks of history, so every chart has data.
- The AI features fall back to rule-based versions (canned coach messages by personality and mood, and a pattern-based log parser).
- A yellow banner says _"Demo mode: add keys in .env.local to enable sync and AI."_

To start over, go to **Settings → Reset demo data**.

---

## Full setup (accounts, sync, AI, push)

Everything below is optional — add only what you want.

### 1. Create your env file

```bash
cp .env.example .env.local
```

Every variable is explained inside `.env.example`.

### 2. Supabase (accounts + cloud sync)

1. Create a free project at [supabase.com](https://supabase.com).
2. Run the database migrations. Either:
   - **SQL editor (easiest):** open each file in `supabase/migrations/` in order and run it, or
   - **Supabase CLI:** `npx supabase link --project-ref <your-ref>` then `npx supabase db push`.
3. (Optional, for local development only) load the demo data: run `supabase/seed.sql` in the SQL editor. It creates a `demo@goaltracker.local` user with the same two goals as demo mode.
4. In **Project Settings → API**, copy the URL, the `anon` key and the `service_role` key into `.env.local`:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
5. In **Authentication → URL Configuration**, set the Site URL (e.g. `http://localhost:3000`) and add `http://localhost:3000/auth/callback` (and your production URL + `/auth/callback`) to Redirect URLs.
6. **Email magic link** works out of the box. For **Google**, enable it in **Authentication → Providers → Google** with a Google OAuth client (redirect URI shown in Supabase). Set `NEXT_PUBLIC_GOOGLE_AUTH=0` to hide the button if you skip this.

Row Level Security is enabled on every table: users can only read and write their own rows, and partners can only read goals explicitly shared with them.

### 3. AI (optional)

Set `ANTHROPIC_API_KEY` (default provider, model `claude-sonnet-5-5`). To use OpenAI instead, set `AI_PROVIDER=openai` and `OPENAI_API_KEY` (and optionally `AI_MODEL`). AI calls only happen on the server and are rate-limited per user.

### 4. Push notifications (optional)

```bash
npm run vapid:generate
```

Paste the printed keys into `.env.local`. Then turn on **Settings → Notifications → Push notifications** in the app. For background reminders in production, also set `CRON_SECRET` (Vercel Cron calls `/api/cron/notify`).

> **iPhone/iPad:** iOS only allows push notifications for web apps that have been **added to the Home Screen** (iOS 16.4+). Install the app first, open it from the Home Screen, then enable notifications.

### 5. Strava (optional)

Create an app at https://www.strava.com/settings/api. Set the _Authorization Callback Domain_ to `localhost` (and your production domain). Put `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` in `.env.local`, and set `INTEGRATION_ENCRYPTION_KEY` to a long random string.

Restart `npm run dev` after changing env vars.

---

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, **Add New → Project** and import the repo (framework: Next.js, default settings).
3. Add your environment variables (same names as `.env.local`) under **Settings → Environment Variables**. With none, the deployed site runs in demo mode.
4. Deploy. Then add `https://<your-app>.vercel.app/auth/callback` to Supabase Redirect URLs and your domain to the Strava callback domain.
5. `vercel.json` schedules the notification cron once a day (Hobby plan limit). On Pro you can make it hourly.

Note: the public feature flags are read when the app is built, so redeploy after changing environment variables.

---

## Install the app

- **iPhone / iPad (Safari):** open the site → **Share** → **Add to Home Screen**.
- **Android (Chrome):** open the site → menu **⋮** → **Install app** (or accept the install banner).
- **Desktop (Chrome / Edge):** click the install icon in the address bar, or menu → **Install Goal Tracker**.

Once installed, the app opens full-screen, works offline for pages you've visited, and queues any logs you enter offline until you reconnect.

---

## Scripts

| Command                       | What it does                                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm run dev`                 | Start the dev server                                                                                  |
| `npm run build` / `npm start` | Production build / run it                                                                             |
| `npm run lint`                | ESLint                                                                                                |
| `npm run typecheck`           | TypeScript check                                                                                      |
| `npm test`                    | Unit tests (formulas, parsers, integrations, export, and Row Level Security on an in-memory Postgres) |
| `npm run test:e2e`            | End-to-end smoke test in a real browser (builds the app first)                                        |
| `npm run format`              | Prettier                                                                                              |
| `npm run seed:sql`            | Regenerate `supabase/seed.sql` from the demo seed                                                     |
| `npm run vapid:generate`      | Create Web Push keys                                                                                  |
| `npm run icons:generate`      | Regenerate app icons                                                                                  |

---

## How the numbers work (short version)

- **Metric progress** = (current − start) ÷ (target − start), clamped 0–1 (works for goals that go down too).
- **Expected progress** = share of the timeline elapsed (optionally a slow-start curve).
- **Pace ratio** = progress ÷ expected → Ahead (≥1.05), On track (≥0.9), Behind (≥0.7), At risk.
- **Projected finish** = today + remaining ÷ your recent rate (a 28-day weighted average), with a confidence band.
- **Goal score** = weighted average of all components × 100.

All formulas live in `lib/engine/` as pure, unit-tested functions. Judgment calls are documented in [DECISIONS.md](./DECISIONS.md).

---

## Project docs

- [AGENTS.md](./AGENTS.md) / [CLAUDE.md](./CLAUDE.md) — structure and conventions for coding agents (and humans).
- [DECISIONS.md](./DECISIONS.md) — every judgment call and why.

## Known limitations

- Gamification (XP/coins) is computed in the browser, so it isn't cheat-proof.
- AI rate limiting is in-memory per server instance (use Redis/Upstash for multi-instance production).
- Demo-mode share links only work in the browser that created them; the Apple Health webhook inbox in demo mode needs a single long-running server (`npm run dev`/`npm start`).
- Plaid bank sync is a stub (see `lib/integrations/plaid.ts`); use the bank CSV import.
- Offline viewing covers pages you've already opened (plus the main tabs, which are pre-cached).
- Coaches give motivation and general guidance only — never medical advice.
