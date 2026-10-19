/** Convert remaining or elapsed chain time into a short English phrase. */

export function secondsToPhrase(sec: number, { ago = false }: { ago?: boolean } = {}): string {
  const n = Math.max(0, Math.round(sec));
  const suffix = ago ? ' ago' : '';
  const prefix = ago ? '' : 'in ';
  if (n < 90) return ago ? 'just now' : 'in under a minute';
  if (n < 3600) {
    const m = Math.round(n / 60);
    return m === 1 ? `${prefix}1 minute${suffix}` : `${prefix}${m} minutes${suffix}`;
  }
  if (n < 86400) {
    const h = Math.round(n / 3600);
    return h === 1 ? `${prefix}1 hour${suffix}` : `${prefix}${h} hours${suffix}`;
  }
  const d = Math.round(n / 86400);
  return d === 1 ? `${prefix}1 day${suffix}` : `${prefix}${d} days${suffix}`;
}

export function blocksToPhrase(
  blocks: number,
  durationSec: number,
  opts?: { ago?: boolean },
): string {
  return secondsToPhrase(blocks * (durationSec || 2), opts);
}

export function remainingPhrase(expiresAt: bigint, current: bigint, durationSec: number): string {
  const blocks = Number(expiresAt - current);
  if (blocks <= 0) return 'Expired';
  return blocksToPhrase(blocks, durationSec);
}

export function lastRenewedPhrase(
  expiresAt: bigint | null,
  createdAt: bigint | null,
  current: bigint,
  durationSec: number,
): string {
  if (!expiresAt) return 'Not renewed yet';
  const lifeBlocks = BigInt(Math.round((26 * 3600) / (durationSec || 2)));
  let last = expiresAt - lifeBlocks;
  if (createdAt && last < createdAt) last = createdAt;
  const agoBlocks = Number(current - last);
  if (agoBlocks <= 0) return 'just now';
  return blocksToPhrase(agoBlocks, durationSec, { ago: true });
}
