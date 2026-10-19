'use client';

import Link from 'next/link';
import Card from '@/components/ui/Card';
import CopyField from '@/components/ui/CopyField';
import PageHeader from '@/components/ui/PageHeader';
import DemoBanner, { DemoSwitch } from '@/components/desk/DemoBanner';
import { useDesk } from '@/components/desk/DeskProvider';
import { DEFAULT_DESK } from '@/lib/constants';

export default function DeskCanaryPage() {
  const d = useDesk();
  const creator = d.creator ?? DEFAULT_DESK;
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
        <Card style={{ textAlign: 'center', padding: 32 }}>
          <div className={`status-word ${d.alive ? 'status-alive' : 'status-gone'}`}>
            {d.alive === null ? 'NONE' : d.alive ? 'ALIVE' : 'GONE'}
          </div>
          <p className="muted" style={{ marginTop: 12 }}>
            {d.alive === null ? 'Create your desk to start a canary.' : d.alive ? 'The newsroom canary is live.' : 'The canary is missing.'}
          </p>
        </Card>
        <Card>
          <p className="kicker">Keys</p>
          <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
            <CopyField label="Desk" value={d.deskKey ?? 'Not set'} />
            <CopyField label="Canary" value={d.canaryKey ?? 'None yet'} />
          </div>
          <div className="ctaRow" style={{ marginTop: 16 }}>
            <button type="button" className="btn primary" onClick={() => d.setConfirm('renew')} disabled={!d.deskKey || !d.canaryKey || d.busy}>
              {d.busy ? 'Working' : 'Renew the daily canary'}
            </button>
            <button type="button" className="btn" onClick={() => void d.renewFlow(true)} disabled={!d.deskKey || !d.canaryKey || d.busy}>
              Dry run
            </button>
            <Link className="btn" href={`/canary/${creator}`}>
              Public page
            </Link>
          </div>
        </Card>
      </div>
    </>
  );
}
