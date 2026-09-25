import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import {
  resolveRole, permissionsFor, writeRoleOverride, writePermissionsOverride, readRoleOverrides,
  type AppRole, type AppPermissions, type AdminUser,
} from '@/lib/auth/roles';
import {
  heartbeat, readPresence, getActiveUsers, logLocalActivity, mergeActivity, readLocalActivity,
  type ActivityItem, type PresenceEntry,
} from '@/lib/auth/presence';

export interface UserSnapshot {
  userId: string;
  email: string | null;
  restricted: boolean;
  progressTotal: number;
  progressDone: number;
  progressPercent: number;
  docsCount: number;
  docs: Array<{ id: string; title: string; created_at: string; mime_type: string; size_bytes: number }>;
  sessionsCount: number;
  studyMinutes: number;
  activity: ActivityItem[];
  note: string | null;
}

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  // --- role-aware additions (additive, optional for old consumers) ---
  profile: Record<string, any> | null;
  role: AppRole;
  isAdmin: boolean;
  isUser: boolean;
  permissions: AppPermissions;
  users: AdminUser[];
  totalUsers: number;
  activeUsers: PresenceEntry[];
  activeCount: number;
  recentActivity: ActivityItem[];
  adminRefreshTick: number;
  refreshAdmin: () => Promise<void>;
  setUserRole: (email: string, role: AppRole) => Promise<void>;
  setUserPermissions: (email: string, perms: AppPermissions) => Promise<void>;
  fetchUserSnapshot: (userId: string) => Promise<UserSnapshot>;
}

const Ctx = createContext<AuthCtx>({
  user: null, session: null, loading: true, signOut: async () => {},
  profile: null, role: 'user', isAdmin: false, isUser: true,
  permissions: { roadmap: true, documents: true, projects: true, analytics: true },
  users: [], totalUsers: 0, activeUsers: [], activeCount: 0, recentActivity: [],
  adminRefreshTick: 0, refreshAdmin: async () => {},
  setUserRole: async () => {}, setUserPermissions: async () => {},
  fetchUserSnapshot: async (userId) => ({
    userId, email: null, restricted: true, progressTotal: 0, progressDone: 0,
    progressPercent: 0, docsCount: 0, docs: [], sessionsCount: 0, studyMinutes: 0, activity: [], note: null,
  }),
});

