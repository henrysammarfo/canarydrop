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
  const waiting = d.loadingDesk || (!!d.loadError && !d.deskKey);
  const status = waiting ? 'Checking' : d.alive === null ? 'None' : d.alive ? 'Alive' : 'Gone';

  return (
    <>
      <PageHeader
        kicker="Newsroom"
        title="Canary"
        description="Daily lifetime is 26 hours. If it is missing, that is the signal."
        actions={<DemoSwitch />}
      />
      <DemoBanner />
      <div className="grid cols-2">
        <Card className={`stat-hero${d.alive ? ' alive' : ''}`} style={{ textAlign: 'left' }}>
          <div className="stat-hero-top">
            <p className="eyebrow">Live status</p>
            {d.alive ? (
              <span className="live-pill">
                <span className="dot live" />
                Live
              </span>
            ) : null}
          </div>
          <div className={`stat-value ${d.alive ? 'status-alive' : d.alive === false ? 'status-gone' : ''}`}>
            {status}
          </div>
          <p className="stat-countdown">
            {waiting
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
          {d.loadError && !d.deskKey && (
            <p className="muted" role="status" style={{ marginTop: 8, color: 'var(--warn)' }}>
              {d.loadError}
            </p>
          )}
        </Card>
        <Card>
          <p className="eyebrow">Keys</p>
          <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
            <CopyField label="Desk" value={d.deskKey ?? (waiting ? 'Loading…' : 'Not set')} />
            <CopyField label="Canary" value={d.canaryKey ?? (waiting ? 'Loading…' : 'None yet')} />
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
