import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Hex } from 'viem';
import { DEFAULT_DESK } from '@/lib/constants';
import { hydrateDeskLive } from '@/lib/live-client';
import { mapExplorerEntity, serializeExplorerItem, hydrateExplorerItem } from '@/lib/explorer-map';

vi.mock('@/lib/arkiv', () => ({
  getDesk: vi.fn(),
  canaryAlive: vi.fn(),
  explorerPage: vi.fn(),
  inboxPage: vi.fn(),
  pub: () => ({
    getBlockTiming: async () => ({ currentBlock: 100n, blockDuration: 2 }),
  }),
}));

vi.mock('@/lib/demo-pub', () => ({
  preferPubForCreator: () => undefined,
}));

const { getDesk, canaryAlive } = await import('@/lib/arkiv');
const { loadDeskLive, clearLiveReadCache } = await import('@/lib/live-read');

afterEach(() => {
  clearLiveReadCache();
  vi.mocked(getDesk).mockReset();
  vi.mocked(canaryAlive).mockReset();
});

describe('desk live snapshot', () => {
  it('serializes bigint fields and hydrates them back', async () => {
    vi.mocked(getDesk).mockResolvedValue({
      key: `0x${'1f'.repeat(32)}` as Hex,
      creator: DEFAULT_DESK,
      expiresAt: 900n,
      payload: new TextEncoder().encode(JSON.stringify({ name: 'CanaryDrop Demo Desk', pub: Array.from({ length: 65 }, (_, i) => (i === 0 ? 4 : 1)) })),
      createdAt: 10n,
      toText: () => '',
      toJson: () => ({}),
    } as Awaited<ReturnType<typeof getDesk>>);
    vi.mocked(canaryAlive).mockResolvedValue({
      key: `0x${'3c'.repeat(32)}` as Hex,
      expiresAt: 200n,
      createdAt: 50n,
      owner: DEFAULT_DESK,
      creationFlags: { readonly: true, permissionlessExtension: false },
    } as Awaited<ReturnType<typeof canaryAlive>>);
    const live = await loadDeskLive(DEFAULT_DESK);
    expect(live.ok).toBe(true);
    expect(live.deskKey).toMatch(/^0x1f/);
    expect(live.canaryKey).toMatch(/^0x3c/);
    expect(live.alive).toBe(true);
    expect(live.name).toBe('CanaryDrop Demo Desk');
    expect(live.expiresAt).toBe('200');
    expect(live.createdAt).toBe('50');
    expect(live.currentBlock).toBe('100');
    const view = hydrateDeskLive(live);
    expect(view.expiresAt).toBe(200n);
    expect(view.createdAt).toBe(50n);
    expect(view.currentBlock).toBe(100n);
    expect(view.deskPub?.[0]).toBe(4);
  });

  it('returns a null desk without throwing when none is live', async () => {
    vi.mocked(getDesk).mockResolvedValue(undefined);
    const live = await loadDeskLive(DEFAULT_DESK, { fresh: true });
    expect(live.deskKey).toBeNull();
    expect(live.alive).toBe(false);
    expect(live.canaryKey).toBeNull();
  });
});

describe('explorer map', () => {
  it('keeps one-line badges and round trips expiry', () => {
    const canonical = `0x${'1f'.repeat(32)}` as Hex;
    const item = mapExplorerEntity(
      {
        key: canonical,
        creator: DEFAULT_DESK,
        owner: DEFAULT_DESK,
        expiresAt: 800n,
        attributes: { type: { type: 'str', value: 'desk' } } as unknown as Parameters<typeof mapExplorerEntity>[0]['attributes'],
        creationFlags: { readonly: true, permissionlessExtension: false },
      },
      canonical,
    );
    expect(item?.canonicalDemo).toBe(true);
    expect(item?.type).toBe('desk');
    const wire = serializeExplorerItem(item!);
    expect(wire.expiresAt).toBe('800');
    expect(hydrateExplorerItem(wire).expiresAt).toBe(800n);
  });
});
