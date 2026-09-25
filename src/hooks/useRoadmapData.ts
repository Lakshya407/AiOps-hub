import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPhases, fetchSkills, fetchAllTopics, fetchProgress, setTopicStatus } from '@/services/roadmap';

export function useRoadmapData() {
  const phases = useQuery({ queryKey: ['phases'], queryFn: fetchPhases, retry: 1 });
  const skills = useQuery({ queryKey: ['skills'], queryFn: fetchSkills, retry: 1 });
  const topics = useQuery({ queryKey: ['topics'], queryFn: fetchAllTopics, retry: 1 });
  const progress = useQuery({ queryKey: ['topic_progress'], queryFn: fetchProgress, retry: 1 });
  return { phases, skills, topics, progress };
}

export function useSetTopicStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ topicId, status }: { topicId: string; status: string }) => setTopicStatus(topicId, status),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ['topic_progress'] });
      const prev = qc.getQueryData<any[]>(['topic_progress']) ?? [];
      qc.setQueryData<any[]>(['topic_progress'], (old = []) => {
        const found = old.find((p) => p.topic_id === vars.topicId);
        if (found) return old.map((p) => (p.topic_id === vars.topicId ? { ...p, status: vars.status, updated_at: new Date().toISOString() } : p));
        return [...old, { id: `optimistic-${vars.topicId}`, owner_id: 'me', topic_id: vars.topicId, status: vars.status, completed_at: null, updated_at: new Date().toISOString() }];
      });
      return { prev };
    },
    onError: (_e, _v, ctx: any) => { if (ctx?.prev) qc.setQueryData(['topic_progress'], ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: ['topic_progress'] }),
  });
}
