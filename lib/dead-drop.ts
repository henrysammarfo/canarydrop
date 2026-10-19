import { ExpirationTime, jsonToPayload } from '@arkiv-network/sdk';
import { key, str, u64 } from '@arkiv-network/sdk/attr';
import type { Hex } from 'viem';
import { PROJECT, SEALED_OWNER, pub } from './arkiv';
import { utcDaySlot } from './day';

export const DROP_TYPE = 'drop';
export const RELEASE_TYPE = 'release';
export const HOLD_TYPE = 'hold';

export type DeadDropStatus = 'held' | 'released';

export type PredictedDropKeys = {
  drop: { key: Hex; salt: bigint };
  release: { key: Hex; salt: bigint };
  hold: { key: Hex; salt: bigint };
};

export type DropDocument = {
  title: string;
  text: string;
};

export type DropRecipient = {
  label: string;
  pub: number[];
};

/** Canary alive plus a live hold means the drop stays sealed to recipients. */
export function deadDropStatus(canaryAlive: boolean, holdAlive: boolean): DeadDropStatus {
  return canaryAlive && holdAlive ? 'held' : 'released';
}

export function deadDropCopy(status: DeadDropStatus): string {
  if (status === 'held') {
    return 'The newsroom is still signing the canary, so this hold stays closed.';
  }
  return 'The canary is gone, so the hold is treated as released.';
}

export async function predictDeadDropKeys(owner: Hex): Promise<PredictedDropKeys> {
  const [drop, release, hold] = await pub().predictEntityKeys({ owner, count: 3 });
  return { drop, release, hold };
}

export function deadDropCreates(opts: {
  keys: PredictedDropKeys;
  deskKey: Hex;
  dropPayload: Uint8Array;
  releasePayload: Uint8Array;
}) {
  return {
    creates: [
      {
        salt: opts.keys.drop.salt,
        payload: opts.dropPayload,
        contentType: 'application/octet-stream',
        attributes: {
          project: str(PROJECT),
          type: str(DROP_TYPE),
          desk: key(opts.deskKey),
          slot: u64(utcDaySlot()),
        },
        expires: ExpirationTime.fromDays(90),
        flags: { readonly: true },
      },
      {
        salt: opts.keys.release.salt,
        payload: opts.releasePayload,
        contentType: 'application/json',
        attributes: {
          project: str(PROJECT),
          type: str(RELEASE_TYPE),
          desk: key(opts.deskKey),
          drop: key(opts.keys.drop.key),
          slot: u64(utcDaySlot()),
        },
        expires: ExpirationTime.fromDays(90),
        flags: { readonly: true },
      },
      {
        salt: opts.keys.hold.salt,
        payload: jsonToPayload({ kind: HOLD_TYPE, drop: opts.keys.drop.key }),
        contentType: 'application/json',
        attributes: {
          project: str(PROJECT),
          type: str(HOLD_TYPE),
          desk: key(opts.deskKey),
          drop: key(opts.keys.drop.key),
        },
        expires: ExpirationTime.fromHours(26),
        flags: { readonly: true },
      },
    ],
    ownershipChanges: [{ entityKey: opts.keys.drop.key, newOwner: SEALED_OWNER }],
  };
}

export function holdExtensions(holdKey: Hex, canaryKey: Hex) {
  return {
    extensions: [
      { entityKey: holdKey, expires: ExpirationTime.fromHours(26) },
      { entityKey: canaryKey, expires: ExpirationTime.fromHours(26) },
    ],
  };
}

export function parseDropDocument(value: unknown): DropDocument | null {
  if (typeof value !== 'object' || value === null) return null;
  const rec = value as Record<string, unknown>;
  if (typeof rec.title !== 'string' || typeof rec.text !== 'string') return null;
  const title = rec.title.trim();
  const text = rec.text.trim();
  if (!title || !text) return null;
  if (title.length > 80 || text.length > 4000) return null;
  return { title, text };
}

export function parseRecipients(value: unknown): DropRecipient[] {
  if (!Array.isArray(value)) return [];
  const out: DropRecipient[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.label !== 'string' || !rec.label.trim()) continue;
    if (!Array.isArray(rec.pub) || rec.pub.length !== 65) continue;
    const pub: number[] = [];
    let ok = true;
    for (const n of rec.pub) {
      if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > 255) {
        ok = false;
        break;
      }
      pub.push(n);
    }
    if (!ok) continue;
    out.push({ label: rec.label.trim().slice(0, 60), pub });
  }
  return out;
}

export function encodeDropPlaintext(doc: DropDocument): string {
  return JSON.stringify({ title: doc.title, text: doc.text, v: 1 });
}
