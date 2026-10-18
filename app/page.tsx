/* Landing page with hero, network strip, how-it-works, features, Arkiv usage and FAQ */
import Link from 'next/link';
import dynamic from 'next/dynamic';

const VIDEO =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260912_104303_0c6d60b2-9353-408e-944-585108a22fb5.mp4';
const POSTER =
  'https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/130837c4-0244-4f37-9c61-8d801d93fd29.jpg';
const NetworkStrip = dynamic(() => import('@/components/NetworkStrip'), { ssr: true });

export default function HomePage() {
  return (
    <>
      <video className="art" autoPlay muted loop playsInline preload="auto" aria-hidden="true" poster={POSTER} src={VIDEO} />
      <div className="veil" />
      <header className="section" style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-6)' }}>
        <div className="wrap" style={{ textAlign: 'center' }}>
          <div className="kicker">Anonymous tips · Sealed expiry · On‑chain canaries</div>
          <h1 className="h1" style={{ marginTop: 10 }}>Tips that can’t be seized. Canaries that can’t be faked.</h1>
          <p className="lead" style={{ marginTop: 12 }}>Encrypted in your browser. Posted via a relay. Read right from Arkiv.</p>
          <div className="ctaRow" style={{ marginTop: 18 }}>
            <Link className="btn primary hero" href="/submit"><span className="dot" /> Submit a tip</Link>
            <Link className="btn hero" href="/desk">Open the desk</Link>
          </div>
        </div>
      </header>
      <NetworkStrip />
      <section id="how" className="section">
        <div className="wrap">
          <h2 className="h2">How it works</h2>
          <div className="grid cols-3" style={{ marginTop: 'var(--space-3)' }}>
            <div className="card"><strong>1) Encrypt</strong><p className="muted">The source’s browser uses P‑256 ECDH → HKDF → AES‑GCM. Plaintext is padded to 2 KiB.</p></div>
            <div className="card"><strong>2) Relay</strong><p className="muted">A server wallet pays gas to create a <span className="kbd">tip</span> and changes ownership to <span className="kbd">0x…dEaD</span> in the same batch.</p></div>
            <div className="card"><strong>3) Read</strong><p className="muted">The desk inbox subscribes to live events over WebSocket and decrypts locally. Replies use the same ECDH secret.</p></div>
          </div>
        </div>
      </section>
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <h2 className="h2">Built on Arkiv</h2>
          <div className="grid cols-2" style={{ marginTop: 'var(--space-3)' }}>
            <div className="card">
              <strong>SDK calls we use</strong>
              <ul className="muted" style={{ marginTop: 8 }}>
                <li>predictEntityKeys → executeBatch (create + reference)</li>
                <li>executeBatch.ownershipChanges to seal tips</li>
                <li>createEntity (reply)</li>
                <li>ExpirationTime & extendEntity (canary + desk lease)</li>
                <li>select + createdBy filters; key(attr) queries</li>
                <li>watchEntityEvents over webSocket()</li>
              </ul>
            </div>
            <div className="card">
              <strong>Security model</strong>
              <ul className="muted" style={{ marginTop: 8 }}>
                <li>Client‑side encryption; relay never sees plaintext</li>
                <li>Read queries are creator‑pinned, so impersonators are ignored</li>
                <li>Tips have sealed expiry; nobody can extend or delete</li>
                <li>Canary must be renewed daily — the absence is the signal</li>
              </ul>
            </div>
          </div>
          <div className="ctaRow" style={{ marginTop: 'var(--space-4)' }}>
            <Link className="btn primary" href="/docs">Read the docs</Link>
            <a className="btn" href="https://hub.arkiv.network/tiramisu" target="_blank">Open Arkiv Explorer</a>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="wrap">
          <h2 className="h2">FAQ</h2>
          <div className="grid cols-2" style={{ marginTop: 'var(--space-3)' }}>
            <div className="card"><strong>Do sources need wallets?</strong><p className="muted">No. The relay creates entities and pays gas.</p></div>
            <div className="card"><strong>What data hits Arkiv?</strong><p className="muted">Only encrypted payloads and small attributes. No personal data.</p></div>
            <div className="card"><strong>How is censorship resistance achieved?</strong><p className="muted">All reads go straight from the browser to Arkiv RPC/WS — no read API.</p></div>
            <div className="card"><strong>What if the relay is down?</strong><p className="muted">Reading still works. Posting tips requires the relay (or another sponsor).</p></div>
          </div>
          <div className="ctaRow" style={{ marginTop: 'var(--space-4)' }}>
            <Link className="btn primary" href="/submit"><span className="dot" /> Submit a tip</Link>
            <Link className="btn" href="/desk">Open the desk</Link>
          </div>
        </div>
      </section>
    </>
  );
}

