#!/usr/bin/env node
import { createPublicClient } from '@arkiv-network/sdk';
import { tiramisu } from '@arkiv-network/sdk/chains';
import { http } from 'viem';

const pub = createPublicClient({ chain: tiramisu, transport: http(undefined, { retryCount: 0, timeout: 20_000 }) });

try {
  const text = pub.select({ key: true }).toString();
  console.log('UNEXPECTED: empty toString succeeded', text);
  process.exit(2);
} catch (e) {
  console.log('F23', e instanceof Error ? e.name : 'Error', e instanceof Error ? e.message : String(e));
}
