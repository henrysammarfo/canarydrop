#!/usr/bin/env node
import { isValidAttributeName, validateAttributeName } from '@arkiv-network/sdk';

const names = ['renewedAt', 'created_at_ms', 'slot', 'NOT', 'type', 'project', 'desk', '--dash', '$expiresAt', 'createdAt'];
for (const name of names) {
  const clientOk = isValidAttributeName(name);
  let thrown = '';
  try {
    validateAttributeName(name);
  } catch (e) {
    thrown = e instanceof Error ? e.message : String(e);
  }
  console.log('F4', name, 'sdk', clientOk ? 'accepts' : 'rejects', thrown ? `msg=${thrown}` : '');
}
