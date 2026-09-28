/**
 * Auth-section admin data layer.
 * Every query relies on Supabase RLS / SECURITY DEFINER RPCs that enforce
 * "admins only" server-side. Nothing here is a second source of truth for roles.
 */
import { supabase } from '@/lib/supabase/client';
import { isActive, hasTrackedSession, type PresenceRow } from '@/lib/auth/presence';

export interface OverviewRow {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: 'admin' | 'user';
  createdAt: string | null;
  lastSeenAt: string | null;
  lastLoginAt: string | null;
  progressTotal: number;
  progressDone: number;
  docsCount: number;
  lastActivityAt: string | null;
  totalCount: number;
}

export interface AdminActivityItem {
  id: string;
  ownerId: string;
  email: string | null;
  displayName: string | null;
  eventType: string;
  entityType: string;
  createdAt: string;
}

export class AdminNotProvisionedError extends Error {
  constructor() {
    super('Admin backend not provisioned. Apply supabase migrations 0008 + 0009, then retry.');
    this.name = 'AdminNotProvisionedError';
  }
}

function isMissingRpc(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err ?? '').toLowerCase();
  return msg.includes('admin_user_overview') || msg.includes('function') && msg.includes('does not exist') || msg.includes('schema cache');
}

function isRlsDenied(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err ?? '');
  return /row-level|permission denied|policy|admins only/i.test(msg);
}

/** Paginated, searchable user directory with per-user aggregates (one RPC call). */
export async function fetchUserOverview(search: string, page: number, pageSize: number): Promise<OverviewRow[]> {
  const { data, error } = await (supabase.rpc as any)('admin_user_overview', {
    p_search: search,
    p_limit: pageSize,
    p_offset: page * pageSize,
  });
  if (error) {
    if (isMissingRpc(error) || isRlsDenied(error)) throw new AdminNotProvisionedError();
    throw error;
  }
  return ((data as any[]) ?? []).map((r) => ({
    userId: r.o_user_id,
    email: r.o_email,
    displayName: r.o_display_name,
    role: r.o_role === 'admin' ? 'admin' : 'user',
    createdAt: r.o_created_at,
    lastSeenAt: r.o_last_seen_at,
    lastLoginAt: r.o_last_login_at,
    progressTotal: Number(r.o_progress_total ?? 0),
    progressDone: Math.min(Number(r.o_progress_done ?? 0), Number(r.o_progress_total ?? 0)),
    docsCount: Number(r.o_docs_count ?? 0),
    lastActivityAt: r.o_last_activity_at,
    totalCount: Number(r.o_total_count ?? 0),
  }));
}

export interface AdminCounts {
  totalUsers: number;
  activeUsers: number;
  trackedSessions: number;
  newThisWeek: number;
}

/** Efficient counts: exact-count head queries + one bounded presence scan. */
export async function fetchAdminCounts(): Promise<AdminCounts> {
  const [totalRes, presenceRes] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('user_presence').select('user_id,last_seen_at,last_login_at,last_logout_at').limit(500),
  ]);
  if (totalRes.error && isRlsDenied(totalRes.error)) throw new AdminNotProvisionedError();
  if (totalRes.error) throw totalRes.error;
  if (presenceRes.error && !isRlsDenied(presenceRes.error)) throw presenceRes.error;
  const rows = ((presenceRes.data as any[]) ?? []) as PresenceRow[];
  const now = Date.now();
  const weekAgo = now - 7 * 86400 * 1000;
  let active = 0, sessions = 0;
  for (const p of rows) {
    if (isActive(p.last_seen_at, now)) active += 1;
    if (hasTrackedSession(p, now)) sessions += 1;
  }
  const { count: weekCount } = await supabase.from('profiles')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', new Date(weekAgo).toISOString());
  return {
    totalUsers: totalRes.count ?? 0,
    activeUsers: active,
    trackedSessions: sessions,
    newThisWeek: weekCount ?? 0,
  };
}

async function emailMapFor(ownerIds: string[]): Promise<Map<string, { email: string | null; displayName: string | null }>> {
  const map = new Map<string, { email: string | null; displayName: string | null }>();
  if (!ownerIds.length) return map;
  const { data, error } = await supabase.from('profiles').select('id,email,display_name').in('id', ownerIds);
  if (error) return map;
  for (const r of (data as any[]) ?? []) map.set(r.id, { email: r.email, displayName: r.display_name });
  return map;
}

