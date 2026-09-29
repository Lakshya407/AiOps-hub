import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useRoadmapData } from '@/hooks/useRoadmapData';
import NotesWorkspace from '@/components/notes/NotesWorkspace';

export default function Notes() {
  const [params] = useSearchParams();
  const { phases, skills, topics } = useRoadmapData();

  const initialTopicId = params.get('topic');
  const initialNoteId = params.get('note');
  const initialSkillId = useMemo(() => {
    const direct = params.get('skill');
    if (direct) return direct;
    if (!initialTopicId) return null;
    const t = ((topics.data as any[]) ?? []).find((x: any) => x.id === initialTopicId);
    return (t?.skill_id as string | undefined) ?? null;
  }, [params, topics.data, initialTopicId]);

  // Pre-select a specific note id via URL (?note=…) — handled by workspace auto-select fallback

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-lg font-semibold">Notes</h1>
        <p className="text-sm text-muted">Obsidian-style Markdown notes, linked to your roadmap. Autosaves as you type; export or open any note in your local Obsidian vault.</p>
      </div>
      <NotesWorkspace
        topics={(topics.data as any[]) ?? []}
        skills={(skills.data as any[]) ?? []}
        phases={(phases.data as any[]) ?? []}
        initialTopicId={initialTopicId}
        initialSkillId={initialSkillId}
        initialNoteId={initialNoteId}
      />
    </div>
  );
}
