import { createECDH, createHash, hkdfSync } from 'node:crypto';
import { AppError } from './errors';
import { isPrivateKey } from './hex';

const INFO = 'canarydrop-demo-p256-v1';
const SALT = 'canarydrop';

export type DemoDeskJwk = {
  kty: 'EC';
  crv: 'P-256';
  x: string;
  y: string;
  d: string;
  ext: true;
  key_ops: ['deriveBits'];
};

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s, 'base64url');
}

/**
 * Derive the shared demo P-256 key from the desk wallet key already held on the server.
 * The Ethereum key never leaves this function. The result is a testnet demo key so a
 * fresh browser can open demo tips. It is not a newsroom key.
 */
export function deriveDemoDeskJwk(ethPrivateKey: string): DemoDeskJwk {
  if (!isPrivateKey(ethPrivateKey)) throw new AppError('demo_disabled');
  const ikm = Buffer.from(ethPrivateKey.slice(2), 'hex');
  let material = Buffer.from(hkdfSync('sha256', ikm, SALT, INFO, 32));
  for (let i = 0; i < 16; i++) {
    try {
      const ecdh = createECDH('prime256v1');
      ecdh.setPrivateKey(material);
      const pub = ecdh.getPublicKey(null, 'uncompressed');
      const priv = ecdh.getPrivateKey();
      if (pub.length !== 65 || pub[0] !== 4) throw new Error('bad_pub');
      return {
        kty: 'EC',
        crv: 'P-256',
        x: b64url(pub.subarray(1, 33)),
        y: b64url(pub.subarray(33, 65)),
        d: b64url(priv),
        ext: true,
        key_ops: ['deriveBits'],
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      material = createHash('sha256').update(material).update(Buffer.from([i])).digest();
    }
  }
  throw new AppError('server_error', 'Could not start demo mode.');
}

export function demoPubRaw(jwk: DemoDeskJwk): Uint8Array {
  const x = fromB64url(jwk.x);
  const y = fromB64url(jwk.y);
  const out = new Uint8Array(65);
  out[0] = 4;
  out.set(x, 1);
  out.set(y, 33);
  return out;
}

export function demoJwkPublic(jwk: DemoDeskJwk): Omit<DemoDeskJwk, 'd'> {
  return {
    kty: jwk.kty,
    crv: jwk.crv,
    x: jwk.x,
    y: jwk.y,
    ext: true,
    key_ops: ['deriveBits'],
  };
}
