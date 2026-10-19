import type { Hex } from 'viem';
import { deskAndCanary, explorerPage, inboxPage } from './arkiv';
import { bytesToB64 } from './bytes';
import { CHAIN_READ_FAILED, DEFAULT_DESK, LIVE_CACHE_MS, LIVE_STALE_MS } from './constants';
import { rememberRead } from './data-cache';
import { preferPubForCreator } from './demo-pub';
import { mapExplorerEntity, serializeExplorerItem, type ExplorerLiveItem } from './explorer-map';
import {
  type DeskLive,
  type ExplorerFilter,
  type ExplorerLive,
  type InboxLive,
} from './live-types';
import { deskPubBytes, parseDeskPayload } from './payload';
import { StaleCache } from './read-cache';
import { withReadBackoff } from './retry';
import { annotateStale } from './stale-copy';

export type { DeskLive, ExplorerFilter, ExplorerLive, InboxLive } from './live-types';

const liveCache = new StaleCache({ freshMs: LIVE_CACHE_MS, staleMs: LIVE_STALE_MS });

export function clearLiveReadCache() {
  liveCache.clear();
}

function freshness(): Pick<DeskLive, 'fetchedAt' | 'stale' | 'staleAgeMs' | 'note'> {
  return { fetchedAt: Date.now(), stale: false, staleAgeMs: 0, note: null };
}

function emptyDesk(creator: Hex, note: string): DeskLive {
  return {
    ok: true,
    creator,
    deskKey: null,
    canaryKey: null,
    alive: false,
    name: 'CanaryDrop desk',
    deskPubB64: null,
    expiresAt: null,
    createdAt: null,
    currentBlock: null,
    blockDuration: 2,
    ...freshness(),
    note,
  };
}

function emptyExplorer(note: string): ExplorerLive {
  return {
    ok: true,
    items: [],
    cursor: null,
    atBlock: '0',
    hasMore: false,
    currentBlock: null,
    blockDuration: 2,
    canonicalDeskKey: null,
    ...freshness(),
    note,
  };
}

function emptyInbox(note: string): InboxLive {
  return {
    ok: true,
    tips: [],
    cursor: null,
    atBlock: '0',
    hasMore: false,
    ...freshness(),
    note,
  };
}

async function fetchDeskFromChain(creator: Hex): Promise<DeskLive> {
  return withReadBackoff(async () => {
    const prefer = preferPubForCreator(creator);
    const bundle = await deskAndCanary(creator, prefer);
    const parsed = bundle.desk?.payload ? parseDeskPayload(bundle.desk.payload) : null;
    return {
      ok: true as const,
      creator,
      deskKey: bundle.desk?.key ?? null,
      canaryKey: bundle.canary?.key ?? null,
      alive: !!bundle.canary,
      name: parsed?.name ?? 'CanaryDrop desk',
      deskPubB64: parsed ? bytesToB64(deskPubBytes(parsed)) : null,
      expiresAt: bundle.canary?.expiresAt != null ? bundle.canary.expiresAt.toString() : null,
      createdAt: bundle.canary?.createdAt != null ? bundle.canary.createdAt.toString() : null,
      currentBlock: bundle.currentBlock.toString(),
      blockDuration: bundle.blockDuration || 2,
      ...freshness(),
    };
  });
}

