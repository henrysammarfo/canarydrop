#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const expected = process.argv[2];
if (!expected) {
  console.log('Usage: node scripts/verify-static.mjs <path-to-build.sha256>');
  console.log('Rebuilds the static site with pinned npm ci output and compares file hashes.');
  process.exit(2);
}

const result = spawnSync('npm', ['run', 'build:static'], { stdio: 'inherit', env: process.env });
if (result.status !== 0) process.exit(result.status ?? 1);

const got = fs.readFileSync(path.resolve('out/build.sha256'), 'utf8');
const want = fs.readFileSync(path.resolve(expected), 'utf8');
if (got !== want) {
  console.error('Static build hash does not match.');
  process.exit(1);
}
console.log('Static build hash matches.');
