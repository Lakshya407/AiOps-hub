-- 0008_admin_hardening.sql — secure DB-backed RBAC, presence, admin RPCs.
-- Safe to rerun (all statements idempotent). Fixes weaknesses in 0007:
-- * is_admin() becomes SECURITY DEFINER so profile/admin policies don't recurse.
-- * Normal users can never change their own role (policies + trigger guard).
-- * Adds user_presence for honest active/session tracking.
-- * Role changes go through admin_set_role() with an audit event.
-- * Admin reads go through RLS + the paginated admin_user_overview() RPC.
-- First admin bootstrap (run as DB administrator in SQL editor):
--   update public.profiles set role = 'admin' where email = 'you@example.com';

-- 1) profiles columns -------------------------------------------------------
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists role text not null default 'user';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_role_check') then
    alter table public.profiles add constraint profiles_role_check check (role in ('admin', 'user'));
  end if;
end $$;

-- Backfill emails for pre-existing rows (never touches roles).
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and (p.email is null or p.email = '');

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_email on public.profiles(email);

-- 2) presence table (heartbeat-driven; browser close/session expiry handled by window) --
create table if not exists public.user_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  last_seen_at timestamptz,
  last_login_at timestamptz,
  last_logout_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists idx_presence_last_seen on public.user_presence(last_seen_at desc);
alter table public.user_presence enable row level security;
drop policy if exists presence_owner_all on public.user_presence;
create policy presence_owner_all on public.user_presence
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists presence_admin_select on public.user_presence;
create policy presence_admin_select on public.user_presence
  for select using (public.is_admin());

-- 3) is_admin(): SECURITY DEFINER, bypasses RLS -> no recursive policies ------
create or replace function public.is_admin()
returns boolean language plpgsql stable security definer set search_path = public as $$
declare r text;
begin
  select role into r from public.profiles where id = auth.uid();
  return coalesce(r, 'user') = 'admin';
end $$;

-- 4) role guard: only admins can change roles, enforced server-side ----------
create or replace function public.protect_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Direct database connections (dashboard SQL editor as postgres, service_role)
  -- carry no app-user JWT, so auth.uid() is null. Those roles bypass RLS anyway
  -- and triggers still fire, so let them through; otherwise a DBA could never
  -- bootstrap the first admin. App users always have auth.uid() set, so the
  -- check below still blocks every non-admin self-promotion (RLS denies them too).
  if auth.uid() is null then
    return new;
  end if;
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only admins may change user roles';
  end if;
  return new;
end $$;
drop trigger if exists trg_profiles_role_guard on public.profiles;
create trigger trg_profiles_role_guard before update on public.profiles
for each row execute function public.protect_profile_role();

-- 5) profiles policies: owner-only self access, admins read/update -----------
drop policy if exists "profiles_owner_all" on public.profiles;
drop policy if exists profiles_admin_update on public.profiles;
drop policy if exists profiles_owner_select on public.profiles;
drop policy if exists profiles_owner_insert on public.profiles;
drop policy if exists profiles_owner_update on public.profiles;
drop policy if exists profiles_admin_select on public.profiles;

create policy profiles_owner_select on public.profiles
  for select using (auth.uid() = id);
create policy profiles_owner_insert on public.profiles
  for insert with check (auth.uid() = id);
create policy profiles_owner_update on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
create policy profiles_admin_select on public.profiles
  for select using (public.is_admin());
create policy profiles_admin_update on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- 6) new-user handler: default 'user' role + presence row --------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'user')
  on conflict (id) do update set email = excluded.email;
  insert into public.user_presence (user_id, email, last_login_at, last_seen_at)
  values (new.id, new.email, now(), now())
  on conflict (user_id) do update set email = excluded.email;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 7) topics natural key: required for idempotent per-owner seeding -----------
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'topics_owner_skill_title_unique') then
    alter table public.topics
      add constraint topics_owner_skill_title_unique unique (owner_id, skill_id, title);
  end if;
end $$;

