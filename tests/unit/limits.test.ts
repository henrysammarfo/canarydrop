import { describe, expect, it } from 'vitest';
import { MAX_WIRE_B64_CHARS, MAX_WIRE_BYTES } from '@/lib/constants';
import { AppError } from '@/lib/errors';
import { assertWireB64, assertWireBytes, decodedB64Length } from '@/lib/limits';

describe('size limits', () => {
  it('agrees that 8192 bytes is the cap', () => {
    expect(MAX_WIRE_BYTES).toBe(8192);
  });

  it('base64 max is large enough for 8192 bytes and not 16KiB', () => {
    expect(MAX_WIRE_B64_CHARS).toBeGreaterThan(10920);
    expect(MAX_WIRE_B64_CHARS).toBeLessThan(16000);
  });

  it('decodedB64Length handles padding', () => {
    expect(decodedB64Length('AA==')).toBe(1);
    expect(decodedB64Length('AAA=')).toBe(2);
    expect(decodedB64Length('AAAA')).toBe(3);
  });

  it('rejects a huge base64 string', () => {
    expect(() => assertWireB64('A'.repeat(70000))).toThrow(AppError);
  });

  it('rejects a decoded payload over 8192', () => {
    const over = Buffer.alloc(8193).toString('base64');
    expect(() => assertWireB64(over)).toThrow(AppError);
  });

  it('accepts a 8192 byte payload encoded as base64', () => {
    const ok = Buffer.alloc(8192).toString('base64');
    expect(() => assertWireB64(ok)).not.toThrow();
  });

  it('rejects a short wire', () => {
    expect(() => assertWireBytes(new Uint8Array(10))).toThrow(AppError);
  });

  it('rejects a wire over 8192 bytes', () => {
    expect(() => assertWireBytes(new Uint8Array(8193))).toThrow(AppError);
  });
});