function emailOf(u: User | null): string | null {
  return u?.email ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Record<string, any> | null>(null);
  const [presenceMap, setPresenceMap] = useState<Record<string, PresenceEntry>>(() => {
    try { return readPresence(); } catch { return {}; }
  });
  const [serverProfiles, setServerProfiles] = useState<Record<string, any>[]>([]);
  const [serverActivity, setServerActivity] = useState<ActivityItem[]>([]);
  const [adminRefreshTick, setAdminRefreshTick] = useState(0);

  // Initial session + listener (unchanged behaviour)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session); setUser(data.session?.user ?? null); setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s); setUser(s?.user ?? null); setLoading(false);
      if (event === 'SIGNED_IN' && s?.user) {
        logLocalActivity({
          ownerId: s.user.id, email: s.user.email ?? null,
          eventType: 'auth_sign_in', entityType: 'auth',
          metadata: { provider: 'email' },
        });
      }
      if (event === 'SIGNED_OUT') {
        try {
          const prev = readLocalActivity()[0];
          if (prev) logLocalActivity({ ownerId: prev.ownerId, email: prev.email, eventType: 'auth_sign_out', entityType: 'auth', metadata: {} });
        } catch { /* ignore */ }
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Heartbeat: mark current user as seen (drives "active users" without backend changes)
  useEffect(() => {
    if (!user) return;
    const email = emailOf(user) ?? 'unknown';
    setPresenceMap(heartbeat(user.id, email));
    const iv = setInterval(() => {
      setPresenceMap(heartbeat(user.id, email));
      // Best-effort server presence (works after 0007 migration; ignored before)
      supabase.from('profiles').upsert(
        { id: user.id, last_seen_at: new Date().toISOString() },
        { onConflict: 'id' },
      ).then(() => {}, () => {});
    }, 30000);
    // Best-effort server presence immediately (ignored if column/table missing)
    supabase.from('profiles').upsert(
      { id: user.id, last_seen_at: new Date().toISOString() },
      { onConflict: 'id' },
    ).then(() => {}, () => {});
    return () => clearInterval(iv);
  }, [user?.id]);

  // Fetch own profile (best-effort; null when table/row missing — never blocks login)
  useEffect(() => {
    if (!user) { setProfile(null); return; }
    let cancelled = false;
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      .then(({ data, error }) => {
        if (!cancelled && !error) setProfile((data as any) ?? null);
      }, () => {});
    return () => { cancelled = true; };
  }, [user?.id]);

  const role: AppRole = useMemo(
    () => resolveRole(emailOf(user), (profile as any)?.role),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.email, (profile as any)?.role, adminRefreshTick],
  );
  const permissions = useMemo(() => permissionsFor(role, emailOf(user)), [role, user?.email, adminRefreshTick]);
  const isAdmin = role === 'admin';
  const isUser = true; // every authenticated account keeps the user panel

  const refreshAdmin = useCallback(async () => {
    // Directory: server profiles (all rows visible post-migration; own row only pre-migration)
    try {
      const { data, error } = await supabase.from('profiles').select('*').limit(200);
      if (!error && Array.isArray(data)) setServerProfiles(data as any[]);
    } catch { /* pre-migration or offline — presence fallback below */ }
    // Activity: server events (own rows pre-migration; all rows for admins post-migration)
    try {
      const { data, error } = await supabase.from('activity_events')
        .select('*').order('created_at', { ascending: false }).limit(100);
      if (!error && Array.isArray(data)) {
        setServerActivity((data as any[]).map((r) => ({
          id: r.id, ownerId: r.owner_id, email: null,
          eventType: r.event_type, entityType: r.entity_type,
          createdAt: r.created_at, metadata: (r.metadata ?? {}) as Record<string, unknown>,
        })));
      }
    } catch { /* ignore */ }
    try { setPresenceMap({ ...readPresence() }); } catch { /* ignore */ }
    setAdminRefreshTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!user) return;
    refreshAdmin();
    const iv = setInterval(refreshAdmin, 30000);
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'aiops_presence_v1' || e.key === 'aiops_user_roles' || e.key === 'aiops_user_permissions') {
        refreshAdmin();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => { clearInterval(iv); window.removeEventListener('storage', onStorage); };
  }, [user?.id, refreshAdmin]);

  const users: AdminUser[] = useMemo(() => {
    const byId = new Map<string, AdminUser>();
    const overrides = readRoleOverrides();
    void overrides;
    // 1) server profiles
    for (const p of serverProfiles) {
      const email = (p.email as string | undefined) ?? (p.display_name as string | undefined) ?? null;
      const id = p.id as string;
      const resolved = resolveRole(email, (p as any).role);
      byId.set(id, {
        id, email: email ?? id.slice(0, 8),
        role: resolved,
        permissions: permissionsFor(resolved, email),
        createdAt: (p.created_at as string) ?? null,
        lastSignInAt: (p.updated_at as string) ?? null,
        lastSeenAt: ((p as any).last_seen_at as string) ?? presenceMap[id]?.lastSeen ?? null,
        isActive: presenceMap[id]
          ? Date.now() - new Date(presenceMap[id].lastSeen).getTime() <= 5 * 60 * 1000
          : false,
        source: 'supabase',
      });
    }
    // 2) presence-only users (multi-user visibility without migration)
    for (const entry of Object.values(presenceMap)) {
      if (byId.has(entry.userId)) continue;
      const resolved = resolveRole(entry.email, null);
      byId.set(entry.userId, {
        id: entry.userId, email: entry.email, role: resolved,
        permissions: permissionsFor(resolved, entry.email),
        createdAt: null, lastSignInAt: null, lastSeenAt: entry.lastSeen,
        isActive: Date.now() - new Date(entry.lastSeen).getTime() <= 5 * 60 * 1000,
        source: 'presence',
      });
    }
    // 3) current session user always present
    if (user) {
      const email = emailOf(user) ?? user.id.slice(0, 8);
      if (!byId.has(user.id)) {
        byId.set(user.id, {
          id: user.id, email, role,
          permissions: permissionsFor(role, email),
          createdAt: (user.created_at as string) ?? null,
          lastSignInAt: (user.last_sign_in_at as string) ?? null,
          lastSeenAt: presenceMap[user.id]?.lastSeen ?? new Date().toISOString(),
          isActive: true, source: 'session',
        });
      } else {
        const cur = byId.get(user.id)!;
        byId.set(user.id, { ...cur, email, role, permissions: permissionsFor(role, email), isActive: true, lastSeenAt: presenceMap[user.id]?.lastSeen ?? cur.lastSeenAt });
      }
    }
    return [...byId.values()].sort((a, b) => (a.email ?? '').localeCompare(b.email ?? ''));
  }, [serverProfiles, presenceMap, user, role, adminRefreshTick]);

  const activeUsers = useMemo(() => getActiveUsers(presenceMap), [presenceMap, adminRefreshTick]);
  const recentActivity = useMemo(() => {
    const emailById = new Map(users.map((u) => [u.id, u.email]));
    if (user && !emailById.has(user.id) && user.email) emailById.set(user.id, user.email);
    return mergeActivity(serverActivity, emailById);
  }, [serverActivity, users, user, adminRefreshTick]);

  const setUserRole = useCallback(async (email: string, next: AppRole) => {
    // Local-first (instant, works pre-migration) + best-effort server write.
    writeRoleOverride(email, next);
    const target = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (target) {
      try {
        await supabase.from('profiles').update({ role: next } as any).eq('id', target.id);
      } catch { /* column may not exist pre-migration — local override still applies */ }
    }
    logLocalActivity({
      ownerId: user?.id ?? 'admin', email: user?.email ?? null,
      eventType: 'admin_role_change', entityType: 'profile',
      metadata: { target: email, role: next },
    });
    await refreshAdmin();
  }, [users, user, refreshAdmin]);

  const setUserPermissions = useCallback(async (email: string, perms: AppPermissions) => {
    writePermissionsOverride(email, perms);
    const target = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (target) {
      try {
        await supabase.from('profiles').update({ permissions: perms } as any).eq('id', target.id);
      } catch { /* pre-migration — local override still applies */ }
    }
    logLocalActivity({
      ownerId: user?.id ?? 'admin', email: user?.email ?? null,
      eventType: 'admin_permissions_change', entityType: 'profile',
      metadata: { target: email, permissions: perms as unknown as Record<string, unknown> },
    });
    await refreshAdmin();
  }, [users, user, refreshAdmin]);

  const fetchUserSnapshot = useCallback(async (targetUserId: string): Promise<UserSnapshot> => {
    const target = users.find((u) => u.id === targetUserId);
    const email = target?.email ?? null;
    const base: UserSnapshot = {
      userId: targetUserId, email, restricted: false,
      progressTotal: 0, progressDone: 0, progressPercent: 0,
      docsCount: 0, docs: [], sessionsCount: 0, studyMinutes: 0, activity: [], note: null,
    };
    const isSelf = user?.id === targetUserId;
    // Pre-migration RLS only permits self-reads; other users' rows are invisible.
    // Try a scoped query; on RLS denial return a restricted snapshot instead of throwing.
    try {
      if (!isSelf) {
        const probe = await supabase.from('topic_progress').select('id').limit(1);
        if ((probe as any).error && /row-level|permission|policy/i.test(String((probe as any).error.message))) {
          // Fall through to per-table best-effort; tables will each return restricted data.
        }
      }
      const [topicsRes, progRes, docsRes, sessRes, actRes] = await Promise.all([
        supabase.from('topics').select('id'),
        supabase.from('topic_progress').select('topic_id,status'),
        supabase.from('documents').select('id,title,created_at,mime_type,size_bytes,owner_id').order('created_at', { ascending: false }).limit(50),
        supabase.from('study_sessions').select('duration_minutes,started_at,owner_id'),
        supabase.from('activity_events').select('*').order('created_at', { ascending: false }).limit(50),
      ]);
      const denied = [topicsRes, progRes, docsRes, sessRes, actRes].some(
        (r: any) => r.error && /row-level|permission|policy/i.test(String(r.error.message)),
      );
      // When viewing another user without the admin migration, Supabase returns ONLY the
      // viewer's own rows — flag it so the UI can explain instead of showing wrong data.
      if (!isSelf && denied) {
        return { ...base, restricted: true, note: 'Run supabase migration 0007_admin_roles.sql so admins can read other users’ rows. Showing no data rather than mixing in your own.' };
      }
      const own = <T,>(rows: T[] | null | undefined, getOwner?: (r: any) => string): T[] => {
        const list = rows ?? [];
        if (isSelf) return list;
        // Post-migration admins see all rows — filter to target; pre-migration we already returned restricted.
        if (!getOwner) return list;
        const filtered = (list as any[]).filter((r) => getOwner(r) === targetUserId);
        return (filtered.length ? filtered : list) as T[];
      };
      const topics = own((topicsRes.data as any[]) ?? []);
      const prog = own(((progRes.data as any[]) ?? []) as any[], (r: any) => (r as any).owner_id) as any[];
      // docs/sessions/activity carry owner_id when migration applied; fall back gracefully
      let docs = ((docsRes.data as any[]) ?? []) as any[];
      if (!isSelf && docs.length && 'owner_id' in (docs[0] ?? {})) docs = docs.filter((d) => d.owner_id === targetUserId);
      let sess = ((sessRes.data as any[]) ?? []) as any[];
      if (!isSelf && sess.length && 'owner_id' in (sess[0] ?? {})) sess = sess.filter((s) => s.owner_id === targetUserId);
      let acts: ActivityItem[] = ((actRes.data as any[]) ?? []).map((r: any) => ({
        id: r.id, ownerId: r.owner_id, email, eventType: r.event_type,
        entityType: r.entity_type, createdAt: r.created_at, metadata: r.metadata ?? {},
      }));
      if (!isSelf) acts = acts.filter((a) => a.ownerId === targetUserId);
      const done = prog.filter((p) => p.status === 'completed').length;
      const total = Math.max(topics.length, prog.length, 1);
      const minutes = sess.reduce((a, s) => a + (s.duration_minutes || 0), 0);
      // Merge local activity for this user (auth events are logged locally)
      const localForUser = readLocalActivity().filter((a) => a.ownerId === targetUserId);
      const mergedActs = [...acts, ...localForUser]
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 50);
      return {
        ...base, restricted: false,
        progressTotal: total, progressDone: Math.min(done, total),
        progressPercent: Math.round((Math.min(done, total) / total) * 100),
        docsCount: docs.length,
        docs: docs.slice(0, 20).map((d: any) => ({ id: d.id, title: d.title, created_at: d.created_at, mime_type: d.mime_type, size_bytes: d.size_bytes })),
        sessionsCount: sess.length, studyMinutes: minutes, activity: mergedActs, note: null,
      };
    } catch (e: any) {
      return { ...base, restricted: true, note: e?.message ?? 'Unable to load user data.' };
    }
  }, [users, user]);

  const signOut = async () => { await supabase.auth.signOut(); setUser(null); setSession(null); setProfile(null); };

  return (
    <Ctx.Provider value={{
      user, session, loading, signOut,
      profile, role, isAdmin, isUser, permissions,
      users, totalUsers: users.length, activeUsers, activeCount: activeUsers.length,
      recentActivity, adminRefreshTick, refreshAdmin,
      setUserRole, setUserPermissions, fetchUserSnapshot,
    }}>
      {children}
    </Ctx.Provider>
  );
}
export const useAuth = () => useContext(Ctx);
