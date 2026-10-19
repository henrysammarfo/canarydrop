#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const files = [
  'f1-created-at.mjs',
  'f2-bare-number.mjs',
  'f3-head-type.mjs',
  'f4-attribute-name.mjs',
  'f5-query-page.mjs',
  'f20-exists.mjs',
  'f21-ne.mjs',
  'f22-has-type.mjs',
  'f23-empty-query.mjs',
  'f24-entity-count.mjs',
  'f25-query-text.mjs',
];
let failed = 0;
for (const file of files) {
  const r = spawnSync(process.execPath, [path.join(dir, file)], { encoding: 'utf8' });
  process.stdout.write(`\n=== ${file} ===\n`);
  process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) {
    failed += 1;
    console.error('exit', r.status);
  }
}
if (failed) process.exit(1);
console.log('\nfriction repros ok');
