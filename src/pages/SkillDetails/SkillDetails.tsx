import { useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Upload } from 'lucide-react';
import { fetchSkills, fetchTopicsBySkill, fetchProgress } from '@/services/roadmap';
import { fetchDocuments, uploadDocument } from '@/services/documents';
import { fetchProjects } from '@/services/tracking';
import { progressOf } from '@/lib/utils/progress';
import ProgressBar from '@/components/progress/ProgressBar';
import TopicTree from '@/components/topics/TopicTree';
import DocumentList from '@/components/documents/DocumentList';
import { useQueryClient } from '@tanstack/react-query';

export default function SkillDetails() {
  const { id } = useParams();
  const qc = useQueryClient();
  const skillsQ = useQuery({ queryKey: ['skills'], queryFn: fetchSkills });
  const topicsQ = useQuery({ queryKey: ['topics', id], queryFn: () => fetchTopicsBySkill(id!), enabled: !!id });
  const progQ = useQuery({ queryKey: ['topic_progress'], queryFn: fetchProgress });
  const docsQ = useQuery({ queryKey: ['documents'], queryFn: fetchDocuments });
  const projQ = useQuery({ queryKey: ['projects'], queryFn: fetchProjects });

  const skill = (skillsQ.data as any[])?.find((s) => s.id === id);
  const topicsAll = (topicsQ.data as any[]) ?? [];
  const pmap = new Map(((progQ.data as any[]) ?? []).map((p: any) => [p.topic_id, p]));
  const p = progressOf(topicsAll, pmap);
  const docs = ((docsQ.data as any[]) ?? []).filter((d) => d.skill_id === id || topicsAll.some((t) => t.id === d.topic_id));
  const linkedProjects = ((projQ.data as any[]) ?? []).filter((p: any) => (p.skill_ids ?? []).includes(id));

  const [topicId, setTopicId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const put = async (files: FileList | null) => {
    if (!files?.length || !id) return;
    setBusy(true); setErr(null);
    try {
      for (const f of Array.from(files)) {
        await uploadDocument(f, { title: f.name, skill_id: id, topic_id: topicId || null });
      }
      qc.invalidateQueries({ queryKey: ['documents'] });
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  if (!skill) return <div><Link to="/" className="btn mb-4"><ArrowLeft size={15} /> Roadmap</Link><p className="text-sm text-muted">Loading skill…</p></div>;

  return (
    <div>
      <Link to="/" className="btn mb-4"><ArrowLeft size={15} /> Roadmap</Link>
      <h1 className="text-lg font-semibold">{skill.title}</h1>
      {skill.description && <p className="text-sm text-muted mt-1">{skill.description}</p>}
      <div className="mt-3 flex items-center gap-3 text-xs text-muted">
        <span>{p.completed}/{p.total} topics</span><span>{p.status}</span><span>{skill.estimated_hours}h est.</span>
      </div>
      <div className="mt-2"><ProgressBar percent={p.percent} /></div>

      <section className="mt-6">
        <h2 className="text-sm font-medium mb-2">Topics</h2>
        <div className="card p-4"><TopicTree topics={topicsAll} progressMap={pmap} /></div>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-medium mb-2">Documents</h2>
        <div className="card p-4 mb-3">
          <div className="text-sm">Upload linked to this skill</div>
          <p className="text-xs text-muted mt-0.5">Pick a topic to map the files, or leave on whole skill. PDF, DOCX, MD, TXT, PNG, JPG · 25 MB max.</p>
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <select value={topicId} onChange={(e) => setTopicId(e.target.value)} className="input flex-1">
              <option value="">Whole skill — no specific topic</option>
              {topicsAll.map((t: any) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
            <button className="btn btn-primary justify-center whitespace-nowrap" disabled={busy} onClick={() => fileRef.current?.click()}>
              <Upload size={15} /> {busy ? 'Uploading…' : 'Choose files'}
            </button>
          </div>
          <input ref={fileRef} type="file" multiple className="hidden" accept=".pdf,.docx,.md,.txt,.png,.jpg,.jpeg" onChange={(e) => put(e.target.files)} />
          {err && <p className="text-xs text-red-300 mt-2">{err}</p>}
        </div>
        <DocumentList docs={docs} topics={topicsAll} onChanged={() => qc.invalidateQueries({ queryKey: ['documents'] })} />
      </section>

      {linkedProjects.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-medium mb-2">Projects using this skill</h2>
          <div className="space-y-2">
            {linkedProjects.map((p: any) => (
              <Link key={p.id} to="/projects" className="card px-3.5 py-3 block hover:border-muted/60 transition">
                <div className="text-sm font-medium">{p.title}</div>
                {p.description && <div className="text-xs text-muted mt-0.5 truncate">{p.description}</div>}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
