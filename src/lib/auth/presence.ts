/** Auth-section presence + activity helpers (local-first so nothing breaks pre-migration). */

export interface PresenceEntry {
  userId: string;
  email: string;
  lastSeen: string;
}

export interface ActivityItem {
  id: string;
  ownerId: string;
  email: string | null;
  eventType: string;
  entityType: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

const PRESENCE_KEY = 'aiops_presence_v1';
const ACTIVITY_KEY = 'aiops_local_activity_v1';
const ACTIVE_WINDOW_MS = 5 * 60 * 1000;
const MAX_LOCAL_ACTIVITY = 200;

export function readPresence(): Record<string, PresenceEntry> {
  try {
    return JSON.parse(localStorage.getItem(PRESENCE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function heartbeat(userId: string, email: string): Record<string, PresenceEntry> {
  const all = readPresence();
  all[userId] = { userId, email, lastSeen: new Date().toISOString() };
  // prune entries older than 24h to keep storage small
  const cutoff = Date.now() - 24 * 3600 * 1000;
  for (const k of Object.keys(all)) {
    if (new Date(all[k].lastSeen).getTime() < cutoff) delete all[k];
  }
  try {
    localStorage.setItem(PRESENCE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
  return all;
}

export function getActiveUsers(all?: Record<string, PresenceEntry>): PresenceEntry[] {
  const map = all ?? readPresence();
  const now = Date.now();
  return Object.values(map).filter((e) => now - new Date(e.lastSeen).getTime() <= ACTIVE_WINDOW_MS);
}

export function logLocalActivity(item: Omit<ActivityItem, 'id' | 'createdAt'> & { createdAt?: string }) {
  try {
    const raw = JSON.parse(localStorage.getItem(ACTIVITY_KEY) ?? '[]') as ActivityItem[];
    raw.unshift({
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: item.createdAt ?? new Date().toISOString(),
      ...item,
    });
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(raw.slice(0, MAX_LOCAL_ACTIVITY)));
  } catch {
    /* ignore */
  }
}

export function readLocalActivity(): ActivityItem[] {
  try {
    return JSON.parse(localStorage.getItem(ACTIVITY_KEY) ?? '[]') as ActivityItem[];
  } catch {
    return [];
  }
}

export function mergeActivity(server: ActivityItem[], emailById: Map<string, string>): ActivityItem[] {
  const local = readLocalActivity();
  const withEmail = server.map((a) => ({
    ...a,
    email: a.email ?? emailById.get(a.ownerId) ?? null,
  }));
  const seen = new Set(withEmail.map((a) => a.id));
  const merged = [...withEmail];
  for (const l of local) {
    if (!seen.has(l.id)) merged.push(l);
  }
  return merged.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 200);
}
