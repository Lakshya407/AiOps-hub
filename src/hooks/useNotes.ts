import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createNote, deleteNote, duplicateNote, fetchNoteById, fetchNotes, renameNote, togglePin, updateNote, type NoteInput } from '@/services/notes';
import type { Note } from '@/types';

export const NOTES_KEY = ['notes'];

export function useNotesList(search?: string) {
  return useQuery({
    queryKey: [...NOTES_KEY, { search: search ?? '' }],
    queryFn: () => fetchNotes(search?.trim() ? { search: search.trim() } : undefined),
    retry: 1,
  });
}

export function useNote(id: string | null) {
  return useQuery({
    queryKey: [...NOTES_KEY, id],
    queryFn: () => fetchNoteById(id!),
    enabled: Boolean(id),
    retry: 1,
  });
}

export function useNotesForTopic(topicId: string | null | undefined) {
  return useQuery({
    queryKey: [...NOTES_KEY, 'topic', topicId ?? 'none'],
    queryFn: () => fetchNotes({ topicId: topicId ?? undefined }),
    enabled: Boolean(topicId),
    retry: 1,
  });
}

export function useNotesForSkill(skillId: string | null | undefined) {
  return useQuery({
    queryKey: [...NOTES_KEY, 'skill', skillId ?? 'none'],
    queryFn: () => fetchNotes({ skillId: skillId ?? undefined }),
    enabled: Boolean(skillId),
    retry: 1,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: NOTES_KEY });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NoteInput) => createNote(input),
    onSettled: () => invalidate(qc),
  });
}

export function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateNote>[1] }) => updateNote(id, patch),
    onSettled: () => invalidate(qc),
  });
}

export function useRenameNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => renameNote(id, title),
    onSettled: () => invalidate(qc),
  });
}

export function useTogglePin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) => togglePin(id, pinned),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: NOTES_KEY });
      const prev: Array<[unknown, unknown]> = [];
      qc.getQueryCache().findAll({ queryKey: NOTES_KEY }).forEach((q) => {
        prev.push([q.queryKey, q.state.data]);
        qc.setQueryData<Note[]>(q.queryKey, (old) =>
          Array.isArray(old) ? old.map((n) => (n.id === vars.id ? { ...n, is_pinned: vars.pinned } : n)) : old,
        );
      });
      return { prev };
    },
    onError: (_e, _v, ctx: any) => {
      ctx?.prev?.forEach(([k, d]: [unknown, unknown]) => qc.setQueryData(k as any, d));
    },
    onSettled: () => invalidate(qc),
  });
}

export function useDuplicateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (note: Note) => duplicateNote(note),
    onSettled: () => invalidate(qc),
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteNote(id),
    onSettled: () => invalidate(qc),
  });
}
