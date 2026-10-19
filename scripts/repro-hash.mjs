#!/usr/bin/env node
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function writeTree(root) {
  fs.mkdirSync(path.join(root, 'nested'), { recursive: true });
  fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><title>CanaryDrop</title>\n');
  fs.writeFileSync(path.join(root, 'nested', 'app.js'), 'console.log("ok")\n');
}

function hashTree(root) {
  const result = spawnSync(process.execPath, [path.resolve('scripts/hash-static.mjs'), root], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || 'hash-static failed');
  }
  return fs.readFileSync(path.join(root, 'build.sha256'), 'utf8');
}

const a = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-hash-a-'));
const b = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-hash-b-'));
writeTree(a);
writeTree(b);
const ha = hashTree(a);
const hb = hashTree(b);
if (ha !== hb) {
  console.error('Two identical trees hashed differently.');
  process.exit(1);
}
const tree = createHash('sha256').update(ha).digest('hex');
process.stdout.write(`repro-hash ok ${tree}\n`);
