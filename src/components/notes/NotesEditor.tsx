import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { noteSchema } from '@/lib/validation/schemas';
import { saveNote } from '@/services/notes';

export default function NotesEditor({ topicId, skillId, onSaved }: { topicId?: string | null; skillId?: string | null; onSaved: () => void }) {
  const [preview, setPreview] = useState(false);
  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(noteSchema), defaultValues: { title: '', content_markdown: '', tags: '' } });
  const content = watch('content_markdown');
  return (
    <form className="card p-4 space-y-3" onSubmit={handleSubmit(async (v) => {
      await saveNote({ topic_id: topicId ?? null, skill_id: skillId ?? null, title: v.title, content_markdown: v.content_markdown, tags: (v.tags ?? '').split(',').map((s) => s.trim()).filter(Boolean) });
      reset(); onSaved();
    })}>
      <div>
        <label className="label">Title</label>
        <input className="input" {...register('title')} placeholder="e.g. systemd cheat sheet" />
        {errors.title && <p className="text-xs text-red-300 mt-1">{errors.title.message}</p>}
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="label !mb-0">Markdown</label>
          <button type="button" className="badge hover:text-text" onClick={() => setPreview((p) => !p)}>{preview ? 'Edit' : 'Preview'}</button>
        </div>
        {preview
          ? <div className="prose prose-invert prose-sm max-w-none bg-surface2 border border-border rounded-xl p-3 min-h-[120px]"><ReactMarkdown rehypePlugins={[rehypeSanitize]}>{content || '*Nothing to preview*'}</ReactMarkdown></div>
          : <textarea className="input min-h-[120px]" {...register('content_markdown')} placeholder="Write in Markdown…" />}
      </div>
      <div>
        <label className="label">Tags (comma separated)</label>
        <input className="input" {...register('tags')} placeholder="runbook, k8s" />
      </div>
      <button className="btn btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save note'}</button>
    </form>
  );
}
