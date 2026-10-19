import type { Hex } from 'viem';
import { str } from '@arkiv-network/sdk/attr';
import { canaryWriteAttrs, replyWriteAttrs } from './arkiv';
import { PROJECT } from './constants';
import { deadDropCreates } from './dead-drop';
import { directTipAttributes } from './direct-tip';
import { DEFAULT_CANARY_STATEMENT } from './eip712';
import { generateStealthAddress, newStealthMeta } from './stealth';

const SAMPLE_DESK = `0x${'11'.repeat(32)}` as Hex;
const SAMPLE_TIP = `0x${'22'.repeat(32)}` as Hex;

export const EIP712_SIG_HEX = `0x${'ab'.repeat(65)}` as Hex;

type AttrCell = { type?: string; value?: unknown };

function strValues(attrs: Record<string, AttrCell | undefined>): string[] {
  const out: string[] = [];
  for (const cell of Object.values(attrs)) {
    if (cell && cell.type === 'str' && typeof cell.value === 'string') out.push(cell.value);
  }
  return out;
}

/** Every UTF-8 string this app passes to SDK `str()` on a write. */
export function productWriteStringValues(): string[] {
  const signed = {
    statement: DEFAULT_CANARY_STATEMENT,
    issuedAt: 1n,
    signature: EIP712_SIG_HEX,
  };
  const stealth = generateStealthAddress(newStealthMeta().meta);
  const drop = deadDropCreates({
    keys: {
      drop: { key: `0x${'d1'.repeat(32)}` as Hex, salt: 1n },
      release: { key: `0x${'e2'.repeat(32)}` as Hex, salt: 2n },
      hold: { key: `0x${'f3'.repeat(32)}` as Hex, salt: 3n },
    },
    deskKey: SAMPLE_DESK,
    dropPayload: new Uint8Array([1]),
    releasePayload: new Uint8Array([2]),
  });
  const values = [
    ...strValues(canaryWriteAttrs(SAMPLE_DESK)),
    ...strValues(canaryWriteAttrs(SAMPLE_DESK, signed)),
    ...strValues({ project: str(PROJECT), type: str('desk') }),
    ...strValues({ project: str(PROJECT), type: str('tip') }),
    ...strValues(directTipAttributes(SAMPLE_DESK)),
    ...strValues(replyWriteAttrs(SAMPLE_TIP)),
    ...strValues(replyWriteAttrs(SAMPLE_TIP, stealth)),
    ...drop.creates.flatMap((row) => strValues(row.attributes)),
  ];
  return [...new Set(values)];
}

export function canaryWriteAttrNames(signed = true): string[] {
  const attrs = canaryWriteAttrs(
    SAMPLE_DESK,
    signed
      ? { statement: DEFAULT_CANARY_STATEMENT, issuedAt: 1n, signature: EIP712_SIG_HEX }
      : undefined,
  );
  return Object.keys(attrs);
}
