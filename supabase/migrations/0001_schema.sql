-- AIOps Learning Hub: core schema
-- Enable pgcrypto for UUID generation
create extension if not exists "pgcrypto";

-- profiles (1 row per auth user)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.roadmap_phases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text default '',
  month_number int not null check (month_number between 1 and 6),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (owner_id, month_number)
);
create index if not exists idx_phases_owner on public.roadmap_phases(owner_id);

create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references public.roadmap_phases(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text default '',
  sort_order int not null default 0,
  estimated_hours int not null default 8,
  created_at timestamptz not null default now(),
  unique (owner_id, title)
);
create index if not exists idx_skills_phase on public.skills(phase_id);
create index if not exists idx_skills_owner on public.skills(owner_id);

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.skills(id) on delete cascade,
  parent_topic_id uuid references public.topics(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text default '',
  sort_order int not null default 0,
  estimated_minutes int not null default 60,
  created_at timestamptz not null default now()
);
create index if not exists idx_topics_skill on public.topics(skill_id);
create index if not exists idx_topics_parent on public.topics(parent_topic_id);
create index if not exists idx_topics_owner on public.topics(owner_id);

create table if not exists public.topic_progress (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started','in_progress','completed','needs_revision')),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (owner_id, topic_id)
);
create index if not exists idx_progress_topic on public.topic_progress(topic_id);
create index if not exists idx_progress_owner on public.topic_progress(owner_id);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_minutes int not null default 0,
  notes text default ''
);
create index if not exists idx_sessions_owner on public.study_sessions(owner_id);
create index if not exists idx_sessions_started on public.study_sessions(started_at);

create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  summary text default '',
  challenges text default '',
  next_steps text default '',
  mood text,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (owner_id, log_date)
);
create index if not exists idx_logs_owner_date on public.daily_logs(owner_id, log_date);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  skill_id uuid references public.skills(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  title text not null,
  description text default '',
  file_path text not null,
  mime_type text default '',
  size_bytes bigint not null default 0,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_docs_owner on public.documents(owner_id);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  skill_id uuid references public.skills(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  title text not null default 'Untitled',
  content_markdown text not null default '',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_notes_owner on public.notes(owner_id);
create index if not exists idx_notes_topic on public.notes(topic_id);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete cascade,
  title text not null,
  url text not null,
  resource_type text not null default 'link',
  notes text default ''
);
create index if not exists idx_resources_topic on public.resources(topic_id);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text default '',
  status text not null default 'not_started' check (status in ('not_started','in_progress','completed')),
  repository_url text default '',
  demo_url text default '',
  month_number int,
  started_at timestamptz,
  completed_at timestamptz
);
create index if not exists idx_projects_owner on public.projects(owner_id);

create table if not exists public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text default '',
  status text not null default 'not_started' check (status in ('not_started','in_progress','completed')),
  sort_order int not null default 0
);
create index if not exists idx_milestones_project on public.project_milestones(project_id);

create table if not exists public.revision_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  next_revision_at timestamptz not null default now(),
  last_revised_at timestamptz,
  revision_count int not null default 0,
  status text not null default 'scheduled' check (status in ('scheduled','done','overdue')),
  unique (owner_id, topic_id)
);
create index if not exists idx_revision_owner_next on public.revision_items(owner_id, next_revision_at);

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_events_owner_created on public.activity_events(owner_id, created_at desc);

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
drop trigger if exists trg_progress_touch on public.topic_progress;
create trigger trg_progress_touch before update on public.topic_progress for each row execute function public.touch_updated_at();
drop trigger if exists trg_docs_touch on public.documents;
create trigger trg_docs_touch before update on public.documents for each row execute function public.touch_updated_at();
drop trigger if exists trg_notes_touch on public.notes;
create trigger trg_notes_touch before update on public.notes for each row execute function public.touch_updated_at();
