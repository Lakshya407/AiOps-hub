// @ts-nocheck
import { describe, it, expect } from 'vitest';
import {
  ALLOWED_IMAGE_TYPES,
  IMAGE_MAX_BYTES,
  MAX_PER_PASTE,
  buildImageMarkdown,
  imageAltFromFile,
  validateImageFile,
} from '@/services/noteImages';
import fs from 'node:fs';

const img = (name: string, type: string, size: number) =>
  new File([new Uint8Array(size)], name, { type });

describe('image validation', () => {
  it('accepts PNG/JPG/GIF/WebP within size limit', () => {
    for (const t of ALLOWED_IMAGE_TYPES) {
      expect(validateImageFile(img('shot.png', t, 1024))).toBeNull();
    }
  });
  it('rejects executables, SVGs and other non-image types', () => {
    expect(validateImageFile(img('run.exe', 'application/x-msdownload', 10))).toMatch(/not a supported image/);
    expect(validateImageFile(img('pic.svg', 'image/svg+xml', 10))).toMatch(/not a supported image/);
    expect(validateImageFile(img('doc.pdf', 'application/pdf', 10))).toMatch(/not a supported image/);
  });
  it('rejects oversized and empty files', () => {
    expect(validateImageFile(img('big.png', 'image/png', IMAGE_MAX_BYTES + 1))).toMatch(/limit/);
    expect(validateImageFile(img('empty.png', 'image/png', 0))).toMatch(/empty/);
  });
  it('caps batch size', () => {
    expect(MAX_PER_PASTE).toBe(5);
  });
});

describe('image markdown helpers', () => {
  it('derives alt text from the filename', () => {
    expect(imageAltFromFile(img('Screenshot 2026-09-29.png', 'image/png', 10))).toBe('Screenshot 2026-09-29');
    expect(imageAltFromFile(img('', 'image/png', 10))).toBe('pasted image');
  });
  it('builds a standard image reference with safe alt text', () => {
    expect(buildImageMarkdown('shot', 'https://x/y.png')).toBe('![](https://x/y.png)'.replace('![]', '![shot]'));
    expect(buildImageMarkdown('a[b]c', 'https://x/y.png')).toBe('![abc](https://x/y.png)');
  });
});

describe('note-images storage migration guards', () => {
  it('0012 creates a public bucket with owner-scoped writes', () => {
    const sql = fs.readFileSync('supabase/migrations/0012_note_images_storage.sql', 'utf8');
    expect(sql).toContain('note_images');
    expect(sql).toMatch(/public/);
    expect(sql).toMatch(/auth\.uid\(\)::text = \(storage\.foldername\(name\)\)\[1\]/);
    expect(sql).not.toMatch(/service_role/i);
  });
  it('upload service uses owner/note UUID paths + public URLs, no service keys', () => {
    const svc = fs.readFileSync('src/services/noteImages.ts', 'utf8');
    expect(svc).toContain('getPublicUrl');
    expect(svc).toContain('${user.id}/${noteId}/');
    expect(svc).not.toMatch(/service_role/i);
  });
});
