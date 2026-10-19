import { NextRequest, NextResponse } from 'next/server';
import { CSRF_COOKIE } from '@/lib/constants';
import { buildCsp } from '@/lib/csp';
import { newCsrfToken } from '@/lib/csrf';

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');

  if (!request.cookies.get(CSRF_COOKIE)?.value) {
    response.cookies.set(CSRF_COOKIE, newCsrfToken(), {
      path: '/',
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      httpOnly: false,
    });
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|ico)$).*)'],
};
