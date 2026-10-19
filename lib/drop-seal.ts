import { jsonToPayload } from '@arkiv-network/sdk';
import { bytesToB64 } from './bytes';
import { sealTo } from './crypto';
import { encodeDropPlaintext, type DropDocument, type DropRecipient } from './dead-drop';

const subtle = globalThis.crypto.subtle;

export type SealedDropPacket = {
  dropPayload: Uint8Array;
  releasePayload: Uint8Array;
};

/** Encrypt the document with a random AES key, then wrap that key to each recipient. */
export async function sealDropPacket(
  doc: DropDocument,
  recipients: DropRecipient[],
): Promise<SealedDropPacket> {
  if (!recipients.length) throw new Error('Add at least one recipient public key.');
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aes = await subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(
    await subtle.encrypt({ name: 'AES-GCM', iv }, aes, new TextEncoder().encode(encodeDropPlaintext(doc))),
  );
  const dropPayload = new Uint8Array(12 + ct.length);
  dropPayload.set(iv, 0);
  dropPayload.set(ct, 12);

  const wraps: { label: string; wireB64: string }[] = [];
  for (const recipient of recipients) {
    const { wire } = await sealTo(Uint8Array.from(recipient.pub), bytesToB64(rawKey));
    wraps.push({ label: recipient.label, wireB64: bytesToB64(wire) });
  }
  return {
    dropPayload,
    releasePayload: jsonToPayload({ v: 1, wraps }),
  };
}

export function parseRecipientPubHex(value: string): number[] | null {
  const raw = value.trim().replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{130}$/.test(raw)) return null;
  const out: number[] = [];
  for (let i = 0; i < raw.length; i += 2) {
    out.push(Number.parseInt(raw.slice(i, i + 2), 16));
  }
  if (out[0] !== 4) return null;
  return out;
}
