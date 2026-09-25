import { z } from 'zod';
export const noteSchema = z.object({
  title: z.string().min(1, 'Title required').max(200),
  content_markdown: z.string().max(50000),
  tags: z.string().optional(),
});
export const docMetaSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().default(''),
  tags: z.string().optional(),
});
export const logSchema = z.object({
  summary: z.string().max(5000).optional().default(''),
  challenges: z.string().max(5000).optional().default(''),
  next_steps: z.string().max(5000).optional().default(''),
});
export const urlSchema = z.string().url('Must be a valid URL').or(z.literal(''));
