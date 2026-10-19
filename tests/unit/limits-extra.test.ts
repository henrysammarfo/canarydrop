import { describe, expect, it } from 'vitest';
import { AppError } from '@/lib/errors';
import { assertWireB64, assertWireBytes, decodedB64Length, isOversizedWireB64, throwIfOversizedWire } from '@/lib/limits';

describe('size limit extra cases', () => {
  it('8191 bytes is accepted and 8192 is accepted', () => {
    expect(() => assertWireBytes(new Uint8Array(8191).fill(1))).not.toThrow();
    expect(() => assertWireBytes(new Uint8Array(8192).fill(1))).not.toThrow();
  });

  it('77 bytes is too short and 78 is not', () => {
    expect(() => assertWireBytes(new Uint8Array(77))).toThrow(AppError);
    expect(() => assertWireBytes(new Uint8Array(78).fill(1))).not.toThrow();
  });

  it('isOversizedWireB64 agrees with assertWireB64', () => {
    const over = Buffer.alloc(8193).toString('base64');
    expect(isOversizedWireB64(over)).toBe(true);
    expect(() => assertWireB64(over)).toThrow(AppError);
    const ok = Buffer.alloc(80).toString('base64');
    expect(isOversizedWireB64(ok)).toBe(false);
  });

  it('throwIfOversizedWire reads only wireB64', () => {
    expect(() => throwIfOversizedWire(null)).not.toThrow();
    expect(() => throwIfOversizedWire({ deskKey: '0x1' })).not.toThrow();
    expect(() => throwIfOversizedWire({ wireB64: 'A'.repeat(70000) })).toThrow(AppError);
  });

  it('decodedB64Length of empty is 0', () => {
    expect(decodedB64Length('')).toBe(0);
    expect(decodedB64Length('   ')).toBe(0);
  });
});
