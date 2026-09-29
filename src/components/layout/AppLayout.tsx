import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useRealtimeSync } from '@/hooks/useRealtime';
import { useRoadmapData } from '@/hooks/useRoadmapData';
import { leafTopics } from '@/lib/utils/progress';
import { useState } from 'react';
import { Menu } from 'lucide-react';

export default function AppLayout() {
  useRealtimeSync();
  const { topics, progress } = useRoadmapData();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const leaves = leafTopics((topics.data as any[]) ?? []);
  const pmap = new Map(((progress.data as any[]) ?? []).map((p: any) => [p.topic_id, p]));
  const done = leaves.filter((t) => pmap.get(t.id)?.status === 'completed').length;
  const pct = leaves.length ? Math.round((done / leaves.length) * 100) : 0;
  // Wide pages (notes workspace, table-heavy admin panels) break out of the narrow reading container.
  const { pathname } = useLocation();
  const wide = pathname.startsWith('/notes') || pathname.startsWith('/admin');
  return (
    <div className="min-h-screen flex">
      <Sidebar mobileOpen={open} onClose={() => setOpen(false)} collapsed={collapsed} onToggleCollapse={() => setCollapsed((v) => !v)} />
      <div className="flex-1 min-w-0">
        <Header percent={pct} onMenu={() => setOpen(true)} />
        <main className={`${wide ? 'max-w-[1500px]' : 'max-w-4xl'} mx-auto px-4 sm:px-6 pb-20 pt-6`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
export function MenuButton({ onClick }: { onClick: () => void }) {
  return <button aria-label="Open menu" onClick={onClick} className="btn !px-2.5 md:hidden"><Menu size={18} /></button>;
}
