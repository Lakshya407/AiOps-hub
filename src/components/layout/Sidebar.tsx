import { NavLink } from 'react-router-dom';
import { Map, Files, FolderKanban, Settings, X, PanelLeftClose, PanelLeftOpen, LayoutDashboard, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const userItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true, perm: null as string | null },
  { to: '/', label: 'Roadmap', icon: Map, end: true, perm: 'roadmap' as string | null },
  { to: '/documents', label: 'Documents', icon: Files, end: false, perm: 'documents' as string | null },
  { to: '/projects', label: 'Projects', icon: FolderKanban, end: false, perm: 'projects' as string | null },
  { to: '/settings', label: 'Settings', icon: Settings, end: false, perm: null as string | null },
];

const adminItems = [
  { to: '/admin', label: 'Admin Console', icon: ShieldCheck, end: true },
  { to: '/admin/users', label: 'User Monitoring', icon: Users, end: false },
];

export default function Sidebar({ mobileOpen, onClose, collapsed, onToggleCollapse }: { mobileOpen: boolean; onClose: () => void; collapsed: boolean; onToggleCollapse: () => void }) {
  const { isAdmin, permissions, role } = useAuth();
  const visibleUser = userItems.filter((i) => !i.perm || (permissions as any)[i.perm] !== false);
  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${isActive ? 'bg-surface2 text-text' : 'text-muted hover:text-text hover:bg-surface'} ${collapsed ? 'justify-center' : ''}`;
  return (
    <>
      <aside className={`hidden md:flex shrink-0 flex-col border-r border-border px-3 py-6 gap-1 sticky top-0 h-screen transition-all ${collapsed ? 'w-16' : 'w-56'}`}>
        <div className="px-2 pb-5 flex items-center justify-between gap-2">
          {!collapsed && (
            <span className="text-sm font-semibold tracking-wide flex items-center gap-2">
              AIOps Hub
              <span className="badge !py-0.5 !text-[10px]">{role}</span>
            </span>
          )}
          <button aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={onToggleCollapse} className="btn !px-2 !py-1.5" title={collapsed ? 'Expand' : 'Collapse'}>
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>
        {!collapsed && <div className="px-2 pb-1 text-[10px] uppercase tracking-widest text-muted">User panel</div>}
        {visibleUser.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end as any} title={collapsed ? label : undefined}
            className={linkCls}>
            <Icon size={17} strokeWidth={1.8} />{!collapsed && label}
          </NavLink>
        ))}
        {isAdmin && (
          <>
            {!collapsed && <div className="px-2 pt-3 pb-1 text-[10px] uppercase tracking-widest text-muted">Admin panel</div>}
            {adminItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end as any} title={collapsed ? label : undefined}
                className={linkCls}>
                <Icon size={17} strokeWidth={1.8} />{!collapsed && label}
              </NavLink>
            ))}
          </>
        )}
        {!collapsed && <div className="mt-auto px-2 text-[11px] text-muted">Role-based · Supabase RLS</div>}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={onClose} />
          <div className="absolute left-0 top-0 h-full w-64 bg-ink border-r border-border p-4 overflow-y-auto">
            <button aria-label="Close menu" onClick={onClose} className="btn !px-2.5 mb-4"><X size={18} /></button>
            <div className="text-[10px] uppercase tracking-widest text-muted px-3 pb-1">User panel</div>
            <div className="flex flex-col gap-1">
              {visibleUser.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end as any} onClick={onClose}
                  className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${isActive ? 'bg-surface2 text-text' : 'text-muted'}`}>
                  <Icon size={17} />{label}
                </NavLink>
              ))}
            </div>
            {isAdmin && (
              <>
                <div className="text-[10px] uppercase tracking-widest text-muted px-3 pt-3 pb-1">Admin panel</div>
                <div className="flex flex-col gap-1">
                  {adminItems.map(({ to, label, icon: Icon, end }) => (
                    <NavLink key={to} to={to} end={end as any} onClick={onClose}
                      className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${isActive ? 'bg-surface2 text-text' : 'text-muted'}`}>
                      <Icon size={17} />{label}
                    </NavLink>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
