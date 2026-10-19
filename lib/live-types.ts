import type { Hex } from 'viem';
import type { ExplorerLiveItem } from './explorer-map';

export type LiveFreshness = {
  fetchedAt: number;
  stale: boolean;
  staleAgeMs: number;
  note: string | null;
};

export type DeskLive = {
  ok: true;
  creator: Hex;
  deskKey: Hex | null;
  canaryKey: Hex | null;
  alive: boolean;
  name: string;
  deskPubB64: string | null;
  expiresAt: string | null;
  createdAt: string | null;
  currentBlock: string | null;
  blockDuration: number;
  domain: string | null;
  canaryStatement: string | null;
  canaryIssuedAt: string | null;
  canarySig: string | null;
} & LiveFreshness;

export type ExplorerFilter = 'all' | 'tip' | 'desk' | 'canary' | 'reply' | 'sealed';

export type ExplorerLive = {
  ok: true;
  items: ExplorerLiveItem[];
  cursor: string | null;
  atBlock: string;
  hasMore: boolean;
  currentBlock: string | null;
  blockDuration: number;
  canonicalDeskKey: Hex | null;
} & LiveFreshness;

export type InboxLiveTip = {
  key: Hex;
  createdAt: string;
  payloadB64: string;
  owner: Hex | null;
};

export type InboxLive = {
  ok: true;
  tips: InboxLiveTip[];
  cursor: string | null;
  atBlock: string;
  hasMore: boolean;
} & LiveFreshness;
