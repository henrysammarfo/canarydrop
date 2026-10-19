import type { Hex } from 'viem';
import { ADDRESS_RE, ENTITY_KEY_RE, PRIVATE_KEY_RE } from './constants';

export function isAddress(value: string): value is Hex {
  return ADDRESS_RE.test(value);
}

export function isEntityKey(value: string): value is Hex {
  return ENTITY_KEY_RE.test(value);
}

export function isPrivateKey(value: string): boolean {
  return PRIVATE_KEY_RE.test(value);
}

export function asAddress(value: string, fallback: Hex): Hex {
  return isAddress(value) ? value : fallback;
}

export function envAddress(name: string, fallback: Hex): Hex {
  const raw = process.env[name] ?? '';
  return asAddress(raw, fallback);
}
