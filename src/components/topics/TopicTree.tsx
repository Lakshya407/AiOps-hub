import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { setTopicStatus } from '@/services/roadmap';
import type { Topic, TopicProgress, TopicStatus } from '@/types';
import TopicNotes from '@/components/notes/TopicNotes';

const order: TopicStatus[] = ['not_started', 'in_progress', 'completed', 'needs_revision'];
const label: Record<TopicStatus, string> = { not_started: 'Not started', in_progress: 'In progress', completed: 'Completed', needs_revision: 'Needs revision' };

export default function TopicTree({ topics, progressMap, skillId, withNotes }: { topics: Topic[]; progressMap: Map<string, TopicProgress>; skillId?: string; withNotes?: boolean }) {
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TopicStatus }) => setTopicStatus(id, status),
    onSettled: () => qc.invalidateQueries({ queryKey: ['topic_progress'] }),
  });
  const roots = topics.filter((t) => !t.parent_topic_id).sort((a, b) => a.sort_order - b.sort_order);
  const kids = (id: string) => topics.filter((t) => t.parent_topic_id === id).sort((a, b) => a.sort_order - b.sort_order);

  const row = (t: Topic, depth: number) => {
    const st = progressMap.get(t.id)?.status ?? 'not_started';
    const done = st === 'completed';
    return (
      <div key={t.id} className={`${depth ? 'ml-7 border-l border-border pl-3' : ''} py-1`}>
        <div className="flex items-start gap-2.5">
          <button aria-label={`Toggle ${t.title}`}
            onClick={() => {
              const i = order.indexOf(st);
              mut.mutate({ id: t.id, status: order[(i + 1) % order.length] });
            }}
            className={`mt-0.5 w-5 h-5 rounded-md border grid place-items-center shrink-0 transition ${done ? 'bg-accent border-accent text-ink' : 'border-muted/50 text-transparent hover:border-text'}`}>
            <Check size={13} strokeWidth={3} />
          </button>
          <div className="min-w-0 flex-1">
            <div className={`text-sm ${done ? 'text-muted line-through' : ''}`}>{t.title}</div>
            {t.description && <div className="text-xs text-muted mt-0.5">{t.description}</div>}
            <div className="mt-1 flex items-center gap-2">
              <span className="badge">{label[st]}</span>
              {t.estimated_minutes > 0 && <span className="text-[11px] text-muted">{t.estimated_minutes}m</span>}
            </div>
            {withNotes && skillId && <TopicNotes topicId={t.id} skillId={t.skill_id || skillId} topicTitle={t.title} />}
          </div>
        </div>
        {kids(t.id).map((k) => row(k, depth + 1))}
      </div>
    );
  };
  if (!roots.length) return <p className="text-sm text-muted">No topics yet.</p>;
  return <div>{roots.map((r) => row(r, 0))}</div>;
}
