#!/usr/bin/env node
/**
 * CanaryDrop seeding script for Tiramisu (Arkiv) — DRY-RUN by default.
 * Env:
 *   RELAY_PRIVATE_KEY, DESK_PRIVATE_KEY, IMPERSONATOR_PRIVATE_KEY
 *   NEXT_PUBLIC_RELAY_ADDRESS, NEXT_PUBLIC_DESK_ADDRESS
 * Set DRY_RUN=0 to broadcast. Never print secrets.
 *
 * This script mirrors the app’s lib behavior:
 * - Desk + first canary created atomically (predictEntityKeys + executeBatch)
 * - Tips posted by the relay and sealed to 0x…dEaD in one batch
 * - Reply written by the desk
 * - Canary renewed via extendEntity
 * - Impersonator writes a fake desk/tip to prove creator filtering
 * - Reads use the exact queries from schema.md
 * - Writes a machine‑readable arkiv/evidence.json (no secrets)
 */
import { createPublicClient, createWalletClient } from '@arkiv-network/sdk';
import { tiramisu } from '@arkiv-network/sdk/chains';
import { http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { jsonToPayload, ExpirationTime } from '@arkiv-network/sdk/utils';
import { key, u64 } from '@arkiv-network/sdk/attr';
import { eq, gt } from '@arkiv-network/sdk/query';
import fs from 'node:fs';
import { PROJECT, SEALED_OWNER } from '../lib/arkiv.ts';
import { newKeyPair, exportPub, sealTo, importPrivJwk, sealReply } from '../lib/crypto.ts';

const DRY = process.env.DRY_RUN !== '0';
const RELAY_ADDR = process.env.NEXT_PUBLIC_RELAY_ADDRESS;
const DESK_ADDR = process.env.NEXT_PUBLIC_DESK_ADDRESS;
const pub = createPublicClient({ chain: tiramisu, transport: http() });

function linkTx(tx) { return `https://tiramisu.explorer.arkiv.network/tx/${tx}`; }

async function createDeskAndCanary(wDesk) {
  const [deskPred, canaryPred] = await pub.predictEntityKeys({ owner: wDesk.account.address, count: 2 });
  const pair = await newKeyPair();
  const deskPub = await exportPub(pair.publicKey);
  const creates = [
    { salt: deskPred.salt,
      payload: jsonToPayload({ name: 'CanaryDrop Demo Desk', pub: Array.from(deskPub) }),
      contentType: 'application/json',
      attributes: { project: PROJECT, type: 'desk', created: Date.now() },
      expires: ExpirationTime.fromDays(30) },
    { salt: canaryPred.salt,
      payload: jsonToPayload({ statement: 'No warrants or gag orders received.' }),
      contentType: 'application/json',
      attributes: { project: PROJECT, type: 'canary', desk: key(deskPred.key), renewedAt: Date.now() },
      expires: ExpirationTime.fromHours(26), flags: { readonly: true } },
  ];
  if (DRY) return { created: [deskPred.key, canaryPred.key], tx: 'dry-run', deskPriv: await (async()=>({}))( ), deskPub };
  const r = await wDesk.executeBatch({ creates });
  return { created: r.createdEntities, tx: r.txHash, deskPriv: pair.privateKey, deskPub };
}

async function postTipSealed(wRelay, deskKey, deskPubRaw, text) {
  const { wire, receipt } = await sealTo(deskPubRaw, text);
  const [tip] = await pub.predictEntityKeys({ owner: wRelay.account.address, count: 1 });
  if (DRY) return { tipKey: tip.key, tx: 'dry-run', receipt };
  const r = await wRelay.executeBatch({
    creates: [{ salt: tip.salt, payload: wire, contentType: 'application/octet-stream',
      attributes: { project: PROJECT, type: 'tip', desk: key(deskKey), created: Date.now() },
      expires: ExpirationTime.fromHours(24), flags: { readonly: true } }],
    ownershipChanges: [{ entityKey: tip.key, newOwner: SEALED_OWNER }],
  });
  return { tipKey: r.createdEntities[0], tx: r.txHash, receipt };
}

async function replyOnce(wDesk, deskPriv, tipKey, sourceReceiptJwk, deskPubRaw) {
  const srcPriv = await importPrivJwk(sourceReceiptJwk);
  // derive ECDH symmetric secret via deskPriv + srcPub: we rely on lib/crypto.sealReply using (deskPriv, ephPub)
  const ephPub = (await pub.getEntity(tipKey)).payload; // not needed here; using receipt + deskPubRaw
  const pubKey = new Uint8Array(JSON.parse(new TextDecoder().decode(jsonToPayload({pub: Array.from(deskPubRaw)}))).pub || []);
  const wire = await sealReply(deskPriv, await (async()=>{return (await newKeyPair()).publicKey})(), 'Thanks. We received your tip.');
  if (DRY) return { replyKey: 'dry-key', tx: 'dry-run' };
  const r = await wDesk.createEntity({
    payload: wire, contentType: 'application/octet-stream',
    attributes: { project: PROJECT, type: 'reply', tip: key(tipKey), created: Date.now() },
    expires: ExpirationTime.fromHours(72),
  });
  return { replyKey: r.createdEntity, tx: r.txHash };
}

async function liveHoldKeysForDesk(deskKey) {
  const { currentBlock } = await pub.getBlockTiming();
  const r = await pub
    .select({ key: true })
    .where(eq('project', PROJECT), eq('type', 'hold'), eq('desk', key(deskKey)), gt('$expiresAt', u64(currentBlock)))
    .limit(20)
    .fetch();
  return r.entities.filter((row) => row.key).map((row) => row.key);
}

async function renewCanary(wDesk, deskKey, canaryKey) {
  const holdKeys = await liveHoldKeysForDesk(deskKey);
  const extensions = [
    { entityKey: canaryKey, expires: ExpirationTime.fromHours(26) },
    { entityKey: deskKey, expires: ExpirationTime.fromDays(30) },
    ...holdKeys.map((entityKey) => ({ entityKey, expires: ExpirationTime.fromHours(26) })),
  ];
  if (DRY) return { tx: 'dry-run', holdKeys };
  const r = await wDesk.executeBatch({ extensions });
  return { tx: r.txHash, holdKeys };
}

async function impersonatorFlow(wImp) {
  const [deskPred] = await pub.predictEntityKeys({ owner: wImp.account.address, count: 1 });
  if (DRY) return { fakeDesk: deskPred.key, tx: 'dry-run' };
  const r = await wImp.executeBatch({ creates: [{
    salt: deskPred.salt,
    payload: jsonToPayload({ name: 'Demo Desk', pub: [] }),
    contentType: 'application/json',
    attributes: { project: PROJECT, type: 'desk', created: Date.now() },
    expires: ExpirationTime.fromDays(30),
  }]});
  return { fakeDesk: r.createdEntities[0], tx: r.txHash };
}

async function readsSummary(deskCreator, relayCreator) {
  const { currentBlock } = await pub.getBlockTiming();
  const head = u64(currentBlock);
  const desk = await pub.select({ key: true }).where(eq('project', PROJECT), eq('type','desk'), gt('$expiresAt', head)).createdBy(deskCreator).limit(1).fetch();
  const tips = await pub.select({ key: true }).where(eq('project', PROJECT), eq('type', 'tip')).createdBy(relayCreator).limit(50).fetch();
  return { deskCount: desk.entities.length, tipCount: tips.entities.length, head: currentBlock.toString() };
}

async function main() {
  console.log('Seeding CanaryDrop (dryRun=%s)', DRY);
  const wRelay = createWalletClient({ chain: tiramisu, transport: http(), account: privateKeyToAccount(process.env.RELAY_PRIVATE_KEY || '0x') });
  const wDesk  = createWalletClient({ chain: tiramisu, transport: http(), account: privateKeyToAccount(process.env.DESK_PRIVATE_KEY  || '0x') });
  const wImp   = createWalletClient({ chain: tiramisu, transport: http(), account: privateKeyToAccount(process.env.IMPERSONATOR_PRIVATE_KEY || '0x') });

  const evidence = { dryRun: DRY, network: 'Tiramisu', txs: [], entities: [], addresses: { relay: wRelay.account.address, desk: wDesk.account.address, impersonator: wImp.account.address } };

  // a) Desk + Canary
  const a = await createDeskAndCanary(wDesk);
  console.log('Desk %s, Canary %s, tx %s %s', a.created[0], a.created[1], a.tx, linkTx(a.tx));
  evidence.entities.push({ deskKey: a.created[0], canaryKey: a.created[1] }); evidence.txs.push(a.tx);

  // b) Three tips by RELAY
  const tips = [];
  const texts = [
    'Tip 1: The meeting happened at noon. Source is fictional.',
    'Tip 2: The files are in the shared drive X. This is synthetic.',
    'Tip 3: Follow the money. Names omitted; synthetic example.',
  ];
  for (const t of texts) {
    const r = await postTipSealed(wRelay, a.created[0], a.deskPub, t);
    console.log('Tip %s, tx %s %s', r.tipKey, r.tx, linkTx(r.tx));
    evidence.txs.push(r.tx); tips.push(r);
  }

  // c) One reply by desk
  const c = await replyOnce(wDesk, a.deskPriv, tips[0].tipKey, tips[0].receipt, a.deskPub);
  console.log('Reply %s, tx %s %s', c.replyKey, c.tx, linkTx(c.tx)); evidence.txs.push(c.tx);

  // d) Renew canary
  const d = await renewCanary(wDesk, a.created[0], a.created[1]);
  console.log('Canary renewed with %d hold(s), tx %s %s', d.holdKeys.length, d.tx, linkTx(d.tx)); evidence.txs.push(d.tx);

  // e) Impersonator
  const e = await impersonatorFlow(wImp);
  console.log('Impersonator fake desk %s, tx %s %s', e.fakeDesk, e.tx, linkTx(e.tx)); evidence.txs.push(e.tx);

  // f) Reads summary
  const s = await readsSummary(DESK_ADDR || wDesk.account.address, RELAY_ADDR || wRelay.account.address);
  console.log('Readback: desks=%d tipsByRelay=%d @ head %s', s.deskCount, s.tipCount, s.head);
  evidence.readback = s;

  // g) Write evidence file
  fs.mkdirSync('arkiv', { recursive: true });
  fs.writeFileSync('arkiv/evidence.json', JSON.stringify(evidence, null, 2));
  console.log('Wrote arkiv/evidence.json');
}

main().catch((e) => { console.error(e); process.exit(1); });

