import { supabase } from '@/lib/supabase/client';
import type { Note } from '@/types';

async function ownerId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export interface NoteInput {
  title: string;
  content_markdown?: string;
  roadmap_id?: string | null;
  skill_id?: string | null;
  topic_id?: string | null;
  tags?: string[];
  is_pinned?: boolean;
}

function normalizeRow(row: any): Note {
  return {
    id: row.id,
    owner_id: row.owner_id,
    roadmap_id: row.roadmap_id ?? null,
    skill_id: row.skill_id ?? null,
    topic_id: row.topic_id ?? null,
    title: row.title ?? 'Untitled',
    content_markdown: row.content_markdown ?? row.content ?? '',
    tags: row.tags ?? [],
    is_pinned: Boolean(row.is_pinned),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** All reads explicitly owner-scoped (see services/roadmap.ts rationale). */
export async function fetchNotes(opts?: { topicId?: string | null; skillId?: string | null; search?: string }): Promise<Note[]> {
  const uid = await ownerId();
  if (!uid) return [];
  let q = supabase.from('notes').select('*').eq('owner_id', uid);
  if (opts?.topicId) q = q.eq('topic_id', opts.topicId);
  if (opts?.skillId) q = q.eq('skill_id', opts.skillId);
  if (opts?.search?.trim()) {
    const needle = opts.search.trim().replace(/[%_]/g, '');
    q = q.or(`title.ilike.%${needle}%,content_markdown.ilike.%${needle}%`);
  }
  q = q.order('is_pinned', { ascending: false }).order('updated_at', { ascending: false });
  const { data, error } = await q;
  if (error) throw error;
  return ((data as any[]) ?? []).map(normalizeRow);
}

export async function fetchNoteById(id: string): Promise<Note | null> {
  const uid = await ownerId();
  if (!uid) return null;
  const { data, error } = await supabase.from('notes').select('*').eq('id', id).eq('owner_id', uid).maybeSingle();
  if (error) throw error;
  return data ? normalizeRow(data) : null;
}

export async function fetchNotesForTopic(topicId: string): Promise<Note[]> {
  return fetchNotes({ topicId });
}

export async function createNote(input: NoteInput): Promise<Note> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const payload = {
    owner_id: user.id,
    title: input.title.trim().slice(0, 200) || 'Untitled',
    content_markdown: (input.content_markdown ?? '').slice(0, 100000),
    roadmap_id: input.roadmap_id ?? null,
    skill_id: input.skill_id ?? null,
    topic_id: input.topic_id ?? null,
    tags: input.tags ?? [],
    is_pinned: Boolean(input.is_pinned),
  };
  const { data, error } = await supabase.from('notes').insert(payload).select().single();
  if (error) throw error;
  return normalizeRow(data);
}

/** Back-compat alias for the legacy inline editor. */
export async function saveNote(input: { id?: string; topic_id?: string | null; skill_id?: string | null; title: string; content_markdown: string; tags: string[] }) {
  if (input.id) return updateNote(input.id, { title: input.title, content_markdown: input.content_markdown });
  return createNote({ title: input.title, content_markdown: input.content_markdown, topic_id: input.topic_id ?? null, skill_id: input.skill_id ?? null, tags: input.tags });
}

export async function updateNote(
  id: string,
  patch: Partial<Pick<Note, 'title' | 'content_markdown' | 'tags' | 'is_pinned' | 'roadmap_id' | 'skill_id' | 'topic_id'>>,
): Promise<Note> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) payload.title = patch.title.slice(0, 200) || 'Untitled';
  if (patch.content_markdown !== undefined) payload.content_markdown = patch.content_markdown.slice(0, 100000);
  if (patch.tags !== undefined) payload.tags = patch.tags;
  if (patch.is_pinned !== undefined) payload.is_pinned = patch.is_pinned;
  if (patch.roadmap_id !== undefined) payload.roadmap_id = patch.roadmap_id;
  if (patch.skill_id !== undefined) payload.skill_id = patch.skill_id;
  if (patch.topic_id !== undefined) payload.topic_id = patch.topic_id;
  const { data, error } = await supabase.from('notes').update(payload).eq('id', id).eq('owner_id', user.id).select().single();
  if (error) throw error;
  return normalizeRow(data);
}

export async function renameNote(id: string, title: string): Promise<Note> {
  return updateNote(id, { title });
}

export async function togglePin(id: string, pinned: boolean): Promise<Note> {
  return updateNote(id, { is_pinned: pinned });
}

export async function duplicateNote(note: Note): Promise<Note> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return createNote({
    title: `${note.title} (copy)`.slice(0, 200),
    content_markdown: note.content_markdown,
    roadmap_id: note.roadmap_id,
    skill_id: note.skill_id,
    topic_id: note.topic_id,
    tags: note.tags,
    is_pinned: false,
  });
}

export async function deleteNote(id: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { error } = await supabase.from('notes').delete().eq('id', id).eq('owner_id', user.id);
  if (error) throw error;
}

// Revision helpers (unchanged legacy API, kept here to avoid breaking imports)
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
  const count = ((cur as any)?.revision_count ?? 0) + 1;
  const { data, error } = await supabase.from('revision_items').upsert({ owner_id: user.id, topic_id: topicId, last_revised_at: new Date().toISOString(), next_revision_at: next.toISOString(), revision_count: count, status: 'scheduled' }, { onConflict: 'owner_id,topic_id' }).select().single();
  if (error) throw error; return data;
}
