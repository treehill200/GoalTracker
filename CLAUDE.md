<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Goal Tracker — agent guide

> `AGENTS.md` (Codex) and `CLAUDE.md` (Claude Code) have identical content. Edit both.

## Overview

A PWA that turns long-term goals into numbers, tracks them, predicts completion, and motivates with
gamification and mood-reactive AI coaches. Next.js 16 (App Router, Turbopack) + TypeScript strict,
Tailwind v4 + hand-written shadcn-style components, Framer Motion, Recharts, Supabase (optional),
Vercel AI SDK v7 (optional). **Runs with zero env vars in demo mode** (IndexedDB + rule-based AI).

## Commands

| Command                           | What it does                                                             |
| --------------------------------- | ------------------------------------------------------------------------ |
| `npm run dev`                     | Dev server on http://localhost:3000                                      |
| `npm run build` / `npm start`     | Production build / serve                                                 |
| `npm run lint`                    | ESLint (flat config, `eslint.config.mjs`)                                |
| `npm run typecheck`               | `tsc --noEmit`                                                           |
| `npm test`                        | Vitest unit tests (`tests/unit`), incl. RLS tests on PGlite              |
| `npm run test:e2e`                | Playwright smoke test (builds + starts on port 3100 in demo mode)        |
| `npm run format` / `format:check` | Prettier                                                                 |
| `npm run seed:sql`                | Regenerate `supabase/seed.sql` + badge migration from `lib/data/seed.ts` |
| `npm run icons:generate`          | Regenerate PWA icons from `scripts/*.svg`                                |
| `npm run vapid:generate`          | Print a VAPID key pair for Web Push                                      |

Run `npm run lint && npm run typecheck && npm test` before every commit; run `npm run build` and
`npm run test:e2e` before finishing a feature.

## Folder structure

```
app/
  (app)/            authenticated app pages (shell + StoreProvider): home, goals, log, coach, rewards, review, partners, integrations, notifications, settings
  (bare)/onboarding store without the nav shell
  share/[token]     public read-only partner view
  login, auth/callback, offline
  api/              route handlers: ai/*, push/*, cron/notify, integrations/*, account
components/
  ui/               shadcn-style primitives (button, card, dialog, tabs, …)
  charts/           ScoreRing (SVG), ForecastChart, heatmap, sparklines, weekly bars, milestone timeline
  coach/            animated SVG avatars, coach card
  goals/ log/ shell/ celebrations, confetti, share card, badge icon
lib/
  engine/           PURE formulas (no I/O): progress, rates, projection, score, streaks, xp, mood, drift, adjust, realism, badges, parse-log, analyze, chart-data, suggest
  data/             types, Zod schemas, repository interface, local (IndexedDB) + Supabase repos, ops, outbox, seed
  store/            React store (StoreProvider), actions (all mutations + XP/badges), maintenance (auto-adjust, drift, reminders, freezes)
  game/             XP/badge orchestration
  coach/            personas, canned messages, plan-change schema, AI context builder
  ai/               provider (anthropic|openai), heuristic fallbacks, rate limit, guard
  integrations/     adapter interface + strava, apple-health, csv/bank, plaid stub, token crypto
  notifications/    quiet hours, web-push (server), push-client (browser)
  supabase/         browser/server/admin clients
supabase/migrations  schema, RLS, badges · supabase/seed.sql (generated)
tests/unit, tests/e2e, tests/sql (Supabase auth stub for PGlite)
public/sw.js        hand-written service worker
```

## Conventions

- **The UI never talks to Supabase or IndexedDB directly**: read via `useStore()`, write via `actions.*`.
  Every write is an `Op` (`lib/data/ops.ts`) applied optimistically, then sent to the repository or
  queued in the offline outbox.
- **Engine functions are pure** and take `today` as an argument. Add/extend formulas there with tests.
- Dates are `"YYYY-MM-DD"` strings (`lib/engine/dates.ts`); timestamps are ISO strings.
- camelCase in TS, snake_case in Postgres (`lib/data/mapping.ts`; `order` ↔ `sort_order`).
- New table? Add it to `types.ts` (`TableMap`, `TABLE_TO_KEY`), a migration with RLS, and `seed.ts` if demo data is needed.
- Validate all external input and AI output with Zod (`lib/data/schemas.ts`, `lib/coach/plan.ts`).
- AI calls only in route handlers (`app/api/ai/*`), always with `guardAi()` (auth + rate limit) and a non-AI fallback.
- No `any` (lint error). Status colors always come with an icon + label (`components/status.tsx`).
- Colors are theme tokens (`app/globals.css`): red primary, blue secondary, yellow rewards; dark first.
- Respect reduced motion (`useReducedMotion`, `.reduce-motion` class).
- Never commit secrets; `.env*` is git-ignored except `.env.example`.

## Tests

- Unit: `tests/unit/*.test.ts` (engine, parser, integrations, export, RLS via PGlite + `tests/sql/supabase-stub.sql`).
- E2E: `tests/e2e/smoke.spec.ts` (Playwright 1.63, Pixel 7 profile). Uses `DEMO_FORCE=1`.
- Seed data is deterministic per date, so tests pass a fixed `today`.
