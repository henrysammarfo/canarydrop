import { CSRF_COOKIE } from './constants';

export function newCsrfToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

export function csrfCookieHeader(token: string, secure: boolean): string {
  const parts = [`${CSRF_COOKIE}=${token}`, 'Path=/', 'SameSite=Lax'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function tokensMatch(cookie: string | null | undefined, header: string | null | undefined): boolean {
  if (!cookie || !header) return false;
  if (cookie.length < 16 || header.length < 16) return false;
  if (cookie.length !== header.length) return false;
  let diff = 0;
  for (let i = 0; i < cookie.length; i++) diff |= cookie.charCodeAt(i) ^ header.charCodeAt(i);
  return diff === 0;
}
