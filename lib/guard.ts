import type { PublicArkivClient } from '@arkiv-network/sdk';
import type { Hex } from 'viem';
import { DESK_DAILY_CREATE_CAP, DESK_DAILY_WRITE_CAP, MIN_WALLET_WEI, RELAY_DAILY_TIP_CAP } from './constants';
import { utcDaySlot } from './day';
import { AppError } from './errors';
import { countBySlot, pub } from './arkiv';

export function overDailyCap(used: number, cap: number): boolean {
  if (!Number.isFinite(used) || used < 0) return true;
  return used >= cap;
}

export function belowFloor(balance: bigint, minWei: bigint = MIN_WALLET_WEI): boolean {
  return balance < minWei;
}

export async function assertMinBalance(
  client: PublicArkivClient,
  address: Hex,
  minWei: bigint = MIN_WALLET_WEI,
): Promise<bigint> {
  const bal = await client.getBalance({ address });
  if (belowFloor(bal, minWei)) throw new AppError('unfunded');
  return bal;
}

export async function assertRelaySpendRoom(relay: Hex, now = new Date()): Promise<number> {
  const used = await countBySlot('tip', relay, utcDaySlot(now));
  if (overDailyCap(used, RELAY_DAILY_TIP_CAP)) throw new AppError('spend_cap');
  return used;
}

export async function assertDeskSpendRoom(desk: Hex, now = new Date()): Promise<number> {
  const used = await countBySlot('reply', desk, utcDaySlot(now));
  if (overDailyCap(used, DESK_DAILY_WRITE_CAP)) {
    throw new AppError('spend_cap', 'The demo desk is at its daily limit. Please try again tomorrow.');
  }
  return used;
}

export async function assertDeskCreateRoom(desk: Hex, now = new Date()): Promise<number> {
  const used = await countBySlot('desk', desk, utcDaySlot(now));
  if (overDailyCap(used, DESK_DAILY_CREATE_CAP)) {
    throw new AppError('spend_cap', 'The demo desk is at its daily create limit. Please try again tomorrow.');
  }
  return used;
}

export async function relayBalance(): Promise<bigint> {
  const { relayAddress } = await import('./arkiv');
  return pub().getBalance({ address: relayAddress() });
}
