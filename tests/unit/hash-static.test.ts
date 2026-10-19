import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('reproducible static hash', () => {
  it('hashes two identical trees the same way', () => {
    const a = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-a-'));
    const b = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-b-'));
    for (const root of [a, b]) {
      fs.writeFileSync(path.join(root, 'index.html'), '<html>ok</html>\n');
    }
    const run = (root: string) => {
      const result = spawnSync(process.execPath, [path.resolve('scripts/hash-static.mjs'), root], {
        encoding: 'utf8',
      });
      expect(result.status).toBe(0);
      return fs.readFileSync(path.join(root, 'build.sha256'), 'utf8');
    };
    expect(run(a)).toBe(run(b));
  });

  it('repro-hash script builds the full out folder twice', () => {
    const src = fs.readFileSync(path.resolve('scripts/repro-hash.mjs'), 'utf8');
    expect(src).toContain("npm', ['run', 'build:static']");
    expect(src.match(/runBuild\(\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(src).toContain('Two full out/ builds hashed differently');
    expect(src).toContain('v24.22.0');
  });

  it('pins Node and a stable build id', () => {
    expect(fs.readFileSync(path.resolve('.nvmrc'), 'utf8').trim()).toBe('24.22.0');
    expect(fs.readFileSync(path.resolve('next.config.js'), 'utf8')).toContain('generateBuildId');
  });

  it('static export uses a clean env and a fixed home', () => {
    const src = fs.readFileSync(path.resolve('scripts/build-static.mjs'), 'utf8');
    expect(src).toContain('staticBuildEnv');
    expect(src).toContain('/tmp/canarydrop-home');
    expect(src).toContain("TZ: 'UTC'");
    expect(src).toContain("LANG: 'C'");
    expect(src).not.toContain('VERCEL_GIT_COMMIT_SHA');
    expect(src).toContain('stripCheckoutPaths');
    expect(src).toContain('sortRuntimeMaps');
  });
});
