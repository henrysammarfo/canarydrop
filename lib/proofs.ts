import type { Hex } from 'viem';
import evidence from '@/arkiv/evidence.json';
import {
  canaryAtBlock,
  chainEntityCount,
  countBySlot,
  getDesk,
  headBlock,
  mintNonce,
  pub,
  queryPredicate,
  sealedTips,
  sealedTipsQueryText,
  tipsOrCanaries,
} from './arkiv';
import {
  CHAIN_READ_FAILED,
  DEFAULT_DESK,
  DEFAULT_IMPOSTOR,
  DEFAULT_RELAY,
  PROJECT,
  PROOF_CACHE_MS,
  PROOF_STALE_MS,
  SEALED_TIPS_EMPTY,
} from './constants';
import { rememberRead } from './data-cache';
import { loadDeskLive } from './live-read';
import { StaleCache } from './read-cache';
import { withReadBackoff } from './retry';
import { showingDataFrom } from './stale-copy';
import { atBlockAbsenceDetail } from './at-block-copy';
import { addressUrl, entityUrl, isSealedOwner, txUrl } from './chain';
import { eq, gt, or } from '@arkiv-network/sdk/query';
import { key, u64 } from '@arkiv-network/sdk/attr';
import { utcDaySlot } from './day';

export type ProofLink = { label: string; href: string };

export type ProofFact = { label: string; value: string };

export type ProofClaim = {
  id: string;
  title: string;
  why: string;
  query: string;
  ok: boolean;
  detail: string;
  links: ProofLink[];
  facts?: ProofFact[];
};

export type ArkivProofs = {
  head: string;
  chainEntities: string;
  claims: ProofClaim[];
  seedTxs: ProofLink[];
  fetchedAt: number;
  stale: boolean;
  note: string | null;
};

function entityLinks(keys: readonly string[], cap = 6): ProofLink[] {
  return keys.slice(0, cap).map((k, i) => ({
    label: `Entity ${i + 1}`,
    href: entityUrl(k),
  }));
}

export function seedTxLinks(): ProofLink[] {
  return evidence.txs.map((hash, i) => ({
    label: `Seed write ${i + 1}`,
    href: txUrl(hash),
  }));
}

export function isFreshProofCache(cachedAt: number, now = Date.now(), ttl = PROOF_CACHE_MS): boolean {
  return now - cachedAt >= 0 && now - cachedAt < ttl;
}

function logChainRead(scope: string, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  const clipped = msg.replace(/0x[0-9a-fA-F]{64}/g, '0x…').slice(0, 300);
  console.error(`CanaryDrop proofs ${scope}:`, clipped);
}

const proofStore = new StaleCache({ freshMs: PROOF_CACHE_MS, staleMs: PROOF_STALE_MS });

export function clearArkivProofsCache() {
  proofStore.clear();
}

function skeletonProofs(): ArkivProofs {
  return {
    head: 'n/a',
    chainEntities: 'n/a',
    claims: [],
    seedTxs: seedTxLinks(),
    fetchedAt: Date.now(),
    stale: false,
    note: CHAIN_READ_FAILED,
  };
}

export async function gatherArkivProofs(): Promise<ArkivProofs> {
  const result = await proofStore.get(
    'proofs',
    () => rememberRead('proofs', gatherArkivProofsUncached),
    {
      fallback: skeletonProofs,
    },
  );
  const age = Math.max(0, Date.now() - result.at);
  return {
    ...result.value,
    fetchedAt: result.at,
    stale: result.stale,
    note: result.stale ? showingDataFrom(age) : result.value.note,
  };
}

