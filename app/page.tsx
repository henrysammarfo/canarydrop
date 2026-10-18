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
      <header className="section" style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-6)', position:'relative' }}>
        <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',pointerEvents:'none',zIndex:1}}>
          <div style={{width:'70%',maxWidth:820,height:300,background:'radial-gradient(ellipse at center, rgba(5,8,14,.6), rgba(5,8,14,0) 70%)'}}></div>
        </div>
        <div className="wrap hero-head" style={{ textAlign: 'center', position:'relative', zIndex:2 }}>
          <div className="kicker">Anonymous tips, sealed expiry, on chain</div>
          <h1 className="h1" style={{ marginTop: 10 }}>Send news safely. Keep your canary alive.</h1>
          <p className="lead" style={{ marginTop: 12 }}>Your tip is locked on your device before you send it. Only the newsroom can open it.</p>
          <div className="ctaRow" style={{ marginTop: 18, justifyContent:'center' }}>
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
            <div className="card"><strong>Step 1. Lock</strong><p className="muted">Your tip is locked on your device. Only the newsroom’s key can open it.</p></div>
            <div className="card"><strong>Step 2. Send</strong><p className="muted">A sponsor sends it to Arkiv for you. You do not need a wallet or an account.</p></div>
            <div className="card"><strong>Step 3. Read</strong><p className="muted">The newsroom sees new tips appear and opens them on its own computer.</p></div>
          </div>
        </div>
      </section>
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <h2 className="h2">Built on Arkiv</h2>
          <div className="grid cols-2" style={{ marginTop: 'var(--space-3)' }}>
            <div className="card">
              <strong>How it helps</strong>
              <ul className="muted" style={{ marginTop: 8 }}>
                <li>Tips expire automatically. Nobody can extend or delete them.</li>
                <li>Readers connect straight to Arkiv from the browser.</li>
                <li>Desks are tied to a wallet, so copycats are ignored.</li>
              </ul>
            </div>
            <div className="card">
              <strong>Security model</strong>
              <ul className="muted" style={{ marginTop: 8 }}>
                <li>Your browser locks your tip. The relay never sees the words.</li>
                <li>Reads are pinned to the real desk wallet, so impostors do not show up.</li>
                <li>Tips are created read‑only and handed to a burn address. They cannot be changed.</li>
                <li>You renew your canary each day. If it is missing, that is the signal.</li>
              </ul>
            </div>
          </div>
          <details className="card" style={{ marginTop: 'var(--space-3)' }}>
            <summary>For developers</summary>
            <ul className="muted" style={{ marginTop: 8 }}>
              <li>predictEntityKeys then executeBatch (create, reference)</li>
              <li>executeBatch.ownershipChanges to send tips to 0x…dEaD</li>
              <li>createEntity for replies</li>
              <li>ExpirationTime and extendEntity for canary and desk leases</li>
              <li>select with createdBy filters; key(attr) queries</li>
              <li>watchEntityEvents over webSocket()</li>
            </ul>
          </details>
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
            <div className="card"><strong>Do sources need wallets?</strong><p className="muted">No. A sponsor wallet posts the tip for them.</p></div>
            <div className="card"><strong>What data goes on Arkiv?</strong><p className="muted">Only locked text and a few small labels. No personal data.</p></div>
            <div className="card"><strong>How can it be read anywhere?</strong><p className="muted">The app reads straight from Arkiv in the browser. There is no read API to block.</p></div>
            <div className="card"><strong>What if the sponsor is down?</strong><p className="muted">Reading still works. Sending new tips needs the sponsor.</p></div>
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

