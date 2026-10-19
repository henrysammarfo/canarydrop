import type { Hex } from 'viem';
import { deskAndCanary, explorerPage, inboxPage } from './arkiv';
import { bytesToB64 } from './bytes';
import { DEFAULT_DESK } from './constants';
import { mapExplorerEntity, serializeExplorerItem } from './explorer-map';
import type { DeskLive, ExplorerFilter, ExplorerLive, InboxLive } from './live-types';
import { deskPubBytes, parseDeskPayload } from './payload';
import { withReadBackoff } from './retry';

function freshness(): Pick<DeskLive, 'fetchedAt' | 'stale' | 'staleAgeMs' | 'note'> {
  return { fetchedAt: Date.now(), stale: false, staleAgeMs: 0, note: null };
}

/** Browser-safe Tiramisu reads. No Node crypto and no Next cache. */
export async function browserDeskLive(creator: Hex): Promise<DeskLive> {
  return withReadBackoff(async () => {
    const bundle = await deskAndCanary(creator);
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

export async function browserExplorerLive(
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
    let canonicalDeskKey: Hex | null = null;
    const items = [];
    for (const entity of r.entities) {
      const mapped = mapExplorerEntity(entity, canonicalDeskKey ?? undefined);
      if (mapped) items.push(serializeExplorerItem(mapped));
    }
    const canonical = items.find((item) => item.canonicalDemo && item.type === 'desk');
    canonicalDeskKey = canonical?.key ?? null;
    return {
      ok: true as const,
      items,
      cursor: r.cursor ?? null,
      atBlock: r.blockNumber.toString(),
      hasMore: r.hasNextPage(),
      currentBlock: r.blockNumber.toString(),
      blockDuration: 2,
      canonicalDeskKey: canonicalDeskKey ?? DEFAULT_DESK,
      ...freshness(),
    };
  });
}

export async function browserInboxLive(
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
