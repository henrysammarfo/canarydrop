#!/usr/bin/env node
import { createPublicClient } from '@arkiv-network/sdk';
import { tiramisu } from '@arkiv-network/sdk/chains';
import { http } from 'viem';
import { eq, gt } from '@arkiv-network/sdk/query';
import { u64 } from '@arkiv-network/sdk/attr';

const PROJECT = 'canarydrop-gts26-hm';
const pub = createPublicClient({
  chain: tiramisu,
  transport: http(undefined, { retryCount: 0, timeout: 20_000 }),
});
const DESK = process.env.NEXT_PUBLIC_DESK_ADDRESS;
const RELAY = process.env.NEXT_PUBLIC_RELAY_ADDRESS;

async function main() {
  const { currentBlock } = await pub.getBlockTiming();
  console.log('Block', currentBlock.toString());
  const desk = await pub
    .select({ key: true })
    .where(eq('project', PROJECT), eq('type', 'desk'), gt('$expiresAt', u64(currentBlock)))
    .createdBy(DESK)
    .limit(1)
    .fetch();
  console.log('Desk entities by creator %s: %d', DESK, desk.entities.length);
  const tips = await pub
    .select({ key: true })
    .where(eq('project', PROJECT), eq('type', 'tip'))
    .createdBy(RELAY)
    .limit(50)
    .fetch();
  console.log('Tips by relay %s: %d', RELAY, tips.entities.length);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : 'verify failed');
  process.exit(1);
});
