import { NavLink } from 'react-router-dom';
import { Map, Files, FolderKanban, Settings, X, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

const items = [
  { to: '/', label: 'Roadmap', icon: Map, end: true },
  { to: '/documents', label: 'Documents', icon: Files },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ mobileOpen, onClose, collapsed, onToggleCollapse }: { mobileOpen: boolean; onClose: () => void; collapsed: boolean; onToggleCollapse: () => void }) {
  return (
    <>
      <aside className={`hidden md:flex shrink-0 flex-col border-r border-border px-3 py-6 gap-1 sticky top-0 h-screen transition-all ${collapsed ? 'w-16' : 'w-56'}`}>
        <div className="px-2 pb-5 flex items-center justify-between gap-2">
          {!collapsed && <span className="text-sm font-semibold tracking-wide">AIOps Hub</span>}
          <button aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={onToggleCollapse} className="btn !px-2 !py-1.5" title={collapsed ? 'Expand' : 'Collapse'}>
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end as any} title={collapsed ? label : undefined}
            className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${isActive ? 'bg-surface2 text-text' : 'text-muted hover:text-text hover:bg-surface'} ${collapsed ? 'justify-center' : ''}`}>
            <Icon size={17} strokeWidth={1.8} />{!collapsed && label}
          </NavLink>
        ))}
        {!collapsed && <div className="mt-auto px-2 text-[11px] text-muted">Single-user · Supabase RLS</div>}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={onClose} />
          <div className="absolute left-0 top-0 h-full w-64 bg-ink border-r border-border p-4">
            <button aria-label="Close menu" onClick={onClose} className="btn !px-2.5 mb-4"><X size={18} /></button>
            <div className="flex flex-col gap-1">
              {items.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end as any} onClick={onClose}
                  className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${isActive ? 'bg-surface2 text-text' : 'text-muted'}`}>
                  <Icon size={17} />{label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
