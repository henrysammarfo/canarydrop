import { CSRF_COOKIE, CSRF_HEADER } from './constants';

export function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const parts = document.cookie.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(`${name}=`)) continue;
    return decodeURIComponent(trimmed.slice(name.length + 1));
  }
  return null;
}

export function csrfFromDocument(): string {
  return readCookie(CSRF_COOKIE) ?? '';
}

export async function appFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = csrfFromDocument();
  if (token) headers.set(CSRF_HEADER, token);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  return fetch(input, { ...init, headers, credentials: 'same-origin' });
}
