import type { Hex } from 'viem';
import { b64ToBytes } from './bytes';
import { appFetch } from './client-fetch';
import { CHAIN_READ_FAILED } from './constants';
import type { ExplorerLiveItem } from './explorer-map';
import { hydrateExplorerItem, type ExplorerItem } from './explorer-map';
import type { DeskLive, ExplorerFilter, ExplorerLive, InboxLive } from './live-types';

export type DeskLiveView = {
  creator: Hex;
  deskKey: Hex | null;
  canaryKey: Hex | null;
  alive: boolean;
  name: string;
  deskPub: Uint8Array | null;
  expiresAt: bigint | null;
  createdAt: bigint | null;
  currentBlock: bigint | null;
  blockDuration: number;
  stale: boolean;
  staleAgeMs: number;
  note: string | null;
};

export type ExplorerLiveView = {
  items: ExplorerItem[];
  cursor: string | undefined;
  atBlock: bigint;
  hasMore: boolean;
  currentBlock: bigint | null;
  blockDuration: number;
  canonicalDeskKey: Hex | null;
  stale: boolean;
  staleAgeMs: number;
  note: string | null;
};

function asBigint(value: string | null | undefined): bigint | null {
  if (value == null || value === '') return null;
  return BigInt(value);
}

async function readJson(r: Response): Promise<Record<string, unknown>> {
  const j = (await r.json()) as Record<string, unknown>;
  if (!r.ok) {
    const message = typeof j.message === 'string' && j.message ? j.message : CHAIN_READ_FAILED;
    throw new Error(message);
  }
  return j;
}

export function hydrateDeskLive(j: DeskLive): DeskLiveView {
  return {
    creator: j.creator,
    deskKey: j.deskKey,
    canaryKey: j.canaryKey,
    alive: j.alive,
    name: j.name,
    deskPub: j.deskPubB64 ? b64ToBytes(j.deskPubB64) : null,
    expiresAt: asBigint(j.expiresAt),
    createdAt: asBigint(j.createdAt),
    currentBlock: asBigint(j.currentBlock),
    blockDuration: j.blockDuration || 2,
    stale: j.stale === true,
    staleAgeMs: typeof j.staleAgeMs === 'number' ? j.staleAgeMs : 0,
    note: typeof j.note === 'string' ? j.note : null,
  };
}

export async function fetchDeskLive(creator: Hex, fresh = false): Promise<DeskLiveView> {
  const r = await appFetch(`/api/desk/live?creator=${creator}${fresh ? '&fresh=1' : ''}`);
  const j = (await readJson(r)) as DeskLive;
  return hydrateDeskLive(j);
}

export async function fetchExplorerLive(
  filter: ExplorerFilter,
  opts?: { cursor?: string; atBlock?: bigint },
): Promise<ExplorerLiveView> {
  const q = new URLSearchParams({ filter });
  if (opts && opts.cursor) q.set('cursor', opts.cursor);
  if (opts && opts.atBlock != null) q.set('atBlock', opts.atBlock.toString());
  const r = await appFetch(`/api/explorer?${q.toString()}`);
  const j = (await readJson(r)) as ExplorerLive;
  return {
    items: (j.items as ExplorerLiveItem[]).map(hydrateExplorerItem),
    cursor: j.cursor ?? undefined,
    atBlock: BigInt(j.atBlock),
    hasMore: j.hasMore,
    currentBlock: asBigint(j.currentBlock),
    blockDuration: j.blockDuration || 2,
    canonicalDeskKey: j.canonicalDeskKey,
    stale: j.stale === true,
    staleAgeMs: typeof j.staleAgeMs === 'number' ? j.staleAgeMs : 0,
    note: typeof j.note === 'string' ? j.note : null,
  };
}

export async function fetchInboxLive(
  deskKey: Hex,
  opts?: { cursor?: string; atBlock?: bigint },
): Promise<{
  tips: { key: Hex; createdAt: bigint; payload: Uint8Array; owner: Hex | null }[];
  cursor: string | undefined;
  atBlock: bigint;
  hasMore: boolean;
  stale: boolean;
  staleAgeMs: number;
  note: string | null;
}> {
  const q = new URLSearchParams({ deskKey });
  if (opts && opts.cursor) q.set('cursor', opts.cursor);
  if (opts && opts.atBlock != null) q.set('atBlock', opts.atBlock.toString());
  const r = await appFetch(`/api/desk/inbox?${q.toString()}`);
  const j = (await readJson(r)) as InboxLive;
  return {
    tips: j.tips.map((t) => ({
      key: t.key,
      createdAt: BigInt(t.createdAt),
      payload: b64ToBytes(t.payloadB64),
      owner: t.owner,
    })),
    cursor: j.cursor ?? undefined,
    atBlock: BigInt(j.atBlock),
    hasMore: j.hasMore,
    stale: j.stale === true,
    staleAgeMs: typeof j.staleAgeMs === 'number' ? j.staleAgeMs : 0,
    note: typeof j.note === 'string' ? j.note : null,
  };
}
