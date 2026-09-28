import { useState } from 'react';
import { FileText, Download, Trash2, Eye, Tag } from 'lucide-react';
import { fmtBytes } from '@/lib/utils/format';
import { signedUrl, deleteDocument } from '@/services/documents';
import type { DocRow } from '@/types';

export default function DocumentList({ docs, topics, onChanged }: { docs: DocRow[]; topics?: { id: string; title: string }[]; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const topicOf = (id: string | null) => (topics ?? []).find((t) => t.id === id)?.title;
  if (!docs.length) return <p className="text-sm text-muted">No documents yet. Upload files linked to this skill or a specific topic below.</p>;
  return (
    <div className="space-y-2">
      {docs.map((d) => (
        <div key={d.id} className="card px-3.5 py-3 flex items-center gap-3">
          <FileText size={17} className="text-muted shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-sm truncate">{d.title}</div>
            <div className="text-[11px] text-muted">{fmtBytes(d.size_bytes)} · {(d.mime_type || '').split('/')[1] ?? 'file'}</div>
            {d.topic_id && topicOf(d.topic_id) && (
              <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-accent"><Tag size={11} />{topicOf(d.topic_id)}</div>
            )}
          </div>
          <button className="btn !px-2.5" title="Preview / download" onClick={async () => {
            setBusy(d.id);
            try { const url = await signedUrl(d.file_path); window.open(url, '_blank'); } finally { setBusy(null); }
          }}><Eye size={15} /></button>
          <a className="btn !px-2.5" title="Download" href="#" onClick={async (e) => {
            e.preventDefault(); setBusy(d.id);
            try {
              const url = await signedUrl(d.file_path);
              const a = document.createElement('a'); a.href = url; a.download = d.title; a.click();
            } finally { setBusy(null); }
          }}><Download size={15} /></a>
          <button className="btn !px-2.5" title="Delete" onClick={async () => {
            if (!confirm(`Delete "${d.title}"?`)) return;
            setBusy(d.id); setErr(null);
            try {
              const { storageWarning } = await deleteDocument(d.id, d.file_path);
              if (storageWarning) setErr(storageWarning);
            } catch (e: any) {
              setErr(e?.message ?? 'Delete failed.');
            } finally {
              setBusy(null);
              onChanged(); // always refresh: the row may be gone even on partial failure
            }
          }}><Trash2 size={15} /></button>
          {busy === d.id && <span className="text-[11px] text-muted">…</span>}
        </div>
      ))}
      {err && <p className="text-xs text-red-300">{err}</p>}
    </div>
  );
}
