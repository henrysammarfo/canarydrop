#!/usr/bin/env node
import { createPublicClient } from '@arkiv-network/sdk';
import { tiramisu } from '@arkiv-network/sdk/chains';
import { eq, exists, not } from '@arkiv-network/sdk/query';
import { http } from 'viem';

const pub = createPublicClient({ chain: tiramisu, transport: http(undefined, { retryCount: 0, timeout: 20_000 }) });
const PROJECT = 'canarydrop-gts26-hm';

try {
  await pub
    .select({ key: true })
    .where(eq('project', PROJECT), eq('type', 'tip'), exists('slot'))
    .limit(1)
    .fetch();
  console.log('UNEXPECTED: exists(slot) succeeded');
  process.exit(2);
} catch (e) {
  const kind = e && typeof e === 'object' && 'kind' in e ? String(e.kind) : '';
  console.log('F20 exists', e instanceof Error ? e.name : 'Error', kind, e instanceof Error ? e.message : String(e));
}

try {
  await pub
    .select({ key: true })
    .where(eq('project', PROJECT), eq('type', 'tip'), not(exists('slot')))
    .limit(1)
    .fetch();
  console.log('UNEXPECTED: not(exists(slot)) succeeded');
  process.exit(2);
} catch (e) {
  const kind = e && typeof e === 'object' && 'kind' in e ? String(e.kind) : '';
  console.log('F20 not-exists', e instanceof Error ? e.name : 'Error', kind, e instanceof Error ? e.message : String(e));
}
