import type { Hex } from 'viem';
import { DEFAULT_DESK } from './constants';
import { isAddress } from './hex';

/** Query form works on the static mirror for desks that were not pre-rendered. */
export function canaryHref(creator: string): string {
  return `/canary?desk=${creator}`;
}

export function publicDeskHref(creator: string): string {
  return `/d?desk=${creator}`;
}

export function parseDeskQuery(value: string | null | undefined, fallback: Hex = DEFAULT_DESK): Hex {
  if (value && isAddress(value)) return value;
  return fallback;
}
