import { describe, expect, it } from 'vitest';
import { SlidingWindow, allowIp } from '@/lib/rate-limit';

describe('sliding window', () => {
  it('allows the first request', () => {
    const w = new SlidingWindow(1000, 2);
    expect(w.allow('a', 0)).toBe(true);
  });

  it('counts up to max', () => {
    const w = new SlidingWindow(1000, 2);
    expect(w.allow('a', 0)).toBe(true);
    expect(w.allow('a', 1)).toBe(true);
    expect(w.allow('a', 2)).toBe(false);
  });

  it('isolates keys', () => {
    const w = new SlidingWindow(1000, 1);
    expect(w.allow('a', 0)).toBe(true);
    expect(w.allow('b', 0)).toBe(true);
    expect(w.allow('a', 1)).toBe(false);
  });

  it('treats empty as missing', () => {
    const w = new SlidingWindow(1000, 1);
    expect(w.allow('', 0)).toBe(true);
    expect(w.allow('', 1)).toBe(false);
    expect(w.peek('missing')?.count).toBe(1);
  });

  it('resets after the window', () => {
    const w = new SlidingWindow(10, 1);
    expect(w.allow('a', 0)).toBe(true);
    expect(w.allow('a', 5)).toBe(false);
    expect(w.allow('a', 10)).toBe(true);
  });

  it('reset clears buckets', () => {
    const w = new SlidingWindow(1000, 1);
    w.allow('a', 0);
    w.reset();
    expect(w.allow('a', 1)).toBe(true);
  });
});

describe('allowIp memory path', () => {
  it('allows then fills the process window', async () => {
    const ip = '198.51.100.99';
    for (let i = 0; i < 8; i++) {
      expect(await allowIp('relay', ip)).toBe(true);
    }
    expect(await allowIp('relay', ip)).toBe(false);
    expect(await allowIp('relay', '198.51.100.100')).toBe(true);
  });
});
