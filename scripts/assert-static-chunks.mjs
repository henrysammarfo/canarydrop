#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[2] || 'out');
const FORBIDDEN = ['(app)/layout-', '%28app%29/layout-'];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.name === 'index.html') acc.push(full);
  }
  return acc;
}

const pages = [...walk(path.join(ROOT, 'canary')), ...walk(path.join(ROOT, 'd'))];
if (pages.length === 0) {
  console.error('assert-static-chunks: no canary/ or d/ HTML under', ROOT);
  process.exit(1);
}

const bad = [];
for (const file of pages) {
  const html = fs.readFileSync(file, 'utf8');
  for (const needle of FORBIDDEN) {
    if (html.includes(needle)) {
      bad.push(`${path.relative(ROOT, file)} includes ${needle}`);
    }
  }
}

if (bad.length) {
  console.error('Site HTML must not preload the (app) layout client chunk.');
  for (const line of bad) console.error(`  ${line}`);
  process.exit(1);
}

process.stdout.write(`assert-static-chunks ok ${pages.length} pages\n`);
