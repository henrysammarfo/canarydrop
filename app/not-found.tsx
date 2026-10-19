import Link from 'next/link';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';

export default function NotFound() {
  return (
    <div className="site">
      <Nav />
      <main id="main">
        <section className="section">
          <div className="wrap" style={{ textAlign: 'center' }}>
            <p className="kicker">404</p>
            <h1 className="h2">Page not found</h1>
            <p className="lead" style={{ margin: '10px auto 0' }}>The page you are looking for does not exist.</p>
            <div className="ctaRow" style={{ justifyContent: 'center', marginTop: 16 }}>
              <Link className="btn primary" href="/">
                Back to home
              </Link>
              <Link className="btn" href="/docs">
                Docs
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
