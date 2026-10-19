/** Monotonic counter so in-flight UI loads can ignore a stale response. */
export type LoadGeneration = { current: number };

export function bumpGeneration(box: LoadGeneration): number {
  box.current += 1;
  return box.current;
}

export function isStaleGeneration(started: number, current: number): boolean {
  return started !== current;
}
