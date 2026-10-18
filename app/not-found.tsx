import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="section">
      <div className="wrap" style={{ textAlign: 'center' }}>
        <h1 className="h2">Page not found</h1>
        <p className="lead">The page you’re looking for doesn’t exist.</p>
        <div style={{ marginTop: 16 }}>
          <Link className="btn primary" href="/">Back to home</Link>
        </div>
      </div>
    </section>
  );
}

