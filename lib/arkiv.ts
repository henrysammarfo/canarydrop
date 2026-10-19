import {
  createPublicClient,
  createWalletClient,
  ExpirationTime,
  jsonToPayload,
  NoEntityFoundError,
} from '@arkiv-network/sdk';
import type {
  EntityCreatedEvent,
  ExpiryExtendedEvent,
  FullEntity,
  ProjectedEntity,
  PublicArkivClient,
  QueryResult,
  TxParams,
  WalletArkivClient,
} from '@arkiv-network/sdk';
import { key, str, u64 } from '@arkiv-network/sdk/attr';
import { tiramisu } from '@arkiv-network/sdk/chains';
import { eq, gt } from '@arkiv-network/sdk/query';
import type { Hex } from 'viem';
import { custom } from 'viem';
import { attrKey, attrStr } from './attr';
import { DEFAULT_RELAY, LIFETIME_KEYS, PROJECT, SEALED_OWNER, type Lifetime } from './constants';
import { utcDaySlot } from './day';
import { AppError } from './errors';
import { envAddress } from './hex';
import type { InjectedProvider } from './injected';
import { rpcHttp, rpcWs } from './rpc';

export { PROJECT, SEALED_OWNER };
export type Wallet = WalletArkivClient;
export type PublicClient = PublicArkivClient;

const DESK_SELECT = { key: true, creator: true, expiresAt: true, payload: true, createdAt: true } as const;
const CANARY_SELECT = { key: true, expiresAt: true, createdAt: true } as const;
const INBOX_SELECT = { key: true, createdAt: true, expiresAt: true, payload: true } as const;
const REPLY_SELECT = { key: true, payload: true, createdAt: true } as const;
const COUNT_SELECT = { key: true } as const;

export type DeskRow = ProjectedEntity<typeof DESK_SELECT>;
export type CanaryRow = ProjectedEntity<typeof CANARY_SELECT>;
export type InboxTip = ProjectedEntity<typeof INBOX_SELECT>;
export type ReplyRow = ProjectedEntity<typeof REPLY_SELECT>;
export type InboxPage = QueryResult<InboxTip>;

export function relayAddress(): Hex {
  return envAddress('NEXT_PUBLIC_RELAY_ADDRESS', DEFAULT_RELAY);
}

export function deskAddress(): Hex {
  return envAddress('NEXT_PUBLIC_DESK_ADDRESS', '0x1da3c22c079c264536D831F6F1fCe638aB0b20B0');
}

let _pub: PublicArkivClient | undefined;
let _ws: PublicArkivClient | undefined;

export function pub(): PublicArkivClient {
  if (!_pub) _pub = createPublicClient({ chain: tiramisu, transport: rpcHttp() });
  return _pub;
}

export function ws(): PublicArkivClient {
  if (!_ws) _ws = createPublicClient({ chain: tiramisu, transport: rpcWs() });
  return _ws;
}

export function walletFromProvider(provider: InjectedProvider): Wallet {
  return createWalletClient({ chain: tiramisu, transport: custom(provider) });
}

export async function headBlock(): Promise<bigint> {
  return (await pub().getBlockTiming()).currentBlock;
}

async function aliveHead() {
  return gt('$expiresAt', u64(await headBlock()));
}

/** Desk onboarding: desk + first canary land atomically. Canary points at the predicted desk key. */
export async function createDesk(w: Wallet, owner: Hex, name: string, deskPubRaw: Uint8Array, txParams?: TxParams) {
  const [desk, canary] = await pub().predictEntityKeys({ owner, count: 2 });
  return w.executeBatch({
    creates: [
      {
        salt: desk.salt,
        payload: jsonToPayload({ name, pub: Array.from(deskPubRaw) }),
        contentType: 'application/json',
        attributes: { project: str(PROJECT), type: str('desk'), slot: u64(utcDaySlot()) },
        expires: ExpirationTime.fromDays(30),
      },
      {
        salt: canary.salt,
        payload: jsonToPayload({ statement: 'No warrants or gag orders received.' }),
        contentType: 'application/json',
        attributes: { project: str(PROJECT), type: str('canary'), desk: key(desk.key) },
        expires: ExpirationTime.fromHours(26),
        flags: { readonly: true },
      },
    ],
  }, txParams);
}

