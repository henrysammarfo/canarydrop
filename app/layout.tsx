import './globals.css';
import type { Metadata } from 'next';
import { Sora } from 'next/font/google';

const sora = Sora({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-sora',
});

export const metadata: Metadata = {
  title: 'CanaryDrop — Tips that cannot be seized',
  description:
    'Anonymous, encrypted tips for small newsrooms. Built on Arkiv (Tiramisu testnet).',
  metadataBase: new URL('https://canarydrop.example.com'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sora.variable}>
      <body>{children}</body>
    </html>
  );
}

