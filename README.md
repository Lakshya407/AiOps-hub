# AIOps Learning Hub

Role-based learning dashboard for a six-month AIOps roadmap (user + admin panels). Minimal dark UI, Supabase backend (Postgres + Auth + Storage + Realtime), static frontend on Netlify.

## Stack

React + Vite + TypeScript · Tailwind · React Router · TanStack Query · React Hook Form + Zod · Recharts · React Markdown (sanitized) · Lucide icons · Supabase · Netlify

## Quick start (local)

```bash
npm install
cp .env.example .env   # fill VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm run dev
```

## Supabase setup (required, one-time)

1. **Create project** at https://supabase.com → note Project URL + anon/publishable key.
2. **Apply migrations** — Supabase Dashboard → SQL Editor → run in order:
   - `supabase/migrations/0001_schema.sql`
   - `supabase/migrations/0002_rls.sql`
   - `supabase/migrations/0003_storage.sql`
   - `supabase/migrations/0007_admin_roles.sql`
   - `supabase/migrations/0008_admin_hardening.sql`
   - `supabase/migrations/0009_seed_roadmap_per_owner.sql`
   - `supabase/migrations/0011_notes_obsidian.sql` (notes: roadmap link + pinning + indexes; safe rerun)
   - `supabase/migrations/0012_note_images_storage.sql` (public `note_images` bucket for pasted note images; owner-scoped writes, safe rerun)
   (or `supabase db push` with the CLI; 0004–0006 are curriculum upgrades, apply if present).
3. **Seed curriculum** — each user picks tracks from the app (Dashboard or Roadmap → seed cards),
   or in SQL Editor run:
   ```sql
   select public.seed_roadmap(auth.uid());         -- AIOps track (6 phases / 18 skills)
   select public.seed_onprem_roadmap(auth.uid());  -- On-Prem LLM track (2 phases / 13 skills)
   ```
   Both functions upsert idempotently **per owner + track** (natural-key
   conflicts); they never touch `topic_progress`. Safe for any number of users.
   Tracks coexist in one account; the Roadmap/Dashboard track tabs filter between them.
4. **Storage** — migration creates private `documents` bucket with owner-path RLS (`<uid>/…`). Uploads use short-lived signed URLs (5 min).
5. **Auth** — Redirect URLs (Authentication → URL Configuration): add `http://localhost:5173` and your Netlify `https://…netlify.app` (+ `/**`).
   Supabase caps project email sending per hour — bursts of signups/resets fail with
   “email rate limit exceeded”. For internal/team use, turn OFF “Confirm email”
   (Authentication → Providers → Email); for production, configure a custom SMTP
   sender there to lift the cap.
   New signups get the `user` role automatically. Promote the first admin in SQL Editor:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```
   Further role changes: Admin sidebar → User Monitoring (audited), or the same SQL as DBA.
6. **Realtime** — Database → Replication → enable the `supabase_realtime` publication for: `topic_progress, notes, documents, study_sessions, project_milestones, daily_logs, revision_items, profiles` (`profiles` drives instant role refresh on demotion).
6. **Realtime** — Database → Replication → enable the `supabase_realtime` publication for: `topic_progress, notes, documents, study_sessions, project_milestones, daily_logs, revision_items`.

## Netlify deploy

- Connect this GitHub repo → Build command `npm run build`, publish `dist`, SPA redirect already in `netlify.toml`.
- Environment: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (no secrets — anon key only).
- Add Netlify domain to Supabase Auth redirect allowlist (step 5).

## Usage

- **Dashboard** (`/dashboard`, per-user) — roadmap %, topics, skills, documents; first login seeds the personal roadmap.
- **Roadmap (home)** — one block per skill, rope-connected; click for topics/subtopics, notes, docs.
- **Today** — auto day plan from start date (Settings), study timer, daily log (a day completes only via “Complete day”).
- **Documents** — drag & drop, private, preview/download/replace/delete.
- **Projects** — milestone timelines + repo/demo links.
- **Analytics** — completion, study time, weekly bars, streaks, revisions — all from persisted data.
- **Settings** — start date, re-seed, password reset, Obsidian vault config, logout.
- **Admin Console** (`/admin`, admins only) — total/active/session user counts, recent registrations, uploads, completions, activity table (user, action, date, time).
- **User Monitoring** (`/admin/users`, admins only) — searchable paginated directory, per-user skill reports + documents (signed URLs) + activity, audited role changes.

## Notes + Obsidian

- **Notes** (`/notes`) — Obsidian-style two-panel workspace: searchable list grouped by roadmap/skill/topic (left), Markdown editor with Edit / Preview / Split modes (right). Toolbar for headings, bold, italic, lists, checklists, quotes, code, links, tables, image attach. Autosaves ~1s after typing with Saving / Saved / Save-failed + retry (unsaved edits are preserved). Create, rename (click title), delete (confirmed), search, pin, duplicate. Word count + last-edited timestamp. Markdown is rendered with GFM + `rehype-sanitize`; `javascript:`/`data:` links are blocked.
- **Note images** — paste screenshots with Ctrl+V / Cmd+V, drag & drop, or use the toolbar image button. PNG/JPG/GIF/WebP up to 5 MB each (5 per paste). Files upload to the `note_images` storage bucket and insert as standard `![alt](url)` Markdown at the cursor, with an Uploading indicator in the status bar. Image links keep working in previews, after refresh, and in Obsidian exports.
- **Roadmap linkage** — each skill page has a Notes tab (notes for that skill, create-note, last-edited date, link to the full workspace); every topic row has a quick Note button + open link. Creating a note never marks a topic complete.
- **Obsidian setup** — Settings → Obsidian integration: enable, set your local vault name (must already exist in Obsidian), optional base folder (default `LearnHub`). Requires Obsidian installed on the same device. There is **no two-way sync**.
  - **Export .md** — downloads UTF-8 Markdown with YAML frontmatter (`title`, `roadmap`, `skill`, `topic`, `exported`); content is unchanged; filenames are sanitized.
  - **Open in Obsidian** — opens the existing vault file via `obsidian://open` (warns if you have unsaved browser edits; never overwrites).
  - **Send to Obsidian** — creates a new vault note via `obsidian://new`; long notes exceed URI limits and should be exported as a file instead.
  - **Import** — upload a `.md` file (≤512 KB, UTF-8); preview before importing as an independent note or into the current topic; existing notes are never overwritten.
