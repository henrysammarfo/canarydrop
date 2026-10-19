import { NextRequest } from 'next/server';

export const CSRF = 'a'.repeat(32);
const ORIGIN = 'http://localhost:3000';

export function postJson(
  url: string,
  body: unknown,
  extra: Record<string, string> = {},
): NextRequest {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    origin: ORIGIN,
    cookie: `cd_csrf=${CSRF}`,
    'x-csrf-token': CSRF,
    'sec-fetch-site': 'same-origin',
    ...extra,
  };
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers,
  });
}

export function postRaw(
  url: string,
  init: { headers?: Record<string, string>; body?: string },
): NextRequest {
  const headers = init.headers ?? {};
  if (init.body === undefined) {
    return new NextRequest(url, { method: 'POST', headers });
  }
  return new NextRequest(url, { method: 'POST', headers, body: init.body });
}

export function getJson(url: string, extra: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, {
    method: 'GET',
    headers: {
      origin: ORIGIN,
      ...extra,
    },
  });
}

export const ZERO_KEY = `0x${'0'.repeat(64)}`;
export const HEX_KEY = `0x${'a'.repeat(64)}`;
