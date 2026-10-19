#!/usr/bin/env node
import { createPublicClient } from '@arkiv-network/sdk';
import { tiramisu } from '@arkiv-network/sdk/chains';
import { gt } from '@arkiv-network/sdk/query';
import { http } from 'viem';

const pub = createPublicClient({ chain: tiramisu, transport: http(undefined, { retryCount: 0, timeout: 20_000 }) });

try {
  await pub.select({ key: true }).where(gt('$createdAt', 0)).limit(1).fetch();
  console.log('UNEXPECTED: $createdAt filter succeeded');
  process.exit(2);
} catch (e) {
  console.log('F1', e instanceof Error ? e.name : 'Error', e instanceof Error ? e.message : String(e));
}
