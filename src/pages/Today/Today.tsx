import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSessions, startSession, endSession, fetchDailyLog, saveDailyLog } from '@/services/tracking';
import { fetchAllTopics, fetchProgress } from '@/services/roadmap';
import { dayIndexSince, planForDay } from '@/lib/utils/scheduling';
import { todayISO, fmtMinutes } from '@/lib/utils/format';
import { useForm } from 'react-hook-form';

export default function Today() {
  const qc = useQueryClient();
  const today = todayISO();
  const startDate = localStorage.getItem('planStart') || (import.meta.env.VITE_PLAN_START_DATE as string) || today;
  const dayIdx = dayIndexSince(startDate);
  const plan = useMemo(() => planForDay(startDate, dayIdx), [startDate, dayIdx]);

  const topicsQ = useQuery({ queryKey: ['topics'], queryFn: fetchAllTopics });
  const progQ = useQuery({ queryKey: ['topic_progress'], queryFn: fetchProgress });
  const sessQ = useQuery({ queryKey: ['study_sessions'], queryFn: () => fetchSessions() });
  const logQ = useQuery({ queryKey: ['daily_logs', today], queryFn: () => fetchDailyLog(today) });

  const [activeId, setActiveId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const { register, handleSubmit, reset } = useForm({ defaultValues: { summary: '', challenges: '', next_steps: '' } });

  const byTitle = new Map(((topicsQ.data as any[]) ?? []).map((t: any) => [t.title.toLowerCase(), t]));
  const pmap = new Map(((progQ.data as any[]) ?? []).map((p: any) => [p.topic_id, p]));
  const todaysSessions = ((sessQ.data as any[]) ?? []).filter((s) => (s.started_at ?? '').slice(0, 10) === today);
  const totalMins = todaysSessions.reduce((a, s) => a + (s.duration_minutes || 0), 0);

  const tick = async () => {
    const s = await startSession(null);
    setActiveId(s.id);
    const t0 = Date.now();
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    (window as any).__timer = iv;
  };
  const stop = async () => {
    if (activeId) { clearInterval((window as any).__timer); await endSession(activeId); setActiveId(null); setElapsed(0); qc.invalidateQueries({ queryKey: ['study_sessions'] }); }
  };

  return (
    <div>
      <h1 className="text-lg font-semibold">Today</h1>
      <p className="text-sm text-muted">Day {dayIdx + 1} · {today} · {fmtMinutes(totalMins)} studied</p>

      <div className="card p-4 mt-4">
        <div className="text-sm font-medium mb-2">Study timer</div>
        <div className="flex items-center gap-3">
          {activeId
            ? <><span className="tabular-nums text-sm">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</span><button className="btn" onClick={stop}>Stop & save</button></>
            : <button className="btn btn-primary" onClick={tick}>Start session</button>}
        </div>
      </div>

      <div className="card p-4 mt-4">
        <div className="text-sm font-medium mb-2">Assigned topics (auto plan, editable pace)</div>
        {plan.length === 0
          ? <p className="text-sm text-muted">Plan complete — all curriculum topics scheduled. Review or advance to projects.</p>
          : <ul className="space-y-1.5">
            {plan.map((p, i) => {
              const t = byTitle.get(p.topicTitle.toLowerCase());
              const st = t ? pmap.get(t.id)?.status : undefined;
              return <li key={i} className="text-sm flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${st === 'completed' ? 'bg-accent' : 'bg-border'}`} />{p.topicTitle} <span className="text-muted text-xs">· {p.skillKey}</span></li>;
            })}
          </ul>}
        <div className="mt-3 text-xs text-muted">Start date: <input type="date" className="input !w-auto inline-block" defaultValue={startDate} onChange={(e) => { localStorage.setItem('planStart', e.target.value); location.reload(); }} /> — missed tasks carry forward (revisit Roadmap to complete).</div>
      </div>

      <form className="card p-4 mt-4 space-y-3" onSubmit={handleSubmit(async (v) => {
        await saveDailyLog(today, { ...v, completed: true });
        reset(v); qc.invalidateQueries({ queryKey: ['daily_logs'] });
      })}>
        <div className="text-sm font-medium">Daily log {logQ.data?.completed ? <span className="badge ml-2">Completed</span> : null}</div>
        <div><label className="label">Summary</label><textarea className="input" {...register('summary')} defaultValue={logQ.data?.summary ?? ''} /></div>
        <div><label className="label">Challenges</label><textarea className="input" {...register('challenges')} defaultValue={logQ.data?.challenges ?? ''} /></div>
        <div><label className="label">Next steps</label><textarea className="input" {...register('next_steps')} defaultValue={logQ.data?.next_steps ?? ''} /></div>
        <button className="btn btn-primary">Complete day</button>
        <p className="text-[11px] text-muted">A day is completed only when you press “Complete day” — never by the calendar alone.</p>
      </form>
    </div>
  );
}
