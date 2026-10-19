// WebCrypto ECIES (P-256 ECDH to HKDF-SHA256 to AES-256-GCM). Runs in browsers and Node 20+.
const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();
export const PAD = 2048;
export const WIRE_VERSION = 1;
const MAX_PLAIN = 4000;

export async function newKeyPair() {
  return subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
}
export async function exportPub(k: CryptoKey) {
  return new Uint8Array(await subtle.exportKey('raw', k));
}
export async function importPub(raw: Uint8Array) {
  if (raw.byteLength !== 65) throw new Error('That public key is the wrong size.');
  return subtle.importKey('raw', raw as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
}
export async function exportPrivJwk(k: CryptoKey) {
  return subtle.exportKey('jwk', k);
}
export async function importPrivJwk(jwk: JsonWebKey) {
  if (jwk.kty !== 'EC' || jwk.crv !== 'P-256' || !jwk.d) {
    throw new Error('That key file is not a desk key we can use.');
  }
  return subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
}

function b64urlToBytes(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  if (typeof Buffer !== 'undefined') return Uint8Array.from(Buffer.from(padded, 'base64'));
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function jwkToUncompressed(jwk: JsonWebKey): Uint8Array {
  if (!jwk.x || !jwk.y) throw new Error('That public key is missing.');
  const x = b64urlToBytes(jwk.x);
  const y = b64urlToBytes(jwk.y);
  const out = new Uint8Array(65);
  out[0] = 4;
  out.set(x, 1);
  out.set(y, 33);
  return out;
}
async function aesKey(priv: CryptoKey, pub: CryptoKey) {
  const bits = await subtle.deriveBits({ name: 'ECDH', public: pub }, priv, 256);
  const hk = await subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: enc.encode('canarydrop/v1') },
    hk,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}
export function pad(b: Uint8Array) {
  const n = Math.ceil((b.length + 4) / PAD) * PAD;
  const out = new Uint8Array(n);
  new DataView(out.buffer).setUint32(0, b.length);
  out.set(b, 4);
  return out;
}
export function unpad(b: Uint8Array) {
  const len = new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(0);
  if (len > b.length - 4) throw new Error('That sealed message is damaged.');
  return b.slice(4, 4 + len);
}

/** Source to desk. Returns wire bytes [1 | ephPub(65) | iv(12) | ct] and the source receipt. */
export async function sealTo(deskPubRaw: Uint8Array, plaintext: string) {
  if (plaintext.length > MAX_PLAIN) throw new Error('That tip is too long.');
  const eph = await newKeyPair();
  const key = await aesKey(eph.privateKey, await importPub(deskPubRaw));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, pad(enc.encode(plaintext))));
  const ephPub = await exportPub(eph.publicKey);
  const wire = new Uint8Array(1 + 65 + 12 + ct.length);
  wire[0] = WIRE_VERSION;
  wire.set(ephPub, 1);
  wire.set(iv, 66);
  wire.set(ct, 78);
  return { wire, receipt: await exportPrivJwk(eph.privateKey) };
}

export async function openAsDesk(deskPriv: CryptoKey, wire: Uint8Array) {
  if (wire.byteLength < 78) throw new Error('That sealed message is too short.');
  if (wire[0] !== WIRE_VERSION) throw new Error('This sealed message is not a version we can open.');
  const ephPub = await importPub(wire.slice(1, 66));
  const key = await aesKey(deskPriv, ephPub);
  const pt = await subtle.decrypt({ name: 'AES-GCM', iv: wire.slice(66, 78) }, key, wire.slice(78));
  return { text: new TextDecoder().decode(unpad(new Uint8Array(pt))), ephPub };
}

export async function sealReply(priv: CryptoKey, pub: CryptoKey, text: string) {
  if (text.length > MAX_PLAIN) throw new Error('That reply is too long.');
  const key = await aesKey(priv, pub);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, pad(enc.encode(text))));
  const w = new Uint8Array(13 + ct.length);
  w[0] = WIRE_VERSION;
  w.set(iv, 1);
  w.set(ct, 13);
  return w;
}

export async function openReply(priv: CryptoKey, pub: CryptoKey, w: Uint8Array) {
  if (w.byteLength < 13) throw new Error('That sealed message is too short.');
  if (w[0] !== WIRE_VERSION) throw new Error('This sealed message is not a version we can open.');
  const key = await aesKey(priv, pub);
  const pt = await subtle.decrypt({ name: 'AES-GCM', iv: w.slice(1, 13) }, key, w.slice(13));
  return new TextDecoder().decode(unpad(new Uint8Array(pt)));
}
