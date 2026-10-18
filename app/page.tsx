/* Landing page rebuilt in Arkiv style: hero, marquee, statement, steps, live stats, bento, comparison, FAQ, CTA */
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
      {/* HERO with video backdrop (only here) */}
      <section id="hero" className="section" style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-6)', position: 'relative' }}>
        <video className="art" autoPlay muted loop playsInline preload="auto" aria-hidden="true" poster={POSTER} src={VIDEO} />
        <div className="veil" />
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', zIndex: 1 }}>
          <div
            style={{
              width: '70%',
              maxWidth: 900,
              height: 360,
              background:
                'radial-gradient(ellipse at center, rgba(5,8,14,.78), rgba(5,8,14,0) 70%)',
            }}
          />
        </div>
        <div className="wrap hero-head" style={{ textAlign: 'center', position: 'relative', zIndex: 2 }}>
          <div className="kicker" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
            PRIVATE · SEALED · WALLET OWNED
          </div>
          <h1 className="h1" style={{ marginTop: 10, textTransform: 'uppercase', fontWeight: 800, letterSpacing: '.02em' }}>
            TIPS THAT CANNOT BE SEIZED.
          </h1>
          <p className="lead" style={{ marginTop: 12, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
            Your tip locks on your device. Only the newsroom can open it.
          </p>
          <div className="ctaRow" style={{ marginTop: 18, justifyContent: 'center' }}>
            <Link className="btn primary" href="/submit">
              Send a tip
            </Link>
            <Link className="btn" href="/desk">
              Open the desk
            </Link>
          </div>
        </div>
      </section>

      {/* KEYWORD MARQUEE */}
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

      {/* STATEMENT BAND */}
      <section className="home-band">
        <div className="wrap">
          <div className="home-band-text">
            THE TIP LINE THAT FORGETS, AND THE CANARY THAT CANNOT LIE.
          </div>
        </div>
      </section>

      {/* HOW IT WORKS ROW */}
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

      {/* LIVE STATS */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="home-live">
            <span className="dot live" aria-hidden="true" />
            <span className="muted">Live</span>
          </div>
        </div>
        <NetworkStrip />
      </section>

      {/* BENTO GRID */}
      <section className="section">
        <div className="wrap">
          <div className="home-bento">
            <a className="card" href="https://github.com/henrysammarfo/canarydrop/blob/main/lib/arkiv.ts#L20-L31" target="_blank" rel="noreferrer">
              <div className="mono">executeBatch</div>
              <div>Create desk and canary in one transaction.</div>
            </a>
            <a className="card" href="https://github.com/henrysammarfo/canarydrop/blob/main/lib/relay.ts#L1-L80" target="_blank" rel="noreferrer">
              <div className="mono">sealed to 0x…dEaD</div>
              <div>Tips are handed to a burn address so nobody can change them.</div>
            </a>
            <a className="card" href="https://github.com/henrysammarfo/canarydrop/blob/main/lib/arkiv.ts#L80-L82" target="_blank" rel="noreferrer">
              <div className="mono">Entity Expiration</div>
              <div>Different lifetimes per type: canary hours, desk days.</div>
            </a>
            <a className="card" href="https://github.com/henrysammarfo/canarydrop/blob/main/lib/arkiv.ts#L32-L36" target="_blank" rel="noreferrer">
              <div className="mono">extendEntity</div>
              <div>Renew canary and desk leases with one call.</div>
            </a>
            <a className="card" href="https://github.com/henrysammarfo/canarydrop/blob/main/lib/arkiv.ts#L40-L46" target="_blank" rel="noreferrer">
              <div className="mono">createdBy</div>
              <div>Read only what the real desk created. Impostors are ignored.</div>
            </a>
            <a className="card" href="https://github.com/henrysammarfo/canarydrop/blob/main/lib/arkiv.ts#L73-L81" target="_blank" rel="noreferrer">
              <div className="mono">watchEntityEvents</div>
              <div>Live inbox over WebSocket. No refresh loop.</div>
            </a>
          </div>
        </div>
      </section>

      {/* COMPARISON TABLE */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="home-compare card">
            <div className="head">
              <div />
              <div>CanaryDrop</div>
              <div>Email tip line</div>
              <div>Self‑hosted server</div>
            </div>
            <div className="row">
              <div>Needs an account</div>
              <div>No</div>
              <div>Yes</div>
              <div>Maybe</div>
            </div>
            <div className="row">
              <div>Server can be seized</div>
              <div>No server</div>
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

      {/* FAQ */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="home-faq">
            <details className="card">
              <summary>Do sources need a wallet?</summary>
              No. A sponsor posts the tip for them.
            </details>
            <details className="card">
              <summary>What data goes on Arkiv?</summary>
              Only locked text and small labels. No personal data.
            </details>
            <details className="card">
              <summary>How do judges reproduce this?</summary>
              Open the Explorer from the footer and run the queries listed in our README.
            </details>
            <details className="card">
              <summary>What happens when the sponsor is down?</summary>
              Reading still works. Sending new tips needs the sponsor.
            </details>
            <details className="card">
              <summary>What stays off Arkiv?</summary>
              Plaintext, private keys, IP addresses and identities.
            </details>
            <details className="card">
              <summary>What is Entity Expiration?</summary>
              Each Arkiv entity has a lifetime. The desk renews its canary to show it is alive.
            </details>
          </div>
        </div>
      </section>

      {/* CTA FOOTER */}
      <section className="home-cta">
        <div className="wrap">
          <div className="home-cta-inner">
            <div className="copy">Ready to try it?</div>
            <div className="ctaRow" style={{ marginTop: 0 }}>
              <Link className="btn primary" href="/submit">Send a tip</Link>
              <Link className="btn" href="/desk">Open the desk</Link>
            </div>
            <div className="links">
              <a href="https://github.com/henrysammarfo/canarydrop" target="_blank" rel="noreferrer">GitHub</a>
              <a href="/arkiv/schema.md" target="_blank" rel="noreferrer">schema.md</a>
              <a href="/arkiv/friction.md" target="_blank" rel="noreferrer">friction.md</a>
              <a href="https://hub.arkiv.network/tiramisu" target="_blank" rel="noreferrer">Explorer</a>
              <a href="/LICENSE" target="_blank" rel="noreferrer">MIT</a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

