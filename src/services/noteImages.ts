import { supabase } from '@/lib/supabase/client';

/**
 * Image attachments for Markdown notes (screenshot paste, drag-drop, file picker).
 * Files live in the public `note_images` bucket (see 0012 migration) under
 * "<owner_uid>/<note_id>/<uuid>.<ext>" so embedded `![alt](url)` links are stable
 * in the preview, after refresh, and in Obsidian exports.
 */

export const BUCKET = 'note_images';
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB per image
export const MAX_PER_PASTE = 5;
export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

/** Pure: reject non-images, SVGs (script-capable), oversized or empty files. */
export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith('image/') || !ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return `“${file.name || 'pasted image'}” is not a supported image. Use PNG, JPG, GIF or WebP.`;
  }
  if (file.size === 0) return 'Image is empty.';
  if (file.size > IMAGE_MAX_BYTES) {
    return `Image is ${(file.size / 1024 / 1024).toFixed(1)} MB — limit is ${IMAGE_MAX_BYTES / 1024 / 1024} MB per image.`;
  }
  return null;
}

/** Pure: "Screenshot 2026-09-29.png" -> "Screenshot 2026-09-29". */
export function imageAltFromFile(file: File): string {
  const base = (file.name || '').replace(/\.[a-z0-9]+$/i, '').trim();
  const clean = base.replace(/[[\]#]/g, '').replace(/\s+/g, ' ').slice(0, 100);
  return clean || 'pasted image';
}

/** Pure: standard Markdown image reference. */
export function buildImageMarkdown(alt: string, url: string): string {
  const safeAlt = (alt || 'image').replace(/[\[\]]/g, '').slice(0, 100) || 'image';
  return `![${safeAlt}](${url})`;
}

export async function uploadNoteImage(file: File, noteId: string): Promise<string> {
  const err = validateImageFile(file);
  if (err) throw new Error(err);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const ext = EXT_BY_MIME[file.type] ?? (file.name.split('.').pop() || 'png').toLowerCase().slice(0, 5);
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `${user.id}/${noteId}/${id}.${ext}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) throw upErr;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error('Upload succeeded but no public URL was returned.');
  return data.publicUrl;
}
