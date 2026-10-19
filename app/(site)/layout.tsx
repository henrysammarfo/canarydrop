import type { ReactNode } from 'react';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="site">
      <Nav />
      <main id="main">{children}</main>
      <Footer />
    </div>
  );
}
