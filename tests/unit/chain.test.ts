import { describe, it, expect } from 'vitest';
import { isSealedOwner, shortHex, TIRAMISU_CHAIN_ID, TIRAMISU_EXPLORER } from '@/lib/chain';

describe('chain helpers', () => {
  it('detects the sealed burn address', () => {
    expect(isSealedOwner('0x000000000000000000000000000000000000dEaD')).toBe(true);
    expect(isSealedOwner('0x000000000000000000000000000000000000dead')).toBe(true);
    expect(isSealedOwner('0x1da3c22c079c264536D831F6F1fCe638aB0b20B0')).toBe(false);
  });
  it('shortens hex and keeps explorer host', () => {
    expect(shortHex('0x1234567890abcdef', 4, 4)).toBe('0x12…cdef');
    expect(TIRAMISU_CHAIN_ID).toBe(7738577);
    expect(TIRAMISU_EXPLORER).toContain('tiramisu.explorer.arkiv.network');
  });
});
