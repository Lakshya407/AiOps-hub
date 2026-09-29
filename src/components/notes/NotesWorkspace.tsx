import { useEffect, useMemo, useRef, useState, type ClipboardEvent as ReactClipboardEvent, type DragEvent as ReactDragEvent } from 'react';
import {
  ArrowLeft, Bold, Check, Code2, Copy, Download, ExternalLink, Eye, Heading1, Heading2,
  ImagePlus, Italic, Link2, List, ListChecks, ListOrdered, Pin, PinOff, Plus, Quote,
  Search, SplitSquareHorizontal, Pencil, Table2, Trash2, Upload, X,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import MarkdownView from './MarkdownView';
import { useDeleteNote, useDuplicateNote, useNotesList, useTogglePin, NOTES_KEY } from '@/hooks/useNotes';
import { createNote, updateNote } from '@/services/notes';
import { MAX_PER_PASTE, buildImageMarkdown, imageAltFromFile, uploadNoteImage, validateImageFile } from '@/services/noteImages';
import {
  IMPORT_MAX_BYTES, buildMarkdownFile, buildObsidianNewUri, buildObsidianOpenUri,
  countWords, isUriTooLong, loadObsidianSettings, noteFilePath,
  parseImportedMarkdown, sanitizeFileName, validateImportFile,
} from '@/lib/obsidian';
import type { Note } from '@/types';

type ViewMode = 'edit' | 'preview' | 'split';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const AUTOSAVE_MS = 1000;

interface Lookup { id: string; title: string; skill_id?: string; phase_id?: string }

export interface NotesWorkspaceProps {
  topics?: Lookup[];
  skills?: Lookup[];
  phases?: Lookup[];
  initialTopicId?: string | null;
  initialSkillId?: string | null;
  initialNoteId?: string | null;
}

function groupLabel(n: Note, skills: Map<string, string>, topics: Map<string, string>): string {
  const t = n.topic_id ? topics.get(n.topic_id) : undefined;
  const s = n.skill_id ? skills.get(n.skill_id) : undefined;
  if (t && s) return `${s} / ${t}`;
  if (s) return s;
  if (t) return t;
  return 'General';
}

export default function NotesWorkspace({ topics = [], skills = [], phases = [], initialTopicId, initialSkillId, initialNoteId }: NotesWorkspaceProps) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>('split');
  const [confirmDelete, setConfirmDelete] = useState<Note | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importText, setImportText] = useState('');
  const [importTitle, setImportTitle] = useState('');
  const [importErr, setImportErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const notesQ = useNotesList(debouncedSearch);
  const notes = useMemo(() => (notesQ.data as Note[] | undefined) ?? [], [notesQ.data]);
  const delMut = useDeleteNote();
  const dupMut = useDuplicateNote();
  const pinMut = useTogglePin();

  const skillNames = useMemo(() => new Map(skills.map((s) => [s.id, s.title])), [skills]);
  const topicNames = useMemo(() => new Map(topics.map((t) => [t.id, t.title])), [topics]);
  const topicToSkill = useMemo(() => new Map(topics.map((t) => [t.id, t.skill_id ?? ''])), [topics]);
  const skillToPhase = useMemo(() => new Map(skills.map((s) => [s.id, (s as any).phase_id ?? ''])), [skills]);
  void phases;

  const selected = useMemo(() => notes.find((n) => n.id === selectedId) ?? null, [notes, selectedId]);

  // Auto-select: explicit note id > topic match > first note
  useEffect(() => {
    if (selectedId || !notes.length) return;
    if (initialNoteId) {
      const match = notes.find((n) => n.id === initialNoteId);
      if (match) { setSelectedId(match.id); return; }
    }
    if (initialTopicId) {
      const match = notes.find((n) => n.topic_id === initialTopicId);
      if (match) { setSelectedId(match.id); return; }
    }
    setSelectedId(notes[0].id);
  }, [notes, selectedId, initialTopicId, initialNoteId]);

  // ---- Local editable state (preserved across mode switches) ----
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const versionRef = useRef(0);
  const hydratedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!selected) {
      if (hydratedFor.current !== null) {
        hydratedFor.current = null;
        setTitle(''); setContent(''); setSaveState('idle'); setLastSavedAt(null);
      }
      return;
    }
    if (hydratedFor.current !== selected.id) {
      hydratedFor.current = selected.id;
      versionRef.current += 1;
      setTitle(selected.title);
      setContent(selected.content_markdown);
      setSaveState('idle');
      setLastSavedAt(selected.updated_at);
      setRenaming(false);
      setError(null);
    }
  }, [selected]);

  const dirty = Boolean(selected) && (title !== selected!.title || content !== selected!.content_markdown);

  // Debounced autosave with stale-request guard
  useEffect(() => {
    if (!selected || !dirty) return;
    setSaveState((s) => (s === 'error' ? s : 'idle'));
    const myVersion = versionRef.current + 1;
    versionRef.current = myVersion;
    const t = setTimeout(async () => {
      setSaveState('saving');
      try {
        const updated = await updateNote(selected.id, { title: title.slice(0, 200) || 'Untitled', content_markdown: content });
        if (versionRef.current !== myVersion) return; // stale response — newer edits exist
        setLastSavedAt(updated.updated_at);
        setSaveState('saved');
        qc.setQueryData(NOTES_KEY, (old: any) =>
          Array.isArray(old) ? old.map((n: Note) => (n.id === updated.id ? updated : n)) : old,
        );
        void qc.invalidateQueries({ queryKey: NOTES_KEY });
      } catch (e: any) {
        if (versionRef.current !== myVersion) return;
        setSaveState('error');
        setError(e?.message ?? 'Save failed. Your edits are preserved — retry.');
      }
    }, AUTOSAVE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content, selected?.id]);

  const retrySave = async () => {
    if (!selected) return;
    const myVersion = versionRef.current + 1;
    versionRef.current = myVersion;
    setSaveState('saving'); setError(null);
    try {
      const updated = await updateNote(selected.id, { title: title.slice(0, 200) || 'Untitled', content_markdown: content });
      if (versionRef.current !== myVersion) return;
      setLastSavedAt(updated.updated_at);
      setSaveState('saved');
      void qc.invalidateQueries({ queryKey: NOTES_KEY });
    } catch (e: any) {
      if (versionRef.current !== myVersion) return;
      setSaveState('error');
      setError(e?.message ?? 'Save failed. Your edits are preserved — retry.');
    }
  };

  const create = async (preset?: { topicId?: string | null; skillId?: string | null; roadmapId?: string | null }) => {
    setError(null); setNotice(null);
    try {
      let topicId = preset?.topicId ?? initialTopicId ?? null;
      let skillId = preset?.skillId ?? initialSkillId ?? null;
      if (topicId && !skillId) skillId = topicToSkill.get(topicId) || null;
      const roadmapId = preset?.roadmapId ?? (skillId ? skillToPhase.get(skillId!) || null : null);
      const topicName = topicId ? topicNames.get(topicId) : undefined;
      const n = await createNote({
        title: topicName ? `Notes — ${topicName}` : 'Untitled note',
        content_markdown: '',
        topic_id: topicId, skill_id: skillId, roadmap_id: roadmapId,
      });
      setSelectedId(n.id);
      setMode('edit');
      setSaveState('saved');
    } catch (e: any) { setError(e?.message ?? 'Could not create note'); }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    try {
      await delMut.mutateAsync(confirmDelete.id);
      if (selectedId === confirmDelete.id) {
        hydratedFor.current = null;
        setSelectedId(null); setTitle(''); setContent('');
      }
      setConfirmDelete(null);
    } catch (e: any) { setError(e?.message ?? 'Delete failed'); }
  };

  const insertAtCursor = (before: string, after = '', placeholder = '') => {
    const el = textareaRef.current;
    if (!el) { setContent((c) => c + before + placeholder + after); return; }
    const s = el.selectionStart ?? content.length;
    const e = el.selectionEnd ?? content.length;
    const sel = content.slice(s, e) || placeholder;
    const next = content.slice(0, s) + before + sel + after + content.slice(e);
    setContent(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = s + before.length + sel.length + after.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const toolbar: Array<{ icon: any; label: string; fn: () => void }> = [
    { icon: Heading1, label: 'Heading 1', fn: () => insertAtCursor('\n# ', '', 'Heading') },
    { icon: Heading2, label: 'Heading 2', fn: () => insertAtCursor('\n## ', '', 'Heading') },
    { icon: Bold, label: 'Bold', fn: () => insertAtCursor('**', '**', 'bold') },
    { icon: Italic, label: 'Italic', fn: () => insertAtCursor('*', '*', 'italic') },
    { icon: List, label: 'Bullet list', fn: () => insertAtCursor('\n- ', '', 'item') },
    { icon: ListOrdered, label: 'Numbered list', fn: () => insertAtCursor('\n1. ', '', 'item') },
    { icon: ListChecks, label: 'Checklist', fn: () => insertAtCursor('\n- [ ] ', '', 'task') },
    { icon: Quote, label: 'Quote', fn: () => insertAtCursor('\n> ', '', 'quote') },
    { icon: Code2, label: 'Code block', fn: () => insertAtCursor('\n```\n', '\n```\n', 'code') },
    { icon: Link2, label: 'Link', fn: () => insertAtCursor('[', '](https://)', 'text') },
    { icon: Table2, label: 'Table', fn: () => insertAtCursor('\n| Col A | Col B |\n| --- | --- |\n| ', ' |  |\n', 'a') },
    { icon: ImagePlus, label: 'Attach image (or paste with Ctrl+V)', fn: () => imageRef.current?.click() },
  ];

  // ---- Image paste / drop / attach ----
  const imagesFromClipboard = (e: ReactClipboardEvent<HTMLTextAreaElement>): File[] => {
    const out: File[] = [];
    const items = e.clipboardData?.items;
    if (items) {
      for (const it of Array.from(items)) {
        if (it.type.startsWith('image/')) {
          const f = it.getAsFile();
          if (f) out.push(f);
        }
      }
    }
    if (!out.length && e.clipboardData?.files?.length) {
      for (const f of Array.from(e.clipboardData.files)) {
        if (f.type.startsWith('image/')) out.push(f);
      }
    }
    return out;
  };

  /** Upload images and insert `![alt](url)` at the cursor. Returns true if it handled the event. */
  const uploadAndInsertImages = async (files: File[] | FileList): Promise<boolean> => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!list.length) return false;
    if (!selected) { setError('Create or select a note first, then paste images.'); return true; }
    const targetId = selected.id;
    const batch = list.slice(0, MAX_PER_PASTE);
    if (list.length > batch.length) setNotice(`Only the first ${batch.length} images were attached (${MAX_PER_PASTE} per paste).`);
    setUploading((n) => n + batch.length);
    for (const f of batch) {
      const err = validateImageFile(f);
      if (err) { setUploading((n) => n - 1); setError(err); continue; }
      const alt = imageAltFromFile(f);
      const placeholder = `![Uploading ${alt}…]()`;
      insertAtCursor(placeholder + '\n', '', '');
      try {
        const url = await uploadNoteImage(f, targetId);
        if (hydratedFor.current === targetId) {
          const done = buildImageMarkdown(alt, url);
          setContent((c) => (c.includes(placeholder) ? c.replace(placeholder, done) : `${c.replace(/\s+$/, '')}\n\n${done}\n`));
        } else {
          // User switched notes mid-upload: don't lose the URL.
          setNotice(`Image uploaded, but you had switched notes — its link: ${url}`);
        }
        void qc.invalidateQueries({ queryKey: NOTES_KEY });
      } catch (e: any) {
        if (hydratedFor.current === targetId) setContent((c) => c.replace(placeholder, ''));
        setError(e?.message ?? 'Image upload failed. The placeholder was removed.');
      } finally {
        setUploading((n) => n - 1);
      }
    }
    return true;
  };

  const onEditorPaste = (e: ReactClipboardEvent<HTMLTextAreaElement>) => {
    const imgs = imagesFromClipboard(e);
    if (!imgs.length) return; // plain text: let the default paste through
    e.preventDefault();
    void uploadAndInsertImages(imgs);
  };

  const onEditorDrop = (e: ReactDragEvent<HTMLTextAreaElement>) => {
    const imgs = Array.from(e.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'));
    if (!imgs.length) return;
    e.preventDefault();
    void uploadAndInsertImages(imgs);
  };

  // ---- Obsidian actions ----
  const obsidianNoteNames = (n: Note) => ({
    roadmap: n.roadmap_id,
    skill: n.skill_id ? skillNames.get(n.skill_id) ?? null : null,
    topic: n.topic_id ? topicNames.get(n.topic_id) ?? null : null,
  });

  const exportMd = (n: Note) => {
    const names = obsidianNoteNames(n);
    const file = buildMarkdownFile({ title: n.title, content_markdown: n.content_markdown, ...names });
    const blob = new Blob([file], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${sanitizeFileName(n.title)}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    setNotice(`Exported "${n.title}" as Markdown with Obsidian frontmatter.`);
  };

  const openInObsidian = (n: Note, mode: 'open' | 'new') => {
    const s = loadObsidianSettings();
    if (!s.enabled || !s.vault) {
      setError('Obsidian integration is not configured. Open Settings → Obsidian and set your vault name first.');
      return;
    }
    if (dirty || saveState === 'saving' || saveState === 'error') {
      setError('You have unsaved browser edits. Opening the vault file will NOT include them — wait for “Saved” or export first. Nothing was overwritten.');
      return;
    }
    const path = noteFilePath(n.title, s.baseFolder);
    const uri = mode === 'open'
      ? buildObsidianOpenUri(s.vault, path)
      : buildObsidianNewUri(s.vault, path, buildMarkdownFile({ title: n.title, content_markdown: n.content_markdown, ...obsidianNoteNames(n) }));
    if (mode === 'new' && isUriTooLong(uri)) {
      setError(`This note is too long for an Obsidian “new note” link (${uri.length} chars). Download the Markdown file instead and place it in your vault — nothing was overwritten.`);
      return;
    }
    window.location.href = uri;
    setNotice(mode === 'open'
      ? `Opening "${path}" in vault "${s.vault}". If nothing happens, make sure Obsidian is installed and the vault exists. Browser edits are never auto-synced.`
      : `Creating "${path}" in vault "${s.vault}". If the file already exists locally, Obsidian keeps the local file — nothing is overwritten silently.`);
  };

  const onPickImport = async (f: File | undefined) => {
    setImportErr(null); setImportText(''); setImportTitle('');
    if (!f) return;
    const err = validateImportFile(f);
    if (err) { setImportErr(err); return; }
    try {
      const raw = await f.text();
      if (raw.length > IMPORT_MAX_BYTES) { setImportErr(`File too large — limit is ${IMPORT_MAX_BYTES / 1024} KB.`); return; }
      const parsed = parseImportedMarkdown(raw, f.name.replace(/\.md$/i, ''));
      setImportFile(f);
      setImportText(parsed.content);
      setImportTitle(parsed.title.slice(0, 200));
    } catch { setImportErr('Could not read file as UTF-8 text.'); }
  };

  const doImport = async (linkToCurrentTopic: boolean) => {
    if (!importText && !importTitle) { setImportErr('Nothing to import.'); return; }
    try {
      let topicId: string | null = null;
      let skillId: string | null = null;
      if (linkToCurrentTopic && selected) { topicId = selected.topic_id; skillId = selected.skill_id; }
      else if (linkToCurrentTopic && initialTopicId) { topicId = initialTopicId; skillId = initialSkillId ?? topicToSkill.get(initialTopicId) ?? null; }
      const roadmapId = skillId ? skillToPhase.get(skillId) || null : null;
      const n = await createNote({ title: importTitle || 'Imported note', content_markdown: importText, topic_id: topicId, skill_id: skillId, roadmap_id: roadmapId });
      setImportOpen(false); setImportFile(null); setImportText(''); setImportTitle('');
      setSelectedId(n.id);
      setNotice(`Imported "${n.title}". A new note was created — nothing was overwritten.`);
    } catch (e: any) { setImportErr(e?.message ?? 'Import failed'); }
  };

  const groups = useMemo(() => {
    const map = new Map<string, Note[]>();
    const pinned = notes.filter((n) => n.is_pinned);
    const rest = notes.filter((n) => !n.is_pinned);
    if (pinned.length) map.set('Pinned', pinned);
    for (const n of rest) {
      const label = groupLabel(n, skillNames, topicNames);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(n);
    }
    return [...map.entries()];
  }, [notes, skillNames, topicNames]);

  const saveLabel = saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Save failed' : dirty ? 'Unsaved' : 'Saved';
  const mobileShowingEditor = Boolean(selectedId);

  return (
    <div>
      {(error || notice) && (
        <div className={`card px-3.5 py-2.5 mb-3 text-sm flex items-start gap-2 ${error ? 'border-red-400/40' : 'border-accent/40'}`}>
          <p className={`flex-1 text-xs leading-relaxed ${error ? 'text-red-200' : 'text-muted'}`}>{error ?? notice}</p>
          <button aria-label="Dismiss" className="text-muted hover:text-text" onClick={() => { setError(null); setNotice(null); }}><X size={14} /></button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
        {/* ---- Left: notes list ---- */}
        <div className={`card p-3 ${mobileShowingEditor ? 'hidden md:block' : ''}`}>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input aria-label="Search notes" className="input !pl-8" placeholder="Search title or content…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <button className="btn btn-primary !px-2.5" title="Create note" aria-label="Create note" onClick={() => void create()}><Plus size={16} /></button>
          </div>

          {notesQ.isLoading && <p className="text-xs text-muted px-1 py-4">Loading notes…</p>}
          {notesQ.error && <p className="text-xs text-red-300 px-1 py-4">Couldn’t load notes: {(notesQ.error as Error).message}</p>}
          {!notesQ.isLoading && !notesQ.error && notes.length === 0 && (
            <div className="text-center px-2 py-10">
              <p className="text-sm font-medium">No notes yet</p>
              <p className="text-xs text-muted mt-1 mb-4">Capture Markdown notes linked to your roadmap, or import an existing .md file.</p>
              <div className="flex flex-col gap-2">
                <button className="btn btn-primary justify-center" onClick={() => void create()}><Plus size={15} /> Create note</button>
                <button className="btn justify-center" onClick={() => setImportOpen(true)}><Upload size={15} /> Import Markdown</button>
              </div>
            </div>
          )}

          <div className="mt-2 max-h-[60vh] md:max-h-[75vh] overflow-y-auto space-y-3 pr-0.5">
            {groups.map(([label, items]) => (
              <div key={label}>
                <div className="px-1.5 pb-1 text-[10px] uppercase tracking-widest text-muted truncate">{label}</div>
                <div className="space-y-1">
                  {items.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => setSelectedId(n.id)}
                      className={`w-full text-left rounded-xl border px-2.5 py-2 transition ${n.id === selectedId ? 'border-accent/50 bg-accentDim/20' : 'border-transparent hover:bg-surface2'}`}
                    >
                      <div className="flex items-center gap-1.5">
                        {n.is_pinned && <Pin size={11} className="text-accent shrink-0" />}
                        <span className="text-[13px] font-medium truncate flex-1">{n.title}</span>
                      </div>
                      <div className="text-[11px] text-muted truncate mt-0.5">
                        {(n.content_markdown.split('\n').find((l) => l.trim()) ?? 'Empty note').slice(0, 80)}
                      </div>
                      <div className="text-[10px] text-muted mt-1">{new Date(n.updated_at).toLocaleString()}</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ---- Right: editor ---- */}
        {!selected ? (
          <div className={`card p-8 text-center ${mobileShowingEditor ? 'hidden' : ''} md:block hidden`}>
            <p className="text-sm font-medium">Select a note</p>
            <p className="text-xs text-muted mt-1">Choose from the list, or create a new one.</p>
          </div>
        ) : (
          <div className={`card p-3 sm:p-5 min-w-0 ${mobileShowingEditor ? '' : 'hidden md:block'}`}>
            <div className="flex items-center gap-2 flex-wrap">
              <button className="btn !px-2 md:hidden" aria-label="Back to notes" onClick={() => setSelectedId(null)}><ArrowLeft size={15} /></button>
              {renaming ? (
                <input
                  aria-label="Note title"
                  className="input flex-1 min-w-[140px]"
                  value={title}
                  autoFocus
                  maxLength={200}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => setRenaming(false)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setRenaming(false); }}
                />
              ) : (
                <button className="flex-1 min-w-0 text-left group" title="Rename" onClick={() => setRenaming(true)}>
                  <span className="block text-[15px] font-semibold truncate">{title || 'Untitled'}</span>
                  <span className="block text-[10px] text-muted">
                    {selected.topic_id && topicNames.get(selected.topic_id) ? `${skillNames.get(selected.skill_id ?? '') ?? ''}${selected.skill_id ? ' / ' : ''}${topicNames.get(selected.topic_id!)}` : 'General'} · click to rename
                  </span>
                </button>
              )}
              <div className="flex items-center gap-1" role="tablist" aria-label="Editor mode">
                {([['edit', Pencil, 'Edit'], ['preview', Eye, 'Preview'], ['split', SplitSquareHorizontal, 'Split']] as const).map(([m, Icon, label]) => (
                  <button key={m} role="tab" aria-selected={mode === m} title={label}
                    onClick={() => setMode(m)}
                    className={`btn !px-2 !py-1.5 ${mode === m ? '!border-accent !text-text bg-accentDim/20' : ''}`}>
                    <Icon size={15} />
                  </button>
                ))}
              </div>
            </div>

            {/* formatting toolbar */}
            {(mode === 'edit' || mode === 'split') && (
              <div className="flex flex-wrap items-center gap-1 mt-2.5" aria-label="Formatting toolbar">
                {toolbar.map(({ icon: Icon, label, fn }) => (
                  <button key={label} title={label} aria-label={label} onClick={fn} className="btn !px-2 !py-1.5"><Icon size={14} /></button>
                ))}
                <span className="text-[11px] text-muted ml-auto hidden lg:inline">Tip: paste screenshots with Ctrl+V, or drag &amp; drop images</span>
              </div>
            )}

            <input
              ref={imageRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple className="hidden"
              aria-label="Attach images"
              onChange={(e) => { void uploadAndInsertImages(e.target.files ?? []); if (imageRef.current) imageRef.current.value = ''; }}
            />
            <div className={`grid gap-4 mt-3 ${mode === 'split' ? 'xl:grid-cols-2' : ''}`}>
              {(mode === 'edit' || mode === 'split') && (
                <textarea
                  ref={textareaRef}
                  aria-label="Markdown editor"
                  className="input min-h-[480px] xl:min-h-[600px] font-mono !text-sm !leading-[1.8] !p-4 resize-y"
                  placeholder={'# Heading\n\nWrite Markdown… **bold**, *italic*, - lists, - [ ] tasks, > quotes, tables, `code`.\n\nPaste screenshots (Ctrl+V) or drag & drop images to attach them.'}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onPaste={onEditorPaste}
                  onDrop={onEditorDrop}
                  onDragOver={(e) => e.preventDefault()}
                />
              )}
              {(mode === 'preview' || mode === 'split') && (
                <div className="rounded-xl border border-border bg-surface2/40 px-5 py-4 min-h-[480px] xl:min-h-[600px] max-h-[75vh] overflow-y-auto text-[15px] leading-[1.85]">
                  <MarkdownView content={content} />
                </div>
              )}
            </div>

            {/* status bar */}
            <div className="mt-2.5 flex items-center gap-2 text-[11px] text-muted flex-wrap">
              <span className={`inline-flex items-center gap-1.5 ${saveState === 'error' ? 'text-red-300' : saveState === 'saving' ? 'text-text' : ''}`}>
                {saveState === 'saving' ? <span className="w-2 h-2 rounded-full bg-text animate-pulse" /> :
                  saveState === 'error' ? <span className="w-2 h-2 rounded-full bg-red-400" /> :
                    <Check size={12} className="text-accent" />}
                {saveLabel}
                {lastSavedAt && saveState !== 'saving' && ` · edited ${new Date(lastSavedAt).toLocaleString()}`}
              </span>
              <span aria-hidden>·</span>
              <span>{countWords(content)} words</span>
              {uploading > 0 && (
                <span className="inline-flex items-center gap-1.5 text-text">
                  <span className="w-2 h-2 rounded-full bg-text animate-pulse" />
                  Uploading {uploading} image{uploading === 1 ? '' : 's'}…
                </span>
              )}
              {saveState === 'error' && (
                <button className="btn !py-1 !px-2 !text-[11px]" onClick={retrySave}>Retry save</button>
              )}
              <span className="flex-1" />
              <span className="hidden sm:inline">Autosaves ~1s after typing</span>
            </div>

            {/* actions */}
            <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-border pt-2.5">
              <button className="btn !py-1.5 !text-xs" title={selected.is_pinned ? 'Unpin' : 'Pin'} onClick={() => pinMut.mutate({ id: selected.id, pinned: !selected.is_pinned })}>
                {selected.is_pinned ? <PinOff size={13} /> : <Pin size={13} />} {selected.is_pinned ? 'Unpin' : 'Pin'}
              </button>
              <button className="btn !py-1.5 !text-xs" onClick={() => dupMut.mutate(selected)}><Copy size={13} /> Duplicate</button>
              <button className="btn !py-1.5 !text-xs" onClick={() => exportMd(selected)}><Download size={13} /> Export .md</button>
              <button className="btn !py-1.5 !text-xs" title="Open existing vault file (no sync of unsaved edits)" onClick={() => openInObsidian(selected, 'open')}><ExternalLink size={13} /> Open in Obsidian</button>
              <button className="btn !py-1.5 !text-xs" title="Create as new vault note via URI" onClick={() => openInObsidian(selected, 'new')}><Plus size={13} /> Send to Obsidian</button>
              <button className="btn !py-1.5 !text-xs" onClick={() => setImportOpen(true)}><Upload size={13} /> Import</button>
              <span className="flex-1" />
              <button className="btn !py-1.5 !text-xs hover:!border-red-400/60 hover:text-red-200" onClick={() => setConfirmDelete(selected)}><Trash2 size={13} /> Delete</button>
            </div>
          </div>
        )}
      </div>

      {/* ---- Delete confirmation ---- */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" role="alertdialog" aria-modal="true" aria-label="Delete note">
          <div className="absolute inset-0 bg-black/60" onClick={() => setConfirmDelete(null)} />
          <div className="relative card p-5 max-w-sm w-full">
            <h3 className="font-medium text-sm">Delete “{confirmDelete.title}”?</h3>
            <p className="text-xs text-muted mt-1">This cannot be undone. The local Obsidian copy (if any) is untouched.</p>
            <div className="flex gap-2 mt-4 justify-end">
              <button className="btn" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn !border-red-400/60 !text-red-200" disabled={delMut.isPending} onClick={doDelete}>
                {delMut.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Import dialog ---- */}
      {importOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="Import Markdown">
          <div className="absolute inset-0 bg-black/60" onClick={() => setImportOpen(false)} />
          <div className="relative card p-5 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">Import Markdown (.md)</h3>
              <button aria-label="Close import" className="btn !px-2 !py-1" onClick={() => setImportOpen(false)}><X size={15} /></button>
            </div>
            <p className="text-xs text-muted mt-1">UTF-8 .md files up to {IMPORT_MAX_BYTES / 1024} KB. Preview before import — existing notes are never overwritten.</p>
            <input ref={fileRef} type="file" accept=".md,.markdown,text/markdown" className="hidden" onChange={(e) => void onPickImport(e.target.files?.[0])} />
            <button className="btn mt-3" onClick={() => fileRef.current?.click()}><Upload size={14} /> Choose .md file</button>
            {importErr && <p className="text-xs text-red-300 mt-2">{importErr}</p>}
            {(importText || importTitle) && !importErr && (
              <div className="mt-3 space-y-2">
                <div>
                  <label className="label">Title</label>
                  <input className="input" value={importTitle} maxLength={200} onChange={(e) => setImportTitle(e.target.value)} />
                </div>
                <div>
                  <label className="label">Preview ({countWords(importText)} words)</label>
                  <div className="rounded-xl border border-border bg-surface2/40 p-3 max-h-56 overflow-y-auto text-sm">
                    <MarkdownView content={importText.slice(0, 8000)} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  <button className="btn" onClick={() => doImport(false)}><Plus size={14} /> Import as independent note</button>
                  <button className="btn btn-primary" onClick={() => doImport(true)}><Plus size={14} /> Import into current topic</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
