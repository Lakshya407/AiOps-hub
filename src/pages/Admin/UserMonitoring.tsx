import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  fetchUserOverview, fetchUserDetail, setUserRoleRpc, AdminNotProvisionedError,
  type OverviewRow, type UserDetail,
} from '@/lib/auth/admin';
import { displayNameOf } from '@/lib/auth/roles';
import { signedUrl } from '@/services/documents';

const PAGE_SIZE = 10;

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function fmtBytes(n: number): string {
  if (!n) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Admin panel 2/2: User Monitoring — directory, detail reports, role changes. */
export default function UserMonitoring() {
  const { user: me } = useAuth();
  const [rows, setRows] = useState<OverviewRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [roleBusy, setRoleBusy] = useState(false);
  const [roleMsg, setRoleMsg] = useState<string | null>(null);
  const [docUrlBusy, setDocUrlBusy] = useState<string | null>(null);

  const load = useCallback(async (s: string, p: number) => {
    setLoading(true); setError(null);
    try {
      const data = await fetchUserOverview(s, p, PAGE_SIZE);
      setRows(data);
      setTotal(data[0]?.totalCount ?? 0);
    } catch (e: any) {
      setRows([]); setTotal(0);
      setError(e instanceof AdminNotProvisionedError ? e.message : (e?.message ?? 'Failed to load users.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(search, page); }, [load, search, page]);

  const runSearch = () => { setPage(0); setSearch(searchInput.trim()); };

  const select = async (id: string) => {
    setSelectedId(id); setDetail(null); setRoleMsg(null); setDetailBusy(true);
    try { setDetail(await fetchUserDetail(id)); }
    catch (e: any) {
      setDetail({
        restricted: true, note: e?.message ?? 'Failed to load report.', profile: null,
        presence: null, overallPercent: 0, skillsCompleted: 0, skillsTotal: 0,
        skillReports: [], docs: [], activity: [],
      });
    } finally { setDetailBusy(false); }
  };

  const changeRole = async (targetId: string, email: string | null, next: 'admin' | 'user') => {
    setRoleMsg(null);
    if (me?.id === targetId && next !== 'admin') {
      if (!confirm('Demote yourself from admin? You will immediately lose access to admin pages.')) return;
    } else if (!confirm(`Change ${email ?? 'this user'} to ${next}? This is recorded in the audit log.`)) {
      return;
    }
    setRoleBusy(true);
    try {
      await setUserRoleRpc(targetId, next);
      setRoleMsg(`Role updated to ${next}.`);
      await load(search, page);
      if (selectedId === targetId) await select(targetId);
    } catch (e: any) {
      setRoleMsg(e?.message ?? 'Role change failed.');
    } finally {
      setRoleBusy(false);
    }
  };

  const openDoc = async (filePath: string, docId: string) => {
    setDocUrlBusy(docId);
    try {
      const url = await signedUrl(filePath);
      window.open(url, '_blank', 'noopener');
    } catch (e: any) {
      setRoleMsg(`Could not open document: ${e?.message ?? 'unknown error'}`);
    } finally {
      setDocUrlBusy(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selected = rows.find((r) => r.userId === selectedId) ?? null;
  const roleChanges = (detail?.activity ?? []).filter((a) => a.eventType === 'admin_role_change');

  return (
    <div>
      <h1 className="text-lg font-semibold">User monitoring</h1>
      <p className="text-sm text-muted">
        Search users, inspect learning progress and uploaded documents, manage roles.
      </p>

      <div className="card p-4 mt-4">
        <div className="flex items-center gap-2 mb-3">
          <input
            className="input" placeholder="Search name or email…" value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
          />
          <button className="btn btn-primary whitespace-nowrap" onClick={runSearch}>Search</button>
          <button className="btn whitespace-nowrap" onClick={() => load(search, page)}>Refresh</button>
        </div>
        {loading && <p className="text-sm text-muted">Loading users…</p>}
        {error && <p className="text-xs text-red-300 leading-relaxed">{error}</p>}
        {!loading && !error && rows.length === 0 && (
          <p className="text-sm text-muted">No users found.</p>
        )}
        {!loading && !error && rows.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-widest text-muted">
                    <th className="py-1.5 pr-2">Name</th>
                    <th className="py-1.5 pr-2">Email</th>
                    <th className="py-1.5 pr-2">Role</th>
                    <th className="py-1.5 pr-2">Created</th>
                    <th className="py-1.5 pr-2">Last activity</th>
                    <th className="py-1.5 pr-2">Progress</th>
                    <th className="py-1.5">Inspect</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((u) => {
                    const pct = u.progressTotal ? Math.round((u.progressDone / u.progressTotal) * 100) : 0;
                    return (
                      <tr key={u.userId} className={`border-t border-border ${selectedId === u.userId ? 'bg-surface/60' : ''}`}>
                        <td className="py-2 pr-2 max-w-[160px] truncate">{u.displayName ?? '—'}</td>
                        <td className="py-2 pr-2 max-w-[200px] truncate">{u.email ?? '—'}</td>
                        <td className="py-2 pr-2"><span className="badge">{u.role}</span></td>
                        <td className="py-2 pr-2 text-muted whitespace-nowrap">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
                        <td className="py-2 pr-2 text-muted whitespace-nowrap">{u.lastActivityAt ? new Date(u.lastActivityAt).toLocaleString() : '—'}</td>
                        <td className="py-2 pr-2 whitespace-nowrap">{pct}% · {u.docsCount} docs</td>
                        <td className="py-2">
                          <button className="btn !py-1.5 text-xs whitespace-nowrap" onClick={() => select(u.userId)}>
                            {selectedId === u.userId ? 'Reload' : 'View'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-2 mt-3 text-xs text-muted">
              <button className="btn !py-1.5" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Prev</button>
              <span>Page {page + 1} of {totalPages} · {total} users</span>
              <button className="btn !py-1.5" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          </>
        )}
      </div>

      {selected && (
        <div className="card p-4 mt-3">
          <div className="text-sm font-medium">
            {displayNameOf({ display_name: selected.displayName, email: selected.email, id: selected.userId })}
            <span className="badge ml-2">{selected.role}</span>
          </div>
          <div className="text-xs text-muted mt-0.5">{selected.email ?? '—'}</div>
          {detailBusy && <p className="text-sm text-muted mt-2">Loading report…</p>}
          {detail && detail.restricted && (
            <p className="text-xs text-muted mt-2 leading-relaxed">{detail.note}</p>
          )}
          {detail && !detail.restricted && (
            <div className="mt-3 space-y-4">
              <div>
                <div className="text-xs font-medium mb-1">Account & role (admin only)</div>
                <div className="text-xs text-muted">
                  Created {detail.profile?.createdAt ? fmtDateTime(detail.profile.createdAt) : '—'}
                  {detail.presence?.last_login_at ? ` · Last login ${fmtDateTime(detail.presence.last_login_at)}` : ''}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <select
                    className="input !w-auto !py-1.5 text-xs"
                    value={detail.profile?.role ?? 'user'}
                    disabled={roleBusy}
                    onChange={(e) => changeRole(selected.userId, selected.email, e.target.value as 'admin' | 'user')}
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                  {roleBusy && <span className="text-xs text-muted">Saving…</span>}
                </div>
                {roleMsg && <p className="text-xs text-accent mt-1">{roleMsg}</p>}
                {roleChanges.length > 0 && (
                  <div className="mt-2">
                    <div className="text-[11px] text-muted mb-1">Role audit</div>
                    <ul className="space-y-1">
                      {roleChanges.slice(0, 5).map((a) => (
                        <li key={a.id} className="text-[11px] text-muted">
                          {fmtDateTime(a.createdAt)} — role change recorded
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div>
                <div className="text-xs font-medium mb-1">
                  Roadmap progress — {detail.overallPercent}% overall · {detail.skillsCompleted}/{detail.skillsTotal} skills completed
                </div>
                {detail.skillReports.length === 0 ? (
                  <p className="text-xs text-muted">No roadmap seeded for this user yet.</p>
                ) : (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {detail.skillReports.map((s) => (
                      <div key={s.skillId} className="flex items-center gap-2 text-xs">
                        <span className="w-40 truncate text-muted">{s.title}</span>
                        <div className="flex-1 h-1.5 bg-border/70 rounded-full overflow-hidden">
                          <div className="h-full bg-accent" style={{ width: `${s.percent}%` }} />
                        </div>
                        <span className="w-24 text-right tabular-nums">{s.done}/{s.total} · {s.percent}%</span>
                        <span className="badge !py-0.5 w-24 text-center">{s.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="text-xs font-medium mb-1">Uploaded documents ({detail.docs.length})</div>
                {detail.docs.length === 0 ? (
                  <p className="text-xs text-muted">No uploads.</p>
                ) : (
                  <ul className="space-y-1 max-h-48 overflow-y-auto">
                    {detail.docs.map((d) => (
                      <li key={d.id} className="text-xs flex items-center gap-2">
                        <span className="flex-1 truncate">{d.title}</span>
                        <span className="text-muted whitespace-nowrap">{d.mime_type || 'file'} · {fmtBytes(d.size_bytes)}</span>
                        <span className="text-muted whitespace-nowrap">{new Date(d.created_at).toLocaleDateString()}</span>
                        <button
                          className="btn !py-1 !px-2 text-[11px] whitespace-nowrap"
                          disabled={docUrlBusy === d.id}
                          onClick={() => openDoc(d.file_path, d.id)}
                        >
                          {docUrlBusy === d.id ? '…' : 'View'}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-[11px] text-muted mt-1">Opened via short-lived signed URLs; never public links.</p>
              </div>

              <div>
                <div className="text-xs font-medium mb-1">Recent activity ({detail.activity.length})</div>
                {detail.activity.length === 0 ? (
                  <p className="text-xs text-muted">No activity recorded.</p>
                ) : (
                  <ol className="space-y-1 max-h-48 overflow-y-auto">
                    {detail.activity.slice(0, 30).map((a) => (
                      <li key={a.id} className="text-xs flex items-center gap-2">
                        <span className="text-muted whitespace-nowrap">{fmtDateTime(a.createdAt)}</span>
                        <span className="badge !py-0.5">{a.eventType.replace(/_/g, ' ')}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
