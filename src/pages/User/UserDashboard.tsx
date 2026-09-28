import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRoadmapData } from '@/hooks/useRoadmapData';
import { leafTopics } from '@/lib/utils/progress';
import { seedRoadmap, fetchProgress, fetchAllTopics, TRACKS, type SeedTrack } from '@/services/roadmap';
import { useTrack, trackOf, seededTracks, missingTracks, TRACK_LABEL } from '@/hooks/useTrack';
import { fetchDocuments } from '@/services/documents';

/**
 * User panel: per-logged-in-user dashboard + seed roadmap entry point.
 * All queries are owner-scoped by RLS (authenticated Supabase user id).
 * Note: session history is still recorded (tracking services untouched);
 * only the two removed widgets' presentation was taken out here.
 */
export default function UserDashboard() {
  const { user, role } = useAuth();
  const { skills, topics, progress } = useRoadmapData();
  const { track, select } = useTrack();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [seeding, setSeeding] = useState<SeedTrack | null>(null);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  const docsQ = useQuery({ queryKey: ['documents'], queryFn: fetchDocuments });
  const topicsQ = useQuery({ queryKey: ['topics'], queryFn: fetchAllTopics });
  const progQ = useQuery({ queryKey: ['topic_progress'], queryFn: fetchProgress });

  const allSkills = useMemo(() => ((skills.data as any[]) ?? []) as any[], [skills.data]);
  const seeded = useMemo(() => seededTracks(allSkills), [allSkills]);
  const missing = useMemo(() => missingTracks(allSkills), [allSkills]);
  const filteredSkills = useMemo(
    () => (track === 'all' ? allSkills : allSkills.filter((s) => trackOf(s) === track)),
    [allSkills, track],
  );

  const stats = useMemo(() => {
    const raw = ((topicsQ.data as any[]) ?? (topics.data as any[]) ?? []) as any[];
    const skillIds = new Set(filteredSkills.map((s) => s.id));
    const all = raw.filter((t) => skillIds.has(t.skill_id));
    const pmap = new Map((((progQ.data as any[]) ?? (progress.data as any[]) ?? []) as any[]).map((p: any) => [p.topic_id, p]));
    const leaves = leafTopics(all);
    const done = leaves.filter((t) => pmap.get(t.id)?.status === 'completed').length;
    const pct = leaves.length ? Math.round((done / leaves.length) * 100) : 0;
    const docs = ((docsQ.data as any[]) ?? []) as any[];
    return {
      pct, done, total: leaves.length,
      docs: docs.length,
      skills: filteredSkills.length,
    };
  }, [topicsQ.data, progQ.data, topics.data, progress.data, docsQ.data, filteredSkills]);

  const doSeed = async (t: SeedTrack) => {
    setSeeding(t); setSeedMsg(null);
    try {
      await seedRoadmap(t);
      await qc.invalidateQueries();
      setSeedMsg(`${TRACKS[t].label} track seeded for ` + (user?.email ?? 'your account') + '.');
    } catch (e: any) { setSeedMsg(e.message ?? 'Seeding failed'); }
    finally { setSeeding(null); }
  };

  return (
    <div>
      <h1 className="text-lg font-semibold">My dashboard</h1>
      <p className="text-sm text-muted">
        Signed in as <span className="text-text">{user?.email}</span>
        <span className="badge ml-2">{role}</span>
      </p>

      {allSkills.length === 0 && (
        <div className="card p-5 mt-4 text-center">
          <h2 className="font-medium">No roadmap yet for this account</h2>
          <p className="text-sm text-muted mt-1 mb-4">
            Choose a track to seed into <span className="text-text">{user?.email}</span>.
            Seeding is idempotent and never overwrites progress.
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {(['aiops', 'onprem'] as SeedTrack[]).map((t) => (
              <button key={t} className="btn btn-primary" disabled={seeding === t} onClick={() => doSeed(t)}>
                {seeding === t ? 'Seeding…' : `Seed ${TRACKS[t].label}`}
              </button>
            ))}
          </div>
          {seedMsg && <p className="text-xs text-accent mt-2">{seedMsg}</p>}
        </div>
      )}

      {seeded.length > 1 && (
        <div className="flex gap-1.5 mt-4">
          {(['all', ...seeded] as const).map((t) => (
            <button key={t} onClick={() => select(t)}
              className={`badge !py-1 cursor-pointer transition ${track === t ? '!text-text !border-accent bg-accentDim/30' : 'hover:text-text'}`}>
              {t === 'all' ? 'All tracks' : TRACK_LABEL[t]}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
        {[
          ['Roadmap', `${stats.pct}%`],
          ['Topics', `${stats.done}/${stats.total}`],
          ['Skills', String(stats.skills)],
          ['Documents', String(stats.docs)],
        ].map(([k, v]) => (
          <div key={k} className="card p-3.5">
            <div className="text-[11px] text-muted">{k}</div>
            <div className="text-lg font-semibold">{v}</div>
          </div>
        ))}
      </div>

      <div className="card p-4 mt-3 flex flex-wrap gap-2">
        <button className="btn btn-primary" onClick={() => nav('/')}>Open seed roadmap</button>
        <button className="btn" onClick={() => nav('/documents')}>My documents</button>
        <button className="btn" onClick={() => nav('/projects')}>My projects</button>
        <button className="btn" onClick={() => nav('/settings')}>Settings</button>
      </div>
      {missing.length > 0 && allSkills.length > 0 && (
        <div className="card p-4 mt-3">
          <div className="text-sm font-medium mb-2">Add another track</div>
          <div className="flex flex-wrap gap-2">
            {missing.map((t) => (
              <button key={t} className="btn" disabled={seeding === t} onClick={() => doSeed(t)}>
                {seeding === t ? 'Seeding…' : `Seed ${TRACKS[t].label}`}
              </button>
            ))}
          </div>
        </div>
      )}
      {seedMsg && allSkills.length > 0 && <p className="text-xs text-accent mt-2">{seedMsg}</p>}
    </div>
  );
}
