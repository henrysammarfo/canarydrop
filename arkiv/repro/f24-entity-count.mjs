#!/usr/bin/env node
import { createPublicClient } from '@arkiv-network/sdk';
import { tiramisu } from '@arkiv-network/sdk/chains';
import { eq } from '@arkiv-network/sdk/query';
import { http } from 'viem';

const pub = createPublicClient({ chain: tiramisu, transport: http(undefined, { retryCount: 0, timeout: 20_000 }) });
const PROJECT = 'canarydrop-gts26-hm';

const chain = await pub.getEntityCount();
const page = await pub.select({ key: true }).where(eq('project', PROJECT)).limit(20).fetch();
console.log('F24 count', chain, 'projectPage', page.entities.length, 'block', page.blockNumber.toString());
if (!(chain > page.entities.length)) {
  console.log('UNEXPECTED: getEntityCount is not larger than one project page');
  process.exit(2);
}