async function fetchExplorerFromChain(
  filter: ExplorerFilter,
  opts?: { cursor?: string; atBlock?: bigint },
): Promise<ExplorerLive> {
  return withReadBackoff(async () => {
    const pageOpts: Parameters<typeof explorerPage>[0] = {};
    if (filter === 'sealed') {
      pageOpts.sealed = true;
      pageOpts.kind = 'tip';
    } else if (filter !== 'all') pageOpts.kind = filter;
    if (opts?.cursor) pageOpts.cursor = opts.cursor;
    if (opts?.atBlock !== undefined) pageOpts.atBlock = opts.atBlock;
    const r = await explorerPage(pageOpts);
    const cachedDesk = liveCache.peek<DeskLive>(`desk:${DEFAULT_DESK.toLowerCase()}`);
    let canonicalDeskKey: Hex | null = cachedDesk?.value.deskKey ?? null;
    const items: ExplorerLiveItem[] = [];
    for (const entity of r.entities) {
      const mapped = mapExplorerEntity(entity, canonicalDeskKey ?? undefined);
      if (mapped) items.push(serializeExplorerItem(mapped));
    }
    if (!canonicalDeskKey) {
      const canonical = items.find((item) => item.canonicalDemo && item.type === 'desk');
      canonicalDeskKey = canonical?.key ?? null;
    }
    return {
      ok: true as const,
      items,
      cursor: r.cursor ?? null,
      atBlock: r.blockNumber.toString(),
      hasMore: r.hasNextPage(),
      currentBlock: r.blockNumber.toString(),
      blockDuration: 2,
      canonicalDeskKey,
      ...freshness(),
    };
  });
}

async function fetchInboxFromChain(
  deskKey: Hex,
  opts?: { cursor?: string; atBlock?: bigint },
): Promise<InboxLive> {
  return withReadBackoff(async () => {
    const pageOpts: { cursor?: string; atBlock?: bigint } = {};
    if (opts?.cursor) pageOpts.cursor = opts.cursor;
    if (opts?.atBlock !== undefined) pageOpts.atBlock = opts.atBlock;
    const r = await inboxPage(deskKey, pageOpts);
    return {
      ok: true as const,
      tips: r.entities
        .filter((row) => row.key)
        .map((row) => ({
          key: row.key as Hex,
          createdAt: (row.createdAt ?? 0n).toString(),
          payloadB64: bytesToB64(new Uint8Array(row.payload ?? new Uint8Array())),
          owner: row.owner ?? null,
        })),
      cursor: r.hasNextPage() ? (r.cursor ?? null) : null,
      atBlock: r.blockNumber.toString(),
      hasMore: r.hasNextPage(),
      ...freshness(),
    };
  });
}

export async function loadDeskLive(creator: Hex, opts?: { fresh?: boolean }): Promise<DeskLive> {
  const cacheKey = `desk:${creator.toLowerCase()}`;
  const result = await liveCache.get(
    cacheKey,
    () => rememberRead(cacheKey, () => fetchDeskFromChain(creator)),
    {
      bypass: opts?.fresh,
      fallback: () => emptyDesk(creator, CHAIN_READ_FAILED),
    },
  );
  return annotateStale(result.value, result.at, result.stale);
}

export async function loadExplorerLive(
  filter: ExplorerFilter,
  opts?: { cursor?: string; atBlock?: bigint; fresh?: boolean },
): Promise<ExplorerLive> {
  const cacheKey = `explorer:${filter}:${opts?.cursor ?? ''}:${opts?.atBlock?.toString() ?? ''}`;
  const paged = !!opts?.cursor;
  const result = await liveCache.get(
    cacheKey,
    () =>
      paged
        ? fetchExplorerFromChain(filter, opts)
        : rememberRead(cacheKey, () => fetchExplorerFromChain(filter, opts)),
    {
      bypass: opts?.fresh || paged,
      fallback: () => emptyExplorer(CHAIN_READ_FAILED),
    },
  );
  return annotateStale(result.value, result.at, result.stale);
}

export async function loadInboxLive(
  deskKey: Hex,
  opts?: { cursor?: string; atBlock?: bigint },
): Promise<InboxLive> {
  const cacheKey = `inbox:${deskKey.toLowerCase()}:${opts?.cursor ?? ''}:${opts?.atBlock?.toString() ?? ''}`;
  const paged = !!opts?.cursor;
  const result = await liveCache.get(
    cacheKey,
    () =>
      paged
        ? fetchInboxFromChain(deskKey, opts)
        : rememberRead(cacheKey, () => fetchInboxFromChain(deskKey, opts)),
    {
      bypass: paged,
      fallback: () => emptyInbox(CHAIN_READ_FAILED),
    },
  );
  return annotateStale(result.value, result.at, result.stale);
}
