#!/usr/bin/env node
import { createPublicClient } from '@arkiv-network/sdk';
import { tiramisu } from '@arkiv-network/sdk/chains';
import { eq, ne } from '@arkiv-network/sdk/query';
import { http } from 'viem';

const pub = createPublicClient({ chain: tiramisu, transport: http(undefined, { retryCount: 0, timeout: 20_000 }) });
const PROJECT = 'canarydrop-gts26-hm';

try {
  await pub
    .select({ key: true })
    .where(eq('project', PROJECT), ne('type', 'desk'))
    .limit(1)
    .fetch();
  console.log('UNEXPECTED: ne(type, desk) succeeded');
  process.exit(2);
} catch (e) {
  const kind = e && typeof e === 'object' && 'kind' in e ? String(e.kind) : '';
  console.log('F21', e instanceof Error ? e.name : 'Error', kind, e instanceof Error ? e.message : String(e));
}
