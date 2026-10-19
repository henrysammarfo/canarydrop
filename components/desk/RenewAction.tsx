'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useDesk } from './DeskProvider';

export default function RenewAction({ extra }: { extra?: ReactNode }) {
  const d = useDesk();
  const canRenew = !!d.deskKey && !!d.canaryKey && !d.busy;
  const stillLooking = (d.loadingDesk || !!d.loadError) && !d.canaryKey;

  if (stillLooking) {
    return (
      <div>
        <p className="muted">
          {d.loadError
            ? 'Still reading the live canary from Arkiv. Renew stays unavailable until that read succeeds.'
            : 'Checking the live canary on Arkiv…'}
        </p>
        {extra ? <div className="ctaRow" style={{ marginTop: 14 }}>{extra}</div> : null}
      </div>
    );
  }

  if (!d.deskKey || !d.canaryKey) {
    return (
      <div>
        <p className="muted">
          {d.deskKey
            ? 'This desk has no live canary yet, so renew is unavailable.'
            : 'There is no live canary to renew. Create a desk first.'}
        </p>
        <div className="ctaRow" style={{ marginTop: 14 }}>
          {d.demo && !d.deskKey ? (
            <button
              type="button"
              className="btn primary"
              onClick={() => void d.createDeskFlow(false)}
              disabled={d.busy || !d.demoKey}
            >
              {d.busy ? 'Working' : 'Create demo desk'}
            </button>
          ) : (
            <Link className="btn primary" href="/desk/settings">
              Create a desk
            </Link>
          )}
          {extra}
        </div>
      </div>
    );
  }

  return (
    <div className="ctaRow">
      <button type="button" className="btn primary" onClick={() => d.setConfirm('renew')} disabled={!canRenew}>
        {d.busy ? 'Working' : 'Renew canary'}
      </button>
      {extra}
    </div>
  );
}
