#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const apiDir = path.join(ROOT, 'app/api');
const apiHold = path.join(ROOT, '.static-hold-api');
const middleware = path.join(ROOT, 'middleware.ts');
const middlewareHold = path.join(ROOT, '.static-hold-middleware.ts');

function run(cmd, args, extraEnv = {}) {
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed`);
  }
}

function stash() {
  if (fs.existsSync(apiDir) && !fs.existsSync(apiHold)) fs.renameSync(apiDir, apiHold);
  if (fs.existsSync(middleware) && !fs.existsSync(middlewareHold)) fs.renameSync(middleware, middlewareHold);
}

function restore() {
  if (fs.existsSync(apiHold) && !fs.existsSync(apiDir)) fs.renameSync(apiHold, apiDir);
  if (fs.existsSync(middlewareHold) && !fs.existsSync(middleware)) fs.renameSync(middlewareHold, middleware);
}

try {
  stash();
  run('npx', ['next', 'build'], {
    STATIC_EXPORT: '1',
    NEXT_PUBLIC_STATIC: '1',
    NEXT_TELEMETRY_DISABLED: '1',
  });
  run('node', ['scripts/hash-static.mjs', 'out']);
  const note = [
    'CanaryDrop static build',
    `node ${process.version}`,
    'SDK @arkiv-network/sdk 0.8.1',
    'chain 7738577 Tiramisu',
    'Verify: npm ci && npm run build:static && diff -u expected.sha256 out/build.sha256',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(ROOT, 'out/VERIFY.txt'), note);
} finally {
  restore();
}
