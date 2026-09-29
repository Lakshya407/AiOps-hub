-- 0011_notes_obsidian.sql — Obsidian-inspired notes upgrade.
-- Safe to rerun. Extends the existing public.notes table (0001_schema.sql) without
-- breaking current columns (owner_id, skill_id, topic_id, title, content_markdown, tags).
-- Adds roadmap linkage (roadmap_phases) + pinning, indexes, updated_at trigger guard,
-- and re-asserts owner-only RLS (defence in depth; 0002_rls.sql already covers notes).

-- 1) New columns ------------------------------------------------------------
alter table public.notes add column if not exists roadmap_id uuid references public.roadmap_phases(id) on delete set null;
alter table public.notes add column if not exists is_pinned boolean not null default false;

-- Backfill roadmap_id from skill -> phase where possible (best effort, idempotent)
update public.notes n
set roadmap_id = s.phase_id
from public.skills s
where n.skill_id = s.id and n.roadmap_id is null;

-- 2) Indexes ----------------------------------------------------------------
create index if not exists idx_notes_owner_updated on public.notes(owner_id, updated_at desc);
create index if not exists idx_notes_owner_pinned on public.notes(owner_id, is_pinned desc, updated_at desc);
create index if not exists idx_notes_skill on public.notes(skill_id);
create index if not exists idx_notes_roadmap on public.notes(roadmap_id);
-- idx_notes_owner and idx_notes_topic already exist (0001). Title/content search
-- uses client-side ILIKE scoped by owner_id; add trigram-friendly plain indexes:
create index if not exists idx_notes_owner_title on public.notes(owner_id, title);

-- 3) updated_at trigger (guard: 0001 already created trg_notes_touch) --------
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_notes_touch') then
    create trigger trg_notes_touch before update on public.notes
      for each row execute function public.touch_updated_at();
  end if;
end $$;

-- 4) RLS (guard: 0002 already enabled owner policies on notes) ---------------
alter table public.notes enable row level security;
do $$
declare t text := 'notes';
begin
  if not exists (select 1 from pg_policies where policyname = 'notes_owner_select' and tablename = 'notes') then
    execute 'create policy notes_owner_select on public.notes for select using (auth.uid() = owner_id)';
  end if;
  if not exists (select 1 from pg_policies where policyname = 'notes_owner_insert' and tablename = 'notes') then
    execute 'create policy notes_owner_insert on public.notes for insert with check (auth.uid() = owner_id)';
  end if;
  if not exists (select 1 from pg_policies where policyname = 'notes_owner_update' and tablename = 'notes') then
    execute 'create policy notes_owner_update on public.notes for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id)';
  end if;
  if not exists (select 1 from pg_policies where policyname = 'notes_owner_delete' and tablename = 'notes') then
    execute 'create policy notes_owner_delete on public.notes for delete using (auth.uid() = owner_id)';
  end if;
end $$;

-- 5) Realtime hint (apply in Dashboard → Replication if not already enabled):
-- add table public.notes to the supabase_realtime publication.
-- alter publication supabase_realtime add table public.notes;
