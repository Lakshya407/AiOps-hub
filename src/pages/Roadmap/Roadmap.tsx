import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useRoadmapData } from '@/hooks/useRoadmapData';
import { leafTopics, progressOf } from '@/lib/utils/progress';
import RoadmapBlock from '@/components/roadmap/RoadmapBlock';
import RoadmapPath from '@/components/roadmap/RoadmapPath';
import { seedRoadmap } from '@/services/roadmap';
import { useQueryClient } from '@tanstack/react-query';
import type { SkillProgress } from '@/types';

export default function Roadmap() {
  const { phases, skills, topics, progress } = useRoadmapData();
  const [seeding, setSeeding] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const qc = useQueryClient();
  const loading = phases.isLoading || skills.isLoading || topics.isLoading || progress.isLoading;
  const error = phases.error || skills.error || topics.error || progress.error;

  const blocks: SkillProgress[] = useMemo(() => {
    const all = (topics.data as any[]) ?? [];
    const pmap = new Map(((progress.data as any[]) ?? []).map((p: any) => [p.topic_id, p]));
    return ((skills.data as any[]) ?? []).slice().sort((a, b) => a.sort_order - b.sort_order).map((s) => {
      const st = all.filter((t) => t.skill_id === s.id);
      const p = progressOf(st, pmap);
      return { skill: s, total: leafTopics(st).length || st.filter((t) => !t.parent_topic_id).length || p.total, completed: p.completed, percent: p.percent, status: p.status };
    });
  }, [skills.data, topics.data, progress.data]);

  const monthOf = (skillId: string) => {
    const s = ((skills.data as any[]) ?? []).find((x) => x.id === skillId);
    const ph = ((phases.data as any[]) ?? []).find((p) => p.id === s?.phase_id);
    return ph?.month_number as number | undefined;
  };

  if (loading) return <p className="text-sm text-muted">Loading roadmap…</p>;
  if (error) return (
    <div className="card p-5">
      <h2 className="font-medium">Couldn’t load roadmap</h2>
      <p className="text-sm text-muted mt-1">Check Supabase env vars and that migrations + seed ran. {(error as Error).message}</p>
    </div>
  );
  if (!blocks.length) return (
    <div className="card p-6 text-center">
      <h2 className="font-medium">No roadmap yet</h2>
      <p className="text-sm text-muted mt-1 mb-4">Seed the six-month curriculum into your account. Seeding is idempotent and never overwrites progress.</p>
      <button className="btn btn-primary" disabled={seeding} onClick={async () => {
        setSeeding(true);
        try { await seedRoadmap(); await qc.invalidateQueries(); } catch (e: any) { alert(e.message); } finally { setSeeding(false); }
      }}>{seeding ? 'Seeding…' : 'Seed my roadmap'}</button>
    </div>
  );

  let lastMonth = 0;
  const groups: { month: number; items: { sp: SkillProgress; index: number }[] }[] = [];
  blocks.forEach((sp, i) => {
    const m = monthOf(sp.skill.id) ?? 0;
    if (m !== lastMonth) { lastMonth = m; groups.push({ month: m, items: [] }); }
    groups[groups.length - 1].items.push({ sp, index: i });
  });

  const toggleMonth = (m: number) => setCollapsed((prev) => {
    const next = new Set(prev);
    if (next.has(m)) next.delete(m); else next.add(m);
    return next;
  });

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-semibold">Six-month roadmap</h1>
        <p className="text-sm text-muted">One block per skill. Select a block to see its topics.</p>
      </div>
      {groups.map((g) => {
        const done = g.items.filter((x) => x.sp.percent === 100).length;
        const avg = Math.round(g.items.reduce((n, x) => n + x.sp.percent, 0) / Math.max(1, g.items.length));
        const isClosed = collapsed.has(g.month);
        return (
          <section key={`m-${g.month}`} className="mb-2">
            <button onClick={() => toggleMonth(g.month)} aria-expanded={!isClosed}
              className="w-full flex items-center gap-3 pt-5 pb-2 text-left group">
              <span className="text-[11px] uppercase tracking-widest text-muted">
                Month {g.month} · {g.items.length} skills · {done}/{g.items.length} done · {avg}%
              </span>
              <span className="flex-1 h-px bg-border" />
              <ChevronDown size={15} className={`text-muted transition-transform ${isClosed ? '-rotate-90' : ''}`} />
            </button>
            {!isClosed && (
              <RoadmapPath>{g.items.map(({ sp, index }) => <RoadmapBlock key={sp.skill.id} sp={sp} index={index} />) as any}</RoadmapPath>
            )}
          </section>
        );
      })}
    </div>
  );
}
