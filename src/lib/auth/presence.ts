/**
 * Auth-section presence + activity helpers (database-backed).
 *
 * Windows (documented, used by the Admin Console):
 * - ACTIVE_WINDOW: last_seen_at within the last 5 minutes  -> "active now".
 * - SESSION_WINDOW: last_seen_at within 30 minutes OR last_login_at newer than
 *   last_logout_at -> "tracked session". Browser closes and expired sessions
 *   age out automatically through heartbeat expiry; the app does not claim to
 *   enumerate raw Supabase Auth sessions (no server access to them).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export const ACTIVE_WINDOW_MS = 5 * 60 * 1000;
export const SESSION_WINDOW_MS = 30 * 60 * 1000;

export interface PresenceRow {
  user_id: string;
  email: string | null;
  last_seen_at: string | null;
  last_login_at: string | null;
  last_logout_at: string | null;
}

export function isActive(lastSeenAt: string | null, now = Date.now()): boolean {
  if (!lastSeenAt) return false;
  return now - new Date(lastSeenAt).getTime() <= ACTIVE_WINDOW_MS;
}

/** "Tracked session": recent heartbeat or a login without a later logout. */
export function hasTrackedSession(p: PresenceRow | null | undefined, now = Date.now()): boolean {
  if (!p) return false;
  if (p.last_seen_at && now - new Date(p.last_seen_at).getTime() <= SESSION_WINDOW_MS) return true;
  if (p.last_login_at && (!p.last_logout_at || new Date(p.last_login_at) > new Date(p.last_logout_at))) return true;
  return false;
}

async function bestEffort(p: PromiseLike<unknown>): Promise<void> {
  try { await p; } catch { /* presence/activity must never break the app */ }
}

/** Heartbeat: upsert last_seen_at (RLS: users own their row). */
export function touchPresence(db: SupabaseClient, userId: string, email: string | null): Promise<void> {
  return bestEffort(
    (db.from('user_presence') as any).upsert(
      { user_id: userId, email, last_seen_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    ),
  );
}

export function markLogin(db: SupabaseClient, userId: string, email: string | null): Promise<void> {
  const now = new Date().toISOString();
  return bestEffort(
    (db.from('user_presence') as any).upsert(
      { user_id: userId, email, last_login_at: now, last_seen_at: now },
      { onConflict: 'user_id' },
    ),
  );
}

export function markLogout(db: SupabaseClient, userId: string): Promise<void> {
  return bestEffort(
    (db.from('user_presence') as any)
      .update({ last_logout_at: new Date().toISOString() })
      .eq('user_id', userId),
  );
}

export interface AuthEvent {
  ownerId: string;
  eventType: string;
  entityType: string;
  entityId?: string | null;
  /** Safe metadata only — never document content or secrets. */
  metadata?: Record<string, unknown>;
}

/** Append to activity_events (owner RLS: users write their own rows). */
export function logEvent(db: SupabaseClient, e: AuthEvent): Promise<void> {
  return bestEffort(
    (db.from('activity_events') as any).insert({
      owner_id: e.ownerId,
      event_type: e.eventType,
      entity_type: e.entityType,
      entity_id: e.entityId ?? null,
      metadata: e.metadata ?? {},
    }),
  );
}
