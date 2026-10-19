#!/usr/bin/env node
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2] || 'out';

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

const files = walk(ROOT)
  .filter((file) => path.basename(file) !== 'build.sha256')
  .sort();
const lines = [];
for (const file of files) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  const hash = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  lines.push(`${hash}  ${rel}`);
}
const body = `${lines.join('\n')}\n`;
const manifest = path.join(ROOT, 'build.sha256');
fs.writeFileSync(manifest, body);
const tree = createHash('sha256').update(body).digest('hex');
process.stdout.write(`${tree}  ${manifest}\n`);
