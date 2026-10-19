#!/usr/bin/env node
import { createPublicClient } from '@arkiv-network/sdk';
import { tiramisu } from '@arkiv-network/sdk/chains';
import { eq } from '@arkiv-network/sdk/query';
import { http } from 'viem';

const pub = createPublicClient({ chain: tiramisu, transport: http(undefined, { retryCount: 0, timeout: 20_000 }) });
const PROJECT = 'canarydrop-gts26-hm';
const RELAY = '0xa6Aa6a1409eb54028550466169A29EAfd8f7a442';
const DEAD = '0x000000000000000000000000000000000000dEaD';

const text = pub
  .select({ key: true, owner: true, creator: true, creationFlags: true })
  .where(eq('project', PROJECT), eq('type', 'tip'))
  .createdBy(RELAY)
  .ownedBy(DEAD)
  .limit(20)
  .toString();

console.log('F25', text);
if (/SELECT|LIMIT/i.test(text)) {
  console.log('UNEXPECTED: toString included SELECT or LIMIT');
  process.exit(2);
}
if (!/project = str\('canarydrop-gts26-hm'\)/.test(text) || !/\$owner = addr\(/.test(text) || !/\$creator = addr\(/.test(text)) {
  console.log('UNEXPECTED: toString missed project, $owner, or $creator');
  process.exit(2);
}
