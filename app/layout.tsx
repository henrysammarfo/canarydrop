import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { ToastProvider } from '@/components/Toast';

export const metadata: Metadata = {
  title: 'CanaryDrop · Tips that cannot be seized',
  description: 'Anonymous, encrypted tips for small newsrooms. Built on Arkiv (Tiramisu testnet).',
  metadataBase: new URL('https://canarydrop.vercel.app'),
  icons: [{ rel: 'icon', url: '/icon.svg' }],
  openGraph: {
    title: 'CanaryDrop',
    description: 'Anonymous, encrypted tips for small newsrooms.',
    images: ['/og.svg'],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const nonce = headers().get('x-nonce') ?? undefined;
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
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
