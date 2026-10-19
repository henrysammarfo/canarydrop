import { secp256k1 } from '@noble/curves/secp256k1';
import type { Hex } from 'viem';
import { keccak256, toHex } from 'viem';
import { generatePrivateKey, privateKeyToAddress } from 'viem/accounts';
import { isAddress, isPrivateKey } from './hex';

/**
 * ERC-5564 / ERC-6538 style one-time reply addresses on secp256k1.
 * Arkiv has no stealth registry, so the meta-address stays with the desk and
 * the announcement is a local value. Citations:
 * https://eips.ethereum.org/EIPS/eip-5564
 * https://eips.ethereum.org/EIPS/eip-6538
 */
export const STEALTH_SCHEME_ID = 1;

export type StealthMeta = {
  spending: Hex;
  viewing: Hex;
};

export type StealthAnnouncement = {
  schemeId: typeof STEALTH_SCHEME_ID;
  ephemeralPub: Hex;
  stealthAddress: Hex;
  viewTag: Hex;
};

function hexToBytes(hex: string): Uint8Array {
  const raw = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (raw.length % 2 !== 0) throw new Error('That key is the wrong size.');
  const out = new Uint8Array(raw.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(raw.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bytesToHex(bytes: Uint8Array): Hex {
  return toHex(bytes);
}

function scalarToBytes(n: bigint): Uint8Array {
  return hexToBytes(n.toString(16).padStart(64, '0'));
}

function pubkeyToAddress(pubCompressed: Uint8Array): Hex {
  const uncompressed = secp256k1.ProjectivePoint.fromHex(pubCompressed).toRawBytes(false);
  const hash = keccak256(uncompressed.slice(1));
  return `0x${hash.slice(-40)}` as Hex;
}

export function newStealthMeta(): { spendingPriv: Hex; viewingPriv: Hex; meta: StealthMeta } {
  const spendingPriv = generatePrivateKey();
  const viewingPriv = generatePrivateKey();
  return {
    spendingPriv,
    viewingPriv,
    meta: {
      spending: bytesToHex(secp256k1.getPublicKey(hexToBytes(spendingPriv), true)),
      viewing: bytesToHex(secp256k1.getPublicKey(hexToBytes(viewingPriv), true)),
    },
  };
}

export function encodeStealthMeta(meta: StealthMeta): string {
  return `st:eth:0x${STEALTH_SCHEME_ID.toString(16).padStart(2, '0')}${meta.spending.slice(2)}${meta.viewing.slice(2)}`;
}

export function parseStealthMeta(value: string): StealthMeta | null {
  const m = value.trim().match(/^st:eth:0x01([0-9a-fA-F]{66})([0-9a-fA-F]{66})$/);
  if (!m) return null;
  return { spending: `0x${m[1]}` as Hex, viewing: `0x${m[2]}` as Hex };
}

export function generateStealthAddress(
  meta: StealthMeta,
  ephemeralPriv = generatePrivateKey(),
): StealthAnnouncement & { ephemeralPriv: Hex } {
  const eph = hexToBytes(ephemeralPriv);
  const shared = secp256k1.getSharedSecret(eph, hexToBytes(meta.viewing), true).slice(1);
  const hashed = keccak256(shared);
  const hashPoint = secp256k1.ProjectivePoint.fromPrivateKey(hexToBytes(hashed));
  const spendingPoint = secp256k1.ProjectivePoint.fromHex(hexToBytes(meta.spending));
  const stealthPoint = spendingPoint.add(hashPoint);
  const stealthAddress = pubkeyToAddress(stealthPoint.toRawBytes(true));
  return {
    schemeId: STEALTH_SCHEME_ID,
    ephemeralPub: bytesToHex(secp256k1.getPublicKey(eph, true)),
    stealthAddress,
    viewTag: `0x${hashed.slice(2, 4)}` as Hex,
    ephemeralPriv,
  };
}

export function recoverStealthPrivateKey(
  announcement: Pick<StealthAnnouncement, 'ephemeralPub'>,
  viewingPriv: Hex,
  spendingPriv: Hex,
): Hex {
  const shared = secp256k1.getSharedSecret(hexToBytes(viewingPriv), hexToBytes(announcement.ephemeralPub), true).slice(1);
  const hashed = keccak256(shared);
  const stealthPriv = (BigInt(hashed) + BigInt(spendingPriv)) % secp256k1.CURVE.n;
  return bytesToHex(scalarToBytes(stealthPriv));
}

export function stealthMatches(
  announcement: Pick<StealthAnnouncement, 'ephemeralPub' | 'viewTag' | 'stealthAddress'>,
  viewingPriv: Hex,
  spendingPriv: Hex,
): boolean {
  if (!isPrivateKey(viewingPriv) || !isPrivateKey(spendingPriv)) return false;
  try {
    const priv = recoverStealthPrivateKey(announcement, viewingPriv, spendingPriv);
    const addr = privateKeyToAddress(priv);
    const shared = secp256k1.getSharedSecret(hexToBytes(viewingPriv), hexToBytes(announcement.ephemeralPub), true).slice(1);
    const hashed = keccak256(shared);
    const tagOk = hashed.slice(0, 4).toLowerCase() === announcement.viewTag.toLowerCase();
    return tagOk && addr.toLowerCase() === announcement.stealthAddress.toLowerCase();
  } catch {
    return false;
  }
}

export function isStealthAddress(value: string): boolean {
  return isAddress(value);
}
