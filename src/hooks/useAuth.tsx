import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import { isValidRole, type AppRole } from '@/lib/auth/roles';
import { touchPresence, markLogin, markLogout, logEvent } from '@/lib/auth/presence';

export interface OwnProfile {
  id: string;
  email: string | null;
  display_name: string | null;
  role: AppRole;
}

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** True while the role is being resolved — admin UI waits on this. */
  roleLoading: boolean;
  profile: OwnProfile | null;
  role: AppRole;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  /** Re-read the profile row (role changes via Supabase are picked up here). */
  refreshProfile: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null, session: null, loading: true, roleLoading: true,
  profile: null, role: 'user', isAdmin: false,
  signOut: async () => {}, refreshProfile: async () => {},
});

async function fetchOwnProfile(userId: string): Promise<OwnProfile | null> {
  const { data, error } = await supabase.from('profiles')
    .select('id,email,display_name,role').eq('id', userId).maybeSingle();
  if (error || !data) return null;
  const row = data as any;
  return {
    id: row.id,
    email: row.email ?? null,
    display_name: row.display_name ?? null,
    role: isValidRole(row.role) ? row.role : 'user',
  };
}

/** Ensure the profile row exists (trigger covers most cases; this is a fallback). */
async function ensureOwnProfile(user: User): Promise<void> {
  try {
    await (supabase.from('profiles') as any).upsert(
      { id: user.id, email: user.email ?? null },
      { onConflict: 'id', ignoreDuplicates: true },
    );
  } catch { /* trigger or RLS handles it; never blocks login */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  const refreshProfile = useCallback(async () => {
    const u = userRef.current;
    if (!u) { setProfile(null); setRoleLoading(false); return; }
    setRoleLoading(true);
    try {
      const p = await fetchOwnProfile(u.id);
      if (p) {
        setProfile(p);
      } else {
        await ensureOwnProfile(u);
        const retry = await fetchOwnProfile(u.id);
        setProfile(retry);
      }
    } finally {
      setRoleLoading(false);
    }
  }, []);

  // Initial session + auth listener (login/logout tracking included)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      const prev = userRef.current;
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
      if (event === 'SIGNED_IN' && s?.user) {
        void ensureOwnProfile(s.user);
        void markLogin(supabase, s.user.id, s.user.email ?? null);
        void logEvent(supabase, { ownerId: s.user.id, eventType: 'auth_sign_in', entityType: 'auth' });
        void fetchOwnProfile(s.user.id).then((p) => { setProfile(p); setRoleLoading(false); });
      }
      if (event === 'SIGNED_OUT' && prev) {
        void logEvent(supabase, { ownerId: prev.id, eventType: 'auth_sign_out', entityType: 'auth' });
        void markLogout(supabase, prev.id);
        setProfile(null);
        setRoleLoading(false);
      }
      if (event === 'TOKEN_REFRESHED' && s?.user) {
        void touchPresence(supabase, s.user.id, s.user.email ?? null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load profile once the session user is known (first paint path)
  useEffect(() => {
    if (!user || profile) return;
    let cancelled = false;
    (async () => {
      const p = await fetchOwnProfile(user.id);
      if (!cancelled) {
        if (p) setProfile(p);
        else {
          await ensureOwnProfile(user);
          setProfile(await fetchOwnProfile(user.id));
        }
        setRoleLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Live role refresh: a DBA changing profiles.role (or a demotion) reflects
  // immediately; demoted admins lose privileged access on next render + request.
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`profile-role-${user.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        () => { void refreshProfile(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, refreshProfile]);

  // Presence heartbeat (drives the 5-minute "active now" window).
  useEffect(() => {
    if (!user) return;
    void touchPresence(supabase, user.id, user.email ?? null);
    const iv = setInterval(() => {
      const u = userRef.current;
      if (u) void touchPresence(supabase, u.id, u.email ?? null);
    }, 60000);
    return () => clearInterval(iv);
  }, [user?.id]);

  const role: AppRole = profile?.role ?? 'user';
  const isAdmin = !roleLoading && role === 'admin';

  const signOut = async () => {
    const u = userRef.current;
    if (u) {
      await logEvent(supabase, { ownerId: u.id, eventType: 'auth_sign_out', entityType: 'auth' });
      await markLogout(supabase, u.id);
    }
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoleLoading(false);
  };

  return (
    <Ctx.Provider value={{
      user, session, loading, roleLoading, profile, role, isAdmin,
      signOut, refreshProfile,
    }}>
      {children}
    </Ctx.Provider>
  );
}
export const useAuth = () => useContext(Ctx);
