'use client';

import Link from 'next/link';
import Card from '@/components/ui/Card';
import CopyField from '@/components/ui/CopyField';
import PageHeader from '@/components/ui/PageHeader';
import DemoBanner, { DemoSwitch } from '@/components/desk/DemoBanner';
import RenewAction from '@/components/desk/RenewAction';
import { useDesk } from '@/components/desk/DeskProvider';
import { txUrl, shortHex } from '@/lib/chain';
import { lastRenewedPhrase, remainingPhrase } from '@/lib/time';

export default function DeskOverviewPage() {
  const d = useDesk();
  const canCount = d.currentBlock != null && d.canaryExpiresAt != null;
  const remaining = canCount ? remainingPhrase(d.canaryExpiresAt!, d.currentBlock!, d.blockDuration) : null;
  const renewed =
    d.currentBlock != null
      ? lastRenewedPhrase(d.canaryExpiresAt, d.canaryCreatedAt, d.currentBlock, d.blockDuration)
      : null;
  const status = d.loadingDesk ? 'Loading' : d.alive === null ? 'None yet' : d.alive ? 'ALIVE' : 'GONE';
  const statusClass = d.alive ? 'status-alive' : d.alive === false ? 'status-gone' : '';

  return (
    <>
      <PageHeader
        kicker="Newsroom"
        title="Overview"
        description="Create your desk, keep the canary alive, and read locked tips."
        actions={<DemoSwitch />}
      />
      <DemoBanner />
      {d.loadError && (
        <div className="page-note" role="alert" style={{ marginBottom: 16 }}>
          {d.loadError}
        </div>
      )}
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <Card className="stat-hero">
          <p className="eyebrow">Canary status</p>
          <div className={`stat-value ${statusClass}`}>{status}</div>
          <p className="stat-meta">
            {d.loadingDesk
              ? 'Loading the live desk from Arkiv…'
              : d.alive
                ? remaining
                  ? `Expires ${remaining}.`
                  : 'The newsroom canary is live.'
                : d.alive === false
                  ? 'The canary is missing. That is the signal.'
                  : 'No canary is published for this desk yet.'}
          </p>
          {d.alive && renewed && (
            <p className="muted" style={{ marginTop: 6 }} title={d.canaryExpiresAt ? `Expires at block ${d.canaryExpiresAt.toString()}` : undefined}>
              Last renewed {renewed}
            </p>
          )}
          <div style={{ marginTop: 'auto', paddingTop: 20 }}>
            <RenewAction
              extra={
                <Link className="btn" href="/desk/canary">
                  Canary page
                </Link>
              }
            />
          </div>
        </Card>
        <div className="stat-stack">
          <Card className="stat-card">
            <p className="eyebrow">Tips waiting</p>
            <div className="stat-value">{d.loadingInbox && d.tips.length === 0 ? '…' : d.tips.length}</div>
            <p className="muted stat-meta">
              {d.demo && d.demoKeyError
                ? 'Tips cannot be opened on this server.'
                : d.loadingInbox
                  ? 'Loading tips from Arkiv…'
                  : 'Open tips stay on this device.'}
            </p>
            <div className="ctaRow" style={{ marginTop: 'auto', paddingTop: 12 }}>
              <Link className="btn" href="/desk/inbox">
                Open inbox
              </Link>
            </div>
          </Card>
          <Card className="stat-card">
            <p className="eyebrow">Desk</p>
            <div className="stat-value" style={{ fontSize: 22, lineHeight: '28px' }}>
              {d.loadingDesk ? 'Loading' : d.chainName || d.deskName}
            </div>
            <p className="muted stat-meta">
              {d.deskKey ? shortHex(d.deskKey) : d.loadingDesk ? 'Looking up the public desk…' : 'Not published yet'}
            </p>
            <div className="ctaRow" style={{ marginTop: 'auto', paddingTop: 12 }}>
              <Link className="btn" href="/desk/settings">
                Desk settings
              </Link>
            </div>
          </Card>
        </div>
      </div>
      <Card>
        <p className="eyebrow">Desk identity</p>
        <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
          <CopyField label="Creator" value={d.creator ?? 'Not set'} />
          <CopyField label="Desk" value={d.deskKey ?? (d.loadingDesk ? 'Loading…' : 'Not set')} />
          <CopyField label="Canary" value={d.canaryKey ?? (d.loadingDesk ? 'Loading…' : 'None yet')} />
          {d.tx ? (
            <a className="btn" href={txUrl(d.tx)} target="_blank" rel="noreferrer">
              Last tx {shortHex(d.tx, 6, 4)}
            </a>
          ) : (
            <p className="muted">No write in this session yet.</p>
          )}
        </div>
      </Card>
    </>
  );
}
