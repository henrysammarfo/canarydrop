import { describe, expect, it } from 'vitest';
import {
  addressUrl,
  entityUrl,
  isSealedOwner,
  shortHex,
  TIRAMISU_CHAIN_ID,
  TIRAMISU_CHAIN_ID_HEX,
  TIRAMISU_EXPLORER,
  txUrl,
} from '@/lib/chain';

describe('chain helpers', () => {
  it('detects the sealed burn address', () => {
    expect(isSealedOwner('0x000000000000000000000000000000000000dEaD')).toBe(true);
    expect(isSealedOwner('0x000000000000000000000000000000000000dead')).toBe(true);
    expect(isSealedOwner('0x1da3c22c079c264536D831F6F1fCe638aB0b20B0')).toBe(false);
    expect(isSealedOwner(null)).toBe(false);
    expect(isSealedOwner('')).toBe(false);
  });

  it('shortens hex', () => {
    expect(shortHex('0x1234567890abcdef', 4, 4)).toBe('0x12…cdef');
    expect(shortHex('0x12')).toBe('0x12');
    expect(shortHex('')).toBe('');
  });

  it('keeps explorer hosts', () => {
    expect(TIRAMISU_CHAIN_ID).toBe(7738577);
    expect(TIRAMISU_CHAIN_ID_HEX).toBe('0x7614d1');
    expect(TIRAMISU_EXPLORER).toContain('tiramisu.explorer.arkiv.network');
    expect(txUrl('0xabc')).toContain('/tx/0xabc');
    expect(entityUrl('0xabc')).toContain('/entity/0xabc');
    expect(addressUrl('0xabc')).toContain('/address/0xabc');
  });

  it('shortens a full address to head and tail', () => {
    const addr = '0x1da3c22c079c264536D831F6F1fCe638aB0b20B0';
    expect(shortHex(addr)).toBe('0x1da3…20B0');
    expect(shortHex(addr, 8, 6)).toContain('…');
  });
});
