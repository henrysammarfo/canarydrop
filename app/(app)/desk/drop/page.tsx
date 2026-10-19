'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card';
import CopyField from '@/components/ui/CopyField';
import PageHeader from '@/components/ui/PageHeader';
import DemoBanner, { DemoSwitch } from '@/components/desk/DemoBanner';
import { useDesk } from '@/components/desk/DeskProvider';
import Badge from '@/components/ui/Badge';
import { bytesToHex } from '@/lib/bytes';
import { deadDropCopy, deadDropStatus } from '@/lib/dead-drop';
import { parseRecipientPubHex } from '@/lib/drop-seal';

function pubHex(raw: Uint8Array | null): string {
  if (!raw) return '';
  return bytesToHex(raw);
}

export default function DeadDropPage() {
  const d = useDesk();
  const held = d.alive !== false;
  const status = deadDropStatus(held, held);
  const released = status === 'released';
  const [title, setTitle] = useState('Synthetic hold statement');
  const [text, setText] = useState(
    'This is fake sample text for the demo desk. It is not a real disclosure and it names no one.',
  );
  const [label, setLabel] = useState('Editor one');
  const [pubText, setPubText] = useState('');
  const [rows, setRows] = useState<{ label: string; pub: number[] }[]>([]);

  function addRecipient() {
    const pub = parseRecipientPubHex(pubText);
    if (!pub) return;
    setRows((old) => [...old, { label: label.trim() || `Recipient ${old.length + 1}`, pub }]);
    setPubText('');
  }

  function useDeskPub() {
    const hex = pubHex(d.deskPubRaw ?? d.demoKey?.pub ?? null);
    if (hex) setPubText(hex);
  }

  const canSeal = !!d.deskKey && !!title.trim() && !!text.trim() && rows.length > 0 && !d.busy && (d.demo || d.canDeskWrite);

  return (
    <>
      <PageHeader
        kicker="Newsroom"
        title="Dead drop"
        description="Seal a statement to chosen recipients. Recipients can open it as soon as they have it. The hold going quiet is a public signal, not a clock lock."
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
          <p className="stat-countdown">{deadDropCopy(status)}</p>
          <p className="muted" style={{ marginTop: 10 }}>
            Renewing the canary also extends every live hold for this desk.
          </p>
        </Card>
        <Card>
          <p className="eyebrow">Seal a dead drop</p>
          <p className="muted" style={{ marginTop: 8 }}>
            Synthetic text only. The packet is encrypted with a random key. That key is wrapped to each recipient.
          </p>
          <label className="small" htmlFor="drop-title">Title</label>
          <input id="drop-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <label className="small" htmlFor="drop-text">Statement</label>
          <textarea id="drop-text" value={text} onChange={(e) => setText(e.target.value)} style={{ height: 120 }} />
          <label className="small" htmlFor="drop-label">Recipient label</label>
          <input id="drop-label" value={label} onChange={(e) => setLabel(e.target.value)} />
          <label className="small" htmlFor="drop-pub">Recipient public key (65 bytes hex)</label>
          <textarea id="drop-pub" value={pubText} onChange={(e) => setPubText(e.target.value)} style={{ height: 72 }} />
          <div className="ctaRow" style={{ marginTop: 12, justifyContent: 'flex-start' }}>
            <button type="button" className="btn" onClick={addRecipient} disabled={!parseRecipientPubHex(pubText)}>
              Add recipient
            </button>
            <button type="button" className="btn" onClick={useDeskPub} disabled={!d.deskPubRaw && !d.demoKey}>
              Use this desk key
            </button>
          </div>
          <ul className="threat-list" style={{ marginTop: 12 }}>
            {rows.map((row, i) => (
              <li key={`${row.label}-${i}`}>{row.label}. Public key added.</li>
            ))}
          </ul>
          <div className="ctaRow" style={{ marginTop: 14 }}>
            <button type="button" className="btn" onClick={() => void d.sealDropFlow(title, text, rows, true)} disabled={!canSeal}>
              Dry run
            </button>
            <button type="button" className="btn primary" onClick={() => void d.sealDropFlow(title, text, rows, false)} disabled={!canSeal}>
              {d.busy ? 'Working' : 'Seal a dead drop'}
            </button>
          </div>
          {!d.demo && !d.canDeskWrite && (
            <p className="muted" style={{ marginTop: 10 }}>
              Sign in with the desk wallet before a live write.
            </p>
          )}
        </Card>
      </div>
      {d.lastDrop && (
        <Card style={{ marginTop: 16 }}>
          <p className="eyebrow">Last sealed packet</p>
          <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
            {d.lastDrop.dropKey && <CopyField label="Drop" value={d.lastDrop.dropKey} />}
            {d.lastDrop.releaseKey && <CopyField label="Release" value={d.lastDrop.releaseKey} />}
            {d.lastDrop.holdKey && <CopyField label="Hold" value={d.lastDrop.holdKey} />}
            {d.lastDrop.txHash && <CopyField label="Tx" value={d.lastDrop.txHash} />}
          </div>
        </Card>
      )}
    </>
  );
}
