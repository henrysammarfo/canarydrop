import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { ToastProvider } from '@/components/Toast';
import { buildStaticCsp } from '@/lib/csp';

export const metadata: Metadata = {
  title: 'CanaryDrop · Tips that cannot be seized',
  description: 'Anonymous, encrypted tips for small newsrooms. Built on Arkiv (Tiramisu testnet).',
  metadataBase: new URL('https://canarydrop.vercel.app'),
  referrer: 'no-referrer',
  icons: [{ rel: 'icon', url: '/icon.svg' }],
  openGraph: {
    title: 'CanaryDrop',
    description: 'Anonymous, encrypted tips for small newsrooms.',
    images: ['/og.svg'],
  },
};

function cspNonce(): string | undefined {
  if (process.env.STATIC_EXPORT === '1' || process.env.NEXT_PUBLIC_STATIC === '1') return undefined;
  try {
    return headers().get('x-nonce') ?? undefined;
  } catch {
    return undefined;
  }
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const nonce = cspNonce();
  const staticExport = process.env.STATIC_EXPORT === '1' || process.env.NEXT_PUBLIC_STATIC === '1';
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      {staticExport ? (
        <head>
          <meta httpEquiv="Content-Security-Policy" content={buildStaticCsp()} />
          <meta name="referrer" content="no-referrer" />
        </head>
      ) : null}
      <body data-nonce={nonce}>
        <ToastProvider>
          <a className="skip-link" href="#main">
            Skip to content
          </a>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
