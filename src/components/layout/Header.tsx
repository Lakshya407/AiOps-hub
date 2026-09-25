import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Menu, LogOut, LogIn, Settings as SettingsIcon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeSync } from '@/hooks/useRealtime';

export default function Header({ percent, onMenu }: { percent: number; onMenu: () => void }) {
  const { user, signOut, role, isAdmin } = useAuth();
  const { online } = useRealtimeSync();
  const [q, setQ] = useState('');
  const [authOpen, setAuthOpen] = useState(false);
  const authRef = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  const day = new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  useEffect(() => {
    const close = (e: MouseEvent) => { if (authRef.current && !authRef.current.contains(e.target as Node)) setAuthOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const handleSignOut = async () => { setAuthOpen(false); await signOut(); nav('/login', { replace: true }); };
  return (
    <header className="sticky top-0 z-30 backdrop-blur bg-ink/85 border-b border-border">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
        <button aria-label="Open menu" onClick={onMenu} className="btn !px-2.5 md:hidden"><Menu size={18} /></button>
        <div className="font-semibold text-[15px]">AIOps Learning Hub</div>
        <div className="hidden sm:flex items-center gap-2 bg-surface border border-border rounded-xl px-2.5 py-1.5 flex-1 max-w-xs ml-4">
          <Search size={15} className="text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && q.trim()) nav(`/documents?q=${encodeURIComponent(q.trim())}`); }}
            placeholder="Search topics, docs…" className="bg-transparent outline-none text-sm w-full placeholder:text-muted/70" />
        </div>
        <div className="ml-auto flex items-center gap-3 text-xs text-muted">
          <span className="hidden sm:inline">{day}</span>
          <span className="badge">{percent}%</span>
          <span className={`badge ${online ? '' : '!text-red-300 !border-red-900'}`}>{online ? 'Synced' : 'Offline'}</span>
          <div ref={authRef} className="relative">
            <button onClick={() => setAuthOpen((v) => !v)} title={user?.email ?? 'Account'}
              className="w-7 h-7 rounded-full bg-surface2 border border-border grid place-items-center text-xs text-text hover:border-accent">
              {(user?.email ?? 'U').slice(0, 1).toUpperCase()}
            </button>
            {authOpen && (
              <div className="absolute right-0 mt-2 w-64 card p-4 text-left z-50">
                {user ? (
                  <>
                    <div className="text-xs text-muted">Signed in as</div>
                    <div className="text-sm text-text break-all mt-0.5">{user.email}</div>
                    <div className="mt-1"><span className="badge">{role}</span></div>
                    <div className="flex gap-2 pt-3">
                      <button className="btn flex-1 justify-center whitespace-nowrap" onClick={() => { setAuthOpen(false); nav('/dashboard'); }}>
                        Dashboard
                      </button>
                      <button className="btn flex-1 justify-center whitespace-nowrap" onClick={() => { setAuthOpen(false); nav('/settings'); }}>
                        <SettingsIcon size={14} className="shrink-0" /> Settings
                      </button>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-2 pt-2">
                        <button className="btn flex-1 justify-center whitespace-nowrap" onClick={() => { setAuthOpen(false); nav('/admin'); }}>
                          Admin console
                        </button>
                        <button className="btn flex-1 justify-center whitespace-nowrap" onClick={() => { setAuthOpen(false); nav('/admin/users'); }}>
                          Monitoring
                        </button>
                      </div>
                    )}
                    <div className="flex gap-2 pt-2">
                      <button className="btn flex-1 justify-center whitespace-nowrap" onClick={handleSignOut}>
                        <LogOut size={14} className="shrink-0" /> Log out
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-sm text-text">Not signed in</div>
                    <button className="btn btn-primary w-full justify-center whitespace-nowrap mt-2" onClick={() => { setAuthOpen(false); nav('/login'); }}>
                      <LogIn size={14} className="shrink-0" /> Log in
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
