#!/usr/bin/env node
/**
 * Renew the demo desk canary and every live dead drop hold.
 * Env: DESK_PRIVATE_KEY (required when DRY_RUN=0).
 * Set DRY_RUN=0 to broadcast. Never print secrets.
 */
import { canaryAlive, deskAddress, getDesk, renew } from '../lib/arkiv.ts';
import { liveHoldKeys } from '../lib/dead-drop.ts';
import { preferPubForCreator } from '../lib/demo-pub.ts';
import { deskAccount, deskWallet, requireDeskEthKey } from '../lib/demo-wallet.ts';

const DRY = process.env.DRY_RUN !== '0';

export async function planRenew(deskCreator) {
  const creator = deskCreator ?? deskAddress();
  const desk = await getDesk(creator, preferPubForCreator(creator));
  if (!desk?.key) throw new Error('No live desk for this wallet.');
  const canary = await canaryAlive(creator, desk.key);
  if (!canary?.key) throw new Error('No live canary for this desk.');
  const holdKeys = await liveHoldKeys(desk.key);
  return {
    deskKey: desk.key,
    canaryKey: canary.key,
    holdKeys,
    extensionKeys: [canary.key, desk.key, ...holdKeys],
  };
}

async function main() {
  const plan = await planRenew();
  console.log(
    'Renew plan desk=%s canary=%s holds=%d dryRun=%s',
    plan.deskKey,
    plan.canaryKey,
    plan.holdKeys.length,
    DRY,
  );
  if (DRY) {
    console.log('Would extend %d entities (canary, desk, holds).', plan.extensionKeys.length);
    return;
  }
  requireDeskEthKey();
  const account = deskAccount();
  const out = await renew(deskWallet(), plan.deskKey, plan.canaryKey, undefined, {
    holdKeys: plan.holdKeys,
    owner: account.address,
  });
  console.log('Renewed canary and %d hold(s), tx %s', plan.holdKeys.length, out.txHash);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(msg.replace(/0x[0-9a-fA-F]{64}/g, '0x…'));
    process.exit(1);
  });
}
