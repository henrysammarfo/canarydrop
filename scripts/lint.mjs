#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SKIP = new Set(['node_modules', '.next', 'shots', 'test-results', 'playwright-report', '.git']);
const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.mjs']);
const COPY_EXT = new Set(['.ts', '.tsx', '.md']);
const COPY_DIRS = ['app', 'components'];

let failed = false;

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

const files = walk(ROOT);
const anyRe = /(^|[^A-Za-z])any([^A-Za-z]|$)/;
const dashRe = /[\u2013\u2014]/;

for (const file of files) {
  const ext = path.extname(file);
  const rel = path.relative(ROOT, file);
  if (!CODE_EXT.has(ext)) continue;
  if (rel.startsWith('arkiv/repro/')) continue;
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('eslint-disable')) return;
    if (anyRe.test(line) && (ext === '.ts' || ext === '.tsx')) {
      // Allow the word in comments that explain the ban.
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
      if (line.includes('no-explicit-any')) return;
      console.error(`${rel}:${i + 1}: forbidden any: ${line.trim()}`);
      failed = true;
    }
  });
}

for (const file of files) {
  const ext = path.extname(file);
  const rel = path.relative(ROOT, file);
  const inCopy = COPY_DIRS.some((d) => rel.startsWith(d + path.sep) || rel.startsWith(d + '/'));
  if (!inCopy || !COPY_EXT.has(ext)) continue;
  const text = fs.readFileSync(file, 'utf8');
  if (dashRe.test(text)) {
    console.error(`${rel}: en dash or em dash in user facing copy`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}
console.log('lint ok');
