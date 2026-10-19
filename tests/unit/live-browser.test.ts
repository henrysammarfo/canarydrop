import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_DESK } from '@/lib/constants';

vi.mock('@/lib/arkiv', () => ({
  deskAndCanary: vi.fn(async () => ({
    desk: { key: `0x${'ab'.repeat(32)}`, payload: new TextEncoder().encode(JSON.stringify({ name: 'Demo', pub: Array(65).fill(1) })) },
    canary: { key: `0x${'cd'.repeat(32)}`, expiresAt: 10n, createdAt: 1n },
    currentBlock: 9n,
    blockDuration: 2,
  })),
  explorerPage: vi.fn(async () => ({
    entities: [],
    cursor: undefined,
    blockNumber: 9n,
    hasNextPage: () => false,
  })),
  inboxPage: vi.fn(async () => ({
    entities: [],
    cursor: undefined,
    blockNumber: 9n,
    hasNextPage: () => false,
  })),
}));

describe('browser live reads', () => {
  it('serializes a desk snapshot', async () => {
    const { browserDeskLive } = await import('@/lib/live-browser');
    const live = await browserDeskLive(DEFAULT_DESK);
    expect(live.ok).toBe(true);
    expect(live.name).toBe('Demo');
    expect(live.alive).toBe(true);
    expect(live.currentBlock).toBe('9');
  });
});
