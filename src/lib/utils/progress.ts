import type { Topic, TopicProgress, TopicStatus } from '@/types';

export function leafTopics(topics: Topic[]): Topic[] {
  const parents = new Set(topics.map((t) => t.parent_topic_id).filter(Boolean) as string[]);
  return topics.filter((t) => !parents.has(t.id));
}

export function progressOf(topics: Topic[], map: Map<string, TopicProgress>) {
  const leaves = leafTopics(topics);
  const total = leaves.length;
  const completed = leaves.filter((t) => map.get(t.id)?.status === 'completed').length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  const status = total === 0 || completed === 0 ? ('Not Started' as const)
    : completed === total ? ('Completed' as const) : ('In Progress' as const);
  return { total, completed, percent, status };
}

export function nextStatus(s: TopicStatus): TopicStatus {
  if (s === 'not_started') return 'in_progress';
  if (s === 'in_progress') return 'completed';
  if (s === 'completed') return 'needs_revision';
  return 'completed';
}