/** extendEntity SETS expiry from now. It does not add to the remaining lifetime. */
export const renew = (w: Wallet, deskKey: Hex, canaryKey: Hex, txParams?: TxParams) =>
  w.executeBatch(
    {
      extensions: [
        { entityKey: canaryKey, expires: ExpirationTime.fromHours(26) },
        { entityKey: deskKey, expires: ExpirationTime.fromDays(30) },
      ],
    },
    txParams,
  );

export async function getDesk(deskCreator: Hex): Promise<DeskRow | undefined> {
  const r = await pub()
    .select(DESK_SELECT)
    .where(eq('project', PROJECT), eq('type', 'desk'), await aliveHead())
    .createdBy(deskCreator)
    .limit(20)
    .fetch();
  const rows = [...r.entities];
  rows.sort((a, b) => Number((b.createdAt ?? 0n) - (a.createdAt ?? 0n)));
  return rows[0];
}

export async function listDesks(deskCreator: Hex): Promise<readonly DeskRow[]> {
  const r = await pub()
    .select(DESK_SELECT)
    .where(eq('project', PROJECT), eq('type', 'desk'), await aliveHead())
    .createdBy(deskCreator)
    .limit(20)
    .fetch();
  return r.entities;
}

export async function listProjectDesks() {
  return pub()
    .select({ key: true, creator: true, payload: true, createdAt: true, owner: true })
    .where(eq('project', PROJECT), eq('type', 'desk'), await aliveHead())
    .limit(50)
    .fetch();
}

export async function canaryAlive(deskCreator: Hex, deskKey: Hex): Promise<CanaryRow | null> {
  const r = await pub()
    .select(CANARY_SELECT)
    .where(eq('project', PROJECT), eq('type', 'canary'), eq('desk', key(deskKey)), await aliveHead())
    .createdBy(deskCreator)
    .limit(1)
    .fetch();
  return r.entities[0] ?? null;
}

/** Historical canary at a pinned block. Absence at that block is the signal. */
export async function canaryAtBlock(deskCreator: Hex, deskKey: Hex, block: bigint): Promise<CanaryRow | null> {
  const r = await pub()
    .select(CANARY_SELECT)
    .where(eq('project', PROJECT), eq('type', 'canary'), eq('desk', key(deskKey)), gt('$expiresAt', u64(block)))
    .createdBy(deskCreator)
    .limit(1)
    .atBlock(block)
    .fetch();
  return r.entities[0] ?? null;
}

export type PageWalk = {
  cursor?: string | undefined;
  atBlock?: bigint | undefined;
};

export async function inboxPage(deskKey: Hex, opts?: PageWalk): Promise<InboxPage> {
  const head = opts?.atBlock ?? (await headBlock());
  let q = pub()
    .select(INBOX_SELECT)
    .where(eq('project', PROJECT), eq('type', 'tip'), eq('desk', key(deskKey)))
    .createdBy(relayAddress())
    .limit(50)
    .atBlock(head);
  if (opts?.cursor) q = q.cursor(opts.cursor);
  return q.fetch();
}

export async function repliesFor(tipKey: Hex, deskCreator: Hex): Promise<readonly ReplyRow[]> {
  return (
    await pub()
      .select(REPLY_SELECT)
      .where(eq('project', PROJECT), eq('type', 'reply'), eq('tip', key(tipKey)))
      .createdBy(deskCreator)
      .limit(20)
      .fetch()
  ).entities;
}

