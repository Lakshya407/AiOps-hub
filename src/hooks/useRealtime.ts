import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';

/** Subscribes to realtime changes and invalidates TanStack caches. Returns online/saving state. */
export function useRealtimeSync() {
  const qc = useQueryClient();
  const [online, setOnline] = useState(navigator.onLine);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => {
    const tables = ['topic_progress', 'notes', 'documents', 'study_sessions', 'projects', 'project_milestones', 'daily_logs', 'revision_items'];
    // Unique name per mount: StrictMode double-invokes effects in dev.
    // Reusing same name returns the already-subscribed channel, and .on() after .subscribe() throws.
    const channel = supabase.channel(`rt-hub-${Math.random().toString(36).slice(2)}`);
    tables.forEach((t) =>
      channel.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => {
        qc.invalidateQueries({ queryKey: [t] });
        if (t === 'topic_progress') { qc.invalidateQueries({ queryKey: ['topics'] }); qc.invalidateQueries({ queryKey: ['skills'] }); }
        if (t === 'project_milestones') qc.invalidateQueries({ queryKey: ['projects'] });
      })
    );
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  return { online, saving, setSaving };
}
