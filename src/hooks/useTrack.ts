import { useState } from 'react';
import type { SeedTrack } from '@/services/roadmap';
import { TRACKS } from '@/services/roadmap';

export type TrackFilter = 'all' | SeedTrack;

export const TRACK_LABEL: Record<SeedTrack, string> = {
  aiops: TRACKS.aiops.label,
  onprem: TRACKS.onprem.label,
};

/** Track stored on curriculum rows; pre-0010 rows have no column -> 'aiops'. */
export function trackOf(row: any): SeedTrack {
  return row?.track === 'onprem' ? 'onprem' : 'aiops';
}

export function seededTracks(skills: any[]): SeedTrack[] {
  const set = new Set<SeedTrack>();
  for (const s of skills ?? []) set.add(trackOf(s));
  return (['aiops', 'onprem'] as SeedTrack[]).filter((t) => set.has(t));
}

export function missingTracks(skills: any[]): SeedTrack[] {
  const have = new Set(seededTracks(skills));
  return (['aiops', 'onprem'] as SeedTrack[]).filter((t) => !have.has(t));
}

const KEY = 'activeTrack';

/** Persisted track filter shared by Roadmap + Dashboard. */
export function useTrack(): { track: TrackFilter; select: (t: TrackFilter) => void } {
  const [track, setTrack] = useState<TrackFilter>(() => {
    try {
      const v = localStorage.getItem(KEY);
      return v === 'aiops' || v === 'onprem' || v === 'all' ? (v as TrackFilter) : 'all';
    } catch {
      return 'all';
    }
  });
  const select = (t: TrackFilter) => {
    setTrack(t);
    try { localStorage.setItem(KEY, t); } catch { /* ignore */ }
  };
  return { track, select };
}
