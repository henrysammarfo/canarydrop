import { describe, expect, it } from 'vitest';
import { DEFAULT_DESK } from '@/lib/constants';
import { demoDeadDrop, isDemoDropKey } from '@/lib/demo-drop';

describe('demo dead drop seed', () => {
  it('is held while the canary is alive', () => {
    const row = demoDeadDrop(true);
    expect(row.status).toBe('held');
    expect(row.deskCreator).toBe(DEFAULT_DESK);
    expect(row.text).toMatch(/fake sample text/);
    expect(isDemoDropKey(row.dropKey)).toBe(true);
  });

  it('releases when the canary is gone', () => {
    expect(demoDeadDrop(false).status).toBe('released');
  });

  it('treats an unknown canary as still held for the seed', () => {
    expect(demoDeadDrop(null).status).toBe('held');
  });
});
