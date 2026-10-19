import {
  createPublicClient,
  createWalletClient,
  ExpirationTime,
  jsonToPayload,
  NoEntityFoundError,
} from '@arkiv-network/sdk';
import type {
  Attributes,
  EntityCreatedEvent,
  EntityDeletedEvent,
  EntityPatchedEvent,
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
import { eq, gt, gte, lte, or } from '@arkiv-network/sdk/query';
import type { Hex } from 'viem';
import { custom } from 'viem';
import { attrKey, attrStr, attrU64 } from './attr';
import { DEFAULT_CANARY_STATEMENT } from './eip712';
import { isSealedOwner } from './chain';
import type { StealthAnnouncement } from './stealth';
import {
  DEFAULT_RELAY,
  DEMO_TIP_LIVE_UNTIL,
  LIFETIME_KEYS,
  PROJECT,
  SEALED_OWNER,
  type Lifetime,
} from './constants';
import { utcDaySlot } from './day';
import { pickLiveDesk } from './desk-pick';
import { AppError } from './errors';
import { envAddress } from './hex';
import type { InjectedProvider } from './injected';
import { rpcHttp, rpcWs } from './rpc';

export { PROJECT, SEALED_OWNER };
export type Wallet = WalletArkivClient;
export type PublicClient = PublicArkivClient;

const DESK_SELECT = { key: true, creator: true, expiresAt: true, payload: true, createdAt: true } as const;
const CANARY_SELECT = {
  key: true,
  expiresAt: true,
  createdAt: true,
  creationFlags: true,
  owner: true,
  attributes: true,
  payload: true,
} as const;
const INBOX_SELECT = { key: true, createdAt: true, expiresAt: true, payload: true, owner: true } as const;
const REPLY_SELECT = { key: true, payload: true, createdAt: true } as const;
const COUNT_SELECT = { key: true } as const;
const SEALED_SELECT = {
  key: true,
  owner: true,
  creator: true,
  createdAt: true,
  expiresAt: true,
  creationFlags: true,
  attributes: true,
} as const;
const EXPLORER_SELECT = {
  key: true,
  attributes: true,
  creator: true,
  owner: true,
  expiresAt: true,
  createdAt: true,
  creationFlags: true,
} as const;
const BUNDLE_SELECT = {
  key: true,
  creator: true,
  expiresAt: true,
  payload: true,
  createdAt: true,
  owner: true,
  creationFlags: true,
  attributes: true,
} as const;

export type ExplorerKind = 'tip' | 'desk' | 'canary' | 'reply';

export type DeskRow = ProjectedEntity<typeof DESK_SELECT>;
export type CanaryRow = ProjectedEntity<typeof CANARY_SELECT>;

export type SignedCanaryWrite = {
  statement: string;
  issuedAt: bigint;
  signature: Hex;
};

export type CreateDeskOpts = {
  domain?: string | undefined;
  signed?: SignedCanaryWrite | undefined;
};

export type RenewOpts = {
  holdKeys?: Hex[];
  signed?: SignedCanaryWrite;
  owner?: Hex;
};

export function pickNewestCanary<T extends { createdAt?: bigint | undefined }>(rows: readonly T[]): T | null {
  if (!rows.length) return null;
  return rows.reduce((best, row) => {
    const a = best.createdAt ?? 0n;
    const b = row.createdAt ?? 0n;
    return b > a ? row : best;
  });
}

export function canarySigFromRow(row: { attributes?: Attributes; payload?: Uint8Array } | null | undefined): {
  statement: string;
  issuedAt: string | null;
  signature: Hex | null;
} {
  if (!row) return { statement: DEFAULT_CANARY_STATEMENT, issuedAt: null, signature: null };
  const issued = attrU64(row.attributes, 'issuedAt');
  const sig = attrStr(row.attributes, 'sig');
  let statement = attrStr(row.attributes, 'statement') ?? DEFAULT_CANARY_STATEMENT;
  let issuedAt = issued != null ? issued.toString() : null;
  let signature = sig && sig.startsWith('0x') ? (sig as Hex) : null;
  if (row.payload) {
    try {
      const parsed: unknown = JSON.parse(new TextDecoder().decode(row.payload));
      if (typeof parsed === 'object' && parsed !== null) {
        const rec = parsed as Record<string, unknown>;
        if (typeof rec.statement === 'string' && rec.statement.trim()) statement = rec.statement.trim();
        if (typeof rec.issuedAt === 'string' || typeof rec.issuedAt === 'number') issuedAt = String(rec.issuedAt);
        if (typeof rec.sig === 'string' && rec.sig.startsWith('0x')) signature = rec.sig as Hex;
      }
    } catch {
      // Keep attribute fields.
    }
  }
  return { statement, issuedAt, signature };
}
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

export function resetPublicClients() {
  _pub = undefined;
  _ws = undefined;
}

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

function canaryWriteAttrs(deskKey: Hex, signed?: SignedCanaryWrite) {
  const attrs: Record<string, ReturnType<typeof str> | ReturnType<typeof key> | ReturnType<typeof u64>> = {
    project: str(PROJECT),
    type: str('canary'),
    desk: key(deskKey),
  };
  if (signed) {
    attrs.statement = str(signed.statement);
    attrs.issuedAt = u64(signed.issuedAt);
    attrs.sig = str(signed.signature);
  }
  return attrs;
}

function canaryWritePayload(signed?: SignedCanaryWrite) {
  if (!signed) return jsonToPayload({ statement: DEFAULT_CANARY_STATEMENT });
  return jsonToPayload({
    statement: signed.statement,
    issuedAt: signed.issuedAt.toString(),
    sig: signed.signature,
  });
}

/** Desk onboarding: desk + first canary land atomically. Canary points at the predicted desk key. */
export async function createDesk(
  w: Wallet,
  owner: Hex,
  name: string,
  deskPubRaw: Uint8Array,
  txParams?: TxParams,
  opts?: CreateDeskOpts,
) {
  const [desk, canary] = await pub().predictEntityKeys({ owner, count: 2 });
  const deskPayload: Record<string, unknown> = { name, pub: Array.from(deskPubRaw) };
  if (opts?.domain) deskPayload.domain = opts.domain;
  return w.executeBatch({
    creates: [
      {
        salt: desk.salt,
        payload: jsonToPayload(deskPayload),
        contentType: 'application/json',
        attributes: { project: str(PROJECT), type: str('desk'), slot: u64(utcDaySlot()) },
        expires: ExpirationTime.fromDays(30),
      },
      {
        salt: canary.salt,
        payload: canaryWritePayload(opts?.signed),
        contentType: 'application/json',
        attributes: canaryWriteAttrs(desk.key, opts?.signed),
        expires: ExpirationTime.fromHours(26),
        flags: { readonly: true },
      },
    ],
  }, txParams);
}

/** extendEntity SETS expiry from now. It does not add to the remaining lifetime. */
export async function renew(w: Wallet, deskKey: Hex, canaryKey: Hex, txParams?: TxParams, opts?: RenewOpts) {
  const holdKeys = opts?.holdKeys ?? [];
  const extensions = [
    { entityKey: canaryKey, expires: ExpirationTime.fromHours(26) },
    { entityKey: deskKey, expires: ExpirationTime.fromDays(30) },
    ...holdKeys.map((entityKey) => ({ entityKey, expires: ExpirationTime.fromHours(26) })),
  ];
  if (!opts?.signed || !opts.owner) {
    return w.executeBatch({ extensions }, txParams);
  }
  const [next] = await pub().predictEntityKeys({ owner: opts.owner, count: 1 });
  return w.executeBatch(
    {
      creates: [
        {
          salt: next.salt,
          payload: canaryWritePayload(opts.signed),
          contentType: 'application/json',
          attributes: canaryWriteAttrs(deskKey, opts.signed),
          expires: ExpirationTime.fromHours(26),
          flags: { readonly: true },
        },
      ],
      extensions,
    },
    txParams,
  );
}

export async function getDesk(deskCreator: Hex, preferPub?: Uint8Array, head?: bigint): Promise<DeskRow | undefined> {
  const alive = head != null ? gt('$expiresAt', u64(head)) : await aliveHead();
  const r = await pub()
    .select(DESK_SELECT)
    .where(eq('project', PROJECT), eq('type', 'desk'), alive)
    .createdBy(deskCreator)
    .limit(20)
    .fetch();
  return pickLiveDesk([...r.entities], preferPub);
}

/** One query for the live desk and its canary. Pass head to skip a second block read. */
export async function deskAndCanary(
  deskCreator: Hex,
  preferPub?: Uint8Array,
  head?: bigint,
): Promise<{
  desk: DeskRow | undefined;
  canary: CanaryRow | null;
  currentBlock: bigint;
  blockDuration: number;
}> {
  let currentBlock = head;
  let blockDuration = 2;
  if (currentBlock == null) {
    const timing = await pub().getBlockTiming();
    currentBlock = timing.currentBlock;
    blockDuration = timing.blockDuration || 2;
  }
  const r = await pub()
    .select(BUNDLE_SELECT)
    .where(
      eq('project', PROJECT),
      or(eq('type', 'desk'), eq('type', 'canary')),
      gt('$expiresAt', u64(currentBlock)),
    )
    .createdBy(deskCreator)
    .limit(40)
    .fetch();
  const desks = r.entities.filter((row) => attrStr(row.attributes, 'type') === 'desk');
  const canaries = r.entities.filter((row) => attrStr(row.attributes, 'type') === 'canary');
  const desk = pickLiveDesk(desks, preferPub);
  const deskKey = desk?.key?.toLowerCase();
  const canaryRow = deskKey
    ? pickNewestCanary(canaries.filter((row) => attrKey(row.attributes, 'desk')?.toLowerCase() === deskKey))
    : null;
  return {
    desk: desk as DeskRow | undefined,
    canary: (canaryRow as CanaryRow | null) ?? null,
    currentBlock: r.blockNumber ?? currentBlock,
    blockDuration,
  };
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

export async function canaryAlive(deskCreator: Hex, deskKey: Hex, head?: bigint): Promise<CanaryRow | null> {
  const alive = head != null ? gt('$expiresAt', u64(head)) : await aliveHead();
  const r = await pub()
    .select(CANARY_SELECT)
    .where(eq('project', PROJECT), eq('type', 'canary'), eq('desk', key(deskKey)), alive)
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

export function tipVisibleInInbox(owner: Hex | null | undefined): boolean {
  return isSealedOwner(owner);
}

export function inboxPageQueryText(deskKey: Hex): string {
  return pub()
    .select(INBOX_SELECT)
    .where(eq('project', PROJECT), eq('type', 'tip'), eq('desk', key(deskKey)))
    .ownedBy(SEALED_OWNER)
    .toString();
}

export async function inboxPage(deskKey: Hex, opts?: PageWalk): Promise<InboxPage> {
  const head = opts?.atBlock ?? (await headBlock());
  let q = pub()
    .select(INBOX_SELECT)
    .where(eq('project', PROJECT), eq('type', 'tip'), eq('desk', key(deskKey)))
    .ownedBy(SEALED_OWNER)
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

const REPLY_LIST_SELECT = {
  key: true,
  payload: true,
  createdAt: true,
  attributes: true,
} as const;

export type ReplyListRow = ProjectedEntity<typeof REPLY_LIST_SELECT>;

/** One page of replies from this desk, instead of one query per tip. */
export async function repliesForCreator(deskCreator: Hex): Promise<readonly ReplyListRow[]> {
  return (
    await pub()
      .select(REPLY_LIST_SELECT)
      .where(eq('project', PROJECT), eq('type', 'reply'))
      .createdBy(deskCreator)
      .limit(50)
      .fetch()
  ).entities;
}

export const reply = (
  w: Wallet,
  tipKey: Hex,
  wire: Uint8Array,
  deskKey?: Hex,
  txParams?: TxParams,
  stealth?: StealthAnnouncement,
) =>
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
            ...(stealth
              ? {
                  scheme: u64(BigInt(stealth.schemeId)),
                  stealth: str(stealth.stealthAddress),
                  eph: str(stealth.ephemeralPub),
                  vtag: str(stealth.viewTag),
                }
              : {}),
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
  onPatched?: (k: Hex) => void;
  onDeleted?: (k: Hex) => void;
  onError?: (err: Error) => void;
};

export type DeskEntityShape = {
  key?: Hex;
  attributes?: Attributes;
};

/** True when the entity is a CanaryDrop tip, canary, or desk row for this desk key. */
export function entityBelongsToDesk(entity: DeskEntityShape | null | undefined, deskKey: Hex): boolean {
  if (!entity?.key) return false;
  if (attrStr(entity.attributes, 'project') !== PROJECT) return false;
  const type = attrStr(entity.attributes, 'type');
  const desk = deskKey.toLowerCase();
  if (type === 'desk') return entity.key.toLowerCase() === desk;
  if (type === 'tip' || type === 'canary' || type === 'drop' || type === 'release' || type === 'hold') {
    const labeled = attrKey(entity.attributes, 'desk');
    return !!labeled && labeled.toLowerCase() === desk;
  }
  return false;
}

export type WatchEntityOwner = {
  key?: Hex;
  attributes?: Attributes;
  owner?: Hex | null;
};

/** A live tip is only ready for the inbox after it has been handed to the burn address. */
export function watchCreatedTipReady(entity: WatchEntityOwner | null | undefined, deskKey: Hex): boolean {
  if (!entityBelongsToDesk(entity, deskKey)) return false;
  if (attrStr(entity?.attributes, 'type') !== 'tip') return false;
  return isSealedOwner(entity?.owner);
}

export type WatchKind = 'sealed' | 'patched' | 'deleted';

/** Decide whether a chain-wide watch event is about this desk. Fetch when you can; use known keys after a delete. */
export function watchEventForDesk(opts: {
  kind: WatchKind;
  entityKey: Hex;
  deskKey: Hex;
  knownKeys: ReadonlySet<string>;
  entity?: DeskEntityShape | null;
  newOwner?: Hex;
}): boolean {
  if (opts.kind === 'sealed' && opts.newOwner && opts.newOwner.toLowerCase() !== SEALED_OWNER.toLowerCase()) {
    return false;
  }
  if (opts.entity) return entityBelongsToDesk(opts.entity, opts.deskKey);
  return opts.knownKeys.has(opts.entityKey.toLowerCase());
}

export function watchInbox(deskKey: Hex, onTipOrHandlers: ((k: Hex) => void) | InboxWatchHandlers) {
  const handlers: InboxWatchHandlers =
    typeof onTipOrHandlers === 'function' ? { onTip: onTipOrHandlers } : onTipOrHandlers;
  let stopped = false;
  let unwatch: (() => void) | undefined;
  const knownKeys = new Set<string>();

  const remember = (k: Hex) => {
    knownKeys.add(k.toLowerCase());
  };

  const ours = async (entityKey: Hex): Promise<boolean> => {
    try {
      const e = await pub().getEntity(entityKey);
      if (entityBelongsToDesk(e, deskKey)) {
        remember(entityKey);
        return true;
      }
      return false;
    } catch {
      return knownKeys.has(entityKey.toLowerCase());
    }
  };

  const start = () => {
    if (stopped) return;
    unwatch = ws().watchEntityEvents({
      onEntityCreated: async (ev: EntityCreatedEvent) => {
        try {
          const e = await pub().getEntity(ev.entityKey);
          if (watchCreatedTipReady(e, deskKey)) {
            remember(ev.entityKey);
            handlers.onTip(ev.entityKey);
          }
        } catch {
          return;
        }
      },
      onExpiryExtended: async (ev: ExpiryExtendedEvent) => {
        if (await ours(ev.entityKey)) handlers.onExpiry?.(ev.entityKey, ev.expiresAt);
      },
      onOwnershipTransferred: async (ev) => {
        if (ev.newOwner.toLowerCase() !== SEALED_OWNER.toLowerCase()) return;
        if (await ours(ev.entityKey)) handlers.onSealed?.(ev.entityKey);
      },
      onEntityPatched: async (ev: EntityPatchedEvent) => {
        if (await ours(ev.entityKey)) handlers.onPatched?.(ev.entityKey);
      },
      onEntityDeleted: (ev: EntityDeletedEvent) => {
        if (
          watchEventForDesk({
            kind: 'deleted',
            entityKey: ev.entityKey,
            deskKey,
            knownKeys,
          })
        ) {
          handlers.onDeleted?.(ev.entityKey);
        }
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

/** Chosen lifetime, but never shorter than DEMO_TIP_LIVE_UNTIL while that date is still ahead. */
export function tipExpires(life: Lifetime, now = new Date()) {
  const chosen = LIFETIMES[life];
  if (now.getTime() < DEMO_TIP_LIVE_UNTIL.getTime()) {
    return ExpirationTime.atDate(DEMO_TIP_LIVE_UNTIL, { atLeast: chosen });
  }
  return chosen;
}

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

export type ExplorerWalk = PageWalk & {
  kind?: ExplorerKind;
  sealed?: boolean;
};

export async function explorerPage(opts?: ExplorerWalk) {
  const head = opts?.atBlock ?? (await headBlock());
  const filters = [eq('project', PROJECT)];
  if (opts?.sealed && !opts.kind) filters.push(eq('type', 'tip'));
  else if (opts?.kind) filters.push(eq('type', opts.kind));
  let q = pub().select(EXPLORER_SELECT).where(...filters).limit(20).atBlock(head);
  if (opts?.sealed) q = q.ownedBy(SEALED_OWNER);
  if (opts?.cursor) q = q.cursor(opts.cursor);
  return q.fetch();
}

/** Tips the sponsor created and then handed to the burn address. Nobody can extend them. */
export async function sealedTips(opts?: PageWalk) {
  const head = opts?.atBlock ?? (await headBlock());
  let q = pub()
    .select(SEALED_SELECT)
    .where(eq('project', PROJECT), eq('type', 'tip'))
    .createdBy(relayAddress())
    .ownedBy(SEALED_OWNER)
    .limit(20)
    .atBlock(head);
  if (opts?.cursor) q = q.cursor(opts.cursor);
  return q.fetch();
}

export async function tipsOrCanaries() {
  return pub()
    .select({ key: true, attributes: true, owner: true, creator: true })
    .where(eq('project', PROJECT), or(eq('type', 'tip'), eq('type', 'canary')))
    .limit(20)
    .fetch();
}

/** slot is YYYYMMDD. Use this instead of filtering $createdAt, which the node rejects. */
export async function countTipsFromSlot(creator: Hex, fromSlot: bigint): Promise<number> {
  const page = await pub()
    .select(COUNT_SELECT)
    .where(eq('project', PROJECT), eq('type', 'tip'), gte('slot', u64(fromSlot)))
    .createdBy(creator)
    .limit(200)
    .fetch();
  return page.entities.length;
}

export async function countTipsToSlot(creator: Hex, toSlot: bigint): Promise<number> {
  const page = await pub()
    .select(COUNT_SELECT)
    .where(eq('project', PROJECT), eq('type', 'tip'), lte('slot', u64(toSlot)))
    .createdBy(creator)
    .limit(200)
    .fetch();
  return page.entities.length;
}

export function mintNonce(owner: Hex): Promise<bigint> {
  return pub().getEntityNonce(owner);
}

export function chainEntityCount(): Promise<number> {
  return pub().getEntityCount();
}

/** Predicate text the node will parse. This is not the full select or limit. */
export function queryPredicate(builder: { toString: () => string }): string {
  return builder.toString();
}

export function sealedTipsQueryText(): string {
  return pub()
    .select(SEALED_SELECT)
    .where(eq('project', PROJECT), eq('type', 'tip'))
    .createdBy(relayAddress())
    .ownedBy(SEALED_OWNER)
    .toString();
}

export function liveDeskQueryText(creator: Hex): string {
  return pub()
    .select(DESK_SELECT)
    .where(eq('project', PROJECT), eq('type', 'desk'))
    .createdBy(creator)
    .toString();
}
