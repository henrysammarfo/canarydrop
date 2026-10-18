import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="section">
      <div className="wrap" style={{ textAlign: 'center' }}>
        <p className="kicker">404</p>
        <h1 className="h2">Page not found</h1>
        <p className="lead" style={{ marginTop: 10 }}>The page you are looking for does not exist.</p>
        <div className="ctaRow" style={{ justifyContent: 'center', marginTop: 16 }}>
          <Link className="btn primary" href="/">Back to home <span className="arrow" aria-hidden="true" /></Link>
          <Link className="btn" href="/docs">Docs <span className="arrow" aria-hidden="true" /></Link>
        </div>
      </div>
    </section>
  );
}
