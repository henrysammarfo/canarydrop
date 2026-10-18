// WebCrypto-only ECIES (P-256 ECDH -> HKDF-SHA256 -> AES-256-GCM). Runs in browsers and Node 20+.
const subtle = globalThis.crypto.subtle
const enc = new TextEncoder()
const PAD = 2048 // pad plaintext to 2 KiB buckets so ciphertext length leaks nothing useful

export async function newKeyPair() {
  return subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])
}
export async function exportPub(k: CryptoKey) { return new Uint8Array(await subtle.exportKey("raw", k)) } // 65 bytes
export async function importPub(raw: Uint8Array) {
  return subtle.importKey("raw", raw as BufferSource, { name: "ECDH", namedCurve: "P-256" }, true, [])
}
export async function exportPrivJwk(k: CryptoKey) { return subtle.exportKey("jwk", k) }
export async function importPrivJwk(jwk: JsonWebKey) {
  return subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])
}
async function aesKey(priv: CryptoKey, pub: CryptoKey) {
  const bits = await subtle.deriveBits({ name: "ECDH", public: pub }, priv, 256)
  const hk = await subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"])
  return subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: enc.encode("canarydrop/v1") },
    hk, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"])
}
function pad(b: Uint8Array) {
  const n = Math.ceil((b.length + 4) / PAD) * PAD
  const out = new Uint8Array(n); new DataView(out.buffer).setUint32(0, b.length); out.set(b, 4); return out
}
function unpad(b: Uint8Array) { const len = new DataView(b.buffer, b.byteOffset).getUint32(0); return b.slice(4, 4 + len) }

/** Source -> desk. Returns wire bytes [1|ephPub(65)|iv(12)|ct] and the ephemeral private key (the source's "receipt"). */
export async function sealTo(deskPubRaw: Uint8Array, plaintext: string) {
  const eph = await newKeyPair()
  const key = await aesKey(eph.privateKey, await importPub(deskPubRaw))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv }, key, pad(enc.encode(plaintext))))
  const ephPub = await exportPub(eph.publicKey)
  const wire = new Uint8Array(1 + 65 + 12 + ct.length)
  wire[0] = 1; wire.set(ephPub, 1); wire.set(iv, 66); wire.set(ct, 78)
  return { wire, receipt: await exportPrivJwk(eph.privateKey) }
}
/** Desk opens a tip with its private key. Also returns the source's ephemeral public key for replies. */
export async function openAsDesk(deskPriv: CryptoKey, wire: Uint8Array) {
  if (wire[0] !== 1) throw new Error("unknown version")
  const ephPub = await importPub(wire.slice(1, 66) as Uint8Array)
  const key = await aesKey(deskPriv, ephPub)
  const pt = await subtle.decrypt({ name: "AES-GCM", iv: wire.slice(66, 78) }, key, wire.slice(78))
  return { text: new TextDecoder().decode(unpad(new Uint8Array(pt))), ephPub }
}
/** Same ECDH secret both ways: desk replies with (deskPriv, ephPub); source reads with (receiptPriv, deskPub). */
export async function sealReply(priv: CryptoKey, pub: CryptoKey, text: string) {
  const key = await aesKey(priv, pub); const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv }, key, pad(enc.encode(text))))
  const w = new Uint8Array(13 + ct.length); w[0] = 1; w.set(iv, 1); w.set(ct, 13); return w
}
export async function openReply(priv: CryptoKey, pub: CryptoKey, w: Uint8Array) {
  const key = await aesKey(priv, pub)
  const pt = await subtle.decrypt({ name: "AES-GCM", iv: w.slice(1, 13) }, key, w.slice(13))
  return new TextDecoder().decode(unpad(new Uint8Array(pt)))
}
