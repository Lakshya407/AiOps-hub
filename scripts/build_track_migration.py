"""Build supabase/migrations/0010_multi_track.sql from the two seed files.

Composes: track columns + natural-key unique migration + the exact
seed_roadmap (aiops) and seed_onprem_roadmap (onprem) function bodies.
Fails loudly if expectations (tracks, conflicts, counts) are not met.
"""
import re

BASE = r"C:\Users\LakshyaDeshmukh\OneDrive - Info Origin Technologies Pvt Ltd\A Devops Docs\AI-dash"
SEED_AIOPS = BASE + r"\supabase\seed\seed.sql"
SEED_ONPREM = BASE + r"\supabase\seed\seed_onprem.sql"
OUT = BASE + r"\supabase\migrations\0010_multi_track.sql"


def extract_function(path: str, fname: str) -> str:
    text = open(path, encoding="utf-8").read()
    idx = text.find(f"create or replace function public.{fname}(")
    assert idx != -1, f"{fname} not found in {path}"
    return text[idx:].strip() + "\n"


aiops = extract_function(SEED_AIOPS, "seed_roadmap")
onprem = extract_function(SEED_ONPREM, "seed_onprem_roadmap")

# --- validations ---
assert "track = 'aiops'" in aiops, "aiops body must scope lookups by track"
assert aiops.count("p_owner, 'aiops',") == 216, f"aiops inserts: {aiops.count(chr(39)+'aiops'+chr(39))}"
assert "(owner_id, track, month_number)" in aiops
assert "(owner_id, track, title)" in aiops
assert "on conflict (id)" not in aiops

assert "track = 'onprem'" in onprem, "onprem body must scope lookups by track"
assert "p_owner, 'onprem'," in onprem
assert "(owner_id, track, month_number)" in onprem
assert "(owner_id, track, title)" in onprem
assert "on conflict (id)" not in onprem
n_ph = onprem.count("into public.roadmap_phases")
n_sk = onprem.count("into public.skills")
n_tp = onprem.count("into public.topics")
print(f"onprem: phases={n_ph} skills={n_sk} topics={n_tp}")
assert (n_ph, n_sk, n_tp) == (2, 13, 91), "unexpected onprem curriculum size"

mig = """-- 0010_multi_track.sql — AIOps + On-Prem LLM tracks side by side.
-- Safe to rerun. Existing rows default to track 'aiops'; nothing is deleted.
-- Natural-key uniques gain the track column so both tracks coexist per owner:
--   phases (owner_id, track, month_number), skills (owner_id, track, title).
-- Topics keep (owner_id, skill_id, title) since skills are already track-scoped.
-- Includes the full seed_roadmap (aiops) + seed_onprem_roadmap (onprem) bodies.

-- 1) track columns ----------------------------------------------------------
alter table public.roadmap_phases add column if not exists track text not null default 'aiops';
alter table public.skills add column if not exists track text not null default 'aiops';
alter table public.topics add column if not exists track text not null default 'aiops';

-- 2) widen natural-key uniques to include track ------------------------------
do $$ declare cname text; begin
  select c.conname into cname from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  where t.relname = 'roadmap_phases' and c.contype = 'u'
    and pg_get_constraintdef(c.oid) ilike '%(owner_id, month_number)%';
  if cname is not null then
    execute format('alter table public.roadmap_phases drop constraint %I', cname);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'roadmap_phases_owner_track_month_unique') then
    alter table public.roadmap_phases
      add constraint roadmap_phases_owner_track_month_unique unique (owner_id, track, month_number);
  end if;
end $$;

do $$ declare cname text; begin
  select c.conname into cname from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  where t.relname = 'skills' and c.contype = 'u'
    and pg_get_constraintdef(c.oid) ilike '%(owner_id, title)%';
  if cname is not null then
    execute format('alter table public.skills drop constraint %I', cname);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'skills_owner_track_title_unique') then
    alter table public.skills
      add constraint skills_owner_track_title_unique unique (owner_id, track, title);
  end if;
end $$;

-- 3) curriculum seed functions (bodies mirror supabase/seed/*.sql) -----------
"""
mig += aiops + "\n" + onprem
open(OUT, "w", encoding="utf-8").write(mig)
print(f"wrote {OUT}")
