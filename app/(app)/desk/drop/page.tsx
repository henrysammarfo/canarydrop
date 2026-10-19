'use client';

import Card from '@/components/ui/Card';
import CopyField from '@/components/ui/CopyField';
import PageHeader from '@/components/ui/PageHeader';
import DemoBanner, { DemoSwitch } from '@/components/desk/DemoBanner';
import { useDesk } from '@/components/desk/DeskProvider';
import Badge from '@/components/ui/Badge';
import { demoDeadDrop } from '@/lib/demo-drop';

export default function DeadDropPage() {
  const d = useDesk();
  const drop = demoDeadDrop(d.alive);
  const released = drop.status === 'released';

  return (
    <>
      <PageHeader
        kicker="Newsroom"
        title="Dead drop"
        description="If the canary goes quiet, a pre-sealed statement is treated as released. This page uses synthetic data only."
        actions={<DemoSwitch />}
      />
      <DemoBanner />
      <div className="grid cols-2">
        <Card className={`stat-hero${released ? '' : ' alive'}`}>
          <div className="stat-hero-top">
            <p className="eyebrow">Hold status</p>
            <Badge tone={released ? 'wait' : 'ok'}>{released ? 'Released' : 'Held'}</Badge>
          </div>
          <div className={`stat-value ${released ? 'status-gone' : 'status-alive'}`}>
            {released ? 'Released' : 'Held'}
          </div>
          <p className="stat-countdown">{drop.note}</p>
          <p className="muted" style={{ marginTop: 10 }}>
            The live path uses predictEntityKeys, a sealed drop, a longer lived release row, and a 26 hour hold that renews with the canary.
          </p>
        </Card>
        <Card>
          <p className="eyebrow">Synthetic packet</p>
          <h2 className="h3" style={{ marginTop: 8 }}>{drop.title}</h2>
          <p className="muted" style={{ marginTop: 8 }}>{drop.text}</p>
          <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
            <CopyField label="Drop" value={drop.dropKey} />
            <CopyField label="Release" value={drop.releaseKey} />
            <CopyField label="Hold" value={drop.holdKey} />
          </div>
        </Card>
      </div>
      <Card style={{ marginTop: 16 }}>
        <p className="eyebrow">Chosen recipients</p>
        <ul className="threat-list">
          {drop.recipients.map((row) => (
            <li key={row.label}>
              {row.label}. {row.hint}.
            </li>
          ))}
        </ul>
        <p className="muted" style={{ marginTop: 12 }}>
          No real keys are stored here. On a live desk the release row wraps a key to each recipient public key. When the hold expires, those recipients already have what they need.
        </p>
      </Card>
    </>
  );
}
