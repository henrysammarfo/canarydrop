export type DeskPayload = {
  name: string;
  pub: number[];
  domain?: string;
};

export function parseDeskPayload(payload: Uint8Array): DeskPayload | null {
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(payload));
    if (typeof parsed !== 'object' || parsed === null) return null;
    const rec = parsed as Record<string, unknown>;
    if (typeof rec.name !== 'string') return null;
    if (!Array.isArray(rec.pub)) return null;
    if (rec.pub.length !== 65) return null;
    const pub: number[] = [];
    for (const n of rec.pub) {
      if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > 255) return null;
      pub.push(n);
    }
    const out: DeskPayload = { name: rec.name, pub };
    if (typeof rec.domain === 'string' && rec.domain.trim()) {
      const domain = rec.domain.trim().toLowerCase();
      if (/^[a-z0-9.-]{1,80}$/.test(domain)) out.domain = domain;
    }
    return out;
  } catch {
    return null;
  }
}

export function deskPubBytes(payload: DeskPayload): Uint8Array {
  return Uint8Array.from(payload.pub);
}
