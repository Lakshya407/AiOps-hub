/**
 * Auth-section role model.
 *
 * Single source of truth: public.profiles.role in Supabase ('admin' | 'user').
 * - Every new profile defaults to 'user' (DB default + handle_new_user trigger).
 * - Only admins can change roles (RLS policies + protect_profile_role trigger
 *   + the admin_set_role RPC). There is intentionally NO client-side override,
 *   NO env allowlist and NO browser-storage role cache: anything client-writable
 *   would let a user escalate themselves.
 */

export type AppRole = 'admin' | 'user';

export function isValidRole(r: unknown): r is AppRole {
  return r === 'admin' || r === 'user';
}

/** Display name fallback chain for admin tables. */
export function displayNameOf(profile: { display_name?: string | null; email?: string | null; id?: string }): string {
  if (profile.display_name) return profile.display_name;
  if (profile.email) return profile.email;
  return (profile.id ?? 'unknown').slice(0, 8);
}
