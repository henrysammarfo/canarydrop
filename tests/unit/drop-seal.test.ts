import { describe, expect, it } from 'vitest';
import { newKeyPair, exportPub, openAsDesk } from '@/lib/crypto';
import { parseDropDocument } from '@/lib/dead-drop';
import { parseRecipientPubHex, sealDropPacket } from '@/lib/drop-seal';
import { b64ToBytes } from '@/lib/bytes';

describe('dead drop sealing', () => {
  it('parses a 65 byte uncompressed public key', () => {
    const hex = `04${'11'.repeat(64)}`;
    expect(parseRecipientPubHex(hex)?.[0]).toBe(4);
    expect(parseRecipientPubHex('0x04' + '11'.repeat(64))?.length).toBe(65);
    expect(parseRecipientPubHex('04aa')).toBeNull();
  });

  it('encrypts a document and wraps the key to a recipient', async () => {
    const pair = await newKeyPair();
    const pub = Array.from(await exportPub(pair.publicKey));
    const packet = await sealDropPacket({ title: 'A', text: 'Synthetic only' }, [{ label: 'Editor', pub }]);
    expect(packet.dropPayload.byteLength).toBeGreaterThan(12);
    const release = JSON.parse(new TextDecoder().decode(packet.releasePayload)) as {
      wraps: { label: string; wireB64: string }[];
    };
    expect(release.wraps).toHaveLength(1);
    const opened = await openAsDesk(pair.privateKey, b64ToBytes(release.wraps[0]!.wireB64));
    expect(opened.text.length).toBeGreaterThan(10);
    expect(parseDropDocument({ title: 'A', text: 'Synthetic only' })?.title).toBe('A');
  });
});