- **Database** — apply `supabase/migrations/0011_notes_obsidian.sql` once (adds `notes.roadmap_id`, `notes.is_pinned`, indexes; re-asserts owner-only RLS) and `supabase/migrations/0012_note_images_storage.sql` once (creates the public `note_images` bucket for pasted images; writes stay owner-scoped). Note: image URLs are public-but-unguessable (random UUID paths) so they survive in previews and Obsidian exports — don't paste secrets as images. No new env vars; no service-role keys.

## Security model

- RLS on every user table: `auth.uid() = owner_id` (SELECT/INSERT/UPDATE/DELETE incl. `WITH CHECK`).
- Roles are DB-backed (`profiles.role`, default `user`). `is_admin()` is `SECURITY DEFINER` (no recursive RLS); a trigger rejects non-admin role edits; app role changes go through the audited `admin_set_role()` RPC. Admins read monitoring data via RLS admin policies + the paginated `admin_user_overview()` RPC.
- Presence (`user_presence`, 60s heartbeat): active = seen ≤5 min; tracked session = seen ≤30 min or login without later logout. Expired sessions age out.
- Storage RLS scoped to `auth.uid()/…` paths plus an admin-read policy; private bucket; signed URLs.
- No service-role keys in the repo or client. Inputs validated (Zod), file type/size checked, Markdown sanitized (`rehype-sanitize`), URLs validated.

## Tests

```bash
npm test            # vitest: progress, streak, scheduling, RLS/seed + admin-panel guards + notes/obsidian
npm run typecheck
npm run build
node scripts/verify-seed.mjs
```

E2E (manual checklist in `tests/`): login → seed → complete a topic → refresh (persists) → second device (realtime) → upload/preview/delete doc → note + revision → timer + complete day → milestone toggle → analytics numbers match.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Empty roadmap after login | Run `select seed_roadmap(auth.uid())`; check env vars |
| Login redirect loop | Add site URL to Auth URL config |
| Upload fails | Check `documents` bucket exists + storage policies; ≤25 MB; allowed types |
| Delete seems to do nothing | Fixed: deletes are row-first + errors now surface in the list; refresh if stale |
| email rate limit exceeded | Hourly Supabase email cap — wait ~1h; turn OFF “Confirm email” or set custom SMTP (step 5) |
| Realtime not syncing | Enable replication publication (step 6); check Online badge |
| Build fails | `npm run typecheck` first; ensure Node 20 |

## License

MIT — see `LICENSE`.
