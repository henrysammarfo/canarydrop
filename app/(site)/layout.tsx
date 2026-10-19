import type { ReactNode } from 'react';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import TorBanner from '@/components/TorBanner';

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="site">
      <Nav />
      <TorBanner />
      <main id="main">{children}</main>
      <Footer />
    </div>
  );
}
