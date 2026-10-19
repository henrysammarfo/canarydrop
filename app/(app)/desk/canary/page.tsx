'use client';

import Link from 'next/link';
import Card from '@/components/ui/Card';
import CopyField from '@/components/ui/CopyField';
import PageHeader from '@/components/ui/PageHeader';
import DemoBanner, { DemoSwitch } from '@/components/desk/DemoBanner';
import RenewAction from '@/components/desk/RenewAction';
import { useDesk } from '@/components/desk/DeskProvider';
import { DEFAULT_DESK } from '@/lib/constants';
import { lastRenewedPhrase, remainingPhrase } from '@/lib/time';

export default function DeskCanaryPage() {
  const d = useDesk();
  const creator = d.creator ?? DEFAULT_DESK;
  const remaining =
    d.currentBlock != null && d.canaryExpiresAt != null
      ? remainingPhrase(d.canaryExpiresAt, d.currentBlock, d.blockDuration)
      : null;
  const renewed =
    d.currentBlock != null
      ? lastRenewedPhrase(d.canaryExpiresAt, d.canaryCreatedAt, d.currentBlock, d.blockDuration)
      : null;
  const status = d.loadingDesk ? '…' : d.alive === null ? 'NONE' : d.alive ? 'ALIVE' : 'GONE';

  return (
    <>
      <PageHeader
        kicker="Newsroom"
        title="Canary"
        description="Daily lifetime is 26 hours. If it is missing, that is the signal."
        actions={<DemoSwitch />}
      />
      <DemoBanner />
      {d.loadError && (
        <div className="page-note" role="alert" style={{ marginBottom: 16 }}>
          {d.loadError}
        </div>
      )}
      <div className="grid cols-2">
        <Card className="stat-hero" style={{ textAlign: 'left' }}>
          <p className="eyebrow">Live status</p>
          <div className={`stat-value ${d.alive ? 'status-alive' : d.alive === false ? 'status-gone' : ''}`}>
            {status}
          </div>
          <p className="stat-meta">
            {d.loadingDesk
              ? 'Loading the live canary from Arkiv…'
              : d.alive
                ? remaining
                  ? `Expires ${remaining}.`
                  : 'The newsroom canary is live.'
                : 'Create your desk to start a canary.'}
          </p>
          {d.alive && renewed && (
            <p className="muted" style={{ marginTop: 8 }}>
              Last renewed {renewed}
            </p>
          )}
        </Card>
        <Card>
          <p className="eyebrow">Keys</p>
          <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
            <CopyField label="Desk" value={d.deskKey ?? (d.loadingDesk ? 'Loading…' : 'Not set')} />
            <CopyField label="Canary" value={d.canaryKey ?? (d.loadingDesk ? 'Loading…' : 'None yet')} />
          </div>
          <div style={{ marginTop: 16 }}>
            <RenewAction
              extra={
                <>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => void d.renewFlow(true)}
                    disabled={!d.deskKey || !d.canaryKey || d.busy}
                  >
                    Dry run
                  </button>
                  <Link className="btn" href={`/canary/${creator}`}>
                    Public page
                  </Link>
                </>
              }
            />
          </div>
        </Card>
      </div>
    </>
  );
}
