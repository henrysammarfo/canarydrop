import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve('.');

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

describe('static export chunk graph', () => {
  it('keeps the (app) group layout free of client chrome', () => {
    const src = read('app/(app)/layout.tsx');
    expect(src).not.toMatch(/AppShell|AppFrame|TorBanner/);
    expect(src).not.toMatch(/['"]use client['"]/);
  });

  it('wraps desk and workspace routes with AppFrame', () => {
    expect(read('app/(app)/desk/layout.tsx')).toContain('AppFrame');
    expect(read('app/(app)/explorer/layout.tsx')).toContain('AppFrame');
    expect(read('app/(app)/how/layout.tsx')).toContain('AppFrame');
    expect(read('app/(app)/verify/layout.tsx')).toContain('AppFrame');
  });

  it('pins webpack ids and a stable build id for the static export', () => {
    const src = read('next.config.js');
    expect(src).toContain('generateBuildId');
    expect(src).toContain('CanarydropStableIds');
    expect(src).toContain("[contenthash]");
    expect(src).toContain('cacheGroups.lib = false');
    expect(src).toContain('CanarydropRelIdent');
  });

  it('pins Node 20.18.0', () => {
    expect(read('.nvmrc').trim()).toBe('20.18.0');
    expect(JSON.parse(read('package.json')).engines.node).toBe('20.18.0');
  });

  it('rejects (app) layout chunks in site HTML after a static build', () => {
    const src = read('scripts/build-static.mjs');
    expect(src).toContain('assert-static-chunks.mjs');
    const assertSrc = read('scripts/assert-static-chunks.mjs');
    expect(assertSrc).toContain('(app)/layout-');
    expect(assertSrc).toContain('canary');
    expect(assertSrc).toContain("'d'");
  });
});

describe('stealth experimental label', () => {
  it('marks inbox and replies stealth copy on screen', () => {
    const inbox = read('app/(app)/desk/inbox/page.tsx');
    expect(inbox).toContain('ExperimentalLabel');
    expect(inbox).toContain('one time address');
    const replies = read('app/(app)/desk/replies/page.tsx');
    expect(replies).toContain('ExperimentalLabel');
    expect(replies).toContain('one time address');
  });

  it('labels the stealth reply toast', () => {
    expect(read('components/desk/DeskProvider.tsx')).toContain(
      'Reply sent to a one time address. Experimental.',
    );
  });
});