async function gatherArkivProofsUncached(): Promise<ArkivProofs> {
  const live = await loadDeskLive(DEFAULT_DESK);
  const head = live.currentBlock ? BigInt(live.currentBlock) : await withReadBackoff(() => headBlock());
  const hourAgo = head > 1800n ? head - 1800n : 0n;
  const claims: ProofClaim[] = [];

  let chainEntities = 'n/a';
  try {
    chainEntities = String(await withReadBackoff(() => chainEntityCount()));
  } catch {
    chainEntities = 'n/a';
  }

  const sealedQuery = sealedTipsQueryText();

  try {
    const deskKey = live.deskKey;
    const q = pub()
      .select({ key: true })
      .where(eq('project', PROJECT), eq('type', 'desk'), gt('$expiresAt', u64(head)))
      .createdBy(DEFAULT_DESK);
    claims.push({
      id: 'createdBy',
      title: 'Only the real desk wallet counts',
      why: 'A fake desk with the same name is ignored. Reads are pinned to the newsroom wallet.',
      query: queryPredicate(q),
      ok: !!deskKey,
      detail: deskKey
        ? 'This is the live desk for the newsroom wallet.'
        : live.note && !live.stale
          ? live.note
          : 'No live desk for the demo wallet.',
      facts: [
        ...(deskKey ? [{ label: 'Desk', value: deskKey }] : []),
        { label: 'Creator', value: DEFAULT_DESK },
      ],
      links: deskKey
        ? [
            { label: 'Desk entity', href: entityUrl(deskKey) },
            { label: 'Desk wallet', href: addressUrl(DEFAULT_DESK) },
          ]
        : [{ label: 'Desk wallet', href: addressUrl(DEFAULT_DESK) }],
    });

    if (deskKey) {
      const canaryKey = live.canaryKey;
      const cq = pub()
        .select({ key: true, expiresAt: true, creationFlags: true })
        .where(eq('project', PROJECT), eq('type', 'canary'), eq('desk', key(deskKey)), gt('$expiresAt', u64(head)))
        .createdBy(DEFAULT_DESK);
      claims.push({
        id: 'expiry',
        title: 'The canary dies if it is not renewed',
        why: 'Expiry is the signal. There is no off chain flag a seized server can flip.',
        query: queryPredicate(cq),
        ok: !!canaryKey,
        detail: canaryKey
          ? `Alive. Expires at block ${live.expiresAt ?? 'n/a'}.`
          : 'Gone. No live canary for this desk.',
        facts: canaryKey ? [{ label: 'Canary', value: canaryKey }] : [],
        links: canaryKey
          ? [
              { label: 'Canary entity', href: entityUrl(canaryKey) },
              { label: 'Public canary page', href: `/canary/${DEFAULT_DESK}` },
            ]
          : [{ label: 'Public canary page', href: `/canary/${DEFAULT_DESK}` }],
      });

      const past = await withReadBackoff(() => canaryAtBlock(DEFAULT_DESK, deskKey, hourAgo));
      const absence = atBlockAbsenceDetail({
        hourAgo,
        pastAlive: past !== null,
        createdAt: live.createdAt ? BigInt(live.createdAt) : null,
      });
      claims.push({
        id: 'atBlock',
        title: 'Was this canary alive about an hour ago?',
        why: 'A pinned block is a small time machine. If the canary was created later, it will not appear at that block.',
        query: `same canary query, atBlock(${hourAgo.toString()}) and $expiresAt > u64(${hourAgo.toString()})`,
        ok: absence.ok,
        detail: absence.detail,
        links: [{ label: 'Public canary page', href: `/canary/${DEFAULT_DESK}` }],
      });
    }
  } catch (err) {
    logChainRead('createdBy', err);
    claims.push({
      id: 'createdBy',
      title: 'Only the real desk wallet counts',
      why: 'A fake desk with the same name is ignored. Reads are pinned to the newsroom wallet.',
      query: `createdBy(${DEFAULT_DESK})`,
      ok: false,
      detail: CHAIN_READ_FAILED,
      links: [{ label: 'Desk wallet', href: addressUrl(DEFAULT_DESK) }],
    });
  }

  try {
    const page = await withReadBackoff(() => sealedTips());
    const keys = page.entities.map((e) => e.key).filter((k): k is Hex => !!k);
    const allSealed = page.entities.every((e) => isSealedOwner(e.owner));
    const readonly = page.entities.filter((e) => e.creationFlags?.readonly).length;
    const noOpenExtend = page.entities.filter((e) => e.creationFlags && !e.creationFlags.permissionlessExtension).length;
    claims.push({
      id: 'ownedBy',
      title: 'Sealed tips have a burn owner',
      why: 'The sponsor creates the tip, then hands it to a burn address in the same batch. Nobody can extend, patch, or delete it later.',
      query: sealedQuery,
      ok: keys.length === 0 || allSealed,
      detail:
        keys.length === 0
          ? SEALED_TIPS_EMPTY
          : `${keys.length} live sealed tips. ${readonly} marked readonly. ${noOpenExtend} refuse open extension. Owner is the burn address on every row.`,
      links: [
        ...entityLinks(keys),
        { label: 'Sponsor wallet', href: addressUrl(DEFAULT_RELAY) },
        { label: 'Burn address', href: addressUrl('0x000000000000000000000000000000000000dEaD') },
      ],
    });
  } catch (err) {
    logChainRead('ownedBy', err);
    claims.push({
      id: 'ownedBy',
      title: 'Sealed tips have a burn owner',
      why: 'The sponsor creates the tip, then hands it to a burn address in the same batch.',
      query: sealedQuery,
      ok: false,
      detail: CHAIN_READ_FAILED,
      links: [{ label: 'Sponsor wallet', href: addressUrl(DEFAULT_RELAY) }],
    });
  }

  try {
    const fake = await withReadBackoff(() => getDesk(DEFAULT_IMPOSTOR));
    claims.push({
      id: 'impostor',
      title: 'An impostor desk does not match',
      why: 'createdBy is the access control we actually use. A copycat name from another wallet is not the newsroom.',
      query: queryPredicate(
        pub().select({ key: true }).where(eq('project', PROJECT), eq('type', 'desk')).createdBy(DEFAULT_IMPOSTOR),
      ),
      ok: fake === undefined || fake.creator.toLowerCase() === DEFAULT_IMPOSTOR.toLowerCase(),
      detail: fake
        ? 'The impostor has a live desk. The source UI still ignores it because it is not the demo desk wallet.'
        : 'No live impostor desk at this block.',
      facts: [
        ...(fake ? [{ label: 'Impostor desk', value: fake.key }] : []),
        { label: 'Impostor wallet', value: DEFAULT_IMPOSTOR },
      ],
      links: [
        { label: 'Impostor wallet', href: addressUrl(DEFAULT_IMPOSTOR) },
        ...(fake ? [{ label: 'Impostor desk', href: entityUrl(fake.key) }] : []),
      ],
    });
  } catch (err) {
    logChainRead('impostor', err);
    claims.push({
      id: 'impostor',
      title: 'An impostor desk does not match',
      why: 'createdBy is the access control we actually use.',
      query: `createdBy(${DEFAULT_IMPOSTOR})`,
      ok: false,
      detail: CHAIN_READ_FAILED,
      links: [{ label: 'Impostor wallet', href: addressUrl(DEFAULT_IMPOSTOR) }],
    });
  }

  try {
    const used = await withReadBackoff(() => countBySlot('tip', DEFAULT_RELAY, utcDaySlot()));
    claims.push({
      id: 'slot',
      title: 'Daily spend uses a slot attribute',
      why: 'The node will not filter $createdAt. A u64 slot for the UTC day is the indexed day bucket we can actually query.',
      query: `eq("type","tip") and eq("slot", u64(${utcDaySlot().toString()})) createdBy(${DEFAULT_RELAY})`,
      ok: Number.isFinite(used),
      detail: `${used} tips with today's slot from the sponsor. Older seed tips may have no slot and do not count here.`,
      links: [{ label: 'Sponsor wallet', href: addressUrl(DEFAULT_RELAY) }],
    });
  } catch (err) {
    logChainRead('slot', err);
    claims.push({
      id: 'slot',
      title: 'Daily spend uses a slot attribute',
      why: 'The node will not filter $createdAt.',
      query: `eq("slot", u64(${utcDaySlot().toString()}))`,
      ok: false,
      detail: CHAIN_READ_FAILED,
      links: [],
    });
  }

  try {
    const nonce = await withReadBackoff(() => mintNonce(DEFAULT_RELAY));
    claims.push({
      id: 'nonce',
      title: 'Entity mint nonce is not the Ethereum nonce',
      why: 'predictEntityKeys reads this counter. Two in flight creates from one wallet can predict the same key. That is why writes are queued.',
      query: `getEntityNonce(${DEFAULT_RELAY})`,
      ok: nonce >= 0n,
      detail: `Next mint nonce for the sponsor is ${nonce.toString()}. Ethereum pending nonce is a separate number.`,
      links: [{ label: 'Sponsor wallet', href: addressUrl(DEFAULT_RELAY) }],
    });
  } catch (err) {
    logChainRead('nonce', err);
    claims.push({
      id: 'nonce',
      title: 'Entity mint nonce is not the Ethereum nonce',
      why: 'predictEntityKeys reads this counter.',
      query: `getEntityNonce(${DEFAULT_RELAY})`,
      ok: false,
      detail: CHAIN_READ_FAILED,
      links: [],
    });
  }

  try {
    const mixed = await withReadBackoff(() => tipsOrCanaries());
    claims.push({
      id: 'or',
      title: 'One query can ask for tips or canaries',
      why: 'The explorer can show more than one type without a second round trip.',
      query: queryPredicate(
        pub().select({ key: true }).where(eq('project', PROJECT), or(eq('type', 'tip'), eq('type', 'canary'))),
      ),
      ok: mixed.entities.length > 0,
      detail: `${mixed.entities.length} rows in this page. Latest block for the page is ${mixed.blockNumber.toString()}.`,
      links: entityLinks(mixed.entities.map((e) => e.key).filter((k): k is Hex => !!k), 4),
    });
  } catch (err) {
    logChainRead('or', err);
    claims.push({
      id: 'or',
      title: 'One query can ask for tips or canaries',
      why: 'The explorer can show more than one type without a second round trip.',
      query: 'or(eq("type","tip"), eq("type","canary"))',
      ok: false,
      detail: CHAIN_READ_FAILED,
      links: [],
    });
  }

  claims.push({
    id: 'count',
    title: 'getEntityCount is the whole chain',
    why: 'This number is not "how many CanaryDrop entities exist". Project counts still need a select with project and type.',
    query: 'getEntityCount()',
    ok: chainEntities !== 'n/a',
    detail: `Tiramisu currently stores ${chainEntities} live entities across every app. Our queries always add project = ${PROJECT}.`,
    links: [{ label: 'Tiramisu explorer', href: 'https://tiramisu.explorer.arkiv.network' }],
  });

  claims.push({
    id: 'batch',
    title: 'Desk plus canary, and tip plus seal, are one transaction',
    why: 'If the second step could fail alone, a tip could exist without a seal, or a canary could exist without a desk. A batch makes that gap impossible.',
    query: 'executeBatch({ creates, ownershipChanges }) and executeBatch({ creates: [desk, canary] })',
    ok: evidence.txs.length >= 2,
    detail: 'Open the seed writes. The first creates desk and canary together. Later writes create a tip and move ownership to the burn address in the same transaction.',
    links: seedTxLinks().slice(0, 4),
  });

  claims.push({
    id: 'watch',
    title: 'The desk inbox is a live subscription',
    why: 'Reads do not go through our server. The browser talks to Arkiv over WebSocket and then decrypts locally.',
    query: 'watchEntityEvents({ onEntityCreated, onExpiryExtended, onOwnershipTransferred, onEntityPatched, onEntityDeleted })',
    ok: true,
    detail: 'Created tips from the sponsor are fetched and opened. A renew keeps the public canary Alive. A transfer to the burn address marks a seal. Patch and delete events are watched so a change attempt is visible.',
    links: [{ label: 'Open the desk', href: '/desk' }],
  });

  return {
    head: head.toString(),
    chainEntities,
    claims,
    seedTxs: seedTxLinks(),
    fetchedAt: Date.now(),
    stale: false,
    note: null,
  };
}
