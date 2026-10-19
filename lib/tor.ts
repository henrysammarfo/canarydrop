export const TOR_BANNER =
  'This page can see your network address. For more privacy, open it in Tor Browser.';

export type TorSignals = {
  hostname?: string | null;
  userAgent?: string | null;
};

/** Onion host is the only strong signal. User agent text is a weak extra hint. */
export function looksLikeTorBrowser(input: TorSignals): boolean {
  const host = (input.hostname ?? '').trim().toLowerCase();
  if (host.endsWith('.onion')) return true;
  const ua = input.userAgent ?? '';
  return /Tor Browser/i.test(ua);
}

export function shouldShowTorBanner(input: TorSignals): boolean {
  return !looksLikeTorBrowser(input);
}

export function readBrowserTorSignals(): TorSignals {
  if (typeof window === 'undefined') return {};
  return {
    hostname: window.location.hostname,
    userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
  };
}
