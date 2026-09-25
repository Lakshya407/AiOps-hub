/** Streak: consecutive days with >=1 completed session/log, rest days (no tasks) don't break. */
export function computeStreak(activeDates: string[], restDates: string[] = []): number {
  const active = new Set(activeDates);
  const rest = new Set(restDates);
  let streak = 0;
  const d = new Date();
  // if today inactive and not rest, start from yesterday
  const key = (x: Date) => x.toISOString().slice(0, 10);
  if (!active.has(key(d)) && !rest.has(key(d))) d.setDate(d.getDate() - 1);
  while (true) {
    const k = key(d);
    if (active.has(k)) { streak += 1; d.setDate(d.getDate() - 1); continue; }
    if (rest.has(k)) { d.setDate(d.getDate() - 1); continue; }
    break;
  }
  return streak;
}

export function weeklyActivity(sessions: { started_at: string; duration_minutes: number }[]): { day: string; minutes: number }[] {
  const days: { day: string; minutes: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = d.toISOString().slice(0, 10);
    const mins = sessions.filter((s) => (s.started_at ?? '').slice(0, 10) === k).reduce((a, s) => a + (s.duration_minutes || 0), 0);
    days.push({ day: k.slice(5), minutes: mins });
  }
  return days;
}
