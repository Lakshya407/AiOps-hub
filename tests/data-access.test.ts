// @ts-nocheck
import { describe, it, expect } from 'vitest';
// Integration contract: services must use owner-scoped queries and never raw service keys.
import fs from 'node:fs';

describe('data-access guards', () => {
  it('no service_role key in src', () => {
    const walk = (d: string): string[] => (fs.readdirSync(d, { withFileTypes: true }) as any[]).flatMap((e: any) => {
      const p = d + '/' + e.name;
      return e.isDirectory() ? walk(p) : [p];
    });
    const files = walk('src').filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));
    for (const f of files) {
      const c = fs.readFileSync(f, 'utf8');
      expect(c).not.toMatch(/service_role/i);
    }
  });
  it('migrations enable RLS on all user tables', () => {
    const rls = fs.readFileSync('supabase/migrations/0002_rls.sql', 'utf8');
    for (const t of ['profiles', 'roadmap_phases', 'skills', 'topics', 'topic_progress', 'study_sessions', 'daily_logs', 'documents', 'notes', 'resources', 'projects', 'project_milestones', 'revision_items', 'activity_events']) {
      expect(rls).toContain(t);
    }
  });
  it('seed is idempotent (on conflict) and never deletes progress', () => {
    const seed = fs.readFileSync('supabase/seed/seed.sql', 'utf8');
    expect(seed).toMatch(/on conflict/i);
    expect(seed).not.toMatch(/delete from/i);
  });
});