/** Recent activity across users (admin RLS), newest first. */
export async function fetchRecentActivity(limit = 50): Promise<AdminActivityItem[]> {
  const { data, error } = await supabase.from('activity_events')
    .select('id,owner_id,event_type,entity_type,created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    if (isRlsDenied(error)) throw new AdminNotProvisionedError();
    throw error;
  }
  const rows = (data as any[]) ?? [];
  const emails = await emailMapFor([...new Set(rows.map((r) => r.owner_id as string))]);
  return rows.map((r) => ({
    id: r.id, ownerId: r.owner_id,
    email: emails.get(r.owner_id)?.email ?? null,
    displayName: emails.get(r.owner_id)?.displayName ?? null,
    eventType: r.event_type, entityType: r.entity_type, createdAt: r.created_at,
  }));
}

export async function fetchRecentRegistrations(limit = 8) {
  const { data, error } = await supabase.from('profiles')
    .select('id,email,display_name,role,created_at')
    .order('created_at', { ascending: false }).limit(limit);
  if (error) {
    if (isRlsDenied(error)) throw new AdminNotProvisionedError();
    throw error;
  }
  return (data as any[]) ?? [];
}

export interface UploadRow { id: string; owner_id: string; title: string; mime_type: string; size_bytes: number; created_at: string; email: string | null; }

export async function fetchRecentUploads(limit = 8): Promise<UploadRow[]> {
  const { data, error } = await supabase.from('documents')
    .select('id,owner_id,title,mime_type,size_bytes,created_at')
    .order('created_at', { ascending: false }).limit(limit);
  if (error) {
    if (isRlsDenied(error)) throw new AdminNotProvisionedError();
    throw error;
  }
  const rows = (data as any[]) ?? [];
  const emails = await emailMapFor([...new Set(rows.map((r) => r.owner_id as string))]);
  return rows.map((r) => ({ ...r, email: emails.get(r.owner_id)?.email ?? null }));
}

export interface CompletionRow { topic_id: string; owner_id: string; completed_at: string | null; updated_at: string; email: string | null; }

export async function fetchRecentCompletions(limit = 8): Promise<CompletionRow[]> {
  const { data, error } = await supabase.from('topic_progress')
    .select('topic_id,owner_id,completed_at,updated_at')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false, nullsFirst: false }).limit(limit);
  if (error) {
    if (isRlsDenied(error)) throw new AdminNotProvisionedError();
    throw error;
  }
  const rows = (data as any[]) ?? [];
  const emails = await emailMapFor([...new Set(rows.map((r) => r.owner_id as string))]);
  return rows.map((r) => ({ ...r, email: emails.get(r.owner_id)?.email ?? null }));
}

/** Role change via the audited SECURITY DEFINER RPC (never a direct table write). */
export async function setUserRoleRpc(targetUserId: string, role: 'admin' | 'user'): Promise<void> {
  const { error } = await (supabase.rpc as any)('admin_set_role', { p_target: targetUserId, p_role: role });
  if (error) {
    if (isMissingRpc(error)) throw new AdminNotProvisionedError();
    throw error;
  }
}

export interface SkillReport {
  skillId: string;
  title: string;
  total: number;
  done: number;
  percent: number;
  status: 'Completed' | 'In Progress' | 'Not Started';
}

export interface UserDetail {
  restricted: boolean;
  note: string | null;
  profile: { id: string; email: string | null; displayName: string | null; role: string; createdAt: string | null } | null;
  presence: PresenceRow | null;
  overallPercent: number;
  skillsCompleted: number;
  skillsTotal: number;
  skillReports: SkillReport[];
  docs: Array<{ id: string; title: string; mime_type: string; size_bytes: number; created_at: string; file_path: string }>;
  activity: AdminActivityItem[];
}

