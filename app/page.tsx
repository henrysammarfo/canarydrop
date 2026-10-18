/* Home explainer + list of desks (verified vs unverified) */
import Link from 'next/link';

const VIDEO =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260912_104303_0c6d60b2-9353-408e-944-585108a22fb5.mp4';
const POSTER =
  'https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/130837c4-0244-4f37-9c61-8d801d93fd29.jpg';

export default function HomePage() {
  return (
    <div className="container">
      <video className="art" autoPlay muted loop playsInline preload="auto" aria-hidden="true" poster={POSTER} src={VIDEO} />
      <div className="veil" />

      <header className="header">
        <span className="brand">CANARYDROP</span>
        <span className="badge">Tiramisu testnet</span>
      </header>

      <main className="hero">
        <div>
          <h1 className="title">Tips that can’t be seized. Canaries that can’t be faked.</h1>
          <p className="sub">Anonymous, encrypted tip line for small newsrooms. Built on Arkiv.</p>
          <div className="ctaRow">
            <Link className="cta" href="/d/preview">
              <span className="dot" /> Submit a tip
            </Link>
            <Link className="cta secondary" href="/desk">
              Open the desk
            </Link>
          </div>
        </div>
      </main>

      <footer className="footer">Synthetic data only. No personal data touches Arkiv.</footer>
    </div>
  );
}

