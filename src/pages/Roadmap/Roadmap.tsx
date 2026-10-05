import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useRoadmapData } from '@/hooks/useRoadmapData';
import { leafTopics, progressOf } from '@/lib/utils/progress';
import RoadmapBlock from '@/components/roadmap/RoadmapBlock';
import RoadmapPath from '@/components/roadmap/RoadmapPath';
import { seedRoadmap, TRACKS, type SeedTrack } from '@/services/roadmap';
import { useTrack, trackOf, seededTracks, missingTracks, TRACK_LABEL } from '@/hooks/useTrack';
import { useQueryClient } from '@tanstack/react-query';
import type { SkillProgress } from '@/types';

function SeedCard({ track, busy, onSeed }: { track: SeedTrack; busy: boolean; onSeed: (t: SeedTrack) => void }) {
  return (
    <div className="card p-5 text-center">
      <h2 className="font-medium">{TRACKS[track].label}</h2>
      <p className="text-sm text-muted mt-1 mb-4">{TRACKS[track].tagline}. Seeding is idempotent and never overwrites progress.</p>
      <button className="btn btn-primary" disabled={busy} onClick={() => onSeed(track)}>
        {busy ? 'Seeding…' : `Seed ${TRACKS[track].label} track`}
      </button>
    </div>
  );
}

export default function Roadmap() {
  const { phases, skills, topics, progress } = useRoadmapData();
  const { track, select } = useTrack();
  const [seeding, setSeeding] = useState<SeedTrack | null>(null);
  const [seedErr, setSeedErr] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const qc = useQueryClient();
  const loading = phases.isLoading || skills.isLoading || topics.isLoading || progress.isLoading;
  const error = phases.error || skills.error || topics.error || progress.error;

  const allSkills = useMemo(() => (skills.data as any[]) ?? [], [skills.data]);
  const seeded = useMemo(() => seededTracks(allSkills), [allSkills]);
  const missing = useMemo(() => missingTracks(allSkills), [allSkills]);

  const visibleSkills = useMemo(
    () => (track === 'all' ? allSkills : allSkills.filter((s) => trackOf(s) === track)),
    [allSkills, track],
  );
  const visibleSkillIds = useMemo(() => new Set(visibleSkills.map((s: any) => s.id)), [visibleSkills]);
  const visibleTopics = useMemo(
    () => ((topics.data as any[]) ?? []).filter((t: any) => visibleSkillIds.has(t.skill_id)),
    [topics.data, visibleSkillIds],
  );

  const blocks: SkillProgress[] = useMemo(() => {
    const pmap = new Map(((progress.data as any[]) ?? []).map((p: any) => [p.topic_id, p]));
    return visibleSkills.slice().sort((a: any, b: any) => a.sort_order - b.sort_order).map((s: any) => {
      const st = visibleTopics.filter((t) => t.skill_id === s.id);
      const p = progressOf(st, pmap);
      return { skill: s, total: leafTopics(st).length || st.filter((t) => !t.parent_topic_id).length || p.total, completed: p.completed, percent: p.percent, status: p.status };
    });
  }, [visibleSkills, visibleTopics, progress.data]);

  const monthOf = (skill: any) => {
    const ph = ((phases.data as any[]) ?? []).find((p) => p.id === skill?.phase_id);
    return ph?.month_number as number | undefined;
  };

  const doSeed = async (t: SeedTrack) => {
    setSeeding(t); setSeedErr(null);
    try { await seedRoadmap(t); await qc.invalidateQueries(); }
    catch (e: any) { setSeedErr(e.message ?? 'Seeding failed'); }
    finally { setSeeding(null); }
  };

  if (loading) return <p className="text-sm text-muted">Loading roadmap…</p>;
  if (error) return (
    <div className="card p-5">
      <h2 className="font-medium">Couldn’t load roadmap</h2>
      <p className="text-sm text-muted mt-1">Check Supabase env vars and that migrations + seed ran. {(error as Error).message}</p>
    </div>
  );
  if (!allSkills.length) return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-semibold">Choose your roadmap</h1>
        <p className="text-sm text-muted">Seed one track to start — or both. Each track keeps its own progress.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {(['aiops', 'onprem'] as SeedTrack[]).map((t) => (
          <SeedCard key={t} track={t} busy={seeding === t} onSeed={doSeed} />
        ))}
      </div>
      {seedErr && <p className="text-xs text-red-300 mt-2">{seedErr}</p>}
    </div>
  );

  type Group = { key: string; month: number; track: SeedTrack; phaseTitle?: string; items: { sp: SkillProgress; index: number }[] };
  const phaseTitleOf = (skill: any) => {
    const ph = ((phases.data as any[]) ?? []).find((p) => p.id === skill?.phase_id);
    return ph?.title as string | undefined;
  };
  const groups: Group[] = [];
  blocks.forEach((sp, i) => {
    const m = monthOf(sp.skill) ?? 0;
    const tr = trackOf(sp.skill);
    const key = `${tr}-${m}`;
    let g = groups.find((x) => x.key === key);
    if (!g) { g = { key, month: m, track: tr, phaseTitle: phaseTitleOf(sp.skill), items: [] }; groups.push(g); }
    g.items.push({ sp, index: i });
  });
  groups.sort((a, b) => a.month - b.month);

  const groupLabel = (g: Group) => {
    if (g.track === 'aiops') {
      if (g.month === 1) return 'Phase 1 · Months 1-3';
      if (g.month === 2) return 'Phase 2 · Months 4-6';
    }
    return `Month ${g.month}`;
  };

  const toggleGroup = (key: string) => setCollapsed((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-semibold">Roadmap</h1>
        <p className="text-sm text-muted">One block per skill. Select a block to see its topics.</p>
      </div>
      {seeded.length > 1 && (
        <div className="flex gap-1.5 mb-2">
          {(['all', ...seeded] as const).map((t) => (
            <button key={t} onClick={() => select(t)}
              className={`badge !py-1 cursor-pointer transition ${track === t ? '!text-text !border-accent bg-accentDim/30' : 'hover:text-text'}`}>
              {t === 'all' ? 'All tracks' : TRACK_LABEL[t]}
            </button>
          ))}
        </div>
      )}
      {groups.map((g) => {
        const done = g.items.filter((x) => x.sp.percent === 100).length;
        const avg = Math.round(g.items.reduce((n, x) => n + x.sp.percent, 0) / Math.max(1, g.items.length));
        const isClosed = collapsed.has(g.key);
        return (
          <section key={g.key} className="mb-2">
            <button onClick={() => toggleGroup(g.key)} aria-expanded={!isClosed}
              className="w-full flex items-center gap-3 pt-5 pb-2 text-left group">
              <span className="text-[11px] uppercase tracking-widest text-muted">
                {track === 'all' && seeded.length > 1 ? `${TRACK_LABEL[g.track]} · ` : ''}{groupLabel(g)} · {g.items.length} skills · {done}/{g.items.length} done · {avg}%
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
      {missing.length > 0 && (
        <div className="mt-6">
          <div className="text-sm font-medium mb-2">Add another track</div>
          <div className="grid sm:grid-cols-2 gap-3">
            {missing.map((t) => (
              <SeedCard key={t} track={t} busy={seeding === t} onSeed={doSeed} />
            ))}
          </div>
        </div>
      )}
      {seedErr && <p className="text-xs text-red-300 mt-2">{seedErr}</p>}
    </div>
  );
}
