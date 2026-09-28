import { supabase } from '@/lib/supabase/client';
export const ALLOWED = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/markdown', 'text/plain', 'image/png', 'image/jpeg'];
export const MAX_BYTES = 25 * 1024 * 1024;

export async function fetchDocuments() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  // Explicit owner scope: admins can SELECT all rows, but the user panel must
  // show only the logged-in user's own documents.
  const { data, error } = await supabase.from('documents').select('*').eq('owner_id', user.id).order('created_at', { ascending: false });
  if (error) throw error; return data;
}
export async function uploadDocument(file: File, meta: { title: string; description?: string; tags?: string[]; skill_id?: string | null; topic_id?: string | null; project_id?: string | null }) {
  if (!ALLOWED.includes(file.type) && !file.name.match(/\.(pdf|docx|md|txt|png|jpg|jpeg)$/i)) throw new Error('Unsupported file type');
  if (file.size > MAX_BYTES) throw new Error('File too large (max 25 MB)');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const { error: upErr } = await supabase.storage.from('documents').upload(path, file, { contentType: file.type });
  if (upErr) throw upErr;
  const { data, error } = await supabase.from('documents').insert({ owner_id: user.id, title: meta.title, description: meta.description ?? '', tags: meta.tags ?? [], skill_id: meta.skill_id ?? null, topic_id: meta.topic_id ?? null, project_id: meta.project_id ?? null, file_path: path, mime_type: file.type, size_bytes: file.size }).select().single();
  if (error) throw error; return data;
}
export async function signedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 300);
  if (error) throw error; return data.signedUrl;
}
export async function deleteDocument(id: string, path: string): Promise<{ storageWarning: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  // Delete the DB row first, explicitly scoped to the owner (RLS enforces too).
  // Row-first ordering guarantees no orphaned file deletes with a surviving row.
  const { error } = await supabase.from('documents').delete().eq('id', id).eq('owner_id', user.id);
  if (error) throw error;
  // Storage cleanup is best-effort: the row (source of truth) is already gone,
  // so a storage-only failure surfaces as a warning, never a failed delete.
  const { error: rmErr } = await supabase.storage.from('documents').remove([path]);
  if (rmErr) return { storageWarning: `Record deleted; storage cleanup failed: ${rmErr.message}` };
  return { storageWarning: null };
}
export async function replaceDocumentFile(id: string, oldPath: string, file: File) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const { error: upErr } = await supabase.storage.from('documents').upload(path, file);
  if (upErr) throw upErr;
  const { data, error } = await supabase.from('documents').update({ file_path: path, mime_type: file.type, size_bytes: file.size, updated_at: new Date().toISOString() }).eq('id', id).eq('owner_id', user.id).select().single();
  if (error) throw error;
  await supabase.storage.from('documents').remove([oldPath]);
  return data;
}
