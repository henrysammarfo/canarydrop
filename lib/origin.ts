import { PRODUCTION_HOST, STATIC_MIRROR_HOST } from './constants';

const PREVIEW_HOST = /^[a-z0-9-]+-teamtitanlink\.vercel\.app$/;

export function parseOrigin(originHeader: string | null | undefined): URL | null {
  if (!originHeader) return null;
  const trimmed = originHeader.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

export function isAllowedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1') return true;
  if (host === PRODUCTION_HOST) return true;
  if (host === STATIC_MIRROR_HOST) return false;
  if (host.endsWith('.vercel.app') && PREVIEW_HOST.test(host)) return true;
  return false;
}

/** Exact hostname allow list. Rejects missing Origin and the old includes() bypass. Writes use this. Reads may also allow same-origin fetch metadata. */
export function originAllowed(originHeader: string | null | undefined): boolean {
  const url = parseOrigin(originHeader);
  if (!url) return false;
  return isAllowedHostname(url.hostname);
}

/** Used only in tests to show why the old check was wrong. */
export function originIncludesHost(originHeader: string, host: string): boolean {
  return originHeader.includes(host);
}
