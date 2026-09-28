// @ts-nocheck
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

const read = (p: string) => fs.readFileSync(p, 'utf8');

describe('role-based auth (DB single source of truth)', () => {
  it('roles.ts has no client-side override or env allowlist', () => {
    const c = read('src/lib/auth/roles.ts');
    expect(c).not.toMatch(/localStorage/i);
    expect(c).not.toMatch(/VITE_ADMIN/i);
    expect(c).toMatch(/profiles/);
  });
  it('useAuth resolves role from profiles only, waits on roleLoading, watches role changes', () => {
    const c = read('src/hooks/useAuth.tsx');
    expect(c).not.toMatch(/localStorage/i);
    expect(c).not.toMatch(/VITE_ADMIN/i);
    expect(c).toMatch(/roleLoading/);
    expect(c).toMatch(/profiles/);
    expect(c).toMatch(/postgres_changes/);
  });
  it('no permission-toggle backdoor in auth section', () => {
    for (const f of ['src/lib/auth/roles.ts', 'src/hooks/useAuth.tsx', 'src/lib/auth/admin.ts']) {
      expect(read(f)).not.toMatch(/setUserPermissions|permissionsFor|writePermissionsOverride/i);
    }
  });
});

describe('admin route protection', () => {
  it('router guards /admin with role-aware RequireAdmin + access-denied state', () => {
    const c = read('src/app/router.tsx');
    expect(c).toMatch(/RequireAdmin/);
    expect(c).toMatch(/roleLoading/);
    expect(c).toMatch(/AccessDenied/);
    expect(c).toMatch(/admin\/users/);
  });
  it('sidebar shows exactly Admin Console + User Monitoring, only for admins', () => {
    const c = read('src/components/layout/Sidebar.tsx');
    expect(c).toMatch(/Admin Console/);
    expect(c).toMatch(/User Monitoring/);
    expect(c).toMatch(/isAdmin/);
    expect(c).not.toMatch(/permissions/);
  });
  it('login redirects by DB role', () => {
    const c = read('src/pages/Login/Login.tsx');
    expect(c).toMatch(/profiles/);
    expect(c).toMatch(/\/dashboard/);
  });
});

describe('user dashboard', () => {
  it('streak and study-time widgets are removed (presentation only)', () => {
    const c = read('src/pages/User/UserDashboard.tsx');
    expect(c).not.toMatch(/Streak/);
    expect(c).not.toMatch(/Study time/);
    expect(c).not.toMatch(/computeStreak/);
  });
  it('dashboard keeps seed roadmap + per-user progress', () => {
    const c = read('src/pages/User/UserDashboard.tsx');
    expect(c).toMatch(/seedRoadmap/);
    expect(c).toMatch(/Roadmap/);
    expect(c).toMatch(/Topics/);
  });
  it('tracking services still record history (no DB deletion)', () => {
    expect(read('src/services/tracking.ts')).toMatch(/study_sessions/);
    expect(read('src/lib/utils/streak.ts')).toMatch(/computeStreak/);
  });
});

describe('admin backend (migrations 0008/0009)', () => {
  const m8 = () => read('supabase/migrations/0008_admin_hardening.sql');
  it('is_admin is SECURITY DEFINER (no recursive RLS)', () => {
    expect(m8()).toMatch(/security definer/i);
    expect(m8()).toMatch(/create or replace function public\.is_admin/);
  });
  it('presence table + role guard + audited role RPC + overview RPC', () => {
    expect(m8()).toMatch(/user_presence/);
    expect(m8()).toMatch(/protect_profile_role/);
    expect(m8()).toMatch(/Only admins may change user roles/);
    expect(m8()).toMatch(/admin_set_role/);
    expect(m8()).toMatch(/admin_user_overview/);
    expect(m8()).toMatch(/actor_id/);
  });
  it('overview RPC output names cannot collide with columns (no ambiguous refs)', () => {
    expect(m8()).toMatch(/o_created_at/);
    expect(m8()).toMatch(/o_total_count/);
  });
  it('role guard blocks app users but allows direct DBA sessions', () => {
    expect(m8()).toMatch(/Only admins may change user roles/);
    expect(m8()).toMatch(/auth\.uid\(\) is null/);
  });
  it('storage admin read policy without public bucket', () => {
    expect(m8()).toMatch(/documents_admin_read/);
    expect(m8()).not.toMatch(/public\s*=\s*true/i);
  });
  it('new users default to user role', () => {
    expect(m8()).toMatch(/'user'/);
    expect(m8()).toMatch(/handle_new_user/);
  });
  it('seed is per-owner idempotent (no global fixed-UUID conflicts)', () => {
    const seed = read('supabase/seed/seed.sql');
    expect(seed).toMatch(/seed_roadmap\(p_owner uuid\)/);
    expect(seed).toMatch(/on conflict \(owner_id, track, month_number\)/);
    expect(seed).toMatch(/on conflict \(owner_id, track, title\)/);
    expect(seed).toMatch(/on conflict \(owner_id, skill_id, title\)/);
    expect(seed).not.toMatch(/on conflict \(id\)/);
    expect(seed).not.toMatch(/delete from/i);
    const m9 = read('supabase/migrations/0009_seed_roadmap_per_owner.sql');
    expect(m9).toMatch(/seed_roadmap\(p_owner uuid\)/);
  });
  it('admin data layer uses RPC/RLS and never service keys', () => {
    const c = read('src/lib/auth/admin.ts');
    expect(c).toMatch(/admin_user_overview/);
    expect(c).toMatch(/admin_set_role/);
    expect(c).not.toMatch(/service_role/i);
  });
});

