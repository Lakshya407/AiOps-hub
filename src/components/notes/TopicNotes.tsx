import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Plus } from 'lucide-react';
import { useNotesForTopic, useCreateNote } from '@/hooks/useNotes';

/** Compact per-topic notes panel used inside SkillDetails. Never touches progress. */
export default function TopicNotes({ topicId, skillId, topicTitle }: { topicId: string; skillId: string; topicTitle: string }) {
  const notesQ = useNotesForTopic(topicId);
  const createMut = useCreateNote();
  const [err, setErr] = useState<string | null>(null);
  const notes = ((notesQ.data as any[]) ?? []);

  const create = async () => {
    setErr(null);
    try {
      await createMut.mutateAsync({ title: `Notes — ${topicTitle}`.slice(0, 200), content_markdown: '', topic_id: topicId, skill_id: skillId });
    } catch (e: any) { setErr(e?.message ?? 'Could not create note'); }
  };

  return (
    <div className="rounded-xl border border-border bg-surface2/40 px-3 py-2.5 mt-2">
      <div className="flex items-center gap-2">
        <FileText size={13} className="text-muted" />
        <span className="text-xs text-muted">
          {notesQ.isLoading ? 'Loading notes…' : notes.length ? `${notes.length} note${notes.length === 1 ? '' : 's'} · last edited ${new Date(notes[0].updated_at).toLocaleDateString()}` : 'No notes yet'}
        </span>
        <span className="flex-1" />
        <button className="btn !py-1 !px-2 !text-[11px]" onClick={create} disabled={createMut.isPending}>
          <Plus size={12} /> {createMut.isPending ? 'Creating…' : 'Note'}
        </button>
        <Link to={`/notes?topic=${topicId}`} className="btn !py-1 !px-2 !text-[11px]">Open</Link>
      </div>
      {notes.length > 0 && (
        <div className="mt-1.5 space-y-1">
          {notes.slice(0, 3).map((n: any) => (
            <Link key={n.id} to={`/notes?note=${n.id}`} className="block text-xs truncate hover:text-accent transition">
              {n.is_pinned ? '📌 ' : ''}{n.title}
            </Link>
          ))}
        </div>
      )}
      {err && <p className="text-[11px] text-red-300 mt-1">{err}</p>}
    </div>
  );
}
