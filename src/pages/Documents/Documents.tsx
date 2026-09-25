import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Upload } from 'lucide-react';
import { fetchDocuments, uploadDocument } from '@/services/documents';
import DocumentList from '@/components/documents/DocumentList';
import type { DocRow } from '@/types';

export default function Documents() {
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const q = (params.get('q') ?? '').toLowerCase();
  const docsQ = useQuery({ queryKey: ['documents'], queryFn: fetchDocuments });
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const docs = ((docsQ.data as DocRow[]) ?? []).filter((d) =>
    !q || d.title.toLowerCase().includes(q) || (d.tags ?? []).join(' ').toLowerCase().includes(q));

  const put = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setErr(null);
    try {
      for (const f of Array.from(files)) {
        await uploadDocument(f, { title: f.name, tags: [] });
      }
      qc.invalidateQueries({ queryKey: ['documents'] });
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <h1 className="text-lg font-semibold">Documents</h1>
      <p className="text-sm text-muted">Private storage · signed URLs · 25 MB max · PDF, DOCX, MD, TXT, PNG, JPG.</p>
      <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); put(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}
        className={`card mt-4 p-8 text-center cursor-pointer transition ${drag ? 'border-muted' : ''}`}>
        <Upload size={20} className="mx-auto text-muted" />
        <div className="text-sm mt-2">{busy ? 'Uploading…' : 'Drag & drop or click to upload'}</div>
        <input ref={fileRef} type="file" multiple className="hidden" accept=".pdf,.docx,.md,.txt,.png,.jpg,.jpeg" onChange={(e) => put(e.target.files)} />
      </div>
      {err && <p className="text-xs text-red-300 mt-2">{err}</p>}
      <div className="mt-4"><DocumentList docs={docs} onChanged={() => qc.invalidateQueries({ queryKey: ['documents'] })} /></div>
    </div>
  );
}
