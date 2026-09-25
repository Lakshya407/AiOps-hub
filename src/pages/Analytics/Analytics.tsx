import { useQuery } from '@tanstack/react-query';
import { fetchSessions, fetchMilestones } from '@/services/tracking';
import { fetchAllTopics, fetchProgress, fetchSkills } from '@/services/roadmap';
import { fetchRevisions } from '@/services/notes';
import { leafTopics, progressOf } from '@/lib/utils/progress';
import { computeStreak, weeklyActivity } from '@/lib/utils/streak';
import { WeeklyBars } from '@/components/charts/MiniCharts';
import { fmtMinutes } from '@/lib/utils/format';

export default function Analytics() {
  const topicsQ = useQuery({ queryKey: ['topics'], queryFn: fetchAllTopics });
  const progQ = useQuery({ queryKey: ['topic_progress'], queryFn: fetchProgress });
  const sessQ = useQuery({ queryKey: ['study_sessions'], queryFn: () => fetchSessions() });
  const msQ = useQuery({ queryKey: ['project_milestones'], queryFn: fetchMilestones });
  const revQ = useQuery({ queryKey: ['revision_items'], queryFn: fetchRevisions });
  const skillsQ = useQuery({ queryKey: ['skills'], queryFn: fetchSkills });

  const topics = (topicsQ.data as any[]) ?? [];
  const pmap = new Map(((progQ.data as any[]) ?? []).map((p: any) => [p.topic_id, p]));
  const leaves = leafTopics(topics);
  const done = leaves.filter((t) => pmap.get(t.id)?.status === 'completed');
  const overall = leaves.length ? Math.round((done.length / leaves.length) * 100) : 0;
  const sessions = (sessQ.data as any[]) ?? [];
  const mins = sessions.reduce((a, s) => a + (s.duration_minutes || 0), 0);
  const activeDates = [...new Set(sessions.map((s) => (s.started_at ?? '').slice(0, 10)).filter(Boolean))];
  const streak = computeStreak(activeDates);
  const miles = (msQ.data as any[]) ?? [];
  const msDone = miles.filter((m) => m.status === 'completed').length;
  const upcoming = ((revQ.data as any[]) ?? []).filter((r) => new Date(r.next_revision_at) <= new Date(Date.now() + 7 * 864e5));

  const perSkill = ((skillsQ.data as any[]) ?? []).map((s) => {
    const st = topics.filter((t) => t.skill_id === s.id);
    return { name: s.title.length > 14 ? s.title.slice(0, 14) + '…' : s.title, pct: progressOf(st, pmap).percent };
  }).slice(0, 10);

  return (
    <div>
      <h1 className="text-lg font-semibold">Analytics</h1>
      <p className="text-sm text-muted">Derived from persisted data only. No vanity metrics.</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
        {[
          ['Overall', `${overall}%`],
          ['Topics', `${done.length}/${leaves.length}`],
          ['Study time', fmtMinutes(mins)],
          ['Streak', `${streak}d`],
        ].map(([k, v]) => (
          <div key={k} className="card p-3.5"><div className="text-[11px] text-muted">{k}</div><div className="text-lg font-semibold">{v}</div></div>
        ))}
      </div>
      <div className="card p-4 mt-3">
        <div className="text-sm font-medium mb-2">Weekly activity (minutes)</div>
        <WeeklyBars data={weeklyActivity(sessions)} />
      </div>
      <div className="grid sm:grid-cols-2 gap-3 mt-3">
        <div className="card p-4">
          <div className="text-sm font-medium mb-1">Milestones</div>
          <div className="text-sm text-muted">{msDone}/{miles.length} completed</div>
        </div>
        <div className="card p-4">
          <div className="text-sm font-medium mb-1">Upcoming revisions (7d)</div>
          <div className="text-sm text-muted">{upcoming.length} due</div>
        </div>
      </div>
      {perSkill.length > 0 && (
        <div className="card p-4 mt-3">
          <div className="text-sm font-medium mb-2">Skill completion</div>
          <div className="space-y-1.5">
            {perSkill.map((s) => (
              <div key={s.name} className="flex items-center gap-2 text-xs">
                <span className="w-32 truncate text-muted">{s.name}</span>
                <div className="flex-1 h-1.5 bg-border/70 rounded-full overflow-hidden"><div className="h-full bg-accent" style={{ width: `${s.pct}%` }} /></div>
                <span className="w-9 text-right tabular-nums">{s.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
