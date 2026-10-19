'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_DESK } from '@/lib/constants';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import HowStatic from '@/components/HowStatic';
import evidence from '@/arkiv/evidence.json';
import { txUrl } from '@/lib/chain';

export default function HowLive() {
  const [head, setHead] = useState('...');
  const [chainEntities, setChainEntities] = useState('...');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { chainEntityCount, pub } = await import('@/lib/arkiv');
      try {
        const timing = await pub().getBlockTiming();
        if (!cancelled) setHead(timing.currentBlock.toString());
      } catch {
        if (!cancelled) setHead('n/a');
      }
      try {
        const count = await chainEntityCount();
        if (!cancelled) setChainEntities(String(count));
      } catch {
        if (!cancelled) setChainEntities('n/a');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
      <p className="muted" role="status" style={{ marginBottom: 18 }}>
        {`Latest block ${head}. Live entities on the whole chain ${chainEntities}.`}
      </p>
      <div className="card" style={{ marginTop: 22 }}>
        <h2 className="proof-title">Seed writes that created the first live entities</h2>
        <p className="muted" style={{ marginTop: 8 }}>
          These transactions are on Tiramisu. Open them on the explorer, then refresh this page on the live app for the claim list.
        </p>
        <div className="ctaRow" style={{ marginTop: 12 }}>
          {evidence.txs.map((hash, i) => (
            <Button key={hash} href={txUrl(hash)} external>
              {`Seed write ${i + 1}`}
            </Button>
          ))}
        </div>
      </div>
      <HowStatic />
      <div className="card" style={{ marginTop: 16 }}>
        <h2 className="proof-title">What stays off Arkiv</h2>
        <p className="muted" style={{ marginTop: 8 }}>
          Plaintext, private keys, IP addresses, and identities. Arkiv holds ciphertext, public labels, expiry, owner, and creator. That split is the product.
        </p>
      </div>
    </>
  );
}
