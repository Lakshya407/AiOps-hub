import { useEffect, useState } from 'react';
import { useAuth, type UserSnapshot } from '@/hooks/useAuth';
import type { AppPermissions, AppRole } from '@/lib/auth/roles';
import { fmtMinutes } from '@/lib/utils/format';

const PERM_KEYS: (keyof AppPermissions)[] = ['roadmap', 'documents', 'projects', 'analytics'];

/** Admin panel 2/2: User Monitoring — roles, permissions, per-user progress + docs + activity. */
export default function UserMonitoring() {
  const { users, setUserRole, setUserPermissions, fetchUserSnapshot, refreshAdmin, user: me } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snap, setSnap] = useState<UserSnapshot | null>(null);
  const [snapBusy, setSnapBusy] = useState(false);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => { refreshAdmin(); }, [refreshAdmin]);

  const visible = users.filter((u) =>
    !filter || u.email.toLowerCase().includes(filter.toLowerCase()));

  const select = async (id: string) => {
    setSelectedId(id); setSnap(null); setSnapBusy(true);
    try { setSnap(await fetchUserSnapshot(id)); }
    finally { setSnapBusy(false); }
  };

  const changeRole = async (email: string, role: AppRole) => {
    if (me?.email?.toLowerCase() === email.toLowerCase() && role !== 'admin') {
      if (!confirm('Demote yourself from admin? You will lose access to this page.')) return;
    }
    setBusyEmail(email);
    try { await setUserRole(email, role); } finally { setBusyEmail(null); }
  };

  const togglePerm = async (email: string, key: keyof AppPermissions, perms: AppPermissions) => {
    setBusyEmail(email);
    try { await setUserPermissions(email, { ...perms, [key]: !perms[key] }); }
    finally { setBusyEmail(null); }
  };

  const selected = users.find((u) => u.id === selectedId) ?? null;

  return (
    <div>
      <h1 className="text-lg font-semibold">User monitoring</h1>
      <p className="text-sm text-muted">
        Change permissions, inspect per-user activity, progress reports and uploaded documents.
      </p>

      <div className="card p-4 mt-4">
        <div className="flex items-center gap-2 mb-3">
          <input
            className="input" placeholder="Filter by email…" value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <button className="btn whitespace-nowrap" onClick={() => refreshAdmin()}>Refresh</button>
        </div>
        {visible.length === 0 ? (
          <p className="text-sm text-muted">No users found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-widest text-muted">
                  <th className="py-1.5 pr-2">User</th>
                  <th className="py-1.5 pr-2">Role</th>
                  <th className="py-1.5 pr-2">Permissions</th>
                  <th className="py-1.5 pr-2">Status</th>
                  <th className="py-1.5">Inspect</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((u) => (
                  <tr key={u.id} className={`border-t border-border ${selectedId === u.id ? 'bg-surface/60' : ''}`}>
                    <td className="py-2 pr-2">
                      <div className="truncate max-w-[220px]">{u.email}</div>
                      <div className="text-[11px] text-muted">
                        {u.lastSeenAt ? `seen ${new Date(u.lastSeenAt).toLocaleString()}` : 'never seen'}
                      </div>
                    </td>
                    <td className="py-2 pr-2">
                      <select
                        className="input !w-auto !py-1.5 text-xs" value={u.role}
                        disabled={busyEmail === u.email}
                        onChange={(e) => changeRole(u.email, e.target.value as AppRole)}
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <div className="flex flex-wrap gap-1">
                        {PERM_KEYS.map((k) => (
                          <button
                            key={k} type="button" disabled={busyEmail === u.email}
                            onClick={() => togglePerm(u.email, k, u.permissions)}
                            title={`${k}: ${u.permissions[k] ? 'allowed' : 'denied'} — click to toggle`}
                            className={`badge !py-1 cursor-pointer transition ${u.permissions[k] ? '' : '!text-red-300 !border-red-900 line-through'}`}
                          >
                            {k}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 pr-2">
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                        <span className={`w-2 h-2 rounded-full ${u.isActive ? 'bg-accent' : 'bg-border'}`} />
                        {u.isActive ? 'Active' : 'Idle'}
                      </span>
                    </td>
                    <td className="py-2">
                      <button className="btn !py-1.5 text-xs whitespace-nowrap" onClick={() => select(u.id)}>
                        {selectedId === u.id ? 'Reload' : 'View report'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className="card p-4 mt-3">
          <div className="text-sm font-medium">
            Progress report — <span className="text-muted">{selected.email}</span>
            <span className="badge ml-2">{selected.role}</span>
          </div>
          {snapBusy ? (
            <p className="text-sm text-muted mt-2">Loading report…</p>
          ) : snap ? (
            <div className="mt-2">
              {snap.restricted ? (
                <p className="text-xs text-muted leading-relaxed">{snap.note}</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      ['Progress', `${snap.progressPercent}% (${snap.progressDone}/${snap.progressTotal})`],
                      ['Documents', String(snap.docsCount)],
                      ['Sessions', String(snap.sessionsCount)],
                      ['Study time', fmtMinutes(snap.studyMinutes)],
                    ].map(([k, v]) => (
                      <div key={k} className="card p-3">
                        <div className="text-[11px] text-muted">{k}</div>
                        <div className="text-sm font-semibold">{v}</div>
                      </div>
                    ))}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3 mt-3">
                    <div>
                      <div className="text-xs font-medium mb-1">Uploaded documents ({snap.docs.length})</div>
                      {snap.docs.length === 0 ? (
                        <p className="text-xs text-muted">No uploads.</p>
                      ) : (
                        <ul className="space-y-1 max-h-48 overflow-y-auto">
                          {snap.docs.map((d) => (
                            <li key={d.id} className="text-xs flex items-center gap-2">
                              <span className="flex-1 truncate">{d.title}</span>
                              <span className="text-muted">{new Date(d.created_at).toLocaleDateString()}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-medium mb-1">Recent activity ({snap.activity.length})</div>
                      {snap.activity.length === 0 ? (
                        <p className="text-xs text-muted">No activity.</p>
                      ) : (
                        <ol className="space-y-1 max-h-48 overflow-y-auto">
                          {snap.activity.slice(0, 30).map((a) => (
                            <li key={a.id} className="text-xs flex items-center gap-2">
                              <span className="text-muted whitespace-nowrap">{new Date(a.createdAt).toLocaleString()}</span>
                              <span className="badge !py-0.5">{a.eventType}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
