#!/usr/bin/env node
import { createPublicClient } from '@arkiv-network/sdk';
import { tiramisu } from '@arkiv-network/sdk/chains';
import { eq } from '@arkiv-network/sdk/query';
import { http } from 'viem';

const pub = createPublicClient({ chain: tiramisu, transport: http(undefined, { retryCount: 0, timeout: 20_000 }) });
const page = await pub.select({ key: true }).where(eq('project', 'canarydrop-gts26-hm')).limit(5).fetch();
console.log('F5 keys', ['entities', 'cursor' in page, 'blockNumber' in page, 'nextCursor' in page].join(','));
console.log('F5 cursorType', typeof page.cursor);
console.log('F5 hasNext', typeof page.hasNextPage === 'function' ? page.hasNextPage() : 'no-method');
console.log('F5 count', page.entities.length, 'block', page.blockNumber.toString());
