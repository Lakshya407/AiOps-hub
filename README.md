# AIOps Learning Hub

Personal, single-user learning dashboard for a six-month AIOps roadmap. Minimal dark UI, Supabase backend (Postgres + Auth + Storage + Realtime), static frontend on Netlify.

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
   (or `supabase db push` with the CLI).
3. **Seed curriculum** — create owner account in the app first (Sign up), then in SQL Editor run:
   ```sql
   select public.seed_roadmap(auth.uid());
   ```
   The function upserts all 6 phases / 21 skills / ~240 topics / 6 projects idempotently; it never touches `topic_progress`.
4. **Storage** — migration creates private `documents` bucket with owner-path RLS (`<uid>/…`). Uploads use short-lived signed URLs (5 min).
5. **Auth lockdown** — after the first (owner) account exists:
   Authentication → Sign In / Sign Ups → disable “Allow new users to sign up”.
   Redirect URLs (Authentication → URL Configuration): add `http://localhost:5173` and your Netlify `https://…netlify.app` (+ `/**`).
6. **Realtime** — Database → Replication → enable the `supabase_realtime` publication for: `topic_progress, notes, documents, study_sessions, project_milestones, daily_logs, revision_items`.

## Netlify deploy

- Connect this GitHub repo → Build command `npm run build`, publish `dist`, SPA redirect already in `netlify.toml`.
- Environment: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (no secrets — anon key only).
- Add Netlify domain to Supabase Auth redirect allowlist (step 5).

## Usage

- **Roadmap (home)** — one block per skill, rope-connected; click for topics/subtopics, notes, docs.
- **Today** — auto day plan from start date (Settings), study timer, daily log (a day completes only via “Complete day”).
- **Documents** — drag & drop, private, preview/download/replace/delete.
- **Projects** — milestone timelines + repo/demo links.
- **Analytics** — completion, study time, weekly bars, streaks, revisions — all from persisted data.
- **Settings** — start date, re-seed, password reset, logout.

## Security model

- RLS on every user table: `auth.uid() = owner_id` (SELECT/INSERT/UPDATE/DELETE incl. `WITH CHECK`).
- Storage RLS scoped to `auth.uid()/…` paths; private bucket; signed URLs.
- No service-role keys in the repo or client. Inputs validated (Zod), file type/size checked, Markdown sanitized (`rehype-sanitize`), URLs validated.

## Tests

```bash
npm test            # vitest: progress, streak, scheduling, RLS/seed guards
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
| Realtime not syncing | Enable replication publication (step 6); check Online badge |
| Build fails | `npm run typecheck` first; ensure Node 20 |

## License

MIT — see `LICENSE`.
