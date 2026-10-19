'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { Hex } from 'viem';
import CanaryAutoVerify from '@/components/CanaryAutoVerify';
import CopyField from '@/components/ui/CopyField';
import DeskListingBadge from '@/components/DeskListingBadge';
import StaleNote from '@/components/ui/StaleNote';
import { addressUrl, entityUrl, TIRAMISU_EXPLORER } from '@/lib/chain';
import { DEFAULT_DESK } from '@/lib/constants';
import { parseDeskQuery, publicDeskHref } from '@/lib/desk-href';
import { fetchDeskLive } from '@/lib/live-client';

export default function CanaryQueryPage() {
  return (
    <Suspense fallback={<section className="section"><div className="wrap"><p className="lead">Loading the canary…</p></div></section>}>
      <CanaryQueryForm />
    </Suspense>
  );
}

function CanaryQueryForm() {
  const params = useSearchParams();
  const creator = parseDeskQuery(params.get('desk'));
  const [name, setName] = useState('CanaryDrop desk');
  const [alive, setAlive] = useState<boolean | null>(null);
  const [deskKey, setDeskKey] = useState<Hex | null>(null);
  const [canaryKey, setCanaryKey] = useState<Hex | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [domain, setDomain] = useState<string | null>(null);
  const [statement, setStatement] = useState<string | null>(null);
  const [issuedAt, setIssuedAt] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchDeskLive(creator).then((live) => {
      if (cancelled) return;
      setName(live.name);
      setAlive(live.deskKey ? live.alive : null);
      setDeskKey(live.deskKey);
      setCanaryKey(live.canaryKey);
      setNote(live.note);
      setDomain(live.domain);
      setStatement(live.canaryStatement);
      setIssuedAt(live.canaryIssuedAt);
      setSignature(live.canarySig);
    });
    return () => {
      cancelled = true;
    };
  }, [creator]);

  const statusWord = alive === null ? 'Not available' : alive ? 'ALIVE' : 'GONE';
  const statusClass = alive === null ? '' : alive ? 'status-alive' : 'status-gone';

  return (
    <section className="section" style={{ paddingBottom: 48 }}>
      <div className="wrap" style={{ maxWidth: 860 }}>
        <p className="kicker">Public warrant canary</p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <h1 className="h2" style={{ margin: 0 }}>Canary status</h1>
          <DeskListingBadge creator={creator} domain={domain} />
        </div>
        <p className="lead" style={{ marginTop: 10 }}>
          If this page says GONE, the newsroom has not renewed its canary. That is the signal.
        </p>
        <StaleNote text={note} />
        <div className="card" style={{ marginTop: 22, textAlign: 'center', padding: '36px 20px' }}>
          <div className={`status-word ${statusClass}`}>{statusWord}</div>
          <p className="lead" style={{ marginTop: 14 }}>{name}</p>
        </div>
        <div className="card" style={{ marginTop: 16 }}>
          <CopyField label="Creator" value={creator} />
          {deskKey && (
            <div style={{ marginTop: 10 }}>
              <CopyField label="Desk" value={deskKey} />
            </div>
          )}
          {canaryKey && (
            <div style={{ marginTop: 10 }}>
              <CopyField label="Canary" value={canaryKey} />
            </div>
          )}
          <div className="ctaRow" style={{ justifyContent: 'flex-start', marginTop: 12 }}>
            <a className="btn" href={addressUrl(creator)} target="_blank" rel="noreferrer">
              View creator <span className="arrow" aria-hidden="true" />
            </a>
            {canaryKey && (
              <a className="btn" href={entityUrl(canaryKey)} target="_blank" rel="noreferrer">
                View canary entity <span className="arrow" aria-hidden="true" />
              </a>
            )}
            <a className="btn" href={TIRAMISU_EXPLORER} target="_blank" rel="noreferrer">
              Open explorer <span className="arrow" aria-hidden="true" />
            </a>
          </div>
        </div>
        <CanaryAutoVerify desk={creator} statement={statement} issuedAt={issuedAt} signature={signature} />
        <div className="ctaRow" style={{ justifyContent: 'flex-start' }}>
          <Link className="btn" href={publicDeskHref(creator)}>
            Send this desk a tip <span className="arrow" aria-hidden="true" />
          </Link>
          <Link className="btn" href={`/canary/${DEFAULT_DESK}`}>
            Seeded demo canary
          </Link>
        </div>
      </div>
    </section>
  );
}
