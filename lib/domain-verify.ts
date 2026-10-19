import type { Hex } from 'viem';
import { ADDRESS_RE, DEFAULT_DESK, PROJECT } from './constants';
import { DOH_CLOUDFLARE } from './csp';
import { isAddress } from './hex';

export const WELL_KNOWN_PATH = '/.well-known/canarydrop.json';
export const DNS_TXT_PREFIX = 'canarydrop-desk=';
export const DOH_QUERY = `${DOH_CLOUDFLARE}/dns-query`;

export type DeskRecord = {
  v: 1;
  desk: Hex;
  name?: string;
  project?: string;
};

export function parseDeskRecord(value: unknown): DeskRecord | null {
  if (typeof value !== 'object' || value === null) return null;
  const rec = value as Record<string, unknown>;
  if (rec.v !== 1) return null;
  if (typeof rec.desk !== 'string' || !isAddress(rec.desk)) return null;
  const out: DeskRecord = { v: 1, desk: rec.desk };
  if (typeof rec.name === 'string' && rec.name.trim()) out.name = rec.name.trim().slice(0, 80);
  if (typeof rec.project === 'string' && rec.project.trim()) out.project = rec.project.trim();
  return out;
}

export function dnsTxtForDesk(desk: Hex): string {
  return `${DNS_TXT_PREFIX}${desk}`;
}

export function deskFromDnsTxt(txt: string): Hex | null {
  const trimmed = txt.trim();
  const match = trimmed.match(/^canarydrop-desk=(0x[0-9a-fA-F]{40})$/);
  if (!match?.[1] || !ADDRESS_RE.test(match[1])) return null;
  return match[1] as Hex;
}

export function recordMatchesDesk(record: DeskRecord, desk: Hex): boolean {
  return record.desk.toLowerCase() === desk.toLowerCase();
}

export type DeskListing = 'listed' | 'mismatch' | 'unknown';

/** Compare the desk this site lists with the creator the visitor is looking at. */
export function fakeDeskSignal(listedDesk: Hex | null | undefined, viewedCreator: Hex): DeskListing {
  if (!listedDesk) return 'unknown';
  if (listedDesk.toLowerCase() === viewedCreator.toLowerCase()) return 'listed';
  return 'mismatch';
}

export function canonicalDemoRecord(): DeskRecord {
  return {
    v: 1,
    desk: DEFAULT_DESK,
    name: 'CanaryDrop demo desk',
    project: PROJECT,
  };
}

export async function fetchDeskRecord(url: string): Promise<DeskRecord | null> {
  try {
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    return parseDeskRecord(json);
  } catch {
    return null;
  }
}

export function wellKnownUrl(origin = ''): string {
  const base = origin.replace(/\/$/, '');
  return `${base}${WELL_KNOWN_PATH}`;
}

export function declaredDomainOrigin(domain: string): string {
  const host = domain.trim().toLowerCase().replace(/\/$/, '');
  return `https://${host}`;
}

export function declaredWellKnownUrl(domain: string): string {
  return wellKnownUrl(declaredDomainOrigin(domain));
}

export type DohAnswer = { type?: number; data?: string };

export function parseDohTxtAnswers(answers: DohAnswer[] | undefined): string[] {
  if (!answers?.length) return [];
  const out: string[] = [];
  for (const answer of answers) {
    if (answer.type !== 16 || typeof answer.data !== 'string') continue;
    const cleaned = answer.data.replace(/^"+|"+$/g, '').trim();
    if (cleaned) out.push(cleaned);
  }
  return out;
}

export function deskFromTxtRecords(records: string[]): Hex | null {
  for (const record of records) {
    const desk = deskFromDnsTxt(record);
    if (desk) return desk;
  }
  return null;
}

export async function fetchDnsTxt(domain: string): Promise<string[]> {
  const host = domain.trim().toLowerCase();
  if (!/^[a-z0-9.-]{1,80}$/.test(host)) return [];
  try {
    const url = `${DOH_QUERY}?name=${encodeURIComponent(host)}&type=TXT`;
    const res = await fetch(url, {
      credentials: 'omit',
      headers: { accept: 'application/dns-json' },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { Answer?: DohAnswer[] };
    return parseDohTxtAnswers(json.Answer);
  } catch {
    return [];
  }
}

export type DomainLookup = {
  record: DeskRecord | null;
  txtDesk: Hex | null;
  listedDesk: Hex | null;
};

export async function lookupDeclaredDomain(domain: string): Promise<DomainLookup> {
  const [record, txts] = await Promise.all([
    fetchDeskRecord(declaredWellKnownUrl(domain)),
    fetchDnsTxt(domain),
  ]);
  const txtDesk = deskFromTxtRecords(txts);
  return {
    record,
    txtDesk,
    listedDesk: record?.desk ?? txtDesk,
  };
}

/** Mismatch only when a listing exists and the viewed desk is not that listing. */
export function listingFromLookup(listedDesk: Hex | null | undefined, viewedCreator: Hex): DeskListing {
  return fakeDeskSignal(listedDesk ?? null, viewedCreator);
}
