#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const apiDir = path.join(ROOT, 'app/api');
const apiHold = path.join(ROOT, '.static-hold-api');
const middleware = path.join(ROOT, 'middleware.ts');
const middlewareHold = path.join(ROOT, '.static-hold-middleware.ts');
const STABLE_HOME = '/tmp/canarydrop-home';
const STABLE_TMP = '/tmp/canarydrop-tmp';

const PINNED_DESK = '0x1da3c22c079c264536D831F6F1fCe638aB0b20B0';
const PINNED_RELAY = '0xa6Aa6a1409eb54028550466169A29EAfd8f7a442';

function buildId() {
  return process.env.NEXT_PUBLIC_BUILD_ID || 'canarydrop-v7';
}

function staticBuildEnv(extra = {}) {
  fs.mkdirSync(STABLE_HOME, { recursive: true });
  fs.mkdirSync(STABLE_TMP, { recursive: true });
  const id = extra.NEXT_PUBLIC_BUILD_ID || buildId();
  return {
    PATH: process.env.PATH,
    HOME: STABLE_HOME,
    USER: 'canarydrop',
    LOGNAME: 'canarydrop',
    TMPDIR: STABLE_TMP,
    TEMP: STABLE_TMP,
    TMP: STABLE_TMP,
    TZ: 'UTC',
    LANG: 'C',
    LC_ALL: 'C',
    NODE_ENV: 'production',
    NEXT_TELEMETRY_DISABLED: '1',
    STATIC_EXPORT: '1',
    NEXT_PUBLIC_STATIC: '1',
    NEXT_PUBLIC_BUILD_ID: id,
    NEXT_PUBLIC_BASE_PATH: '',
    NEXT_PUBLIC_DESK_ADDRESS: PINNED_DESK,
    NEXT_PUBLIC_RELAY_ADDRESS: PINNED_RELAY,
    SOURCE_DATE_EPOCH: extra.SOURCE_DATE_EPOCH || process.env.SOURCE_DATE_EPOCH || '0',
    ...extra,
    PATH: process.env.PATH,
    HOME: STABLE_HOME,
    TZ: 'UTC',
    LANG: 'C',
    LC_ALL: 'C',
    NODE_ENV: 'production',
    NEXT_TELEMETRY_DISABLED: '1',
  };
}

function run(cmd, args, extraEnv = {}) {
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    env: staticBuildEnv(extraEnv),
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

function pathVariants(root) {
  const unix = String(root).replace(/\\/g, '/');
  return [unix, String(root), encodeURIComponent(unix), unix.replaceAll('/', '%2F')].filter(Boolean);
}

function sortRuntimeMaps(src) {
  let out = src.replace(/\{([^{}]{8,})\}/g, (full, inner) => {
    if (!/^[A-Za-z0-9_$]+:"[a-f0-9]+"(,[A-Za-z0-9_$]+:"[a-f0-9]+")+$/.test(inner)) return full;
    return `{${inner.split(',').sort().join(',')}}`;
  });
  out = out.replace(/\[((?:"[^"]+")(?:,(?:"[^"]+"))+)\]/g, (full, inner) => {
    const parts = inner.split(',');
    if (parts.length < 2) return full;
    if (!parts.every((part) => /^"[A-Za-z0-9_./()[\]-]+"$/.test(part))) return full;
    return `[${parts.slice().sort().join(',')}]`;
  });
  return out;
}

function stripCheckoutPaths(outDir) {
  const roots = [ROOT, process.env.HOME, osHome()].filter(Boolean);
  const variants = [];
  for (const root of roots) variants.push(...pathVariants(root));
  variants.sort((a, b) => b.length - a.length);
  const skip = new Set(['build.sha256']);
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (!skip.has(entry.name)) files.push(full);
    }
  }
  walk(outDir);
  for (const file of files) {
    if (!/\.(js|css|html|txt|json|svg|map)$/.test(file)) continue;
    const src = fs.readFileSync(file, 'utf8');
    let next = src;
    for (const variant of variants) {
      if (variant && next.includes(variant)) {
        const repl = variant.includes('%') ? encodeURIComponent('.') : '.';
        next = next.split(variant).join(repl);
      }
    }
    next = sortRuntimeMaps(next);
    if (next !== src) fs.writeFileSync(file, next);
  }
}

function osHome() {
  return process.env.HOME || '';
}

try {
  stash();
  fs.rmSync(path.join(ROOT, 'out'), { recursive: true, force: true });
  fs.rmSync(path.join(ROOT, '.next'), { recursive: true, force: true });
  const id = buildId();
  run('npx', ['next', 'build'], {
    NEXT_PUBLIC_BUILD_ID: id,
    SOURCE_DATE_EPOCH: process.env.SOURCE_DATE_EPOCH || '0',
  });
  stripCheckoutPaths(path.join(ROOT, 'out'));
  run('node', ['scripts/hash-static.mjs', 'out']);
  run('node', ['scripts/assert-static-chunks.mjs', 'out']);
  const note = [
    'CanaryDrop static build',
    'node 24.22.0 required for expected.sha256',
    'nvm use && npm ci && npm run build:static',
    'npm run verify:static -- expected.sha256',
    `node ${process.version}`,
    `build id ${id}`,
    'SDK @arkiv-network/sdk 0.8.1',
    'chain 7738577 Tiramisu',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(ROOT, 'out/VERIFY.txt'), note);
  run('node', ['scripts/hash-static.mjs', 'out']);
} finally {
  restore();
}
