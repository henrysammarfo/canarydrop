#!/usr/bin/env node
/**
 * CanaryDrop seeding script for Tiramisu (Arkiv) — dry-run by default.
 * Requires environment variables:
 *  RELAY_PRIVATE_KEY (hex), DESK_PRIVATE_KEY (hex), NEXT_PUBLIC_DESK_ADDRESS, NEXT_PUBLIC_RELAY_ADDRESS
 * Pass DRY_RUN=0 to attempt real writes (only when funded).
 */
import { createPublicClient, createWalletClient } from '@arkiv-network/sdk';
import { tiramisu } from '@arkiv-network/sdk/chains';
import { http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { jsonToPayload, ExpirationTime } from '@arkiv-network/sdk/utils';
import { key } from '@arkiv-network/sdk/attr';
import { PROJECT } from '../lib/arkiv.js';

const DRY = process.env.DRY_RUN !== '0';
const pub = createPublicClient({ chain: tiramisu, transport: http() });

async function main() {
  console.log('Seeding CanaryDrop (dryRun=%s)', DRY);
  const relay = privateKeyToAccount(process.env.RELAY_PRIVATE_KEY || '0x');
  const desk = privateKeyToAccount(process.env.DESK_PRIVATE_KEY || '0x');
  const wRelay = createWalletClient({ chain: tiramisu, transport: http(), account: relay });
  const wDesk = createWalletClient({ chain: tiramisu, transport: http(), account: desk });

  const [deskPred, canaryPred] = await pub.predictEntityKeys({ owner: desk.address, count: 2 });
  const creates = [
    { salt: deskPred.salt, payload: jsonToPayload({ name: 'Demo Desk', pub: [] }), contentType: 'application/json', attributes: { project: PROJECT, type: 'desk' }, expires: ExpirationTime.fromDays(30) },
    { salt: canaryPred.salt, payload: jsonToPayload({ statement: 'No warrants or gag orders received.' }), contentType: 'application/json', attributes: { project: PROJECT, type: 'canary', desk: key(deskPred.key) }, expires: ExpirationTime.fromHours(26), flags: { readonly: true } },
  ];
  if (DRY) {
    console.log('Would create desk %s and canary %s', deskPred.key, canaryPred.key);
  } else {
    const r = await wDesk.executeBatch({ creates });
    console.log('Created', r.createdEntities, 'tx', r.txHash);
  }

  const [tipPred] = await pub.predictEntityKeys({ owner: relay.address, count: 1 });
  if (DRY) console.log('Would create tip %s and seal to 0x…dEaD', tipPred.key);
  // Additional actions (tips, impersonator) elided here for brevity in dry run.
}

main().catch((e) => { console.error(e); process.exit(1); });

