import { NextRequest, NextResponse } from 'next/server';
import { CSRF_COOKIE, CSRF_HEADER } from './constants';
import { tokensMatch } from './csrf';
import { isAllowedHostname, originAllowed } from './origin';
import { allowIp, type WriteKind } from './rate-limit';

export type { WriteKind };

export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const cf = req.headers.get('cf-connecting-ip');
  if (cf) return cf;
  if (req.ip) return req.ip;
  return 'missing';
}

function json(code: string, message: string, status: number): NextResponse {
  return NextResponse.json({ error: code, message }, { status });
}

export async function protectWrite(req: NextRequest, kind: WriteKind): Promise<NextResponse | null> {
  if (!originAllowed(req.headers.get('origin'))) {
    return json('bad_origin', 'Please use the site to send this request.', 403);
  }
  const site = req.headers.get('sec-fetch-site');
  if (site === 'cross-site' || site === 'same-site') {
    return json('bad_origin', 'Please use the site to send this request.', 403);
  }
  const cookie = req.cookies.get(CSRF_COOKIE)?.value;
  const header = req.headers.get(CSRF_HEADER);
  if (!tokensMatch(cookie, header)) {
    return json('bad_csrf', 'Please reload the page and try again.', 403);
  }
  const ok = await allowIp(kind, clientIp(req));
  if (!ok) {
    return json('rate_limited', 'Please wait a minute and try again.', 429);
  }
  return null;
}

/**
 * Writes still require Origin. Same-origin GET from a real browser omits Origin, so a read is
 * allowed when Sec-Fetch-Site is same-origin and the request host is on our allow list.
 * Curl and Playwright's APIRequestContext send neither, so they stay 403.
 */
export function readFromSiteAllowed(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (originAllowed(origin)) return true;
  if (origin && origin.trim() !== '') return false;
  const site = (req.headers.get('sec-fetch-site') ?? '').toLowerCase();
  if (site !== 'same-origin') return false;
  return isAllowedHostname(req.nextUrl.hostname);
}

export async function protectRead(req: NextRequest, kind: WriteKind): Promise<NextResponse | null> {
  if (!readFromSiteAllowed(req)) {
    return json('bad_origin', 'Please use the site to send this request.', 403);
  }
  const bucket = kind === 'relay' ? 'relay-read' : 'desk-read';
  const ok = await allowIp(bucket, clientIp(req));
  if (!ok) {
    return json('rate_limited', 'Please wait a minute and try again.', 429);
  }
  return null;
}

export function isDryRun(req: NextRequest): boolean {
  const url = new URL(req.url);
  return url.searchParams.get('dryRun') === '1' || req.headers.get('x-dry-run') === '1';
}

export async function readJson(req: NextRequest): Promise<unknown | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
