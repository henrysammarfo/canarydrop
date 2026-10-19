import type { Hex } from 'viem';
import { canaryAlive, explorerPage, getDesk, inboxPage, pub } from './arkiv';
import { bytesToB64 } from './bytes';
import { DEFAULT_DESK, LIVE_CACHE_MS } from './constants';
import { preferPubForCreator } from './demo-pub';
import { mapExplorerEntity, serializeExplorerItem, type ExplorerLiveItem } from './explorer-map';
import {
  type DeskLive,
  type ExplorerFilter,
  type ExplorerLive,
  type InboxLive,
} from './live-types';
import { deskPubBytes, parseDeskPayload } from './payload';
import { sleep, withBackoff } from './retry';

export type { DeskLive, ExplorerFilter, ExplorerLive, InboxLive } from './live-types';

type CacheEntry<T> = { at: number; value: T };

const cache = new Map<string, CacheEntry<unknown>>();

export function clearLiveReadCache() {
  cache.clear();
}

function cached<T>(key: string, ttl: number): T | undefined {
  const hit = cache.get(key) as CacheEntry<T> | undefined;
  if (!hit) return undefined;
  if (Date.now() - hit.at >= ttl) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
}

function store<T>(key: string, value: T): T {
  cache.set(key, { at: Date.now(), value });
  return value;
}

async function blockTiming(): Promise<{ currentBlock: bigint | null; blockDuration: number }> {
  try {
    const timing = await pub().getBlockTiming();
    return { currentBlock: timing.currentBlock, blockDuration: timing.blockDuration || 2 };
  } catch {
    return { currentBlock: null, blockDuration: 2 };
  }
}

export async function loadDeskLive(creator: Hex, opts?: { fresh?: boolean }): Promise<DeskLive> {
  const cacheKey = `desk:${creator.toLowerCase()}`;
  if (!opts?.fresh) {
    const hit = cached<DeskLive>(cacheKey, LIVE_CACHE_MS);
    if (hit) return hit;
  }
  const prefer = preferPubForCreator(creator);
  const d = await withBackoff(() => getDesk(creator, prefer), 8, (ms) => sleep(Math.max(400, ms)));
  const timing = await blockTiming();
  const c = d?.key
    ? await withBackoff(() => canaryAlive(creator, d.key), 4, (ms) => sleep(Math.max(300, ms)))
    : null;
  const parsed = d?.payload ? parseDeskPayload(d.payload) : null;
  return store(cacheKey, {
    ok: true as const,
    creator,
    deskKey: d?.key ?? null,
    canaryKey: c?.key ?? null,
    alive: !!c,
    name: parsed?.name ?? 'CanaryDrop desk',
    deskPubB64: parsed ? bytesToB64(deskPubBytes(parsed)) : null,
    expiresAt: c?.expiresAt != null ? c.expiresAt.toString() : null,
    createdAt: c?.createdAt != null ? c.createdAt.toString() : null,
    currentBlock: timing.currentBlock != null ? timing.currentBlock.toString() : null,
    blockDuration: timing.blockDuration || 2,
  });
}

export async function loadExplorerLive(
  filter: ExplorerFilter,
  opts?: { cursor?: string; atBlock?: bigint; fresh?: boolean },
): Promise<ExplorerLive> {
  const cacheKey = `explorer:${filter}:${opts?.cursor ?? ''}:${opts?.atBlock?.toString() ?? ''}`;
  if (!opts?.cursor && !opts?.fresh) {
    const hit = cached<ExplorerLive>(cacheKey, LIVE_CACHE_MS);
    if (hit) return hit;
  }
  const prefer = preferPubForCreator(DEFAULT_DESK);
  let canonicalDeskKey: Hex | null = null;
  try {
    const desk = await getDesk(DEFAULT_DESK, prefer);
    canonicalDeskKey = desk?.key ?? null;
  } catch {
    // Labels still work from the known replaced keys.
  }
  const pageOpts: Parameters<typeof explorerPage>[0] = {};
  if (filter === 'sealed') {
    pageOpts.sealed = true;
    pageOpts.kind = 'tip';
  } else if (filter !== 'all') pageOpts.kind = filter;
  if (opts?.cursor) pageOpts.cursor = opts.cursor;
  if (opts?.atBlock !== undefined) pageOpts.atBlock = opts.atBlock;
  const r = await withBackoff(() => explorerPage(pageOpts), 8, (ms) => sleep(Math.max(400, ms)));
  const timing = await blockTiming();
  const items: ExplorerLiveItem[] = [];
  for (const entity of r.entities) {
    const mapped = mapExplorerEntity(entity, canonicalDeskKey ?? undefined);
    if (mapped) items.push(serializeExplorerItem(mapped));
  }
  const live: ExplorerLive = {
    ok: true,
    items,
    cursor: r.cursor ?? null,
    atBlock: r.blockNumber.toString(),
    hasMore: r.hasNextPage(),
    currentBlock: timing.currentBlock != null ? timing.currentBlock.toString() : null,
    blockDuration: timing.blockDuration || 2,
    canonicalDeskKey,
  };
  if (!opts?.cursor) store(cacheKey, live);
  return live;
}

export async function loadInboxLive(
  deskKey: Hex,
  opts?: { cursor?: string; atBlock?: bigint },
): Promise<InboxLive> {
  const pageOpts: { cursor?: string; atBlock?: bigint } = {};
  if (opts?.cursor) pageOpts.cursor = opts.cursor;
  if (opts?.atBlock !== undefined) pageOpts.atBlock = opts.atBlock;
  const r = await withBackoff(() => inboxPage(deskKey, pageOpts), 8, (ms) => sleep(Math.max(400, ms)));
  return {
    ok: true,
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
  };
}
