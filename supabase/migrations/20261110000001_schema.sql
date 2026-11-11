-- Goal Tracker schema. Every table has user_id + Row Level Security.
-- Run with `supabase db push` (or paste into the Supabase SQL editor).

-- gen_random_uuid() is built into Postgres 13+, no extension needed.

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text not null default '',
  timezone text not null default 'UTC',
  coach_id text not null default 'sage',
  xp integer not null default 0 check (xp >= 0),
  level integer not null default 0,
  coins integer not null default 0 check (coins >= 0),
  streak_freezes integer not null default 0 check (streak_freezes between 0 and 2),
  onboarded boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Create a profile automatically when someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------- goals
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '',
  category text not null default 'General',
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'archived')),
  start_date date not null default current_date,
  deadline date,
  is_open_ended boolean not null default false,
  suggested_deadline date,
  planned_weekly_effort numeric,
  expected_curve text not null default 'linear' check (expected_curve in ('linear', 'slow_start')),
  created_via text not null default 'manual' check (created_via in ('ai', 'milestones', 'single_metric', 'weighted', 'manual')),
  milestone_weight numeric not null default 0 check (milestone_weight >= 0),
  task_weight numeric not null default 0 check (task_weight >= 0),
  reminder_time text,
  color text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists goals_user_idx on public.goals (user_id);

create table if not exists public.metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null references public.goals (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  unit text not null default '',
  baseline numeric not null default 0,
  target numeric not null,
  direction text not null default 'increase' check (direction in ('increase', 'decrease')),
  weight numeric not null default 1 check (weight >= 0),
  aggregation text not null default 'latest' check (aggregation in ('latest', 'sum_total', 'weekly_sum')),
  source text not null default 'manual',
  weekly_target numeric,
  is_key boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists metrics_goal_idx on public.metrics (goal_id);
create index if not exists metrics_user_idx on public.metrics (user_id);

create table if not exists public.metric_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  metric_id uuid not null references public.metrics (id) on delete cascade,
  value numeric not null,
  date date not null,
  recorded_at timestamptz not null default now(),
  source text not null default 'manual',
  note text check (note is null or char_length(note) <= 500)
);
create index if not exists entries_metric_date_idx on public.metric_entries (metric_id, date);
create index if not exists entries_user_idx on public.metric_entries (user_id);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null references public.goals (id) on delete cascade,
  title text not null,
  target_date date,
  sort_order integer not null default 0,
  weight numeric not null default 1,
  completed_at timestamptz,
  metric_id uuid references public.metrics (id) on delete set null,
  threshold_value numeric
);
create index if not exists milestones_goal_idx on public.milestones (goal_id);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null references public.goals (id) on delete cascade,
  title text not null,
  recurrence jsonb not null default '{"type":"daily"}'::jsonb,
  xp_value integer not null default 15 check (xp_value between 0 and 500),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists tasks_goal_idx on public.tasks (goal_id);

create table if not exists public.task_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  date date not null,
  completed_at timestamptz not null default now(),
  unique (task_id, date)
);
create index if not exists completions_user_idx on public.task_completions (user_id);

create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  mood integer not null check (mood between 1 and 5),
  note text,
  parsed jsonb,
  created_at timestamptz not null default now()
);
create index if not exists checkins_user_date_idx on public.checkins (user_id, date);

create table if not exists public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid references public.goals (id) on delete cascade,
  week_start date not null,
  rating integer not null check (rating between 1 and 5),
  reflection text not null default '',
  wins jsonb not null default '[]'::jsonb,
  misses jsonb not null default '[]'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  ai_suggestion text,
  created_at timestamptz not null default now()
);

create table if not exists public.target_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null references public.goals (id) on delete cascade,
  metric_id uuid references public.metrics (id) on delete set null,
  kind text not null check (kind in ('auto', 'push_deadline', 'commit_pace', 'rescue', 'coach', 'manual')),
  reason text not null,
  before jsonb not null default '{}'::jsonb,
  after jsonb not null default '{}'::jsonb,
  accepted boolean,
  created_at timestamptz not null default now()
);

create table if not exists public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  amount integer not null,
  coins integer not null default 0,
  reason text not null,
  ref_id text,
  created_at timestamptz not null default now()
);
create index if not exists xp_user_idx on public.xp_events (user_id, created_at);

-- Badge catalogue (public, read-only) + earned badges.
create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text not null,
  icon text not null,
  tier text not null default 'bronze'
);

create table if not exists public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  badge_key text not null references public.badges (key),
  earned_at timestamptz not null default now(),
  unique (user_id, badge_key)
);

create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  coin_cost integer not null check (coin_cost > 0),
  emoji text not null default '🎁',
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reward_id uuid references public.rewards (id) on delete set null,
  title text not null,
  coin_cost integer not null,
  redeemed_at timestamptz not null default now()
);

create table if not exists public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid references public.goals (id) on delete set null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  mood text check (mood in ('ecstatic', 'happy', 'neutral', 'worried', 'sad')),
  coach_id text not null,
  kind text not null default 'chat' check (kind in ('chat', 'proactive')),
  created_at timestamptz not null default now()
);
create index if not exists coach_messages_user_idx on public.coach_messages (user_id, created_at);

-- Accountability partners. goal_ids lists exactly which goals are shared.
create table if not exists public.partnerships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  partner_id uuid references auth.users (id) on delete set null,
  invite_email text,
  partner_name text,
  share_token text not null unique check (char_length(share_token) >= 12),
  goal_ids uuid[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'active', 'revoked')),
  created_at timestamptz not null default now()
);

create table if not exists public.cheers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade, -- the owner who receives it
  partnership_id uuid not null references public.partnerships (id) on delete cascade,
  goal_id uuid references public.goals (id) on delete set null,
  from_name text not null check (char_length(from_name) between 1 and 60),
  emoji text not null check (char_length(emoji) <= 16),
  message text check (message is null or char_length(message) <= 280),
  created_at timestamptz not null default now()
);

create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  provider text not null check (provider in ('strava', 'apple_health', 'csv', 'bank_csv', 'plaid')),
  connected boolean not null default false,
  webhook_secret text unique,
  config jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, provider)
);

-- OAuth tokens live in their own table with RLS on and NO policies:
-- only the server (service role) can read them. Values are AES-GCM encrypted.
create table if not exists public.integration_tokens (
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  tokens_encrypted text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  goal_id uuid references public.goals (id) on delete set null,
  href text,
  read boolean not null default false,
  dedupe_key text,
  created_at timestamptz not null default now()
);
create unique index if not exists notifications_dedupe_idx on public.notifications (user_id, dedupe_key) where dedupe_key is not null;
create index if not exists notifications_user_idx on public.notifications (user_id, created_at);
