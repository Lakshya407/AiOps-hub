import { supabase } from '@/lib/supabase/client';

/** Curriculum tracks. Rows carry track='aiops'|'onprem' (default 'aiops' pre-0010). */
export type SeedTrack = 'aiops' | 'onprem';

export const TRACKS: Record<SeedTrack, { label: string; tagline: string }> = {
  aiops: { label: 'AIOps', tagline: 'Six-month AIOps engineer roadmap · 6 phases · 18 skills' },
  onprem: { label: 'On-Prem LLM', tagline: 'Two-month on-prem LLM infra track · laptop practice → XE7740 + H200 production' },
};

/**
 * User-panel reads are ALWAYS scoped to the logged-in owner explicitly.
 * RLS alone is not enough: admins can SELECT all rows (monitoring policies),
 * so unscoped queries merge every user's roadmap into the admin's own pages.
 * Normal users see identical results as before (their RLS subset == this filter).
 */
async function ownerId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function fetchPhases() {
  const uid = await ownerId();
  if (!uid) return [];
  const { data, error } = await supabase.from('roadmap_phases').select('*').eq('owner_id', uid).order('sort_order');
  if (error) throw error; return data;
}
export async function fetchSkills() {
  const uid = await ownerId();
  if (!uid) return [];
  const { data, error } = await supabase.from('skills').select('*').eq('owner_id', uid).order('sort_order');
  if (error) throw error; return data;
}
export async function fetchTopicsBySkill(skillId: string) {
  const uid = await ownerId();
  if (!uid) return [];
  const { data, error } = await supabase.from('topics').select('*').eq('skill_id', skillId).eq('owner_id', uid).order('sort_order');
  if (error) throw error; return data;
}
export async function fetchAllTopics() {
  const uid = await ownerId();
  if (!uid) return [];
  const { data, error } = await supabase.from('topics').select('*').eq('owner_id', uid).order('sort_order');
  if (error) throw error; return data;
}
export async function fetchProgress() {
  const uid = await ownerId();
  if (!uid) return [];
  const { data, error } = await supabase.from('topic_progress').select('*').eq('owner_id', uid);
  if (error) throw error; return data;
}
export async function setTopicStatus(topicId: string, status: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const payload: any = { owner_id: user.id, topic_id: topicId, status, updated_at: new Date().toISOString() };
  if (status === 'completed') payload.completed_at = new Date().toISOString();
  const { data, error } = await supabase.from('topic_progress').upsert(payload, { onConflict: 'owner_id,topic_id' }).select().single();
  if (error) throw error;
  await supabase.from('activity_events').insert({ owner_id: user.id, event_type: `topic_${status}`, entity_type: 'topic', entity_id: topicId, metadata: { status } });
  return data;
}
export async function seedRoadmap(track: SeedTrack = 'aiops') {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const fn = track === 'onprem' ? 'seed_onprem_roadmap' : 'seed_roadmap';
  const { error } = await supabase.rpc(fn, { p_owner: user.id });
  if (error) throw error;
}
