import { describe, expect, it } from 'vitest';
import type { Attributes } from '@arkiv-network/sdk';
import type { Hex } from 'viem';
import { entityBelongsToDesk, watchEventForDesk } from '@/lib/arkiv';
import { PROJECT, SEALED_OWNER } from '@/lib/constants';

const DESK = `0x${'ab'.repeat(32)}` as Hex;
const OTHER_DESK = `0x${'cd'.repeat(32)}` as Hex;
const TIP = `0x${'11'.repeat(32)}` as Hex;
const FOREIGN = `0x${'22'.repeat(32)}` as Hex;

function attrs(type: string, desk = DESK, project = PROJECT): Attributes {
  return {
    project: { type: 'str', value: project },
    type: { type: 'str', value: type },
    desk: { type: 'key', value: desk },
  } as unknown as Attributes;
}

describe('watch scope for this desk', () => {
  it('accepts a CanaryDrop tip labeled with this desk', () => {
    expect(entityBelongsToDesk({ key: TIP, attributes: attrs('tip') }, DESK)).toBe(true);
    expect(entityBelongsToDesk({ key: TIP, attributes: attrs('drop') }, DESK)).toBe(true);
    expect(entityBelongsToDesk({ key: TIP, attributes: attrs('hold') }, DESK)).toBe(true);
  });

  it('accepts this desk entity and a canary for it', () => {
    expect(entityBelongsToDesk({ key: DESK, attributes: attrs('desk') }, DESK)).toBe(true);
    expect(entityBelongsToDesk({ key: TIP, attributes: attrs('canary') }, DESK)).toBe(true);
  });

  it('rejects another app, another desk, replies, and missing rows', () => {
    expect(entityBelongsToDesk({ key: TIP, attributes: attrs('tip', DESK, 'other-app') }, DESK)).toBe(false);
    expect(entityBelongsToDesk({ key: TIP, attributes: attrs('tip', OTHER_DESK) }, DESK)).toBe(false);
    expect(entityBelongsToDesk({ key: TIP, attributes: attrs('reply') }, DESK)).toBe(false);
    expect(entityBelongsToDesk({ key: TIP, attributes: attrs('desk') }, DESK)).toBe(false);
    expect(entityBelongsToDesk(null, DESK)).toBe(false);
    expect(entityBelongsToDesk({ attributes: attrs('tip') }, DESK)).toBe(false);
  });

  it('ignores a seal to anyone but the burn address', () => {
    expect(
      watchEventForDesk({
        kind: 'sealed',
        entityKey: TIP,
        deskKey: DESK,
        knownKeys: new Set([TIP.toLowerCase()]),
        newOwner: `0x${'34'.repeat(20)}` as Hex,
      }),
    ).toBe(false);
  });

  it('accepts a seal when the fetched entity is a tip for this desk', () => {
    expect(
      watchEventForDesk({
        kind: 'sealed',
        entityKey: TIP,
        deskKey: DESK,
        knownKeys: new Set(),
        entity: { key: TIP, attributes: attrs('tip') },
        newOwner: SEALED_OWNER,
      }),
    ).toBe(true);
  });

  it('rejects a seal of another app even when the new owner is the burn address', () => {
    expect(
      watchEventForDesk({
        kind: 'sealed',
        entityKey: FOREIGN,
        deskKey: DESK,
        knownKeys: new Set(),
        entity: { key: FOREIGN, attributes: attrs('tip', DESK, 'other-app') },
        newOwner: SEALED_OWNER,
      }),
    ).toBe(false);
  });

  it('uses known keys after a delete when the entity is gone', () => {
    expect(
      watchEventForDesk({
        kind: 'deleted',
        entityKey: TIP,
        deskKey: DESK,
        knownKeys: new Set([TIP.toLowerCase()]),
      }),
    ).toBe(true);
    expect(
      watchEventForDesk({
        kind: 'deleted',
        entityKey: FOREIGN,
        deskKey: DESK,
        knownKeys: new Set([TIP.toLowerCase()]),
      }),
    ).toBe(false);
  });

  it('scopes a patch to a fetched CanaryDrop row for this desk', () => {
    expect(
      watchEventForDesk({
        kind: 'patched',
        entityKey: TIP,
        deskKey: DESK,
        knownKeys: new Set(),
        entity: { key: TIP, attributes: attrs('tip') },
      }),
    ).toBe(true);
    expect(
      watchEventForDesk({
        kind: 'patched',
        entityKey: FOREIGN,
        deskKey: DESK,
        knownKeys: new Set(),
        entity: { key: FOREIGN, attributes: attrs('tip', OTHER_DESK) },
      }),
    ).toBe(false);
  });
});
