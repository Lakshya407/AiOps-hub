"""Transform supabase/seed/seed.sql fixed-UUID inserts into owner-scoped upserts.

Reads the existing seed.sql, parses phase/skill/topic inserts, and emits a new
seed_roadmap(p_owner) function body that is per-owner idempotent:
  phases -> on conflict (owner_id, month_number)
  skills -> on conflict (owner_id, title) with phase lookup by month
  topics -> on conflict (owner_id, skill_id, title) with skill lookup by title
Fails loudly on unexpected patterns so mismatches are caught, not silently kept.
"""
import re
import sys

SRC = r"C:\Users\LakshyaDeshmukh\OneDrive - Info Origin Technologies Pvt Ltd\A Devops Docs\AI-dash\supabase\seed\seed.sql"
OUT_BODY = r"C:\Users\LAKSHY~1\AppData\Local\Temp\opencode\seed_body.sql"
OUT_SEED = r"C:\Users\LakshyaDeshmukh\OneDrive - Info Origin Technologies Pvt Ltd\A Devops Docs\AI-dash\supabase\seed\seed.sql"
OUT_MIG = r"C:\Users\LakshyaDeshmukh\OneDrive - Info Origin Technologies Pvt Ltd\A Devops Docs\AI-dash\supabase\migrations\0009_seed_roadmap_per_owner.sql"

STR = r"'(?:[^']|'')*'"  # single-quoted SQL string incl. escaped ''
VAL = rf"(?:{STR}|[^,()]+?)"

def split_top_commas(s: str):
    parts, cur, q, i = [], [], False, 0
    while i < len(s):
        c = s[i]
        if c == "'":
            if q and i + 1 < len(s) and s[i + 1] == "'":
                cur.append("''")
                i += 2
                continue
            q = not q
            cur.append(c)
        elif c == "," and not q:
            parts.append("".join(cur).strip())
            cur = []
        else:
            cur.append(c)
        i += 1
    parts.append("".join(cur).strip())
    return parts

text = open(SRC, encoding="utf-8").read()
lines = [ln.strip() for ln in text.splitlines() if ln.strip().startswith("insert into public.")]

phase_month = {}   # phase uuid -> month_number
skill_title = {}   # skill uuid -> title
phase_rows, skill_rows, topic_rows = [], [], []
seen_topics = set()
dupes = []

for ln in lines:
    m = re.match(r"insert into public\.(\w+) \(([^)]+)\) values \((.+?)\)(?: on conflict .+)?;$", ln)
    assert m, f"UNPARSEABLE LINE: {ln[:160]}"
    table, cols, vals_raw = m.group(1), m.group(2), m.group(3)
    vals = split_top_commas(vals_raw)
    if table == "roadmap_phases":
        assert len(vals) == 6, f"phase arity: {ln[:120]}"
        pid, _owner, title, desc, month, sort = vals
        assert _owner == "p_owner", ln[:120]
        phase_month[pid.strip("'")] = month
        phase_rows.append((title, desc, month, sort))
    elif table == "skills":
        assert len(vals) == 7, f"skill arity: {ln[:120]}"
        sid, pid, _owner, title, desc, sort, hrs = vals
        assert _owner == "p_owner", ln[:120]
        assert pid.strip("'") in phase_month, f"unknown phase ref: {ln[:120]}"
        skill_title[sid.strip("'")] = title
        skill_rows.append((pid.strip("'"), title, desc, sort, hrs))
    elif table == "topics":
        assert len(vals) == 8, f"topic arity: {ln[:120]}"
        tid, sid, parent, _owner, title, desc, sort, mins = vals
        assert _owner == "p_owner", ln[:120]
        assert parent == "null", f"NON-NULL PARENT (hierarchy!) unsupported: {ln[:160]}"
        assert sid.strip("'") in skill_title, f"unknown skill ref: {ln[:120]}"
        key = (sid.strip("'"), title)
        if key in seen_topics:
            dupes.append(key)
        seen_topics.add(key)
        topic_rows.append((sid.strip("'"), title, desc, sort, mins))
    else:
        raise AssertionError(f"unexpected table {table}")

print(f"phases={len(phase_rows)} skills={len(skill_rows)} topics={len(topic_rows)}")
assert len(phase_rows) == 6, "expected 6 phases"
assert not dupes, f"duplicate (skill,title) pairs would violate new unique constraint: {dupes[:5]}"

out = []
out.append("-- Owner-scoped curriculum seed. Idempotent per owner, never touches progress.")
out.append("-- * phases  -> upsert on (owner_id, month_number)")
out.append("-- * skills  -> upsert on (owner_id, title), phase resolved by month")
out.append("-- * topics  -> upsert on (owner_id, skill_id, title), skill resolved by title")
out.append("create or replace function public.seed_roadmap(p_owner uuid)")
out.append("returns void language plpgsql as $$")
out.append("begin")
for title, desc, month, sort in phase_rows:
    out.append(
        f"  insert into public.roadmap_phases (owner_id, title, description, month_number, sort_order)"
        f" values (p_owner, {title}, {desc}, {month}, {sort})"
        f" on conflict (owner_id, month_number) do update set title=excluded.title,"
        f" description=excluded.description, sort_order=excluded.sort_order;"
    )
for pid, title, desc, sort, hrs in skill_rows:
    month = phase_month[pid]
    out.append(
        f"  insert into public.skills (phase_id, owner_id, title, description, sort_order, estimated_hours)"
        f" values ((select id from public.roadmap_phases where owner_id = p_owner and month_number = {month}),"
        f" p_owner, {title}, {desc}, {sort}, {hrs})"
        f" on conflict (owner_id, title) do update set description=excluded.description,"
        f" sort_order=excluded.sort_order, estimated_hours=excluded.estimated_hours, phase_id=excluded.phase_id;"
    )
for sid, title, desc, sort, mins in topic_rows:
    stitle = skill_title[sid]
    out.append(
        f"  insert into public.topics (skill_id, parent_topic_id, owner_id, title, description, sort_order, estimated_minutes)"
        f" values ((select id from public.skills where owner_id = p_owner and title = {stitle}),"
        f" null, p_owner, {title}, {desc}, {sort}, {mins})"
        f" on conflict (owner_id, skill_id, title) do update set description=excluded.description,"
        f" sort_order=excluded.sort_order, estimated_minutes=excluded.estimated_minutes;"
    )
out.append("end;")
out.append("$$;")
body = "\n".join(out) + "\n"
open(OUT_BODY, "w", encoding="utf-8").write(body)
print(f"wrote {OUT_BODY} ({len(out)} lines)")

seed_file = (
    "-- AIOps Learning Hub seed: idempotent PER OWNER, never touches progress.\n"
    "-- Usage (in Supabase SQL editor, authenticated):  select public.seed_roadmap(auth.uid());\n"
    "-- Safe to run multiple times and for many users: each owner gets their own\n"
    "-- roadmap rows (upserts on natural keys), progress rows are never modified.\n"
    + body
)
open(OUT_SEED, "w", encoding="utf-8").write(seed_file)
print(f"rewrote {OUT_SEED}")

migration = (
    "-- Curriculum seed, owner-scoped (same body as supabase/seed/seed.sql).\n"
    "-- Requires 0008 (topics natural-key unique constraint). Safe to rerun.\n"
    + body
)
open(OUT_MIG, "w", encoding="utf-8").write(migration)
print(f"wrote {OUT_MIG}")
