-- Projects upgrade: skill tags + project files (via documents.project_id).
-- Safe to run multiple times. Owner RLS already covers both tables.
alter table public.projects
  add column if not exists skill_ids uuid[] not null default '{}';

alter table public.documents
  add column if not exists project_id uuid references public.projects(id) on delete cascade;

create index if not exists idx_docs_project on public.documents(project_id);
create index if not exists idx_projects_skills on public.projects using gin (skill_ids);
