import type { Hex } from 'viem';
import { bytesEqual } from './bytes';
import { deskPubBytes, parseDeskPayload } from './payload';

export type DeskPickRow = {
  key?: Hex;
  createdAt?: bigint;
  payload?: Uint8Array;
};

export function deskRowPub(row: DeskPickRow): Uint8Array | null {
  if (!row.payload) return null;
  const parsed = parseDeskPayload(row.payload);
  return parsed ? deskPubBytes(parsed) : null;
}

export function deskRowMatchesPub(row: DeskPickRow, preferPub: Uint8Array): boolean {
  const pub = deskRowPub(row);
  return !!pub && bytesEqual(pub, preferPub);
}

/** Newest live row, but if preferPub is set, newest whose payload pub matches it. */
export function pickLiveDesk<T extends DeskPickRow>(rows: readonly T[], preferPub?: Uint8Array): T | undefined {
  const sorted = [...rows].sort((a, b) => Number((b.createdAt ?? 0n) - (a.createdAt ?? 0n)));
  if (preferPub) {
    const match = sorted.find((row) => deskRowMatchesPub(row, preferPub));
    if (match) return match;
  }
  return sorted[0];
}
