-- RLS: deny-by-default, owner-only access. No client-side ownership bypass.
alter table public.profiles enable row level security;
alter table public.roadmap_phases enable row level security;
alter table public.skills enable row level security;
alter table public.topics enable row level security;
alter table public.topic_progress enable row level security;
alter table public.study_sessions enable row level security;
alter table public.daily_logs enable row level security;
alter table public.documents enable row level security;
alter table public.notes enable row level security;
alter table public.resources enable row level security;
alter table public.projects enable row level security;
alter table public.project_milestones enable row level security;
alter table public.revision_items enable row level security;
alter table public.activity_events enable row level security;

-- Helper: all policies enforce auth.uid() = owner_id (or id for profiles).
-- profiles
drop policy if exists "profiles_owner_all" on public.profiles;
create policy "profiles_owner_all" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- generic owner policies
do $$
declare t text;
begin
  foreach t in array array[
    'roadmap_phases','skills','topics','topic_progress','study_sessions',
    'daily_logs','documents','notes','resources','projects',
    'project_milestones','revision_items','activity_events']
  loop
    execute format('drop policy if exists %1$I_owner_select on public.%1$I', t);
    execute format('drop policy if exists %1$I_owner_insert on public.%1$I', t);
    execute format('drop policy if exists %1$I_owner_update on public.%1$I', t);
    execute format('drop policy if exists %1$I_owner_delete on public.%1$I', t);
    execute format('create policy %1$I_owner_select on public.%1$I for select using (auth.uid() = owner_id)', t);
    execute format('create policy %1$I_owner_insert on public.%1$I for insert with check (auth.uid() = owner_id)', t);
    execute format('create policy %1$I_owner_update on public.%1$I for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id)', t);
    execute format('create policy %1$I_owner_delete on public.%1$I for delete using (auth.uid() = owner_id)', t);
  end loop;
end $$;
