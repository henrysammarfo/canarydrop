import { describe, expect, it } from 'vitest';
import { StaleCache } from '@/lib/read-cache';

describe('StaleCache', () => {
  it('coalesces in-flight loads into one call', async () => {
    let n = 0;
    const cache = new StaleCache({ freshMs: 1_000, staleMs: 10_000 });
    const load = () =>
      new Promise<string>((resolve) => {
        n += 1;
        setTimeout(() => resolve('ok'), 20);
      });
    const [a, b] = await Promise.all([cache.get('k', load), cache.get('k', load)]);
    expect(n).toBe(1);
    expect(a.value).toBe('ok');
    expect(b.value).toBe('ok');
    expect(a.stale).toBe(false);
  });

  it('returns the last good value when a later load 429s', async () => {
    const cache = new StaleCache({ freshMs: 1, staleMs: 60_000 });
    await cache.get('desk', async () => 'live');
    await new Promise((r) => setTimeout(r, 5));
    const stale = await cache.get('desk', async () => {
      throw new Error('429 ANON_COST_LIMITED');
    });
    expect(stale.value).toBe('live');
    expect(stale.stale).toBe(true);
  });

  it('uses fallback when there is no last good value', async () => {
    const cache = new StaleCache({ freshMs: 1_000, staleMs: 10_000 });
    const out = await cache.get(
      'desk',
      async () => {
        throw new Error('HTTP 429');
      },
      { fallback: () => 'empty' },
    );
    expect(out.value).toBe('empty');
    expect(out.stale).toBe(false);
  });
});
