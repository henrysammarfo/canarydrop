import { NextRequest, NextResponse } from 'next/server';
import { CSRF_COOKIE, CSRF_HEADER } from './constants';
import { tokensMatch } from './csrf';
import { originAllowed } from './origin';
import { deskIpWindow, relayIpWindow } from './rate-limit';

export type WriteKind = 'relay' | 'desk';

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

export function protectWrite(req: NextRequest, kind: WriteKind): NextResponse | null {
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
  const window = kind === 'relay' ? relayIpWindow : deskIpWindow;
  if (!window.allow(`${kind}:${clientIp(req)}`)) {
    return json('rate_limited', 'Please wait a minute and try again.', 429);
  }
  return null;
}

export function protectRead(req: NextRequest, kind: WriteKind): NextResponse | null {
  if (!originAllowed(req.headers.get('origin'))) {
    return json('bad_origin', 'Please use the site to send this request.', 403);
  }
  const window = kind === 'relay' ? relayIpWindow : deskIpWindow;
  if (!window.allow(`${kind}-read:${clientIp(req)}`)) {
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
