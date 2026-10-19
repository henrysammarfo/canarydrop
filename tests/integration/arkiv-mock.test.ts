import { describe, expect, it } from 'vitest';
import { SEALED_OWNER } from '@/lib/constants';
import { isSealedOwner } from '@/lib/chain';

type MockTip = {
  key: `0x${string}`;
  type: string;
  desk: `0x${string}`;
  owner: `0x${string}`;
  payload: Uint8Array;
};

class MockInbox {
  constructor(private readonly tips: MockTip[]) {}
  page(desk: `0x${string}`, limit = 50) {
    return this.tips.filter((t) => t.desk === desk).slice(0, limit);
  }
}

describe('faithful inbox mock', () => {
  const desk = `0x${'11'.repeat(32)}` as `0x${string}`;
  const other = `0x${'22'.repeat(32)}` as `0x${string}`;
  const inbox = new MockInbox([
    { key: `0x${'aa'.repeat(32)}`, type: 'tip', desk, owner: SEALED_OWNER, payload: new Uint8Array([1]) },
    { key: `0x${'bb'.repeat(32)}`, type: 'tip', desk: other, owner: SEALED_OWNER, payload: new Uint8Array([1]) },
  ]);

  it('returns only tips for the requested desk', () => {
    expect(inbox.page(desk)).toHaveLength(1);
    expect(inbox.page(other)).toHaveLength(1);
  });

  it('marks sealed owners', () => {
    expect(isSealedOwner(inbox.page(desk)[0]?.owner)).toBe(true);
  });

  it('does not invent tips for an unknown desk', () => {
    expect(inbox.page(`0x${'ff'.repeat(32)}` as `0x${string}`)).toEqual([]);
  });
});

describe('relay desk existence gate (logic)', () => {
  function wouldPay(deskExists: boolean, expired: boolean) {
    return deskExists && !expired;
  }
  it('refuses to pay for a missing desk', () => {
    expect(wouldPay(false, false)).toBe(false);
  });
  it('refuses to pay for an expired desk', () => {
    expect(wouldPay(true, true)).toBe(false);
  });
  it('pays for a live desk', () => {
    expect(wouldPay(true, false)).toBe(true);
  });
});

describe('cursor walk mock', () => {
  it('pages in order and stops', () => {
    const keys = Array.from({ length: 7 }, (_, i) => `0x${i.toString().padStart(64, '0')}`);
    function page(cursor: number, limit = 3) {
      const slice = keys.slice(cursor, cursor + limit);
      const next = cursor + limit < keys.length ? cursor + limit : undefined;
      return { entities: slice, cursor: next };
    }
    const first = page(0);
    expect(first.entities).toHaveLength(3);
    const second = page(first.cursor!);
    expect(second.entities).toHaveLength(3);
    const third = page(second.cursor!);
    expect(third.entities).toHaveLength(1);
    expect(third.cursor).toBeUndefined();
  });
});
