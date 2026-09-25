import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRoadmapData } from '@/hooks/useRoadmapData';
import { leafTopics } from '@/lib/utils/progress';
import { seedRoadmap, fetchProgress, fetchAllTopics } from '@/services/roadmap';
import { fetchSessions } from '@/services/tracking';
import { fetchDocuments } from '@/services/documents';
import { computeStreak } from '@/lib/utils/streak';
import { fmtMinutes } from '@/lib/utils/format';

/** User panel: per-logged-in-user dashboard + seed roadmap entry point. */
export default function UserDashboard() {
  const { user, role } = useAuth();
  const { skills, topics, progress } = useRoadmapData();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  const sessQ = useQuery({ queryKey: ['study_sessions'], queryFn: () => fetchSessions() });
  const docsQ = useQuery({ queryKey: ['documents'], queryFn: fetchDocuments });
  const topicsQ = useQuery({ queryKey: ['topics'], queryFn: fetchAllTopics });
  const progQ = useQuery({ queryKey: ['topic_progress'], queryFn: fetchProgress });

  const stats = useMemo(() => {
    const all = ((topicsQ.data as any[]) ?? (topics.data as any[]) ?? []) as any[];
    const pmap = new Map((((progQ.data as any[]) ?? (progress.data as any[]) ?? []) as any[]).map((p: any) => [p.topic_id, p]));
    const leaves = leafTopics(all);
    const done = leaves.filter((t) => pmap.get(t.id)?.status === 'completed').length;
    const pct = leaves.length ? Math.round((done / leaves.length) * 100) : 0;
    const sessions = ((sessQ.data as any[]) ?? []) as any[];
    const mins = sessions.reduce((a, s) => a + (s.duration_minutes || 0), 0);
    const dates = [...new Set(sessions.map((s) => (s.started_at ?? '').slice(0, 10)).filter(Boolean))];
    const docs = ((docsQ.data as any[]) ?? []) as any[];
    return {
      pct, done, total: leaves.length, mins,
      streak: computeStreak(dates), sessions: sessions.length, docs: docs.length,
      skills: ((skills.data as any[]) ?? []).length,
    };
  }, [topicsQ.data, progQ.data, topics.data, progress.data, sessQ.data, docsQ.data, skills.data]);

  const needsSeed = ((skills.data as any[]) ?? []).length === 0;

  const doSeed = async () => {
    setSeeding(true); setSeedMsg(null);
    try {
      await seedRoadmap();
      await qc.invalidateQueries();
      setSeedMsg('Roadmap seeded for ' + (user?.email ?? 'your account') + '.');
    } catch (e: any) { setSeedMsg(e.message ?? 'Seeding failed'); }
    finally { setSeeding(false); }
  };

  return (
    <div>
      <h1 className="text-lg font-semibold">My dashboard</h1>
      <p className="text-sm text-muted">
        Signed in as <span className="text-text">{user?.email}</span>
        <span className="badge ml-2">{role}</span>
      </p>

      {needsSeed && (
        <div className="card p-5 mt-4 text-center">
          <h2 className="font-medium">No roadmap yet for this account</h2>
          <p className="text-sm text-muted mt-1 mb-4">
            Seed the six-month curriculum into <span className="text-text">{user?.email}</span>.
            Seeding is idempotent and never overwrites progress.
          </p>
          <button className="btn btn-primary" disabled={seeding} onClick={doSeed}>
            {seeding ? 'Seeding…' : 'Seed my roadmap'}
          </button>
          {seedMsg && <p className="text-xs text-accent mt-2">{seedMsg}</p>}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
        {[
          ['Roadmap', `${stats.pct}%`],
          ['Topics', `${stats.done}/${stats.total}`],
          ['Study time', fmtMinutes(stats.mins)],
          ['Streak', `${stats.streak}d`],
        ].map(([k, v]) => (
          <div key={k} className="card p-3.5">
            <div className="text-[11px] text-muted">{k}</div>
            <div className="text-lg font-semibold">{v}</div>
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-3 gap-2 mt-3">
        {[
          ['Skills', String(stats.skills)],
          ['Sessions', String(stats.sessions)],
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
      {seedMsg && !needsSeed && <p className="text-xs text-accent mt-2">{seedMsg}</p>}
    </div>
  );
}
