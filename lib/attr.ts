import type { Attributes } from '@arkiv-network/sdk';
import type { Hex } from 'viem';

export function attrStr(attrs: Attributes | undefined, name: string): string | undefined {
  const cell = attrs?.[name];
  if (!cell || cell.type !== 'str') return undefined;
  return cell.value;
}

export function attrKey(attrs: Attributes | undefined, name: string): Hex | undefined {
  const cell = attrs?.[name];
  if (!cell || cell.type !== 'key') return undefined;
  return cell.value;
}

export function attrU64(attrs: Attributes | undefined, name: string): bigint | undefined {
  const cell = attrs?.[name];
  if (!cell || cell.type !== 'u64') return undefined;
  return cell.value;
}

export function attrBool(attrs: Attributes | undefined, name: string): boolean | undefined {
  const cell = attrs?.[name];
  if (!cell || cell.type !== 'bool') return undefined;
  return cell.value;
}
