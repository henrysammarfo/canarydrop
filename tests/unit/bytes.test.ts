import { describe, expect, it } from 'vitest';
import { b64ToBytes, bytesEqual, bytesToB64 } from '@/lib/bytes';

describe('bytes helpers', () => {
  it('roundtrips base64', () => {
    const src = new Uint8Array([1, 2, 3, 250]);
    expect(bytesEqual(b64ToBytes(bytesToB64(src)), src)).toBe(true);
  });

  it('detects inequality', () => {
    expect(bytesEqual(new Uint8Array([1]), new Uint8Array([2]))).toBe(false);
    expect(bytesEqual(new Uint8Array([1]), new Uint8Array([1, 1]))).toBe(false);
  });

  it('empty arrays are equal', () => {
    expect(bytesEqual(new Uint8Array(), new Uint8Array())).toBe(true);
  });

  it('roundtrips empty and long buffers', () => {
    expect(bytesToB64(new Uint8Array())).toBe('');
    expect(b64ToBytes('').length).toBe(0);
    const long = new Uint8Array(4096).map((_, i) => i % 256);
    expect(bytesEqual(b64ToBytes(bytesToB64(long)), long)).toBe(true);
  });
});
