import { DEFAULT_DESK } from '@/lib/constants';
import { asAddress } from '@/lib/hex';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';

export default function VerifyPage() {
  const desk = asAddress(process.env.NEXT_PUBLIC_DESK_ADDRESS || '', DEFAULT_DESK);
  return (
    <>
      <PageHeader
        kicker="For judges"
        title="Verify in 60 seconds"
        description="You do not need a wallet and you do not need keys. Follow these steps on the live site."
      />
      <ol className="verify-steps">
        <li>
          <span className="verify-n">1</span>
          <div>
            <strong>See the canary.</strong>
            <p className="muted">Open the public canary page. It should say Alive if the demo desk has been renewed. The public page shows that as a large status word.</p>
            <Button href={`/canary/${desk}`} variant="primary">
              Open canary
            </Button>
          </div>
        </li>
        <li>
          <span className="verify-n">2</span>
          <div>
            <strong>Send a synthetic tip.</strong>
            <p className="muted">Use the submit page. Write a fake sentence. You do not need an account. We pay the fee.</p>
            <Button href="/submit" variant="primary">
              Submit a tip
            </Button>
          </div>
        </li>
        <li>
          <span className="verify-n">3</span>
          <div>
            <strong>Find it on the explorer.</strong>
            <p className="muted">The explorer reads live Arkiv rows. Look for a tip. Sealed tips show the burn owner.</p>
            <Button href="/explorer" variant="primary">
              Open explorer
            </Button>
          </div>
        </li>
        <li>
          <span className="verify-n">4</span>
          <div>
            <strong>Open the desk in a fresh browser.</strong>
            <p className="muted">Turn on Demo mode. This site loads a shared testnet desk key so you can read tips without the original laptop. You should not see a request blocked or tips that this key cannot open.</p>
            <Button href="/desk" variant="primary">
              Open the desk
            </Button>
          </div>
        </li>
        <li>
          <span className="verify-n">5</span>
          <div>
            <strong>See how each Arkiv feature is used.</strong>
            <p className="muted">The How page runs live queries and links every claim to Tiramisu explorer.</p>
            <Button href="/how" variant="primary">
              How we use Arkiv
            </Button>
          </div>
        </li>
      </ol>
      <div className="card" style={{ marginTop: 18 }}>
        <strong>Optional local readback</strong>
        <pre className="query-box">{`npm i
NEXT_PUBLIC_DESK_ADDRESS=${desk}
NEXT_PUBLIC_RELAY_ADDRESS=0xa6Aa6a1409eb54028550466169A29EAfd8f7a442
npm run verify`}</pre>
      </div>
    </>
  );
}
