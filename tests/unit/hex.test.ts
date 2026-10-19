import { describe, expect, it } from 'vitest';
import { DEFAULT_DESK } from '@/lib/constants';
import { asAddress, envAddress, isAddress, isEntityKey, isPrivateKey } from '@/lib/hex';

describe('hex validators', () => {
  it('accepts addresses', () => {
    expect(isAddress(DEFAULT_DESK)).toBe(true);
    expect(isAddress('0x1da3c22c079c264536D831F6F1fCe638aB0b20B0')).toBe(true);
  });

  it('rejects short or bad addresses', () => {
    expect(isAddress('0x1da3')).toBe(false);
    expect(isAddress('1da3c22c079c264536D831F6F1fCe638aB0b20B0')).toBe(false);
    expect(isAddress('')).toBe(false);
  });

  it('accepts entity keys', () => {
    expect(isEntityKey(`0x${'ab'.repeat(32)}`)).toBe(true);
    expect(isEntityKey(`0x${'AB'.repeat(32)}`)).toBe(true);
    expect(isEntityKey('0xxyz')).toBe(false);
  });

  it('treats 32 byte hex as a private key shape without logging it', () => {
    expect(isPrivateKey(`0x${'11'.repeat(32)}`)).toBe(true);
    expect(isPrivateKey('11'.repeat(32))).toBe(false);
  });

  it('falls back when env is missing', () => {
    expect(asAddress('nope', DEFAULT_DESK)).toBe(DEFAULT_DESK);
    delete process.env.NEXT_PUBLIC_DESK_ADDRESS;
    expect(envAddress('NEXT_PUBLIC_DESK_ADDRESS', DEFAULT_DESK)).toBe(DEFAULT_DESK);
  });

  it('rejects 0x-only and odd length', () => {
    expect(isAddress('0x')).toBe(false);
    expect(isEntityKey('0x')).toBe(false);
    expect(isPrivateKey('0x')).toBe(false);
    expect(isAddress(`0x${'a'.repeat(39)}`)).toBe(false);
  });

  it('asAddress keeps a valid value', () => {
    expect(asAddress(DEFAULT_DESK, `0x${'11'.repeat(20)}`)).toBe(DEFAULT_DESK);
  });
});
