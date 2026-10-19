import './globals.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Sora } from 'next/font/google';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import { ToastProvider } from '@/components/Toast';

const sora = Sora({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-sora',
});

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = headers().get('x-nonce') ?? undefined;
  return (
    <html lang="en" className={sora.variable}>
      <body data-nonce={nonce}>
        <ToastProvider>
          <div className="container">
            <Nav />
            {children}
            <Footer />
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
