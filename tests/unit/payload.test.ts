import { describe, expect, it } from 'vitest';
import { deskPubBytes, parseDeskPayload } from '@/lib/payload';

const pub = Array.from({ length: 65 }, (_, i) => (i === 0 ? 4 : i));

describe('desk payload', () => {
  it('parses a valid payload', () => {
    const raw = new TextEncoder().encode(JSON.stringify({ name: 'Desk', pub }));
    const parsed = parseDeskPayload(raw);
    expect(parsed?.name).toBe('Desk');
    expect(parsed?.pub.length).toBe(65);
    expect(deskPubBytes(parsed!).byteLength).toBe(65);
  });

  it('rejects missing pub', () => {
    const raw = new TextEncoder().encode(JSON.stringify({ name: 'Desk' }));
    expect(parseDeskPayload(raw)).toBeNull();
  });

  it('rejects a short pub', () => {
    const raw = new TextEncoder().encode(JSON.stringify({ name: 'Desk', pub: [1, 2, 3] }));
    expect(parseDeskPayload(raw)).toBeNull();
  });

  it('rejects out of range bytes', () => {
    const bad = [...pub];
    bad[2] = 300;
    const raw = new TextEncoder().encode(JSON.stringify({ name: 'Desk', pub: bad }));
    expect(parseDeskPayload(raw)).toBeNull();
  });

  it('rejects invalid json', () => {
    expect(parseDeskPayload(new TextEncoder().encode('not-json'))).toBeNull();
  });

  it('rejects a non object', () => {
    expect(parseDeskPayload(new TextEncoder().encode('[]'))).toBeNull();
  });

  it('rejects a missing name', () => {
    const raw = new TextEncoder().encode(JSON.stringify({ pub }));
    expect(parseDeskPayload(raw)).toBeNull();
  });

  it('rejects a float in pub', () => {
    const bad = [...pub];
    bad[1] = 1.5;
    const raw = new TextEncoder().encode(JSON.stringify({ name: 'Desk', pub: bad }));
    expect(parseDeskPayload(raw)).toBeNull();
  });

  it('rejects a negative byte', () => {
    const bad = [...pub];
    bad[4] = -1;
    const raw = new TextEncoder().encode(JSON.stringify({ name: 'Desk', pub: bad }));
    expect(parseDeskPayload(raw)).toBeNull();
  });

  it('rejects a 66 byte pub', () => {
    const raw = new TextEncoder().encode(JSON.stringify({ name: 'Desk', pub: [...pub, 1] }));
    expect(parseDeskPayload(raw)).toBeNull();
  });
});
