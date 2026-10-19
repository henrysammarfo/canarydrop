/* Landing page: hero (video scoped here), marquee, statement, steps, stats, bento, compare, FAQ, CTA */
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
      <section id="hero" className="section">
        <video className="art" autoPlay muted loop playsInline preload="auto" aria-hidden="true" poster={POSTER} src={VIDEO} />
        <div className="veil" />
        <div className="wrap hero-head" style={{ textAlign: 'center', width: '100%' }}>
          <div className="kicker">
            PRIVATE · SEALED · WALLET OWNED
          </div>
          <h1 className="h1" style={{ marginTop: 12, textTransform: 'uppercase', fontWeight: 650, letterSpacing: '-0.03em' }}>
            TIPS THAT CANNOT BE SEIZED.
          </h1>
          <p className="lead">
            Your tip locks on your device. Only the newsroom can open it.
          </p>
          <div className="ctaRow" style={{ marginTop: 18, justifyContent: 'center' }}>
            <Link className="btn primary pill lg" href="/submit">
              Send a tip <span className="arrow" aria-hidden="true" />
            </Link>
            <Link className="btn pill lg" href="/desk">
              Open the desk <span className="arrow" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section aria-hidden="true" className="home-marquee">
        <div className="home-marquee-track">
          <span>PRIVATE</span>
          <span>SEALED</span>
          <span>SELF EXPIRING</span>
          <span>WALLET OWNED</span>
          <span>NO ACCOUNT NEEDED</span>
          <span>ON ARKIV</span>
          <span>PRIVATE</span>
          <span>SEALED</span>
          <span>SELF EXPIRING</span>
          <span>WALLET OWNED</span>
          <span>NO ACCOUNT NEEDED</span>
          <span>ON ARKIV</span>
        </div>
      </section>

      <section className="home-band">
        <div className="wrap">
          <div className="home-band-text">
            The tip line that forgets, and the canary that cannot lie.
          </div>
        </div>
      </section>

      <section id="how" className="section">
        <div className="wrap">
          <div className="home-steps">
            <div className="cell">
              <div className="num">01</div>
              <div className="title">WRITE</div>
              <p>Your device prepares your tip. No account is needed.</p>
            </div>
            <div className="cell">
              <div className="num">02</div>
              <div className="title">SEAL</div>
              <p>Your device locks it. A sponsor sends it to Arkiv for you.</p>
            </div>
            <div className="cell">
              <div className="num">03</div>
              <div className="title">READ</div>
              <p>The newsroom sees new tips appear and opens them locally.</p>
            </div>
            <div className="cell">
              <div className="num">04</div>
              <div className="title">EXPIRE</div>
              <p>Old tips expire by themselves. Nobody can change them.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="home-live">
            <span className="dot live" aria-hidden="true" />
            <span className="muted">Live</span>
          </div>
        </div>
        <NetworkStrip />
      </section>

      <section className="section">
        <div className="wrap">
          <div className="home-bento">
            <a className="card" href="/how#batch">
              <div className="mono">executeBatch</div>
              <div>Create desk and canary in one transaction.</div>
            </a>
            <a className="card" href="/how#ownedBy">
              <div className="mono">ownedBy the burn address</div>
              <div>Tips are handed to a burn address so nobody can change them.</div>
            </a>
            <a className="card" href="/how#expiry">
              <div className="mono">Entity Expiration</div>
              <div>Different lifetimes per type: canary hours, desk days.</div>
            </a>
            <a className="card" href="/how#atBlock">
              <div className="mono">atBlock</div>
              <div>Ask whether the canary was alive at a pinned block.</div>
            </a>
            <a className="card" href="/how#createdBy">
              <div className="mono">createdBy</div>
              <div>Read only what the real desk created. Impostors are ignored.</div>
            </a>
            <a className="card" href="/how#watch">
              <div className="mono">watchEntityEvents</div>
              <div>Live inbox over WebSocket. No refresh loop.</div>
            </a>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="home-compare card">
            <div className="head">
              <div />
              <div>CanaryDrop</div>
              <div>Email tip line</div>
              <div>Self hosted server</div>
            </div>
            <div className="row">
              <div>Needs an account</div>
              <div>No</div>
              <div>Yes</div>
              <div>Maybe</div>
            </div>
            <div className="row">
              <div>Plaintext database to seize</div>
              <div>No</div>
              <div>Yes</div>
              <div>Yes</div>
            </div>
            <div className="row">
              <div>Old tips kept forever</div>
              <div>No</div>
              <div>Yes</div>
              <div>By default</div>
            </div>
            <div className="row">
              <div>Canary can be faked</div>
              <div>No</div>
              <div>Yes</div>
              <div>Yes</div>
            </div>
            <div className="row">
              <div>Works without a wallet</div>
              <div>Yes</div>
              <div>Yes</div>
              <div>Yes</div>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="home-faq">
            <details className="card" open>
              <summary>Do sources need a wallet?</summary>
              <p>No. A sponsor posts the tip for them.</p>
            </details>
            <details className="card">
              <summary>What data goes on Arkiv?</summary>
              <p>Only locked text and small labels. No personal data.</p>
            </details>
            <details className="card">
              <summary>How do judges reproduce this?</summary>
              <p>Open the Verify page. You can check the canary, send a synthetic tip, and read the explorer in about one minute.</p>
            </details>
            <details className="card">
              <summary>What happens when the sponsor is down?</summary>
              <p>Reading still works. Sending new tips needs the sponsor.</p>
            </details>
            <details className="card">
              <summary>What stays off Arkiv?</summary>
              <p>Plaintext, private keys, IP addresses and identities.</p>
            </details>
            <details className="card">
              <summary>What is Entity Expiration?</summary>
              <p>Each Arkiv entity has a lifetime. The desk renews its canary to show it is alive.</p>
            </details>
          </div>
        </div>
      </section>

      <section id="home-cta" className="home-cta">
        <div className="wrap">
          <div className="home-cta-inner">
            <h2 className="copy">Ready to try it?</h2>
            <div className="ctaRow" style={{ marginTop: 0 }}>
              <Link className="btn primary" href="/submit">Send a tip <span className="arrow" aria-hidden="true" /></Link>
              <Link className="btn" href="/desk">Open the desk <span className="arrow" aria-hidden="true" /></Link>
            </div>
            <div className="links">
              <a href="https://github.com/henrysammarfo/canarydrop" target="_blank" rel="noreferrer">GitHub</a>
              <a href="/verify">Verify in 60 seconds</a>
              <a href="/how">How we use Arkiv</a>
              <a href="/docs">Docs</a>
              <a href="https://tiramisu.explorer.arkiv.network" target="_blank" rel="noreferrer">Explorer</a>
              <a href="/LICENSE" target="_blank" rel="noreferrer">MIT</a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
