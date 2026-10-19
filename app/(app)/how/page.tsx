import { gatherArkivProofs } from '@/lib/proofs';
import { DEFAULT_DESK } from '@/lib/constants';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import CopyField from '@/components/ui/CopyField';
import StaleNote from '@/components/ui/StaleNote';

export const dynamic = 'force-dynamic';

export default async function HowPage() {
  const proofs = await gatherArkivProofs();

  return (
    <>
      <PageHeader
        kicker="For judges"
        title="How CanaryDrop uses Arkiv"
        description="Each claim below is a live read from Tiramisu in this request. Open the explorer links. This is not a screenshot of an old run."
        actions={
          <>
            <Button href="/verify" variant="primary">
              Sixty second path
            </Button>
            <Button href={`/canary/${DEFAULT_DESK}`}>Public canary</Button>
            <Button href="/explorer">Live explorer</Button>
          </>
        }
      />
      <StaleNote text={proofs.note} />
      <p className="muted" role="status" style={{ marginBottom: 18 }}>
        {`Latest block ${proofs.head}. Live entities on the whole chain ${proofs.chainEntities}.`}
      </p>

      {proofs.claims.length > 0 && (
        <div className="proof-list">
          {proofs.claims.map((claim) => (
            <article id={claim.id} key={claim.id} className="card proof-card">
              <div className="proof-head">
                <h2 className="proof-title">{claim.title}</h2>
                <Badge tone={claim.ok ? 'ok' : 'wait'}>{claim.ok ? 'Live' : 'Check'}</Badge>
              </div>
              <p className="muted" style={{ marginTop: 8 }}>{claim.why}</p>
              <p style={{ marginTop: 10 }}>{claim.detail}</p>
              {claim.facts && claim.facts.length > 0 ? (
                <div className="proof-facts">
                  {claim.facts.map((fact) => (
                    <CopyField key={`${claim.id}-${fact.label}`} label={fact.label} value={fact.value} />
                  ))}
                </div>
              ) : null}
              <pre className="query-box" tabIndex={0}>{claim.query}</pre>
              {claim.links.length > 0 && (
                <div className="ctaRow" style={{ marginTop: 12 }}>
                  {claim.links.map((link) => (
                    <Button
                      key={link.href + link.label}
                      href={link.href}
                      external={!link.href.startsWith('/')}
                    >
                      {link.label}
                    </Button>
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
          These transactions are on Tiramisu. The claims above query those entities again.
        </p>
        <div className="ctaRow" style={{ marginTop: 12 }}>
          {proofs.seedTxs.map((link) => (
            <Button key={link.href} href={link.href} external>
              {link.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 className="proof-title">What stays off Arkiv</h2>
        <p className="muted" style={{ marginTop: 8 }}>
          Plaintext, private keys, IP addresses, and identities. Arkiv holds ciphertext, public labels, expiry, owner, and creator. That split is the product.
        </p>
      </div>
    </>
  );
}
