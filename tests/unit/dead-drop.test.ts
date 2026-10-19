import { describe, expect, it } from 'vitest';
import type { Hex } from 'viem';
import { SEALED_OWNER } from '@/lib/constants';
import {
  deadDropCopy,
  deadDropCreates,
  deadDropStatus,
  encodeDropPlaintext,
  holdExtensions,
  parseDropDocument,
  parseRecipients,
} from '@/lib/dead-drop';

const desk = `0x${'11'.repeat(32)}` as Hex;
const drop = { key: `0x${'d1'.repeat(32)}` as Hex, salt: 1n };
const release = { key: `0x${'e2'.repeat(32)}` as Hex, salt: 2n };
const hold = { key: `0x${'f3'.repeat(32)}` as Hex, salt: 3n };

describe('dead drop on silence', () => {
  it('stays held only when canary and hold are both alive', () => {
    expect(deadDropStatus(true, true)).toBe('held');
    expect(deadDropStatus(false, true)).toBe('released');
    expect(deadDropStatus(true, false)).toBe('released');
    expect(deadDropStatus(false, false)).toBe('released');
  });

  it('uses plain English for both states', () => {
    expect(deadDropCopy('held')).toMatch(/still signing/);
    expect(deadDropCopy('released')).toMatch(/canary is gone/);
    expect(deadDropCopy('held')).not.toMatch(/[\u2013\u2014]/);
  });

  it('builds create plus burn ownership in one batch', () => {
    const batch = deadDropCreates({
      keys: { drop, release, hold },
      deskKey: desk,
      dropPayload: new Uint8Array([1, 2, 3]),
      releasePayload: new Uint8Array([4]),
    });
    expect(batch.creates).toHaveLength(3);
    expect(batch.creates[0]?.flags).toEqual({ readonly: true });
    expect(batch.ownershipChanges).toEqual([{ entityKey: drop.key, newOwner: SEALED_OWNER }]);
    const typeCell = batch.creates[0]?.attributes.type as { value?: string };
    expect(typeCell.value).toBe('drop');
  });

  it('renews hold and canary together', () => {
    const ext = holdExtensions(hold.key, `0x${'c4'.repeat(32)}` as Hex);
    expect(ext.extensions).toHaveLength(2);
    expect(ext.extensions[0]?.entityKey).toBe(hold.key);
  });

  it('parses documents and recipients', () => {
    expect(parseDropDocument({ title: 'A', text: 'B' })).toEqual({ title: 'A', text: 'B' });
    expect(parseDropDocument({ title: '', text: 'B' })).toBeNull();
    expect(parseRecipients([{ label: 'Editor', pub: Array(65).fill(1) }])).toHaveLength(1);
    expect(parseRecipients([{ label: 'x', pub: [1] }])).toEqual([]);
    expect(encodeDropPlaintext({ title: 'A', text: 'B' })).toContain('"v":1');
  });
});
