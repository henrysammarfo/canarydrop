#!/usr/bin/env node
import { createPublicClient } from '@arkiv-network/sdk';
import { tiramisu } from '@arkiv-network/sdk/chains';
import { gt } from '@arkiv-network/sdk/query';
import { u64 } from '@arkiv-network/sdk/attr';
import { http } from 'viem';

const pub = createPublicClient({ chain: tiramisu, transport: http(undefined, { retryCount: 0, timeout: 20_000 }) });
const { currentBlock } = await pub.getBlockTiming();

try {
  await pub.select({ key: true }).where(gt('$expiresAt', currentBlock)).limit(1).fetch();
  console.log('UNEXPECTED: raw bigint currentBlock succeeded');
  process.exit(2);
} catch (e) {
  console.log('F3 raw', e instanceof Error ? e.name : 'Error', e instanceof Error ? e.message : String(e));
}

const ok = await pub.select({ key: true }).where(gt('$expiresAt', u64(currentBlock))).limit(1).fetch();
console.log('F3 wrap', 'ok', 'entities', ok.entities.length, 'block', ok.blockNumber.toString());
