import Link from 'next/link';
import { gatherArkivProofs } from '@/lib/proofs';
import { DEFAULT_DESK } from '@/lib/constants';
import { uiError } from '@/lib/ui-error';

export const dynamic = 'force-dynamic';

export default async function HowPage() {
  let proofs: Awaited<ReturnType<typeof gatherArkivProofs>> | null = null;
  let loadError: string | null = null;
  try {
    proofs = await gatherArkivProofs();
  } catch (err) {
    loadError = uiError(err);
  }

  return (
    <section className="section">
      <div className="wrap" style={{ maxWidth: 920 }}>
        <p className="kicker">For judges</p>
        <h1 className="h2">How CanaryDrop uses Arkiv</h1>
        <p className="lead" style={{ marginTop: 10 }}>
          Each claim below is a live read from Tiramisu in this request. Open the explorer links. This is not a screenshot of an old run.
        </p>
        <p className="muted" style={{ marginTop: 10 }} role="status">
          {proofs
            ? `Latest block ${proofs.head}. Live entities on the whole chain ${proofs.chainEntities}.`
            : loadError
              ? loadError
              : 'Loading live proofs…'}
        </p>

        <div className="ctaRow" style={{ justifyContent: 'flex-start', marginTop: 16 }}>
          <Link className="btn primary" href="/verify">
            Sixty second path <span className="arrow" aria-hidden="true" />
          </Link>
          <Link className="btn" href={`/canary/${DEFAULT_DESK}`}>
            Public canary <span className="arrow" aria-hidden="true" />
          </Link>
          <Link className="btn" href="/explorer">
            Live explorer <span className="arrow" aria-hidden="true" />
          </Link>
        </div>

        {proofs && (
          <div className="proof-list" style={{ marginTop: 22 }}>
            {proofs.claims.map((claim) => (
              <article id={claim.id} key={claim.id} className="card proof-card">
                <div className="proof-head">
                  <h2 className="proof-title">{claim.title}</h2>
                  <span className={`pill ${claim.ok ? 'pill-ok' : 'pill-wait'}`}>{claim.ok ? 'Live' : 'Check'}</span>
                </div>
                <p className="muted" style={{ marginTop: 8 }}>{claim.why}</p>
                <p style={{ marginTop: 10 }}>{claim.detail}</p>
                <pre className="query-box" tabIndex={0}>{claim.query}</pre>
                {claim.links.length > 0 && (
                  <div className="ctaRow" style={{ justifyContent: 'flex-start', marginTop: 12 }}>
                    {claim.links.map((link) => (
                      <a
                        key={link.href + link.label}
                        className="btn"
                        href={link.href}
                        target={link.href.startsWith('/') ? undefined : '_blank'}
                        rel={link.href.startsWith('/') ? undefined : 'noreferrer'}
                      >
                        {link.label} <span className="arrow" aria-hidden="true" />
                      </a>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}

        <div className="card" style={{ marginTop: 22 }}>
          <h2 className="proof-title">Seed writes that created the first live entities</h2>
          <p className="muted" style={{ marginTop: 8 }}>
            These transactions are on Tiramisu. The claims above re query the entities those writes left behind.
          </p>
          <div className="ctaRow" style={{ justifyContent: 'flex-start', marginTop: 12 }}>
            {(proofs?.seedTxs ?? []).map((link) => (
              <a key={link.href} className="btn" href={link.href} target="_blank" rel="noreferrer">
                {link.label} <span className="arrow" aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <h2 className="proof-title">What stays off Arkiv</h2>
          <p className="muted" style={{ marginTop: 8 }}>
            Plaintext, private keys, IP addresses, and identities. Arkiv holds ciphertext, public labels, expiry, owner, and creator. That split is the product.
          </p>
        </div>
      </div>
    </section>
  );
}
