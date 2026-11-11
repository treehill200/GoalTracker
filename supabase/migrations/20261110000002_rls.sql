-- Row Level Security: users only see and change their own rows. Partners can
-- additionally READ goals that were explicitly shared with them.

-- Goals shared with the current user through an active partnership.
create or replace function public.shared_goal_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select unnest(p.goal_ids)
  from public.partnerships p
  where p.partner_id = auth.uid() and p.status = 'active';
$$;

alter table public.profiles enable row level security;
create policy "profiles: read own" on public.profiles for select using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles for update using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "profiles: insert own" on public.profiles for insert with check (id = (select auth.uid()));

-- Standard "own rows" policies for every user-owned table.
do $$
declare
  t text;
begin
  foreach t in array array[
    'goals', 'metrics', 'metric_entries', 'milestones', 'tasks', 'task_completions', 'checkins',
    'weekly_reviews', 'target_adjustments', 'xp_events', 'user_badges', 'rewards', 'reward_redemptions',
    'coach_messages', 'partnerships', 'integrations', 'push_subscriptions', 'notifications'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s: select own" on public.%I for select using (user_id = (select auth.uid()))', t, t);
    execute format('create policy "%s: insert own" on public.%I for insert with check (user_id = (select auth.uid()))', t, t);
    execute format('create policy "%s: update own" on public.%I for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t, t);
    execute format('create policy "%s: delete own" on public.%I for delete using (user_id = (select auth.uid()))', t, t);
  end loop;
end;
$$;

-- Child rows must belong to a parent the user owns (prevents attaching rows to someone else's goal).
create policy "metrics: parent owned" on public.metrics as restrictive for insert
  with check (exists (select 1 from public.goals g where g.id = goal_id and g.user_id = (select auth.uid())));
create policy "entries: parent owned" on public.metric_entries as restrictive for insert
  with check (exists (select 1 from public.metrics m where m.id = metric_id and m.user_id = (select auth.uid())));
create policy "milestones: parent owned" on public.milestones as restrictive for insert
  with check (exists (select 1 from public.goals g where g.id = goal_id and g.user_id = (select auth.uid())));
create policy "tasks: parent owned" on public.tasks as restrictive for insert
  with check (exists (select 1 from public.goals g where g.id = goal_id and g.user_id = (select auth.uid())));
create policy "completions: parent owned" on public.task_completions as restrictive for insert
  with check (exists (select 1 from public.tasks t where t.id = task_id and t.user_id = (select auth.uid())));

-- Partner read access, limited to explicitly shared goals.
create policy "goals: partner read" on public.goals for select
  using (id in (select public.shared_goal_ids()));
create policy "metrics: partner read" on public.metrics for select
  using (goal_id in (select public.shared_goal_ids()));
create policy "milestones: partner read" on public.milestones for select
  using (goal_id in (select public.shared_goal_ids()));
create policy "tasks: partner read" on public.tasks for select
  using (goal_id in (select public.shared_goal_ids()));
create policy "entries: partner read" on public.metric_entries for select
  using (metric_id in (select m.id from public.metrics m where m.goal_id in (select public.shared_goal_ids())));
create policy "completions: partner read" on public.task_completions for select
  using (task_id in (select t.id from public.tasks t where t.goal_id in (select public.shared_goal_ids())));
create policy "partnerships: partner read" on public.partnerships for select
  using (partner_id = (select auth.uid()));

-- Cheers: the owner can read/delete; new cheers only arrive through send_cheer().
alter table public.cheers enable row level security;
create policy "cheers: owner read" on public.cheers for select using (user_id = (select auth.uid()));
create policy "cheers: owner delete" on public.cheers for delete using (user_id = (select auth.uid()));

-- Badge catalogue is public read-only.
alter table public.badges enable row level security;
create policy "badges: read all" on public.badges for select using (true);

-- Tokens: RLS on, no policies → service role only.
alter table public.integration_tokens enable row level security;

-- ------------------------------------------------------------- functions

-- Read-only partner view by share token (works for anonymous visitors).
create or replace function public.get_shared_view(p_token text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'owner_name', pr.display_name,
    'partner_name', p.partner_name,
    'partnership_id', p.id,
    'level', pr.level,
    'goals', coalesce((
      select json_agg(json_build_object(
        'goal', to_json(g),
        'metrics', (select coalesce(json_agg(m), '[]'::json) from public.metrics m where m.goal_id = g.id),
        'entries', (select coalesce(json_agg(e), '[]'::json) from public.metric_entries e join public.metrics m on m.id = e.metric_id where m.goal_id = g.id),
        'milestones', (select coalesce(json_agg(ms), '[]'::json) from public.milestones ms where ms.goal_id = g.id),
        'tasks', (select coalesce(json_agg(t), '[]'::json) from public.tasks t where t.goal_id = g.id),
        'completions', (select coalesce(json_agg(c), '[]'::json) from public.task_completions c join public.tasks t on t.id = c.task_id where t.goal_id = g.id)
      ))
      from public.goals g
      where g.user_id = p.user_id and g.id = any (p.goal_ids)
    ), '[]'::json),
    'cheers', (select coalesce(json_agg(ch order by ch.created_at desc), '[]'::json) from (select * from public.cheers c where c.partnership_id = p.id order by c.created_at desc limit 20) ch)
  )
  from public.partnerships p
  join public.profiles pr on pr.id = p.user_id
  where p.share_token = p_token and p.status in ('active', 'pending');
$$;

-- Send a cheer through a share link. Validates the token and rate-limits.
create or replace function public.send_cheer(p_token text, p_from_name text, p_emoji text, p_message text, p_goal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.partnerships;
  recent integer;
begin
  select * into p from public.partnerships where share_token = p_token and status in ('active', 'pending');
  if not found then
    raise exception 'This share link is no longer active';
  end if;
  if p_goal_id is not null and not (p_goal_id = any (p.goal_ids)) then
    raise exception 'That goal is not shared';
  end if;
  select count(*) into recent from public.cheers where partnership_id = p.id and created_at > now() - interval '1 day';
  if recent >= 30 then
    raise exception 'Too many cheers today — try again tomorrow';
  end if;
  insert into public.cheers (user_id, partnership_id, goal_id, from_name, emoji, message)
  values (p.user_id, p.id, p_goal_id, left(coalesce(nullif(trim(p_from_name), ''), 'A friend'), 60), left(p_emoji, 16), left(p_message, 280));
  insert into public.notifications (user_id, kind, title, body, goal_id, href)
  values (p.user_id, 'cheer', left(coalesce(nullif(trim(p_from_name), ''), 'A friend'), 60) || ' cheered you on ' || left(p_emoji, 16),
          coalesce(left(p_message, 280), 'Keep going!'), p_goal_id,
          case when p_goal_id is null then '/partners' else '/goals/' || p_goal_id::text end);
end;
$$;

-- A signed-in partner claims an invite link, which unlocks the RLS partner policies.
create or replace function public.accept_partnership(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  update public.partnerships
     set partner_id = auth.uid(), status = 'active'
   where share_token = p_token and status in ('pending', 'active') and user_id <> auth.uid()
     and (partner_id is null or partner_id = auth.uid());
end;
$$;

revoke all on function public.get_shared_view(text) from public;
revoke all on function public.send_cheer(text, text, text, text, uuid) from public;
revoke all on function public.accept_partnership(text) from public;
grant execute on function public.get_shared_view(text) to anon, authenticated;
grant execute on function public.send_cheer(text, text, text, text, uuid) to anon, authenticated;
grant execute on function public.accept_partnership(text) to authenticated;
