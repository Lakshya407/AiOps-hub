/** Auth-section RBAC helpers. Additive only — no changes to business tables. */

export type AppRole = 'admin' | 'user';

export interface AppPermissions {
  roadmap: boolean;
  documents: boolean;
  projects: boolean;
  analytics: boolean;
}

export interface AdminUser {
  id: string;
  email: string;
  role: AppRole;
  permissions: AppPermissions;
  createdAt: string | null;
  lastSignInAt: string | null;
  lastSeenAt: string | null;
  isActive: boolean;
  source: 'supabase' | 'presence' | 'session';
}

export const DEFAULT_PERMISSIONS: Record<AppRole, AppPermissions> = {
  admin: { roadmap: true, documents: true, projects: true, analytics: true },
  user: { roadmap: true, documents: true, projects: true, analytics: true },
};

const ROLE_OVERRIDE_KEY = 'aiops_user_roles';
const PERMS_OVERRIDE_KEY = 'aiops_user_permissions';

function parseEnvAdmins(): string[] {
  const raw = (import.meta as any)?.env?.VITE_ADMIN_EMAILS as string | undefined;
  return String(raw ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function getEnvAdminEmails(): string[] {
  return parseEnvAdmins();
}

export function resolveRole(email: string | null | undefined, profileRole?: string | null): AppRole {
  const fromProfile = String(profileRole ?? '').toLowerCase();
  if (fromProfile === 'admin') return 'admin';
  if (fromProfile === 'user') {
    // Explicit profile role wins over env allowlist (allows demoting an env admin).
    const overrides = readRoleOverrides();
    const key = String(email ?? '').toLowerCase();
    if (key && overrides[key] === 'user') return 'user';
  }
  const envAdmins = parseEnvAdmins();
  if (email && envAdmins.includes(email.toLowerCase())) return 'admin';
  const key = String(email ?? '').toLowerCase();
  const overrides = readRoleOverrides();
  if (key && overrides[key]) return overrides[key];
  if (fromProfile === 'admin') return 'admin';
  return 'user';
}

export function permissionsFor(role: AppRole, email?: string | null): AppPermissions {
  const base = { ...DEFAULT_PERMISSIONS[role] };
  if (!email) return base;
  try {
    const raw = localStorage.getItem(PERMS_OVERRIDE_KEY);
    if (!raw) return base;
    const map = JSON.parse(raw) as Record<string, Partial<AppPermissions>>;
    const over = map[email.toLowerCase()];
    if (over) return { ...base, ...over };
  } catch {
    /* ignore — defaults apply */
  }
  return base;
}

export function readRoleOverrides(): Record<string, AppRole> {
  try {
    const raw = localStorage.getItem(ROLE_OVERRIDE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, AppRole>;
  } catch {
    return {};
  }
}

export function writeRoleOverride(email: string, role: AppRole) {
  const map = readRoleOverrides();
  map[email.toLowerCase()] = role;
  localStorage.setItem(ROLE_OVERRIDE_KEY, JSON.stringify(map));
}

export function writePermissionsOverride(email: string, perms: AppPermissions) {
  let map: Record<string, AppPermissions> = {};
  try {
    map = JSON.parse(localStorage.getItem(PERMS_OVERRIDE_KEY) ?? '{}');
  } catch {
    map = {};
  }
  map[email.toLowerCase()] = perms;
  localStorage.setItem(PERMS_OVERRIDE_KEY, JSON.stringify(map));
}
