import { describe, it, expect } from 'vitest';
import { newKeyPair, exportPub, sealTo, importPrivJwk, openAsDesk, sealReply, openReply, importPub } from '@/lib/crypto';

describe('crypto roundtrip', () => {
  it('seals and opens a tip, and roundtrips a reply', async () => {
    const desk = await newKeyPair();
    const deskPub = await exportPub(desk.publicKey);
    const { wire, receipt } = await sealTo(deskPub, 'hello world');
    const text = (await openAsDesk(desk.privateKey, wire)).text;
    expect(text).toBe('hello world');
    const ephPub = (await openAsDesk(desk.privateKey, wire)).ephPub;
    const replyWire = await sealReply(desk.privateKey, ephPub, 'roger');
    const srcPriv = await importPrivJwk(receipt);
    const pub = await importPub(deskPub);
    const r = await openReply(srcPriv, pub, replyWire);
    expect(r).toBe('roger');
  });
});