describe('bugfix regressions', () => {
  it('user-panel service reads/writes are explicitly owner-scoped (no merged admin views)', () => {
    const scoped: [string, number][] = [
      ['src/services/roadmap.ts', 5], // fetchPhases/Skills/TopicsBySkill/AllTopics/Progress
      ['src/services/tracking.ts', 8], // fetchSessions/DailyLog/Projects/Milestones + scoped writes
      ['src/services/documents.ts', 3], // fetchDocuments/deleteDocument/replaceDocumentFile
      ['src/services/notes.ts', 5], // fetchNotes/Revisions/saveNote/deleteNote/completeRevision
    ];
    for (const [f, min] of scoped) {
      const hits = read(f).match(/eq\('owner_id'/g) ?? [];
      expect(hits.length, f).toBeGreaterThanOrEqual(min);
    }
  });
  it('document delete is row-first, owner-scoped, and surfaces errors', () => {
    const svc = read('src/services/documents.ts');
    expect(svc.indexOf(".delete().eq('id', id).eq('owner_id'")).toBeGreaterThan(-1);
    expect(svc.indexOf('.delete()')).toBeLessThan(svc.indexOf('.remove('));
    const list = read('src/components/documents/DocumentList.tsx');
    expect(list).toMatch(/catch/);
    expect(list).toMatch(/setErr/);
  });
  it('login explains email rate limits with admin remediation', () => {
    const c = read('src/pages/Login/Login.tsx');
    expect(c).toMatch(/rate limit/i);
    expect(c).toMatch(/Confirm email/);
    expect(c).toMatch(/SMTP/);
  });
});

describe('multi-track seeding (aiops + onprem)', () => {
  it('migration 0010 adds track columns and widens natural-key uniques', () => {
    const m = read('supabase/migrations/0010_multi_track.sql');
    expect(m).toMatch(/add column if not exists track/);
    expect(m).toMatch(/roadmap_phases_owner_track_month_unique/);
    expect(m).toMatch(/skills_owner_track_title_unique/);
    expect(m).toMatch(/seed_roadmap/);
    expect(m).toMatch(/seed_onprem_roadmap/);
  });
  it('aiops seed is explicitly track-stamped and collision-free', () => {
    const seed = read('supabase/seed/seed.sql');
    const stamped = seed.match(/p_owner, 'aiops',/g) ?? [];
    expect(stamped.length).toBe(216); // 6 phases + 18 skills + 192 topics
    expect(seed).toMatch(/on conflict \(owner_id, track, month_number\)/);
    expect(seed).toMatch(/on conflict \(owner_id, track, title\)/);
    expect(seed).not.toMatch(/on conflict \(id\)/);
  });
  it('onprem seed defines the 2-month LLM infra curriculum', () => {
    const seed = read('supabase/seed/seed_onprem.sql');
    expect(seed).toMatch(/seed_onprem_roadmap\(p_owner uuid\)/);
    expect(seed).toMatch(/p_owner, 'onprem',/);
    expect(seed).toMatch(/XE7740/);
    expect(seed).toMatch(/Kimi/);
    expect(seed).toMatch(/DeepSeek/);
    expect(seed).not.toMatch(/on conflict \(id\)/);
    expect(seed).not.toMatch(/delete from/i);
  });
  it('frontend seeds per track and filters by it', () => {
    expect(read('src/services/roadmap.ts')).toMatch(/seed_onprem_roadmap/);
    expect(read('src/services/roadmap.ts')).toMatch(/SeedTrack/);
    expect(read('src/hooks/useTrack.ts')).toMatch(/'all'/);
    expect(read('src/pages/Roadmap/Roadmap.tsx')).toMatch(/Add another track/);
    expect(read('src/pages/Roadmap/Roadmap.tsx')).toMatch(/Choose your roadmap/);
    expect(read('src/pages/User/UserDashboard.tsx')).toMatch(/TRACKS\[t\]\.label/);
    expect(read('src/services/roadmap.ts')).toMatch(/On-Prem LLM/);
    expect(read('src/pages/Settings/Settings.tsx')).toMatch(/Re-run/);
  });
});

describe('user monitoring UI', () => {
  it('search, pagination, skill-wise reports, signed doc URLs, confirm + audit', () => {
    const c = read('src/pages/Admin/UserMonitoring.tsx');
    expect(c).toMatch(/Search/);
    expect(c).toMatch(/Page/);
    expect(c).toMatch(/skillReports/);
    expect(c).toMatch(/signedUrl/);
    expect(c).toMatch(/confirm\(/);
    expect(c).toMatch(/admin_role_change/);
  });
  it('console shows required sections with loading/empty/error states', () => {
    const c = read('src/pages/Admin/AdminConsole.tsx');
    for (const s of ['Total registered', 'Active now', 'Tracked sessions', 'Recent activity', 'Recent registrations', 'Recent document uploads', 'Recent skill completions']) {
      expect(c).toContain(s);
    }
    expect(c).toMatch(/Loading admin data/);
    expect(c).toMatch(/No activity yet/);
  });
});
