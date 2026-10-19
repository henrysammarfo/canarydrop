/** UTC calendar day as YYYYMMDD, stored as a u64 attribute named slot. */
export function utcDaySlot(now = new Date()): bigint {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  const d = now.getUTCDate();
  return BigInt(y * 10000 + m * 100 + d);
}

export function slotFromDateParts(y: number, m: number, d: number): bigint {
  return BigInt(y * 10000 + m * 100 + d);
}
