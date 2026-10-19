import { describe, expect, it } from 'vitest';
import type { Hex } from 'viem';
import { DEFAULT_DESK, DEFAULT_IMPOSTOR } from '@/lib/constants';
import {
  explorerRowFlags,
  explorerTypeBadges,
  olderDemoLabel,
  SEALED_BADGE,
  REPLACED_DEMO_CANARY_KEYS,
  REPLACED_DEMO_DESK_KEYS,
} from '@/lib/explorer-label';

const CANONICAL = `0x${'1f'.repeat(32)}` as Hex;
const OLD_DESK = `0x${'87'.repeat(32)}` as Hex;
const OLD_CANARY = `0x${'5a'.repeat(32)}` as Hex;
const NEW_CANARY = `0x${'3c'.repeat(32)}` as Hex;
const IMPOSTOR_DESK = `0x${'4d'.repeat(32)}` as Hex;

function flags(partial: {
  type: string;
  key: Hex;
  creator?: Hex;
  deskAttr?: Hex;
  canonicalDeskKey?: Hex | undefined;
}) {
  const input: Parameters<typeof explorerRowFlags>[0] = {
    type: partial.type,
    key: partial.key,
    creator: partial.creator ?? DEFAULT_DESK,
    demoCreator: DEFAULT_DESK,
    impostorCreator: DEFAULT_IMPOSTOR,
  };
  if (partial.deskAttr) input.deskAttr = partial.deskAttr;
  if (Object.prototype.hasOwnProperty.call(partial, 'canonicalDeskKey')) {
    input.canonicalDeskKey = partial.canonicalDeskKey;
  } else {
    input.canonicalDeskKey = CANONICAL;
  }
  return explorerRowFlags(input);
}

describe('explorer row flags', () => {
  it('labels the canonical demo desk', () => {
    const row = flags({ type: 'desk', key: CANONICAL });
    expect(row.canonicalDemo).toBe(true);
    expect(row.impostor).toBe(false);
    expect(olderDemoLabel(row)).toBeNull();
  });

  it('labels a superseded demo desk', () => {
    const row = flags({ type: 'desk', key: OLD_DESK });
    expect(row.canonicalDemo).toBe(false);
    expect(row.impostor).toBe(false);
    expect(olderDemoLabel(row)).toBe('Older demo desk, replaced');
  });

  it('labels a canary that still points at the superseded desk', () => {
    const row = flags({ type: 'canary', key: OLD_CANARY, deskAttr: OLD_DESK });
    expect(row.canonicalDemo).toBe(false);
    expect(row.impostor).toBe(false);
    expect(olderDemoLabel(row)).toBe('Older demo canary, replaced');
  });

  it('does not mark the live canary as replaced', () => {
    const row = flags({ type: 'canary', key: NEW_CANARY, deskAttr: CANONICAL });
    expect(olderDemoLabel(row)).toBeNull();
    expect(row.impostor).toBe(false);
  });

  it('keeps the impostor desk as ignored impostor', () => {
    const row = flags({
      type: 'desk',
      key: IMPOSTOR_DESK,
      creator: DEFAULT_IMPOSTOR,
    });
    expect(row.impostor).toBe(true);
    expect(row.canonicalDemo).toBe(false);
    expect(olderDemoLabel(row)).toBeNull();
  });

  it('does not call a desk older until the canonical key is known', () => {
    const row = flags({ type: 'desk', key: OLD_DESK, canonicalDeskKey: undefined });
    expect(olderDemoLabel(row)).toBeNull();
    expect(row.canonicalDemo).toBe(false);
  });

  it('labels the known superseded desk even before canonical is loaded', () => {
    const row = flags({
      type: 'desk',
      key: REPLACED_DEMO_DESK_KEYS[0] as Hex,
      canonicalDeskKey: undefined,
    });
    expect(olderDemoLabel(row)).toBe('Older demo desk, replaced');
    expect(row.canonicalDemo).toBe(false);
    expect(row.impostor).toBe(false);
  });

  it('short explorer badges keep the full meaning for tooltips', () => {
    const canonical = explorerTypeBadges(flags({ type: 'desk', key: CANONICAL }));
    expect(canonical).toEqual([{ short: 'Canonical', full: 'Canonical demo desk' }]);
    const replaced = explorerTypeBadges(
      flags({ type: 'desk', key: REPLACED_DEMO_DESK_KEYS[0] as Hex, canonicalDeskKey: undefined }),
    );
    expect(replaced).toEqual([{ short: 'Replaced', full: 'Older demo desk, replaced' }]);
    const impostor = explorerTypeBadges(
      flags({ type: 'desk', key: IMPOSTOR_DESK, creator: DEFAULT_IMPOSTOR }),
    );
    expect(impostor).toEqual([{ short: 'Impostor', full: 'Ignored impostor' }]);
    expect(SEALED_BADGE).toEqual({ short: 'Sealed', full: 'Sealed: nobody can change it' });
  });

  it('labels the known superseded canary even before canonical is loaded', () => {
    const row = flags({
      type: 'canary',
      key: REPLACED_DEMO_CANARY_KEYS[0] as Hex,
      canonicalDeskKey: undefined,
    });
    expect(olderDemoLabel(row)).toBe('Older demo canary, replaced');
    expect(row.impostor).toBe(false);
  });
});
