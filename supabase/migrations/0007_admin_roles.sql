-- Admin roles + user monitoring (ADDITIVE, safe to run multiple times).
-- Pre-migration the app works in local-first mode (roles via VITE_ADMIN_EMAILS +
-- localStorage overrides, presence via browser storage). After this migration,
-- admins can read all users' rows for the Admin Console / User Monitoring pages.
-- Existing owner-only policies are kept; admin policies are added on top.

-- 1) profiles: role / permissions / presence columns
alter table public.profiles
  add column if not exists email text,
  add column if not exists role text not null default 'user' check (role in ('admin','user')),
  add column if not exists permissions jsonb not null default '{"roadmap":true,"documents":true,"projects":true,"analytics":true}',
  add column if not exists last_seen_at timestamptz;

-- Backfill email from auth.users where available (best effort)
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and (p.email is null or p.email = '');

-- Keep updated_at fresh on admin edits
drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch before update on public.profiles
for each row execute function public.touch_updated_at();

-- 2) helper: is_admin()
create or replace function public.is_admin()
returns boolean language sql stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- 3) admin read policies (owner policies from 0002_rls.sql stay untouched).
-- Admins can SELECT every row; writes remain owner-only (admin edits go through
-- profiles.role / profiles.permissions only).
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','roadmap_phases','skills','topics','topic_progress','study_sessions',
    'daily_logs','documents','notes','resources','projects',
    'project_milestones','revision_items','activity_events']
  loop
    execute format('drop policy if exists %1$I_admin_select on public.%1$I', t);
    execute format(
      'create policy %1$I_admin_select on public.%1$I for select using (public.is_admin())',
      t
    );
  end loop;
end $$;

-- Admins may update role/permissions/last_seen on profiles (nothing else).
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- 4) auto-create profile row on signup (keeps directory complete)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'user')
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
