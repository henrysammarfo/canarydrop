import Link from 'next/link';
import { DEFAULT_DESK } from '@/lib/constants';
import { asAddress } from '@/lib/hex';

export default function VerifyPage() {
  const desk = asAddress(process.env.NEXT_PUBLIC_DESK_ADDRESS || '', DEFAULT_DESK);
  return (
    <section className="section">
      <div className="wrap" style={{ maxWidth: 820 }}>
        <p className="kicker">For judges</p>
        <h1 className="h2">Verify in 60 seconds</h1>
        <p className="lead" style={{ marginTop: 10 }}>
          You do not need a wallet and you do not need keys. Follow these steps on the live site.
        </p>

        <ol className="verify-steps">
          <li>
            <strong>See the canary.</strong>
            <p className="muted">Open the public canary page. It should say ALIVE if the demo desk has been renewed.</p>
            <Link className="btn primary" href={`/canary/${desk}`}>
              Open canary <span className="arrow" aria-hidden="true" />
            </Link>
          </li>
          <li>
            <strong>Send a synthetic tip.</strong>
            <p className="muted">Use the submit page. Write a fake sentence. You do not need an account. We pay the fee.</p>
            <Link className="btn primary" href="/submit">
              Submit a tip <span className="arrow" aria-hidden="true" />
            </Link>
          </li>
          <li>
            <strong>Find it on the explorer.</strong>
            <p className="muted">The explorer reads Arkiv in your browser. Look for a tip row. Sealed tips show the burn owner.</p>
            <Link className="btn primary" href="/explorer">
              Open explorer <span className="arrow" aria-hidden="true" />
            </Link>
          </li>
          <li>
            <strong>Open the desk in a fresh browser.</strong>
            <p className="muted">Turn on Demo mode. This site loads a shared testnet desk key so you can read tips without the original laptop. You should not see a request blocked or tips that this key cannot open.</p>
            <Link className="btn primary" href="/desk">
              Open the desk <span className="arrow" aria-hidden="true" />
            </Link>
          </li>
          <li>
            <strong>See how each Arkiv feature is used.</strong>
            <p className="muted">The How page runs live queries and links every claim to Tiramisu explorer.</p>
            <Link className="btn primary" href="/how">
              How we use Arkiv <span className="arrow" aria-hidden="true" />
            </Link>
          </li>
        </ol>

        <div className="card" style={{ marginTop: 18 }}>
          <strong>Optional local readback</strong>
          <pre className="muted" style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{`npm i
NEXT_PUBLIC_DESK_ADDRESS=${desk} \\
NEXT_PUBLIC_RELAY_ADDRESS=0xa6Aa6a1409eb54028550466169A29EAfd8f7a442 \\
npm run verify`}</pre>
        </div>
      </div>
    </section>
  );
}
