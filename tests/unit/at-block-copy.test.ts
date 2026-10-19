import { describe, expect, it } from 'vitest';
import { atBlockAbsenceDetail } from '@/lib/at-block-copy';

describe('atBlockAbsenceDetail', () => {
  it('says ALIVE when the canary was present at that block', () => {
    const out = atBlockAbsenceDetail({ hourAgo: 100n, pastAlive: true, createdAt: 50n });
    expect(out.ok).toBe(true);
    expect(out.detail).toBe('ALIVE at block 100.');
  });

  it('says the canary did not exist yet when it was created after the hour-ago block', () => {
    const out = atBlockAbsenceDetail({ hourAgo: 100n, pastAlive: false, createdAt: 150n });
    expect(out.ok).toBe(true);
    expect(out.detail).toContain('did not exist yet about an hour ago');
    expect(out.detail).toContain('created at block 150');
    expect(out.detail).not.toMatch(/GONE/);
    expect(out.detail).not.toMatch(/[\u2013\u2014]/);
  });

  it('says GONE when an older canary was missing at that block', () => {
    const out = atBlockAbsenceDetail({ hourAgo: 100n, pastAlive: false, createdAt: 40n });
    expect(out.ok).toBe(false);
    expect(out.detail).toBe('GONE at block 100.');
  });

  it('says GONE when createdAt is unknown', () => {
    const out = atBlockAbsenceDetail({ hourAgo: 100n, pastAlive: false });
    expect(out.ok).toBe(false);
    expect(out.detail).toBe('GONE at block 100.');
  });
});
