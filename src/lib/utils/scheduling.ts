import { SKILLS } from '@/data/curriculum';

/** Deterministic day plan: spread leaf topics across N days from start date. */
export function planForDay(startDate: string, dayIndex: number, perDay = 3): { skillKey: string; topicTitle: string }[] {
  const all: { skillKey: string; topicTitle: string }[] = [];
  for (const s of SKILLS) for (const t of s.topics) all.push({ skillKey: s.key, topicTitle: t.title });
  const start = dayIndex * perDay;
  return all.slice(start, start + perDay);
}

export function dayIndexSince(startDate: string, today = new Date()): number {
  const s = new Date(startDate + 'T00:00:00');
  const diff = Math.floor((today.getTime() - s.getTime()) / 86400000);
  return Math.max(0, diff);
}

export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${mm}-${dd}`;
}
