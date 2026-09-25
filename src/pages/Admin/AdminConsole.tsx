import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

/** Admin panel 1/2: Admin Console — totals, active users, recent activity. */
export default function AdminConsole() {
  const { users, totalUsers, activeUsers, activeCount, recentActivity, refreshAdmin, user } = useAuth();
  const nav = useNavigate();

  const adminCount = users.filter((u) => u.role === 'admin').length;
  const userCount = users.filter((u) => u.role === 'user').length;

  return (
    <div>
      <h1 className="text-lg font-semibold">Admin console</h1>
      <p className="text-sm text-muted">
        Signed in as <span className="text-text">{user?.email}</span> · admin view of the AIOps Hub.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
        {[
          ['Total users', String(totalUsers)],
          ['Active now (5 min)', String(activeCount)],
          ['Admins', String(adminCount)],
          ['Users', String(userCount)],
        ].map(([k, v]) => (
          <div key={k} className="card p-3.5">
            <div className="text-[11px] text-muted">{k}</div>
            <div className="text-lg font-semibold">{v}</div>
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mt-3">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-sm font-medium flex-1">Active users</div>
            <button className="btn !py-1 text-xs" onClick={() => refreshAdmin()}>Refresh</button>
          </div>
          {activeUsers.length === 0 ? (
            <p className="text-sm text-muted">Nobody active in the last 5 minutes besides you. Presence updates every 30s per logged-in tab.</p>
          ) : (
            <ul className="space-y-1.5">
              {activeUsers.slice(0, 20).map((a) => (
                <li key={a.userId} className="text-sm flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent" />
                  <span className="flex-1 truncate">{a.email}</span>
                  <span className="text-[11px] text-muted">{new Date(a.lastSeen).toLocaleTimeString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card p-4">
          <div className="text-sm font-medium mb-1">Logged-in directory</div>
          <p className="text-xs text-muted mb-2">
            {totalUsers} known account{totalUsers === 1 ? '' : 's'} (Supabase profiles + local presence).
          </p>
          <ul className="space-y-1.5 max-h-48 overflow-y-auto">
            {users.slice(0, 30).map((u) => (
              <li key={u.id} className="text-sm flex items-center gap-2">
                <span className={`badge ${u.role === 'admin' ? '!border-accent' : ''}`}>{u.role}</span>
                <span className="flex-1 truncate">{u.email}</span>
                <span className={`w-2 h-2 rounded-full ${u.isActive ? 'bg-accent' : 'bg-border'}`} title={u.isActive ? 'Active' : 'Idle'} />
              </li>
            ))}
          </ul>
          <button className="btn mt-3" onClick={() => nav('/admin/users')}>Open user monitoring</button>
        </div>
      </div>

      <div className="card p-4 mt-3">
        <div className="text-sm font-medium mb-2">Recent activity</div>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-muted">No activity yet. Topic completions, sign-ins and admin changes appear here.</p>
        ) : (
          <ol className="space-y-1.5 max-h-80 overflow-y-auto">
            {recentActivity.slice(0, 50).map((a) => (
              <li key={a.id} className="text-xs flex items-center gap-2">
                <span className="text-muted whitespace-nowrap">{new Date(a.createdAt).toLocaleString()}</span>
                <span className="badge !py-0.5">{a.eventType}</span>
                <span className="flex-1 truncate text-muted">{a.email ?? a.ownerId.slice(0, 8)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
