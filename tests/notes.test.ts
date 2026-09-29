// @ts-nocheck
import { describe, it, expect } from 'vitest';
import {
  buildMarkdownFile,
  buildObsidianNewUri,
  buildObsidianOpenUri,
  countWords,
  filterNotesByQuery,
  isUriTooLong,
  noteFilePath,
  parseImportedMarkdown,
  sanitizeFileName,
  sanitizeFolderPath,
  validateImportFile,
} from '@/lib/obsidian';
import fs from 'node:fs';

describe('obsidian filename sanitization', () => {
  it('strips illegal path characters', () => {
    expect(sanitizeFileName('a/b\\c:d*e?f"g<h>i|j')).not.toMatch(/[\\/:*?"<>|]/);
    expect(sanitizeFileName('  ')).toBe('Untitled');
    expect(sanitizeFileName('notes...')).toBe('notes');
  });
  it('builds vault-relative paths under the base folder', () => {
    expect(noteFilePath('My note', 'LearnHub')).toBe('LearnHub/My note.md');
    expect(noteFilePath('a/b', '')).toBe('LearnHub/a-b.md');
    expect(sanitizeFolderPath('A//B..')).toBe('A/B');
  });
});

describe('obsidian export frontmatter', () => {
  it('emits valid YAML frontmatter and keeps content intact', () => {
    const md = '# Hi\n\nbody **bold**';
    const file = buildMarkdownFile({ title: 'T', content_markdown: md, skill: 'Linux', topic: 'systemd', roadmap: null });
    expect(file.startsWith('---\n')).toBe(true);
    expect(file).toContain('title: T');
    expect(file).toContain('skill: Linux');
    expect(file.endsWith(md)).toBe(true);
  });
  it('quotes titles with special chars', () => {
    const file = buildMarkdownFile({ title: 'a: b "c"', content_markdown: 'x' });
    expect(file).toContain('title: "a: b \\"c\\""');
  });
});

describe('obsidian URIs', () => {
  it('encodes vault and file params', () => {
    const uri = buildObsidianOpenUri('My Vault', 'LearnHub/a b.md');
    expect(uri).toBe('obsidian://open?vault=My%20Vault&file=LearnHub%2Fa%20b.md');
    const created = buildObsidianNewUri('V', 'F/n.md', '# hi & bye');
    expect(created).toContain('content=%23%20hi%20%26%20bye');
  });
  it('flags long URIs for manual import', () => {
    expect(isUriTooLong('x'.repeat(2001))).toBe(true);
    expect(isUriTooLong('x'.repeat(1999))).toBe(false);
  });
});

describe('markdown import', () => {
  it('parses frontmatter title without executing content', () => {
    const p = parseImportedMarkdown('---\ntitle: Hello\n---\n\n# Body\n<script>alert(1)</script>', 'file.md');
    expect(p.title).toBe('Hello');
    expect(p.content).toContain('<script>alert(1)</script>'); // raw preserved; renderer sanitizes
  });
  it('falls back to first H1 then filename', () => {
    expect(parseImportedMarkdown('# Real Title\ntext', 'file.md').title).toBe('Real Title');
    expect(parseImportedMarkdown('just text', 'file.md').title).toBe('file.md');
  });
  it('rejects oversized and non-markdown files', () => {
    const big = new File([new Uint8Array(600 * 1024)], 'big.md', { type: 'text/markdown' });
    expect(validateImportFile(big)).toMatch(/limit/);
    const exe = new File(['x'], 'run.exe', { type: 'application/x-msdownload' });
    expect(validateImportFile(exe)).toMatch(/Unsupported/);
    const ok = new File(['# hi'], 'note.md', { type: 'text/markdown' });
    expect(validateImportFile(ok)).toBeNull();
  });
});

describe('notes search + word count', () => {
  const rows = [
    { title: 'systemd cheat sheet', content_markdown: 'journalctl basics' },
    { title: 'k8s pods', content_markdown: 'kubectl get pods' },
  ];
  it('matches title or content case-insensitively', () => {
    expect(filterNotesByQuery(rows, 'SYSTEMD')).toHaveLength(1);
    expect(filterNotesByQuery(rows, 'kubectl')).toHaveLength(1);
    expect(filterNotesByQuery(rows, '')).toHaveLength(2);
  });
  it('counts words', () => {
    expect(countWords('  hello   world\nnew line ')).toBe(4);
    expect(countWords('')).toBe(0);
  });
});

describe('notes migration guards', () => {
  it('0011 adds roadmap_id + is_pinned with owner RLS intact', () => {
    const sql = fs.readFileSync('supabase/migrations/0011_notes_obsidian.sql', 'utf8');
    expect(sql).toContain('roadmap_id');
    expect(sql).toContain('is_pinned');
    expect(sql).toMatch(/auth\.uid\(\) = owner_id/);
    expect(sql).not.toMatch(/service_role/i);
  });
  it('notes service stays owner-scoped with no service keys', () => {
    const svc = fs.readFileSync('src/services/notes.ts', 'utf8');
    expect(svc).toContain("eq('owner_id'");
    expect(svc).not.toMatch(/service_role/i);
  });
});
