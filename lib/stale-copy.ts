/** Calm note when a page is serving the last good chain snapshot. */
export function showingDataFrom(ageMs: number): string {
  const sec = Math.max(1, Math.round(ageMs / 1000));
  if (sec < 90) {
    return sec === 1 ? 'Showing data from 1 second ago.' : `Showing data from ${sec} seconds ago.`;
  }
  const min = Math.max(1, Math.round(sec / 60));
  return min === 1 ? 'Showing data from 1 minute ago.' : `Showing data from ${min} minutes ago.`;
}

export function annotateStale<T extends { fetchedAt: number; stale: boolean; staleAgeMs: number; note: string | null }>(
  value: T,
  at: number,
  stale: boolean,
  now = Date.now(),
): T {
  const staleAgeMs = Math.max(0, now - at);
  return {
    ...value,
    fetchedAt: at,
    stale,
    staleAgeMs,
    note: stale ? showingDataFrom(staleAgeMs) : value.note,
  };
}
