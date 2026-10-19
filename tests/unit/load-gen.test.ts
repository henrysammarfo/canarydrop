import { describe, expect, it } from 'vitest';
import { bumpGeneration, isStaleGeneration } from '@/lib/load-gen';

describe('explorer load generation', () => {
  it('marks an earlier in-flight load as stale after a newer load starts', () => {
    const box = { current: 0 };
    const first = bumpGeneration(box);
    const second = bumpGeneration(box);
    expect(isStaleGeneration(first, box.current)).toBe(true);
    expect(isStaleGeneration(second, box.current)).toBe(false);
    expect(first).toBe(1);
    expect(second).toBe(2);
  });

  it('does not treat the latest generation as stale', () => {
    const box = { current: 4 };
    const started = bumpGeneration(box);
    expect(isStaleGeneration(started, box.current)).toBe(false);
    expect(isStaleGeneration(started, started + 1)).toBe(true);
  });
});
