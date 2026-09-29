/** Obsidian integration helpers — pure functions, no Supabase dependency. */

export interface ObsidianSettings {
  enabled: boolean;
  vault: string;
  baseFolder: string;
}

const LS_KEY = 'learnhub.obsidian';

export const OBSIDIAN_DEFAULTS: ObsidianSettings = {
  enabled: false,
  vault: '',
  baseFolder: 'LearnHub',
};

export function loadObsidianSettings(): ObsidianSettings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...OBSIDIAN_DEFAULTS };
    const p = JSON.parse(raw) as Partial<ObsidianSettings>;
    return {
      enabled: Boolean(p.enabled),
      vault: typeof p.vault === 'string' ? p.vault.trim() : '',
      baseFolder: typeof p.baseFolder === 'string' && p.baseFolder.trim() ? p.baseFolder.trim() : 'LearnHub',
    };
  } catch {
    return { ...OBSIDIAN_DEFAULTS };
  }
}

export function saveObsidianSettings(s: ObsidianSettings): void {
  localStorage.setItem(LS_KEY, JSON.stringify({
    enabled: s.enabled,
    vault: s.vault.trim(),
    baseFolder: s.baseFolder.trim() || 'LearnHub',
  }));
}

/** Strip characters illegal on Windows/macOS/Linux + collapse whitespace. */
export function sanitizeFileName(name: string): string {
  const base = (name || 'Untitled').trim().slice(0, 120);
  return (
    base
      .replace(/[\\/:*?"<>|#^[\]]/g, '-')
      .replace(/\s+/g, ' ')
      .replace(/\.+$/g, '')
      .trim() || 'Untitled'
  );
}

/** Sanitize each segment of a vault-relative folder path. */
export function sanitizeFolderPath(folder: string): string {
  return folder
    .split('/')
    .map((seg) => seg.trim().replace(/[\\:*?"<>|#^[\]]/g, '-').replace(/\s+/g, ' '))
    .map((seg) => seg.replace(/\.+$/g, ''))
    .filter(Boolean)
    .join('/');
}

export interface NoteLike {
  title: string;
  content_markdown: string;
  roadmap?: string | null;
  skill?: string | null;
  topic?: string | null;
}

function yamlScalar(v: string): string {
  if (/^[A-Za-z0-9 _-]+$/.test(v) && v.length <= 80) return v;
  return JSON.stringify(v);
}

/** Build Obsidian-compatible file content: YAML frontmatter + original markdown intact. */
export function buildMarkdownFile(note: NoteLike): string {
  const lines = ['---', `title: ${yamlScalar(note.title || 'Untitled')}`];
  if (note.roadmap) lines.push(`roadmap: ${yamlScalar(note.roadmap)}`);
  if (note.skill) lines.push(`skill: ${yamlScalar(note.skill)}`);
  if (note.topic) lines.push(`topic: ${yamlScalar(note.topic)}`);
  lines.push(`exported: ${new Date().toISOString()}`, '---', '');
  return lines.join('\n') + (note.content_markdown || '');
}

/** Vault-relative file path, e.g. "LearnHub/My note.md". */
export function noteFilePath(title: string, baseFolder: string): string {
  const folder = sanitizeFolderPath(baseFolder || 'LearnHub');
  const file = `${sanitizeFileName(title)}.md`;
  return folder ? `${folder}/${file}` : file;
}

export function buildObsidianOpenUri(vault: string, filePath: string): string {
  return `obsidian://open?vault=${encodeURIComponent(vault)}&file=${encodeURIComponent(filePath)}`;
}

export function buildObsidianNewUri(vault: string, filePath: string, content: string): string {
  return `obsidian://new?vault=${encodeURIComponent(vault)}&file=${encodeURIComponent(filePath)}&content=${encodeURIComponent(content)}`;
}

/** ~2000 chars keeps URIs usable across browsers; above that recommend file download. */
export const OBSIDIAN_URI_SOFT_LIMIT = 2000;
export function isUriTooLong(uri: string): boolean {
  return uri.length > OBSIDIAN_URI_SOFT_LIMIT;
}

export const IMPORT_MAX_BYTES = 512 * 1024; // 512 KB

export interface ParsedImport {
  title: string;
  content: string;
}

/** Parse optional YAML frontmatter (title only) without executing anything. */
export function parseImportedMarkdown(raw: string, fallbackTitle: string): ParsedImport {
  const text = raw.replace(/^\uFEFF/, '');
  const fm = text.match(/^---\s*\r?\n([\s\S]{0,4000}?)\r?\n---\s*\r?\n?/);
  if (!fm) {
    const first = text.split(/\r?\n/).find((l) => l.trim()) ?? '';
    const h1 = first.match(/^#{1,6}\s+(.*)/)?.[1]?.trim();
    return { title: (h1 || fallbackTitle || 'Untitled').slice(0, 200), content: text };
  }
  const body = text.slice(fm[0].length);
  const titleLine = fm[1].split(/\r?\n/).find((l) => /^\s*title\s*:/i.test(l));
  let title = fallbackTitle || 'Untitled';
  if (titleLine) {
    const v = titleLine.split(':').slice(1).join(':').trim().replace(/^["']|["']$/g, '');
    if (v) title = v.slice(0, 200);
  }
  if (title === (fallbackTitle || 'Untitled')) {
    const first = body.split(/\r?\n/).find((l) => l.trim()) ?? '';
    const h1 = first.match(/^#{1,6}\s+(.*)/)?.[1]?.trim();
    if (h1) title = h1.slice(0, 200);
  }
  return { title, content: body };
}

export function validateImportFile(file: File): string | null {
  const okName = /\.md(?:\.markdown)?$/i.test(file.name) || file.type === 'text/markdown';
  if (!okName && file.type !== 'text/plain' && file.type !== '') {
    return `Unsupported file type "${file.type || 'unknown'}". Please choose a .md file.`;
  }
  if (!/\.md(?:\.markdown)?$/i.test(file.name) && file.type !== 'text/markdown' && file.type !== 'text/plain') {
    return 'Please choose a Markdown (.md) file.';
  }
  if (file.size > IMPORT_MAX_BYTES) {
    return `File is ${(file.size / 1024).toFixed(0)} KB — import limit is ${IMPORT_MAX_BYTES / 1024} KB.`;
  }
  if (file.size === 0) return 'File is empty.';
  return null;
}

/** Client-side text search over title + markdown (server query is owner-scoped first). */
export function filterNotesByQuery<T extends { title: string; content_markdown: string }>(notes: T[], q: string): T[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return notes;
  return notes.filter(
    (n) => n.title.toLowerCase().includes(needle) || n.content_markdown.toLowerCase().includes(needle),
  );
}

export function countWords(md: string): number {
  const t = md.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}
