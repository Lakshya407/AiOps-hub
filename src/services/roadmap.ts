import { supabase } from '@/lib/supabase/client';
export async function fetchPhases() {
  const { data, error } = await supabase.from('roadmap_phases').select('*').order('sort_order');
  if (error) throw error; return data;
}
export async function fetchSkills() {
  const { data, error } = await supabase.from('skills').select('*').order('sort_order');
  if (error) throw error; return data;
}
export async function fetchTopicsBySkill(skillId: string) {
  const { data, error } = await supabase.from('topics').select('*').eq('skill_id', skillId).order('sort_order');
  if (error) throw error; return data;
}
export async function fetchAllTopics() {
  const { data, error } = await supabase.from('topics').select('*').order('sort_order');
  if (error) throw error; return data;
}
export async function fetchProgress() {
  const { data, error } = await supabase.from('topic_progress').select('*');
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
export async function seedRoadmap() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { error } = await supabase.rpc('seed_roadmap', { p_owner: user.id });
  if (error) throw error;
}
