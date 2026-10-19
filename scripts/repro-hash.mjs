#!/usr/bin/env node
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const PINNED_NODE = 'v20.18.0';
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || 'canarydrop-v7';
const EPOCH = process.env.SOURCE_DATE_EPOCH || '0';

function runBuild() {
  fs.rmSync(path.join(ROOT, 'out'), { recursive: true, force: true });
  const result = spawnSync('npm', ['run', 'build:static'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NEXT_PUBLIC_BUILD_ID: BUILD_ID,
      SOURCE_DATE_EPOCH: EPOCH,
      NEXT_TELEMETRY_DISABLED: '1',
    },
  });
  if (result.status !== 0) {
    throw new Error('build:static failed');
  }
  return fs.readFileSync(path.join(ROOT, 'out/build.sha256'), 'utf8');
}

function copyOut(dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(path.join(ROOT, 'out'), dest, { recursive: true });
}

if (process.version !== PINNED_NODE) {
  console.warn(
    `repro-hash: this process is ${process.version}. expected.sha256 is pinned to ${PINNED_NODE}.`,
  );
}

const tmpA = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-out-a-'));
const tmpB = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-out-b-'));
const ha = runBuild();
copyOut(tmpA);
const hb = runBuild();
copyOut(tmpB);
if (ha !== hb) {
  console.error('Two full out/ builds hashed differently.');
  process.exit(1);
}
const tree = createHash('sha256').update(ha).digest('hex');
process.stdout.write(`repro-hash ok ${tree}\n`);
