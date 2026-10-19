import { describe, expect, it } from 'vitest';
import {
  blocksToPhrase,
  canaryLifeBlocks,
  canaryRemainingRatio,
  lastRenewedPhrase,
  remainingPhrase,
  secondsToPhrase,
} from '@/lib/time';

describe('time phrases', () => {
  it('describes remaining seconds without dashes', () => {
    expect(secondsToPhrase(30)).toBe('in under a minute');
    expect(secondsToPhrase(120)).toBe('in 2 minutes');
    expect(secondsToPhrase(3600)).toBe('in 1 hour');
    expect(secondsToPhrase(6 * 86400)).toBe('in 6 days');
  });

  it('describes elapsed seconds', () => {
    expect(secondsToPhrase(20, { ago: true })).toBe('just now');
    expect(secondsToPhrase(3 * 3600, { ago: true })).toBe('3 hours ago');
  });

  it('maps expiry blocks to a phrase from the current head', () => {
    expect(remainingPhrase(1000n, 1000n, 2)).toBe('Expired');
    expect(remainingPhrase(1000n + 3n * 86400n / 2n, 1000n, 2)).toBe('in 3 days');
  });

  it('maps 26 hour canary lifetime back to last renew', () => {
    const duration = 2;
    const life = BigInt((26 * 3600) / duration);
    const current = 50_000n;
    const expires = current + life;
    expect(lastRenewedPhrase(expires, current, current, duration)).toBe('just now');
    expect(lastRenewedPhrase(null, null, current, duration)).toBe('Not renewed yet');
  });

  it('uses block duration when converting counts', () => {
    expect(blocksToPhrase(1800, 2)).toBe('in 1 hour');
  });

  it('reports how much of the 26 hour canary lifetime is left', () => {
    const duration = 2;
    const life = canaryLifeBlocks(duration);
    expect(life).toBe(46_800n);
    const current = 10_000n;
    expect(canaryRemainingRatio(current + life, current, duration)).toBe(1);
    expect(canaryRemainingRatio(current + life / 2n, current, duration)).toBe(0.5);
    expect(canaryRemainingRatio(current, current, duration)).toBe(0);
    expect(canaryRemainingRatio(current - 10n, current, duration)).toBe(0);
  });
});
