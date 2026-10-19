import Link from 'next/link';
import { DEFAULT_DESK, DEFAULT_IMPOSTOR, DEFAULT_RELAY } from '@/lib/constants';
import { TOR_BANNER } from '@/lib/tor';

export default function ThreatPage() {
  return (
    <section className="section">
      <div className="wrap" style={{ maxWidth: 860 }}>
        <p className="kicker">Limits</p>
        <h1 className="h2">Threat model and limits</h1>
        <p className="lead" style={{ marginTop: 10 }}>
          This is a testnet demo. Residual risk remains. Nothing here is unhackable.
        </p>

        <div className="card" style={{ marginTop: 22 }}>
          <strong>What Arkiv hides</strong>
          <p className="muted" style={{ marginTop: 8 }}>
            Plaintext tips never go on chain. Private keys stay in the browser or in server env, never in git. Desk reads are pinned to the newsroom wallet, so a copycat name does not match.
          </p>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <strong>What Arkiv does not hide</strong>
          <ul className="threat-list">
            <li>The public RPC and our sponsor can see your network address. Use Tor Browser if that matters.</li>
            <li>Ciphertext size, chosen lifetime, and public labels are visible.</li>
            <li>A sealed tip still has a creator address. A throwaway key is one use. It is not a hide for your IP.</li>
            <li>Platform logs on the hosted mirror may keep IPs. The static build has no write API of its own.</li>
          </ul>
          <p className="muted" style={{ marginTop: 12 }}>{TOR_BANNER}</p>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <strong>Metadata risks</strong>
          <p className="muted" style={{ marginTop: 8 }}>
            Sending at an unusual hour, writing a unique length, or reusing a receipt on a watched device can still link a source. Pad to 2 KiB buckets reduces length leaks. It does not remove them.
          </p>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <strong>Dead drop on silence</strong>
          <p className="muted" style={{ marginTop: 8 }}>
            The newsroom can pre-seal a statement to chosen recipients. Recipients can open that packet as soon as they have it. The hold going quiet is a public signal. It is not a lock that waits for a clock.
          </p>
          <div className="ctaRow" style={{ justifyContent: 'flex-start', marginTop: 12 }}>
            <Link className="btn" href="/desk/drop">
              Demo hold
            </Link>
          </div>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <strong>Current testnet wallets</strong>
          <pre className="query-box">{`Relay   ${DEFAULT_RELAY}
Desk    ${DEFAULT_DESK}
Fake    ${DEFAULT_IMPOSTOR}`}</pre>
        </div>

        <div className="ctaRow" style={{ justifyContent: 'flex-start' }}>
          <Link className="btn" href="/how">
            How we use Arkiv
          </Link>
          <Link className="btn" href="/docs">
            Docs
          </Link>
        </div>
      </div>
    </section>
  );
}