-- 8) admin_set_role(): the ONLY supported way to change roles from the app.
-- Records actor, target, old/new role and timestamp in activity_events. -------
create or replace function public.admin_set_role(p_target uuid, p_role text)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare
  old_role text;
  actor uuid := auth.uid();
  rec public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  if p_role not in ('admin', 'user') then
    raise exception 'Invalid role: %', p_role;
  end if;
  select role into old_role from public.profiles where id = p_target;
  if old_role is null then
    raise exception 'User profile not found';
  end if;
  if old_role = 'admin' and p_role = 'user' then
    if (select count(*) from public.profiles where role = 'admin') <= 1 then
      raise exception 'Cannot demote the last admin';
    end if;
  end if;
  update public.profiles set role = p_role where id = p_target returning * into rec;
  insert into public.activity_events (owner_id, event_type, entity_type, entity_id, metadata)
  values (p_target, 'admin_role_change', 'profile', p_target,
    jsonb_build_object('actor_id', actor, 'old_role', old_role, 'new_role', p_role, 'changed_at', now()));
  return rec;
end $$;

-- 9) admin_user_overview(): paginated searchable directory with aggregates.
-- Single indexed query instead of loading all user data into the browser.
-- NOTE: OUT params use an o_ prefix deliberately. With RETURNS TABLE, PL/pgSQL
-- treats out-param names as variables, and names like created_at/email/role
-- then collide with selected columns ("column reference is ambiguous").
-- The o_ prefix makes a collision impossible.
drop function if exists public.admin_user_overview(text, int, int);
create function public.admin_user_overview(p_search text, p_limit int, p_offset int)
returns table (
  o_user_id uuid, o_email text, o_display_name text, o_role text, o_created_at timestamptz,
  o_last_seen_at timestamptz, o_last_login_at timestamptz,
  o_progress_total int, o_progress_done int, o_docs_count int,
  o_last_activity_at timestamptz, o_total_count bigint
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  return query
  with filtered as (
    select prof.id, prof.email, prof.display_name, prof.role, prof.created_at
    from public.profiles prof
    where (p_search is null or p_search = ''
      or prof.email ilike '%' || p_search || '%'
      or coalesce(prof.display_name, '') ilike '%' || p_search || '%')
  ),
  agg_topics as (
    select tp.owner_id, count(*)::int cnt from public.topics tp group by tp.owner_id
  ),
  agg_done as (
    select tp2.owner_id, count(*)::int cnt from public.topic_progress tp2
    where tp2.status = 'completed' group by tp2.owner_id
  ),
  agg_docs as (
    select dc.owner_id, count(*)::int cnt from public.documents dc group by dc.owner_id
  ),
  agg_act as (
    select ev.owner_id, max(ev.created_at) last_act from public.activity_events ev group by ev.owner_id
  )
  select flt.id, flt.email, flt.display_name, flt.role, flt.created_at,
    pres.last_seen_at, pres.last_login_at,
    coalesce(aggt.cnt, 0), coalesce(aggd.cnt, 0), coalesce(aggdc.cnt, 0), agga.last_act,
    (select count(*) from filtered)
  from filtered flt
  left join public.user_presence pres on pres.user_id = flt.id
  left join agg_topics aggt on aggt.owner_id = flt.id
  left join agg_done aggd on aggd.owner_id = flt.id
  left join agg_docs aggdc on aggdc.owner_id = flt.id
  left join agg_act agga on agga.owner_id = flt.id
  order by flt.created_at desc
  limit greatest(1, least(coalesce(p_limit, 10), 100))
  offset greatest(0, coalesce(p_offset, 0));
end $$;

-- 10) storage: admins may read any user's documents (short-lived signed URLs).
-- Users remain restricted to their own "<uid>/..." paths by 0003 policies. ----
drop policy if exists "documents_admin_read" on storage.objects;
create policy "documents_admin_read" on storage.objects
  for select using (bucket_id = 'documents' and public.is_admin());

-- 11) indexes for admin queries ----------------------------------------------
create index if not exists idx_events_type_created on public.activity_events(event_type, created_at desc);
create index if not exists idx_docs_owner_created on public.documents(owner_id, created_at desc);
create index if not exists idx_progress_owner_status on public.topic_progress(owner_id, status);
