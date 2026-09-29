import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  fetchAdminCounts, fetchRecentActivity, fetchRecentRegistrations,
  fetchRecentUploads, fetchRecentCompletions, AdminNotProvisionedError,
  type AdminCounts, type AdminActivityItem,
} from '@/lib/auth/admin';
import { displayNameOf } from '@/lib/auth/roles';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString();
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString();
}

function friendlyAction(eventType: string): string {
  return eventType.replace(/^topic_/, 'topic ').replace(/^auth_/, '').replace(/_/g, ' ');
}

/** Admin panel 1/2: Admin Console — totals, presence, recent activity. */
export default function AdminConsole() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [counts, setCounts] = useState<AdminCounts | null>(null);
  const [activity, setActivity] = useState<AdminActivityItem[]>([]);
  const [regs, setRegs] = useState<any[]>([]);
  const [uploads, setUploads] = useState<any[]>([]);
  const [completions, setCompletions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [c, a, r, u, d] = await Promise.all([
        fetchAdminCounts(),
        fetchRecentActivity(50),
        fetchRecentRegistrations(8),
        fetchRecentUploads(8),
        fetchRecentCompletions(8),
      ]);
      setCounts(c); setActivity(a); setRegs(r); setUploads(u); setCompletions(d);
    } catch (e: any) {
      setError(e instanceof AdminNotProvisionedError ? e.message : (e?.message ?? 'Failed to load admin data.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-lg font-semibold">Admin console</h1>
          <p className="text-sm text-muted">
            Signed in as <span className="text-text">{user?.email}</span> · admin view of the AIOps Hub.
          </p>
        </div>
        <button className="btn whitespace-nowrap" onClick={() => load()}>Refresh</button>
      </div>

      {loading && <p className="text-sm text-muted mt-4">Loading admin data…</p>}
      {error && (
        <div className="card p-4 mt-4">
          <div className="text-sm font-medium">Couldn’t load admin data</div>
          <p className="text-xs text-muted mt-1 leading-relaxed">{error}</p>
        </div>
      )}

      {!loading && !error && counts && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            {[
              ['Total registered users', String(counts.totalUsers)],
              ['Active now (5 min)', String(counts.activeUsers)],
              ['Tracked sessions', String(counts.trackedSessions)],
              ['New this week', String(counts.newThisWeek)],
            ].map(([k, v]) => (
              <div key={k} className="card p-4">
                <div className="text-xs text-muted">{k}</div>
                <div className="text-xl font-semibold mt-0.5">{v}</div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted mt-2 leading-relaxed">
            Active now = heartbeat within the last 5 minutes. Tracked sessions = heartbeat within
            30 minutes or a login without a later logout. Browser closes and expired sessions age
            out automatically; raw Supabase Auth sessions are not enumerated.
          </p>

          <div className="grid sm:grid-cols-3 gap-4 mt-4">
            <div className="card p-5">
              <div className="text-[15px] font-medium mb-2.5">Recent registrations</div>
              {regs.length === 0 ? (
                <p className="text-xs text-muted">No registrations yet.</p>
              ) : (
                <ul className="space-y-2">
                  {regs.map((r) => (
                    <li key={r.id} className="text-[13px] flex items-center gap-2">
                      <span className="flex-1 truncate">{displayNameOf(r)}</span>
                      <span className="text-muted whitespace-nowrap">{fmtDate(r.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="card p-5">
              <div className="text-[15px] font-medium mb-2.5">Recent document uploads</div>
              {uploads.length === 0 ? (
                <p className="text-xs text-muted">No uploads yet.</p>
              ) : (
                <ul className="space-y-2">
                  {uploads.map((d) => (
                    <li key={d.id} className="text-[13px]">
                      <div className="truncate">{d.title}</div>
                      <div className="text-muted">{d.email ?? '—'} · {fmtDate(d.created_at)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="card p-5">
              <div className="text-[15px] font-medium mb-2.5">Recent skill completions</div>
              {completions.length === 0 ? (
                <p className="text-xs text-muted">No completions yet.</p>
              ) : (
                <ul className="space-y-2">
                  {completions.map((c, i) => (
                    <li key={`${c.topic_id}-${c.owner_id}-${i}`} className="text-[13px]">
                      <div className="truncate">Topic completed</div>
                      <div className="text-muted">{c.email ?? '—'} · {fmtDate(c.completed_at ?? c.updated_at)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="card p-5 mt-4">
            <div className="text-[15px] font-medium mb-2.5">Recent activity</div>
            {activity.length === 0 ? (
              <p className="text-sm text-muted">No activity yet. Sign-ins, completions and admin changes appear here.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-widest text-muted">
                      <th className="py-2 pr-4">User</th>
                      <th className="py-2 pr-4">Action</th>
                      <th className="py-2 pr-4">Date</th>
                      <th className="py-2">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.map((a) => (
                      <tr key={a.id} className="border-t border-border">
                        <td className="py-2 pr-4 max-w-[320px] truncate">{a.displayName ?? a.email ?? a.ownerId.slice(0, 8)}</td>
                        <td className="py-2 pr-4"><span className="badge !py-0.5">{friendlyAction(a.eventType)}</span></td>
                        <td className="py-2 pr-4 text-muted whitespace-nowrap">{fmtDate(a.createdAt)}</td>
                        <td className="py-2 text-muted whitespace-nowrap">{fmtTime(a.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <button className="btn mt-3" onClick={() => nav('/admin/users')}>Open user monitoring</button>
        </>
      )}
    </div>
  );
}
