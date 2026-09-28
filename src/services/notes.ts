import { supabase } from '@/lib/supabase/client';

/** See services/roadmap.ts: user-panel reads are explicitly owner-scoped. */
async function ownerId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}
export async function fetchNotes(topicId?: string) {
  const uid = await ownerId();
  if (!uid) return [];
  let q = supabase.from('notes').select('*').eq('owner_id', uid).order('updated_at', { ascending: false });
  if (topicId) q = q.eq('topic_id', topicId);
  const { data, error } = await q;
  if (error) throw error; return data;
}
export async function saveNote(input: { id?: string; topic_id?: string | null; skill_id?: string | null; title: string; content_markdown: string; tags: string[] }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  if (input.id) {
    const { data, error } = await supabase.from('notes').update({ ...input, updated_at: new Date().toISOString() }).eq('id', input.id).eq('owner_id', user.id).select().single();
    if (error) throw error; return data;
  }
  const { data, error } = await supabase.from('notes').insert({ ...input, owner_id: user.id }).select().single();
  if (error) throw error; return data;
}
export async function deleteNote(id: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { error } = await supabase.from('notes').delete().eq('id', id).eq('owner_id', user.id);
  if (error) throw error;
}
export async function fetchRevisions() {
  const uid = await ownerId();
  if (!uid) return [];
  const { data, error } = await supabase.from('revision_items').select('*').eq('owner_id', uid).order('next_revision_at');
  if (error) throw error; return data;
}
export async function scheduleRevision(topicId: string, nextAt: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase.from('revision_items').upsert({ owner_id: user.id, topic_id: topicId, next_revision_at: nextAt, status: 'scheduled' }, { onConflict: 'owner_id,topic_id' }).select().single();
  if (error) throw error; return data;
}
export async function completeRevision(topicId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const next = new Date(); next.setDate(next.getDate() + 7);
  const { data: cur } = await supabase.from('revision_items').select('*').eq('topic_id', topicId).eq('owner_id', user.id).maybeSingle();
  const count = (cur?.revision_count ?? 0) + 1;
  const { data, error } = await supabase.from('revision_items').upsert({ owner_id: user.id, topic_id: topicId, last_revised_at: new Date().toISOString(), next_revision_at: next.toISOString(), revision_count: count, status: 'scheduled' }, { onConflict: 'owner_id,topic_id' }).select().single();
  if (error) throw error; return data;
}