/** Full per-user report for the monitoring detail view. */
export async function fetchUserDetail(targetUserId: string): Promise<UserDetail> {
  const empty: UserDetail = {
    restricted: true, note: null, profile: null, presence: null,
    overallPercent: 0, skillsCompleted: 0, skillsTotal: 0,
    skillReports: [], docs: [], activity: [],
  };
  try {
    const db = supabase as any;
    const queries: Promise<any>[] = [
      db.from('profiles').select('id,email,display_name,role,created_at').eq('id', targetUserId).maybeSingle(),
      db.from('user_presence').select('*').eq('user_id', targetUserId).maybeSingle(),
      db.from('skills').select('id,title,sort_order').eq('owner_id', targetUserId).order('sort_order'),
      db.from('topics').select('id,skill_id,title').eq('owner_id', targetUserId),
      db.from('topic_progress').select('topic_id,status,owner_id').eq('owner_id', targetUserId),
      db.from('documents').select('id,title,mime_type,size_bytes,created_at,file_path,owner_id').eq('owner_id', targetUserId).order('created_at', { ascending: false }).limit(50),
      db.from('activity_events').select('id,owner_id,event_type,entity_type,created_at').eq('owner_id', targetUserId).order('created_at', { ascending: false }).limit(50),
    ];
    const [profRes, presRes, skillsRes, topicsRes, progRes, docsRes, actRes] = await Promise.all(queries);
    // skills/topics carry owner_id; progress/docs/activity are admin-visible post-migration.
    // Filter all to the target user; any RLS denial -> restricted notice (never mixed data).
    for (const r of [profRes, presRes, skillsRes, topicsRes, progRes, docsRes, actRes] as any[]) {
      if (r?.error && isRlsDenied(r.error)) {
        return { ...empty, note: 'Insufficient access. Apply migrations 0008 + 0009 and ensure your profile role is admin.' };
      }
      if (r?.error) throw r.error;
    }
    // NOTE: every query is already scoped to the target user server-side.
    // Admin SELECT policies (0007/0008) permit these; without them RLS denies
    // and we surface a restricted notice instead of mixed/wrong data.
    const topics = ((topicsRes.data as any[]) ?? []) as any[];
    const skills = ((skillsRes.data as any[]) ?? []) as any[];
    const topicSkill = new Map(topics.map((t: any) => [t.id, t.skill_id]));
    const progByTopic = new Map<string, string>();
    for (const p of ((progRes.data as any[]) ?? []) as any[]) {
      if (topicSkill.has(p.topic_id)) progByTopic.set(p.topic_id, p.status);
    }
    let totalTopics = 0, doneTopics = 0;
    const skillReports: SkillReport[] = skills.map((s: any) => {
      const st = topics.filter((t: any) => t.skill_id === s.id);
      const done = st.filter((t: any) => progByTopic.get(t.id) === 'completed').length;
      totalTopics += st.length; doneTopics += done;
      const pct = st.length ? Math.round((done / st.length) * 100) : 0;
      return {
        skillId: s.id, title: s.title, total: st.length, done, percent: pct,
        status: pct === 100 && st.length > 0 ? 'Completed' : done > 0 || pct > 0 ? 'In Progress' : 'Not Started',
      };
    });
    const docs = (((docsRes.data as any[]) ?? []) as any[]).slice(0, 20);
    const acts = (((actRes.data as any[]) ?? []) as any[])
      .map((a: any) => ({
        id: a.id, ownerId: a.owner_id ?? targetUserId, email: (profRes.data as any)?.email ?? null,
        displayName: (profRes.data as any)?.display_name ?? null,
        eventType: a.event_type, entityType: a.entity_type, createdAt: a.created_at,
      }));
    const prof = profRes.data as any;
    return {
      restricted: false, note: null,
      profile: prof ? { id: prof.id, email: prof.email, displayName: prof.display_name, role: prof.role, createdAt: prof.created_at } : null,
      presence: (presRes.data as any) ?? null,
      overallPercent: totalTopics ? Math.round((doneTopics / totalTopics) * 100) : 0,
      skillsCompleted: skillReports.filter((s) => s.status === 'Completed').length,
      skillsTotal: skillReports.length,
      skillReports,
      docs: docs.map((d: any) => ({ id: d.id, title: d.title, mime_type: d.mime_type, size_bytes: d.size_bytes, created_at: d.created_at, file_path: d.file_path })),
      activity: acts,
    };
  } catch (e: any) {
    if (isRlsDenied(e)) {
      return { ...empty, note: 'Insufficient access. Apply migrations 0008 + 0009 and ensure your profile role is admin.' };
    }
    throw e;
  }
}
