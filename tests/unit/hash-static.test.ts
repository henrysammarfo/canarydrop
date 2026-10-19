import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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

  it('repro-hash script exits 0', () => {
    const result = spawnSync(process.execPath, [path.resolve('scripts/repro-hash.mjs')], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/repro-hash ok/);
  });
});
