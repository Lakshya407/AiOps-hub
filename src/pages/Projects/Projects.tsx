import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { fetchProjects, fetchMilestones, setMilestoneStatus, updateProject, createProject, deleteProject } from '@/services/tracking';
import { fetchSkills } from '@/services/roadmap';
import { fetchDocuments, uploadDocument } from '@/services/documents';
import DocumentList from '@/components/documents/DocumentList';
import { useRef, useState } from 'react';
import { Check, ExternalLink, Plus, Tag, Trash2, Upload, X } from 'lucide-react';

export default function Projects() {
  const qc = useQueryClient();
  const projQ = useQuery({ queryKey: ['projects'], queryFn: fetchProjects });
  const msQ = useQuery({ queryKey: ['project_milestones'], queryFn: fetchMilestones });
  const skillsQ = useQuery({ queryKey: ['skills'], queryFn: fetchSkills });
  const docsQ = useQuery({ queryKey: ['documents'], queryFn: fetchDocuments });

  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [repo, setRepo] = useState('');
  const [demo, setDemo] = useState('');
  const [editSkills, setEditSkills] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // New-project form state
  const [nTitle, setNTitle] = useState('');
  const [nDesc, setNDesc] = useState('');
  const [nMonth, setNMonth] = useState('');
  const [nRepo, setNRepo] = useState('');
  const [nDemo, setNDemo] = useState('');
  const [nSkills, setNSkills] = useState<string[]>([]);
  const [nMiles, setNMiles] = useState('');

  const mut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => setMilestoneStatus(id, status),
    onSettled: () => qc.invalidateQueries({ queryKey: ['project_milestones'] }),
  });

  const projects = (projQ.data as any[]) ?? [];
  const miles = (msQ.data as any[]) ?? [];
  const skills = ((skillsQ.data as any[]) ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
  const docs = (docsQ.data as any[]) ?? [];
  const skillName = (id: string) => skills.find((s: any) => s.id === id)?.title ?? 'Skill';

  const toggle = (list: string[], id: string, set: (v: string[]) => void) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const saveNew = async () => {
    if (!nTitle.trim()) { setErr('Title is required.'); return; }
    setBusy('new'); setErr(null);
    try {
      await createProject({
        title: nTitle.trim(),
        description: nDesc.trim(),
        month_number: nMonth ? Number(nMonth) : null,
        repository_url: nRepo.trim(),
        demo_url: nDemo.trim(),
        skill_ids: nSkills,
        milestones: nMiles.split('\n'),
      });
      setNTitle(''); setNDesc(''); setNMonth(''); setNRepo(''); setNDemo(''); setNSkills([]); setNMiles('');
      setShowNew(false);
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['project_milestones'] });
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(null); }
  };

  const putFiles = async (projectId: string, files: FileList | null) => {
    if (!files?.length) return;
    setBusy(projectId); setErr(null);
    try {
      for (const f of Array.from(files)) {
        await uploadDocument(f, { title: f.name, project_id: projectId });
      }
      qc.invalidateQueries({ queryKey: ['documents'] });
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(null); const el = fileRefs.current[projectId]; if (el) el.value = ''; }
  };

  const loading = projQ.isLoading || msQ.isLoading;
  if (loading) return <p className="text-sm text-muted">Loading projects…</p>;

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-lg font-semibold">Projects</h1>
          <p className="text-sm text-muted">Milestone timelines. Link GitHub repos and demos, tag skills, attach files.</p>
        </div>
        <button className="btn btn-primary whitespace-nowrap" onClick={() => setShowNew((v) => !v)}>
          {showNew ? <X size={15} /> : <Plus size={15} />} {showNew ? 'Close' : 'New project'}
        </button>
      </div>
      {err && <p className="text-xs text-red-300 mt-2">{err}</p>}

      {showNew && (
        <div className="card p-4 mt-4 space-y-3">
          <div>
            <label className="label">Title *</label>
            <input className="input" placeholder="e.g. K8s monitoring stack" value={nTitle} onChange={(e) => setNTitle(e.target.value)} />
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" placeholder="What does it demonstrate?" value={nDesc} onChange={(e) => setNDesc(e.target.value)} />
          </div>
          <div className="grid sm:grid-cols-3 gap-2">
            <div>
              <label className="label">Month</label>
              <select className="input" value={nMonth} onChange={(e) => setNMonth(e.target.value)}>
                <option value="">—</option>
                {[1, 2, 3, 4, 5, 6].map((m) => <option key={m} value={m}>Month {m}</option>)}
              </select>
            </div>
            <div className="sm:col-span-1">
              <label className="label">GitHub repo URL</label>
              <input className="input" placeholder="https://github.com/…" value={nRepo} onChange={(e) => setNRepo(e.target.value)} />
            </div>
            <div className="sm:col-span-1">
              <label className="label">Demo URL</label>
              <input className="input" placeholder="https://…" value={nDemo} onChange={(e) => setNDemo(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Tagged skills</label>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto card !rounded-xl p-2.5">
              {skills.map((s: any) => (
                <button key={s.id} type="button" onClick={() => toggle(nSkills, s.id, setNSkills)}
                  className={`badge !py-1 cursor-pointer transition ${nSkills.includes(s.id) ? '!text-text !border-accent bg-accentDim/30' : 'hover:text-text'}`}>
                  {s.title}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Milestones (one per line)</label>
            <textarea className="input" rows={3} placeholder={'Deploy Prometheus\nBuild Grafana dashboard'} value={nMiles} onChange={(e) => setNMiles(e.target.value)} />
          </div>
          <button className="btn btn-primary justify-center" disabled={busy === 'new'} onClick={saveNew}>
            {busy === 'new' ? 'Saving…' : 'Create project'}
          </button>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {projects.length === 0 && !showNew && (
          <div className="card p-5 text-sm text-muted">No projects yet — click “New project” to add one with repo links, skill tags and files.</div>
        )}
        {projects.map((p) => {
          const ms = miles.filter((m) => m.project_id === p.id);
          const done = ms.filter((m) => m.status === 'completed').length;
          const pDocs = docs.filter((d: any) => d.project_id === p.id);
          const pSkills: string[] = p.skill_ids ?? [];
          return (
            <div key={p.id} className="card p-4">
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-medium flex-1">{p.title}</h2>
                {p.month_number ? <span className="badge">M{p.month_number}</span> : null}
                <span className="badge">{done}/{ms.length}</span>
              </div>
              {p.description && <p className="text-sm text-muted mt-1">{p.description}</p>}
              {pSkills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {pSkills.map((id) => (
                    <span key={id} className="badge inline-flex items-center gap-1"><Tag size={11} />{skillName(id)}</span>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-3 mt-2 text-xs">
                {p.repository_url ? <a href={p.repository_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted hover:text-text"><ExternalLink size={12} /> Repo</a> : null}
                {p.demo_url ? <a href={p.demo_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted hover:text-text"><ExternalLink size={12} /> Demo</a> : null}
                <button className="text-muted hover:text-text" onClick={() => { setEditing(p.id); setRepo(p.repository_url ?? ''); setDemo(p.demo_url ?? ''); setEditSkills(pSkills); }}>Edit links & skills</button>
                <button className="text-muted hover:text-red-300 inline-flex items-center gap-1" onClick={async () => {
                  if (!confirm(`Delete "${p.title}" and its milestones? Files stay in Documents.`)) return;
                  await deleteProject(p.id);
                  qc.invalidateQueries({ queryKey: ['projects'] });
                  qc.invalidateQueries({ queryKey: ['project_milestones'] });
                }}><Trash2 size={12} /> Delete</button>
              </div>
              {editing === p.id && (
                <div className="mt-2 space-y-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input className="input" placeholder="Repository URL (GitHub)" value={repo} onChange={(e) => setRepo(e.target.value)} />
                    <input className="input" placeholder="Demo URL" value={demo} onChange={(e) => setDemo(e.target.value)} />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {skills.map((s: any) => (
                      <button key={s.id} type="button" onClick={() => toggle(editSkills, s.id, setEditSkills)}
                        className={`badge !py-1 cursor-pointer transition ${editSkills.includes(s.id) ? '!text-text !border-accent bg-accentDim/30' : 'hover:text-text'}`}>
                        {s.title}
                      </button>
                    ))}
                  </div>
                  <button className="btn btn-primary" onClick={async () => {
                    await updateProject(p.id, { repository_url: repo, demo_url: demo, skill_ids: editSkills });
                    setEditing(null);
                    qc.invalidateQueries({ queryKey: ['projects'] });
                  }}>Save</button>
                </div>
              )}
              <ol className="mt-3 relative border-l border-border ml-1.5 pl-4 space-y-2">
                {ms.map((m) => (
                  <li key={m.id} className="flex items-start gap-2">
                    <button aria-label={`Toggle ${m.title}`} onClick={() => mut.mutate({ id: m.id, status: m.status === 'completed' ? 'not_started' : 'completed' })}
                      className={`mt-0.5 w-[18px] h-[18px] rounded-md border grid place-items-center ${m.status === 'completed' ? 'bg-accent border-accent text-ink' : 'border-muted/50 text-transparent'}`}>
                      <Check size={12} strokeWidth={3} />
                    </button>
                    <span className={`text-sm ${m.status === 'completed' ? 'text-muted line-through' : ''}`}>{m.title}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-3 border-t border-border pt-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted flex-1">Project files ({pDocs.length}) — code zips, configs, screenshots</span>
                  <button className="btn !py-1.5 text-xs whitespace-nowrap" disabled={busy === p.id}
                    onClick={() => fileRefs.current[p.id]?.click()}>
                    <Upload size={13} /> {busy === p.id ? 'Uploading…' : 'Upload files'}
                  </button>
                  <input ref={(el) => { fileRefs.current[p.id] = el; }} type="file" multiple className="hidden"
                    accept=".pdf,.docx,.md,.txt,.png,.jpg,.jpeg,.zip,.yml,.yaml,.json"
                    onChange={(e) => putFiles(p.id, e.target.files)} />
                </div>
                {pDocs.length > 0 && (
                  <div className="mt-2"><DocumentList docs={pDocs} onChanged={() => qc.invalidateQueries({ queryKey: ['documents'] })} /></div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
