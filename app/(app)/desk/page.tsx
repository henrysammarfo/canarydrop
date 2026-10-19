'use client';

import Link from 'next/link';
import Card from '@/components/ui/Card';
import CopyField from '@/components/ui/CopyField';
import PageHeader from '@/components/ui/PageHeader';
import DemoBanner, { DemoSwitch } from '@/components/desk/DemoBanner';
import RenewAction from '@/components/desk/RenewAction';
import { useDesk } from '@/components/desk/DeskProvider';
import StaleNote from '@/components/ui/StaleNote';
import { txUrl, shortHex } from '@/lib/chain';
import { canaryRemainingRatio, lastRenewedPhrase, remainingPhrase } from '@/lib/time';

export default function DeskOverviewPage() {
  const d = useDesk();
  const canCount = d.currentBlock != null && d.canaryExpiresAt != null;
  const remaining = canCount ? remainingPhrase(d.canaryExpiresAt!, d.currentBlock!, d.blockDuration) : null;
  const renewed =
    d.currentBlock != null
      ? lastRenewedPhrase(d.canaryExpiresAt, d.canaryCreatedAt, d.currentBlock, d.blockDuration)
      : null;
  const lifeLeft = canCount ? canaryRemainingRatio(d.canaryExpiresAt!, d.currentBlock!, d.blockDuration) : 0;
  const lifePct = Math.round(lifeLeft * 100);
  const waiting = d.loadingDesk || (!!d.loadError && !d.deskKey);
  const status = waiting ? 'Checking' : d.alive === null ? 'None yet' : d.alive ? 'Alive' : 'Gone';
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
      <StaleNote text={d.staleNote} />
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <Card className={`stat-hero${d.alive ? ' alive' : ''}`}>
          <div className="stat-hero-top">
            <p className="eyebrow">Canary</p>
            {d.alive ? (
              <span className="live-pill">
                <span className="dot live" />
                Live
              </span>
            ) : null}
          </div>
          <div className={`stat-value ${statusClass}`}>{status}</div>
          <p className="stat-countdown">
            {waiting
              ? 'Loading the live desk from Arkiv…'
              : d.alive && remaining
                ? `Expires ${remaining}`
                : d.alive
                  ? 'The newsroom canary is live.'
                  : d.alive === false
                    ? 'The canary is missing. That is the signal.'
                    : 'No canary is published for this desk yet.'}
          </p>
          {d.alive && canCount && (
            <div className="life-meter">
              <div
                className={`life-meter-track${lifeLeft <= 0.2 ? ' low' : ''}`}
                role="progressbar"
                aria-label="Canary lifetime remaining"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={lifePct}
                title={d.canaryExpiresAt ? `Expires at block ${d.canaryExpiresAt.toString()}` : undefined}
              >
                <div className="life-meter-fill" style={{ width: `${lifePct}%` }} />
              </div>
              <p className="muted">
                {lifePct}% of this lifetime is left.
                {renewed ? ` Last renewed ${renewed}.` : ''}
                {remaining && remaining !== 'Expired'
                  ? ` Next renewal due ${remaining}.`
                  : remaining === 'Expired'
                    ? ' This lifetime has ended.'
                    : ''}
              </p>
            </div>
          )}
          {d.loadError && !d.deskKey && (
            <p className="muted" role="status" style={{ marginTop: 8, color: 'var(--warn)' }}>
              {d.loadError}
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
          <Card className={`stat-card${d.tips.length > 0 ? ' hot' : ''}`}>
            <p className="eyebrow">Tips waiting</p>
            <div className="stat-value">{d.loadingInbox && d.tips.length === 0 ? '…' : d.tips.length}</div>
            <p className="muted stat-meta">
              {d.demo && d.demoKeyError
                ? 'Tips cannot be opened on this server.'
                : d.loadingInbox
                  ? 'Loading tips from Arkiv…'
                  : d.tips.length === 1
                    ? 'One open tip is on this device.'
                    : d.tips.length > 1
                      ? `${d.tips.length} open tips are on this device.`
                      : 'Open tips stay on this device.'}
            </p>
            <div className="ctaRow" style={{ marginTop: 'auto', paddingTop: 12 }}>
              <Link className={`btn${d.tips.length > 0 ? ' primary' : ''}`} href="/desk/inbox">
                Open inbox
              </Link>
            </div>
          </Card>
          <Card className="stat-card">
            <p className="eyebrow">Desk</p>
            <div className="stat-value" style={{ fontSize: 22, lineHeight: '28px' }}>
              {waiting ? 'Loading' : d.chainName || d.deskName}
            </div>
            <p className="muted stat-meta" title={d.deskKey ?? undefined}>
              {d.deskKey ? shortHex(d.deskKey, 8, 6) : waiting ? 'Looking up the public desk…' : 'Not published yet'}
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
        <p className="eyebrow">Keys</p>
        <div className="keys-bar">
          <CopyField label="Creator" value={d.creator ?? 'Not set'} />
          <CopyField label="Desk" value={d.deskKey ?? (waiting ? 'Loading…' : 'Not set')} />
          <CopyField label="Canary" value={d.canaryKey ?? (waiting ? 'Loading…' : 'None yet')} />
        </div>
        {d.tx ? (
          <a className="btn" href={txUrl(d.tx)} target="_blank" rel="noreferrer" style={{ marginTop: 12 }}>
            Last tx {shortHex(d.tx, 6, 4)}
          </a>
        ) : (
          <p className="muted" style={{ marginTop: 12 }}>
            No write in this session yet.
          </p>
        )}
      </Card>
    </>
  );
}
