import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Hex } from 'viem';
import { CHAIN_READ_FAILED, DEFAULT_DESK } from '@/lib/constants';
import { hydrateDeskLive } from '@/lib/live-client';
import { mapExplorerEntity, serializeExplorerItem, hydrateExplorerItem } from '@/lib/explorer-map';

vi.mock('@/lib/arkiv', () => ({
  deskAndCanary: vi.fn(),
  explorerPage: vi.fn(),
  inboxPage: vi.fn(),
}));

vi.mock('@/lib/retry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/retry')>();
  return {
    ...actual,
    withReadBackoff: <T,>(fn: () => Promise<T>) =>
      actual.withBackoff(fn, 2, async () => undefined, { base: 1, jitter: false }),
  };
});

vi.mock('@/lib/demo-pub', () => ({
  preferPubForCreator: () => undefined,
}));

const { deskAndCanary } = await import('@/lib/arkiv');
const { loadDeskLive, clearLiveReadCache } = await import('@/lib/live-read');

function liveBundle() {
  return {
    desk: {
      key: `0x${'1f'.repeat(32)}` as Hex,
      creator: DEFAULT_DESK,
      expiresAt: 900n,
      payload: new TextEncoder().encode(
        JSON.stringify({ name: 'CanaryDrop Demo Desk', pub: Array.from({ length: 65 }, (_, i) => (i === 0 ? 4 : 1)) }),
      ),
      createdAt: 10n,
    },
    canary: {
      key: `0x${'3c'.repeat(32)}` as Hex,
      expiresAt: 200n,
      createdAt: 50n,
      owner: DEFAULT_DESK,
      creationFlags: { readonly: true, permissionlessExtension: false },
    },
    currentBlock: 100n,
    blockDuration: 2,
  };
}

afterEach(() => {
  clearLiveReadCache();
  vi.mocked(deskAndCanary).mockReset();
});

describe('desk live snapshot', () => {
  it('serializes bigint fields and hydrates them back', async () => {
    vi.mocked(deskAndCanary).mockResolvedValue(liveBundle() as Awaited<ReturnType<typeof deskAndCanary>>);
    const live = await loadDeskLive(DEFAULT_DESK);
    expect(live.ok).toBe(true);
    expect(live.deskKey).toMatch(/^0x1f/);
    expect(live.canaryKey).toMatch(/^0x3c/);
    expect(live.alive).toBe(true);
    expect(live.name).toBe('CanaryDrop Demo Desk');
    expect(live.expiresAt).toBe('200');
    expect(live.createdAt).toBe('50');
    expect(live.currentBlock).toBe('100');
    expect(live.stale).toBe(false);
    const view = hydrateDeskLive(live);
    expect(view.expiresAt).toBe(200n);
    expect(view.createdAt).toBe(50n);
    expect(view.currentBlock).toBe(100n);
    expect(view.deskPub?.[0]).toBe(4);
  });

  it('returns a null desk without throwing when none is live', async () => {
    vi.mocked(deskAndCanary).mockResolvedValue({
      desk: undefined,
      canary: null,
      currentBlock: 100n,
      blockDuration: 2,
    } as Awaited<ReturnType<typeof deskAndCanary>>);
    const live = await loadDeskLive(DEFAULT_DESK, { fresh: true });
    expect(live.deskKey).toBeNull();
    expect(live.alive).toBe(false);
    expect(live.canaryKey).toBeNull();
  });

  it('serves the last good snapshot when a later read 429s', async () => {
    vi.mocked(deskAndCanary).mockResolvedValueOnce(liveBundle() as Awaited<ReturnType<typeof deskAndCanary>>);
    const first = await loadDeskLive(DEFAULT_DESK, { fresh: true });
    expect(first.stale).toBe(false);
    vi.mocked(deskAndCanary).mockRejectedValue(new Error('HTTP request failed. Status: 429 ANON_COST_LIMITED'));
    const stale = await loadDeskLive(DEFAULT_DESK, { fresh: true });
    expect(stale.ok).toBe(true);
    expect(stale.stale).toBe(true);
    expect(stale.deskKey).toBe(first.deskKey);
    expect(stale.note).toMatch(/Showing data from/);
    expect(stale.note).not.toMatch(/[\u2013\u2014]/);
  });

  it('returns a calm empty snapshot when a 429 has no last good data', async () => {
    vi.mocked(deskAndCanary).mockRejectedValue(new Error('429 too many requests'));
    const live = await loadDeskLive(DEFAULT_DESK, { fresh: true });
    expect(live.ok).toBe(true);
    expect(live.deskKey).toBeNull();
    expect(live.note).toBe(CHAIN_READ_FAILED);
    expect(live.stale).toBe(false);
  });

  it('coalesces duplicate in-flight desk reads', async () => {
    let n = 0;
    vi.mocked(deskAndCanary).mockImplementation(async () => {
      n += 1;
      await new Promise((r) => setTimeout(r, 30));
      return liveBundle() as Awaited<ReturnType<typeof deskAndCanary>>;
    });
    const [a, b] = await Promise.all([loadDeskLive(DEFAULT_DESK, { fresh: true }), loadDeskLive(DEFAULT_DESK, { fresh: true })]);
    expect(n).toBe(1);
    expect(a.deskKey).toBe(b.deskKey);
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
