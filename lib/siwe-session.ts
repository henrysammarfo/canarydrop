import type { Hex } from 'viem';
import { isAddress } from './hex';
import { parseSiweMessage, siweDomainAllowed, verifySiwe } from './siwe';

export const SIWE_STORE = 'canarydrop/siwe';

export type SiweSession = {
  address: Hex;
  message: string;
  signature: Hex;
};

export function deskWriteAllowed(opts: {
  creator: Hex | null | undefined;
  signer: Hex | null | undefined;
  demo: boolean;
}): boolean {
  if (opts.demo) return true;
  if (!opts.creator || !opts.signer) return false;
  if (!isAddress(opts.creator) || !isAddress(opts.signer)) return false;
  return opts.creator.toLowerCase() === opts.signer.toLowerCase();
}

export function loadSiweSession(storage?: Storage | null): SiweSession | null {
  const store = storage ?? (typeof sessionStorage === 'undefined' ? null : sessionStorage);
  if (!store) return null;
  try {
    const raw = store.getItem(SIWE_STORE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SiweSession>;
    if (!parsed.address || !parsed.message || !parsed.signature) return null;
    if (!isAddress(parsed.address)) return null;
    if (!parsed.signature.startsWith('0x')) return null;
    return { address: parsed.address, message: parsed.message, signature: parsed.signature };
  } catch {
    return null;
  }
}

export function saveSiweSession(session: SiweSession, storage?: Storage | null): void {
  const store = storage ?? (typeof sessionStorage === 'undefined' ? null : sessionStorage);
  if (!store) return;
  try {
    store.setItem(SIWE_STORE, JSON.stringify(session));
  } catch {
    // Private mode can refuse sessionStorage.
  }
}

export function clearSiweSession(storage?: Storage | null): void {
  const store = storage ?? (typeof sessionStorage === 'undefined' ? null : sessionStorage);
  if (!store) return;
  try {
    store.removeItem(SIWE_STORE);
  } catch {
    // Ignore.
  }
}

export function siweSessionHostOk(session: SiweSession, host: string): boolean {
  const fields = parseSiweMessage(session.message);
  if (!fields) return false;
  if (fields.address.toLowerCase() !== session.address.toLowerCase()) return false;
  return siweDomainAllowed(fields.domain, host);
}

export async function restoreSiweSession(
  host: string,
  storage?: Storage | null,
): Promise<SiweSession | null> {
  const session = loadSiweSession(storage);
  if (!session) return null;
  if (!siweSessionHostOk(session, host)) {
    clearSiweSession(storage);
    return null;
  }
  const checked = await verifySiwe(session.message, session.signature);
  if (!checked.ok || checked.address.toLowerCase() !== session.address.toLowerCase()) {
    clearSiweSession(storage);
    return null;
  }
  return session;
}
