import type { Hex } from 'viem';
import { attrKey, attrStr } from './attr';
import { DEFAULT_DESK, DEFAULT_IMPOSTOR } from './constants';
import { explorerRowFlags, olderDemoLabel } from './explorer-label';

export type ExplorerEntity = {
  key?: Hex;
  creator?: Hex;
  owner?: Hex;
  expiresAt?: bigint;
  attributes?: Parameters<typeof attrStr>[0];
  creationFlags?: { readonly?: boolean; permissionlessExtension?: boolean };
};

export type ExplorerItem = {
  key: Hex;
  type: string;
  creator: Hex;
  owner: Hex;
  expiresAt: bigint | null;
  impostor: boolean;
  canonicalDemo: boolean;
  olderDemo: string | null;
  verifiedDomain: boolean;
  unlistedDesk: boolean;
  readonly: boolean;
  openExtend: boolean;
};

export type ExplorerLiveItem = Omit<ExplorerItem, 'expiresAt'> & { expiresAt: string | null };

export function mapExplorerEntity(e: ExplorerEntity, canonicalDeskKey?: Hex): ExplorerItem | null {
  if (!e.key) return null;
  const creator = e.creator ?? ('0x' as Hex);
  const type = attrStr(e.attributes, 'type') ?? 'unknown';
  const flags = explorerRowFlags({
    type,
    key: e.key,
    creator,
    deskAttr: attrKey(e.attributes, 'desk'),
    canonicalDeskKey,
    demoCreator: DEFAULT_DESK,
    impostorCreator: DEFAULT_IMPOSTOR,
    listedDesk: DEFAULT_DESK,
  });
  return {
    key: e.key,
    type,
    creator,
    owner: e.owner ?? creator,
    expiresAt: e.expiresAt ?? null,
    impostor: flags.impostor,
    canonicalDemo: flags.canonicalDemo,
    olderDemo: olderDemoLabel(flags),
    verifiedDomain: flags.verifiedDomain,
    unlistedDesk: flags.unlistedDesk,
    readonly: e.creationFlags?.readonly === true,
    openExtend: e.creationFlags?.permissionlessExtension === true,
  };
}

export function serializeExplorerItem(item: ExplorerItem): ExplorerLiveItem {
  return {
    ...item,
    expiresAt: item.expiresAt != null ? item.expiresAt.toString() : null,
  };
}

export function hydrateExplorerItem(item: ExplorerLiveItem): ExplorerItem {
  return {
    ...item,
    expiresAt: item.expiresAt != null ? BigInt(item.expiresAt) : null,
  };
}
