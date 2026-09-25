import { supabase } from '@/lib/supabase/client';
export async function fetchSessions(limit = 500) {
  const { data, error } = await supabase.from('study_sessions').select('*').order('started_at', { ascending: false }).limit(limit);
  if (error) throw error; return data;
}
export async function startSession(topicId?: string | null) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase.from('study_sessions').insert({ owner_id: user.id, topic_id: topicId ?? null, started_at: new Date().toISOString() }).select().single();
  if (error) throw error; return data;
}
export async function endSession(id: string, notes = '') {
  const { data: cur } = await supabase.from('study_sessions').select('*').eq('id', id).single();
  const mins = cur ? Math.max(1, Math.round((Date.now() - new Date(cur.started_at).getTime()) / 60000)) : 0;
  const { data, error } = await supabase.from('study_sessions').update({ ended_at: new Date().toISOString(), duration_minutes: mins, notes }).eq('id', id).select().single();
  if (error) throw error; return data;
}
export async function fetchDailyLog(date: string) {
  const { data, error } = await supabase.from('daily_logs').select('*').eq('log_date', date).maybeSingle();
  if (error) throw error; return data;
}
export async function saveDailyLog(date: string, input: { summary?: string; challenges?: string; next_steps?: string; completed?: boolean }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase.from('daily_logs').upsert({ owner_id: user.id, log_date: date, ...input }, { onConflict: 'owner_id,log_date' }).select().single();
  if (error) throw error; return data;
}
export async function fetchProjects() {
  const { data, error } = await supabase.from('projects').select('*').order('month_number');
  if (error) throw error; return data;
}
export async function fetchMilestones() {
  const { data, error } = await supabase.from('project_milestones').select('*').order('sort_order');
  if (error) throw error; return data;
}
export async function setMilestoneStatus(id: string, status: string) {
  const { data, error } = await supabase.from('project_milestones').update({ status }).eq('id', id).select().single();
  if (error) throw error; return data;
}
export async function updateProject(id: string, patch: Record<string, unknown>) {
  const { data, error } = await supabase.from('projects').update(patch).eq('id', id).select().single();
  if (error) throw error; return data;
}
export async function createProject(input: { title: string; description?: string; month_number?: number | null; repository_url?: string; demo_url?: string; skill_ids?: string[]; milestones?: string[] }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase.from('projects').insert({
    owner_id: user.id,
    title: input.title,
    description: input.description ?? '',
    status: 'not_started',
    repository_url: input.repository_url ?? '',
    demo_url: input.demo_url ?? '',
    month_number: input.month_number ?? null,
    skill_ids: input.skill_ids ?? [],
  }).select().single();
  if (error) throw error;
  const names = (input.milestones ?? []).map((t) => t.trim()).filter(Boolean);
  if (names.length) {
    const { error: msErr } = await supabase.from('project_milestones').insert(
      names.map((title, i) => ({ owner_id: user.id, project_id: data.id, title, sort_order: i + 1 }))
    );
    if (msErr) throw msErr;
  }
  return data;
}
export async function deleteProject(id: string) {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
}
