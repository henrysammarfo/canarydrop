'use client';

import Link from 'next/link';
import Card from '@/components/ui/Card';
import CopyField from '@/components/ui/CopyField';
import PageHeader from '@/components/ui/PageHeader';
import DemoBanner, { DemoSwitch } from '@/components/desk/DemoBanner';
import { useDesk } from '@/components/desk/DeskProvider';
import { txUrl, shortHex } from '@/lib/chain';

export default function DeskOverviewPage() {
  const d = useDesk();
  return (
    <>
      <PageHeader
        kicker="Newsroom"
        title="Overview"
        description="Create your desk, keep the canary alive, and read locked tips."
        actions={<DemoSwitch />}
      />
      <DemoBanner />
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <Card>
          <p className="kicker">Canary</p>
          <div style={{ marginTop: 8, fontSize: 22, letterSpacing: '-0.03em', fontWeight: 650 }} className={d.alive ? 'status-alive' : d.alive === false ? 'status-gone' : ''}>
            {d.alive === null ? 'None yet' : d.alive ? 'ALIVE' : 'GONE'}
          </div>
          <div className="ctaRow" style={{ marginTop: 14 }}>
            <button type="button" className="btn primary sm" onClick={() => d.setConfirm('renew')} disabled={!d.deskKey || !d.canaryKey || d.busy}>
              Renew canary
            </button>
            <Link className="btn sm" href="/desk/canary">
              Canary page
            </Link>
          </div>
        </Card>
        <Card>
          <p className="kicker">Inbox</p>
          <div style={{ marginTop: 8, fontSize: 22, letterSpacing: '-0.03em', fontWeight: 650 }}>{d.tips.length}</div>
          <p className="muted" style={{ marginTop: 6 }}>
            {d.loadingInbox ? 'Loading tips from Arkiv…' : 'Open tips stay on this device.'}
          </p>
          <div className="ctaRow" style={{ marginTop: 14 }}>
            <Link className="btn sm" href="/desk/inbox">
              Open inbox
            </Link>
          </div>
        </Card>
        <Card>
          <p className="kicker">Next</p>
          <ol className="muted" style={{ marginTop: 8, paddingLeft: 18, lineHeight: 1.6 }}>
            <li>Generate keys, or turn on Demo mode</li>
            <li>Create your desk and first canary</li>
            <li>Share your public tip link</li>
          </ol>
          {d.demo && (
            <div className="ctaRow" style={{ marginTop: 14 }}>
              <button
                type="button"
                className="btn primary sm"
                onClick={() => void d.createDeskFlow(false)}
                disabled={d.busy || !d.demoKey}
              >
                {d.busy ? 'Working' : 'Create demo desk'}
              </button>
              <Link className="btn sm" href="/desk/settings">
                Desk settings
              </Link>
            </div>
          )}
        </Card>
      </div>
      <Card>
        <p className="kicker">Desk identity</p>
        <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
          <CopyField label="Creator" value={d.creator ?? 'Not set'} />
          <CopyField label="Desk" value={d.deskKey ?? 'Not set'} />
          <CopyField label="Canary" value={d.canaryKey ?? 'None yet'} />
          {d.tx ? (
            <a className="btn sm" href={txUrl(d.tx)} target="_blank" rel="noreferrer">
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