export const reply = (w: Wallet, tipKey: Hex, wire: Uint8Array, deskKey?: Hex, txParams?: TxParams) =>
  w.executeBatch(
    {
      creates: [
        {
          payload: wire,
          contentType: 'application/octet-stream',
          attributes: {
            project: str(PROJECT),
            type: str('reply'),
            tip: key(tipKey),
            slot: u64(utcDaySlot()),
          },
          expires: ExpirationTime.fromHours(72),
        },
      ],
      extensions: deskKey ? [{ entityKey: deskKey, expires: ExpirationTime.fromDays(30) }] : [],
    },
    txParams,
  );

export type InboxWatchHandlers = {
  onTip: (k: Hex) => void;
  onExpiry?: (k: Hex, expiresAt: bigint) => void;
  onSealed?: (k: Hex) => void;
  onError?: (err: Error) => void;
};

export function watchInbox(deskKey: Hex, onTipOrHandlers: ((k: Hex) => void) | InboxWatchHandlers) {
  const handlers: InboxWatchHandlers =
    typeof onTipOrHandlers === 'function' ? { onTip: onTipOrHandlers } : onTipOrHandlers;
  let stopped = false;
  let unwatch: (() => void) | undefined;

  const start = () => {
    if (stopped) return;
    unwatch = ws().watchEntityEvents({
      onEntityCreated: async (ev: EntityCreatedEvent) => {
        if (ev.owner.toLowerCase() !== relayAddress().toLowerCase()) return;
        try {
          const e = await pub().getEntity(ev.entityKey);
          if (attrStr(e.attributes, 'type') === 'tip' && attrKey(e.attributes, 'desk') === deskKey) {
            handlers.onTip(ev.entityKey);
          }
        } catch {
          return;
        }
      },
      onExpiryExtended: (ev: ExpiryExtendedEvent) => {
        handlers.onExpiry?.(ev.entityKey, ev.expiresAt);
      },
      onOwnershipTransferred: (ev) => {
        if (ev.newOwner.toLowerCase() === SEALED_OWNER.toLowerCase()) handlers.onSealed?.(ev.entityKey);
      },
      onError: (err: Error) => {
        handlers.onError?.(err);
        if (stopped) return;
        unwatch?.();
        setTimeout(start, 2000);
      },
    });
  };

  start();
  return () => {
    stopped = true;
    unwatch?.();
  };
}

export const LIFETIMES = {
  '1h': ExpirationTime.fromHours(1),
  '24h': ExpirationTime.fromHours(24),
  '72h': ExpirationTime.fromHours(72),
  '7d': ExpirationTime.fromDays(7),
} as const;

export function isLifetime(value: string): value is Lifetime {
  return (LIFETIME_KEYS as readonly string[]).includes(value);
}

export async function requireLiveDesk(deskKey: Hex): Promise<FullEntity> {
  try {
    const entity = await pub().getEntity(deskKey);
    if (attrStr(entity.attributes, 'project') !== PROJECT || attrStr(entity.attributes, 'type') !== 'desk') {
      throw new AppError('no_desk');
    }
    const head = await headBlock();
    if (entity.expiresAt !== undefined && entity.expiresAt <= head) throw new AppError('no_desk');
    return entity;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof NoEntityFoundError) throw new AppError('no_desk');
    throw err;
  }
}

export async function countBySlot(kind: 'tip' | 'reply' | 'desk', creator: Hex, slot: bigint): Promise<number> {
  const page = await pub()
    .select(COUNT_SELECT)
    .where(eq('project', PROJECT), eq('type', kind), eq('slot', u64(slot)))
    .createdBy(creator)
    .limit(200)
    .fetch();
  return page.entities.length;
}

export async function explorerPage(opts?: PageWalk) {
  const head = opts?.atBlock ?? (await headBlock());
  let q = pub()
    .select({ key: true, attributes: true, creator: true, owner: true, expiresAt: true, createdAt: true })
    .where(eq('project', PROJECT))
    .limit(20)
    .atBlock(head);
  if (opts?.cursor) q = q.cursor(opts.cursor);
  return q.fetch();
}
