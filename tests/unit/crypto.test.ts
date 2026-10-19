import { describe, expect, it } from 'vitest';
import {
  exportPub,
  importPrivJwk,
  importPub,
  jwkToUncompressed,
  newKeyPair,
  openAsDesk,
  openReply,
  PAD,
  pad,
  sealReply,
  sealTo,
  unpad,
  WIRE_VERSION,
} from '@/lib/crypto';

describe('crypto roundtrip', () => {
  it('seals and opens a tip, and roundtrips a reply', async () => {
    const desk = await newKeyPair();
    const deskPub = await exportPub(desk.publicKey);
    const { wire, receipt } = await sealTo(deskPub, 'hello world');
    const opened = await openAsDesk(desk.privateKey, wire);
    expect(opened.text).toBe('hello world');
    const replyWire = await sealReply(desk.privateKey, opened.ephPub, 'roger');
    const srcPriv = await importPrivJwk(receipt);
    const pub = await importPub(deskPub);
    expect(await openReply(srcPriv, pub, replyWire)).toBe('roger');
  });

  it('roundtrips unicode and empty text', async () => {
    const desk = await newKeyPair();
    const deskPub = await exportPub(desk.publicKey);
    for (const text of ['', 'café', '密钥', 'hello\nworld']) {
      const { wire } = await sealTo(deskPub, text);
      expect((await openAsDesk(desk.privateKey, wire)).text).toBe(text);
    }
  });

  it('pads to 2 KiB buckets', () => {
    const a = pad(new Uint8Array(1));
    expect(a.length).toBe(PAD);
    const b = pad(new Uint8Array(PAD - 4));
    expect(b.length).toBe(PAD);
    const c = pad(new Uint8Array(PAD - 3));
    expect(c.length).toBe(PAD * 2);
    expect(unpad(a).length).toBe(1);
  });

  it('rejects a wrong version on open', async () => {
    const desk = await newKeyPair();
    const deskPub = await exportPub(desk.publicKey);
    const { wire } = await sealTo(deskPub, 'x');
    wire[0] = 9;
    await expect(openAsDesk(desk.privateKey, wire)).rejects.toThrow(/version/);
  });

  it('rejects a short wire', async () => {
    const desk = await newKeyPair();
    await expect(openAsDesk(desk.privateKey, new Uint8Array(10))).rejects.toThrow(/short/);
  });

  it('rejects tampered ciphertext', async () => {
    const desk = await newKeyPair();
    const deskPub = await exportPub(desk.publicKey);
    const { wire } = await sealTo(deskPub, 'secret');
    wire[wire.length - 1] = (wire[wire.length - 1] ?? 0) ^ 0xff;
    await expect(openAsDesk(desk.privateKey, wire)).rejects.toThrow();
  });

  it('rejects the wrong desk key', async () => {
    const desk = await newKeyPair();
    const other = await newKeyPair();
    const { wire } = await sealTo(await exportPub(desk.publicKey), 'secret');
    await expect(openAsDesk(other.privateKey, wire)).rejects.toThrow();
  });

  it('exports a 65 byte uncompressed public key', async () => {
    const desk = await newKeyPair();
    const pub = await exportPub(desk.publicKey);
    expect(pub.byteLength).toBe(65);
    expect(pub[0]).toBe(4);
  });

  it('rejects a public key of the wrong size', async () => {
    await expect(importPub(new Uint8Array(32))).rejects.toThrow(/wrong size/);
  });

  it('rejects a jwk that is not P-256', async () => {
    await expect(importPrivJwk({ kty: 'oct', k: 'aa' })).rejects.toThrow(/desk key/);
  });

  it('rebuilds uncompressed bytes from a jwk', async () => {
    const desk = await newKeyPair();
    const jwk = await (await import('@/lib/crypto')).exportPrivJwk(desk.privateKey);
    const raw = jwkToUncompressed(jwk);
    expect(raw.byteLength).toBe(65);
    expect(raw[0]).toBe(WIRE_VERSION + 3);
  });

  it('refuses overly long plaintext', async () => {
    const desk = await newKeyPair();
    const deskPub = await exportPub(desk.publicKey);
    await expect(sealTo(deskPub, 'x'.repeat(5000))).rejects.toThrow(/too long/);
  });

  it('rejects a short reply wire', async () => {
    const desk = await newKeyPair();
    const pub = desk.publicKey;
    await expect(openReply(desk.privateKey, pub, new Uint8Array(4))).rejects.toThrow(/short/);
  });

  it('rejects a wrong reply version', async () => {
    const desk = await newKeyPair();
    const other = await newKeyPair();
    const { ephPub } = await (async () => {
      const sealed = await sealTo(await exportPub(desk.publicKey), 'hi');
      return openAsDesk(desk.privateKey, sealed.wire);
    })();
    const wire = await sealReply(desk.privateKey, ephPub, 'ok');
    wire[0] = 2;
    await expect(openReply(other.privateKey, desk.publicKey, wire)).rejects.toThrow(/version/);
  });

  it('wire starts with version 1 and is at least 78 bytes', async () => {
    const desk = await newKeyPair();
    const { wire } = await sealTo(await exportPub(desk.publicKey), 'n');
    expect(wire[0]).toBe(WIRE_VERSION);
    expect(wire.byteLength).toBeGreaterThanOrEqual(78);
  });
});
