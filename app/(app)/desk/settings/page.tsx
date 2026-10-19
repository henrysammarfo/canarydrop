'use client';

import Card from '@/components/ui/Card';
import CopyField from '@/components/ui/CopyField';
import PageHeader from '@/components/ui/PageHeader';
import DemoBanner, { DemoSwitch } from '@/components/desk/DemoBanner';
import { useDesk } from '@/components/desk/DeskProvider';
import SiweCard from '@/components/desk/SiweCard';
import { shortHex, txUrl } from '@/lib/chain';

export default function SettingsPage() {
  const d = useDesk();
  return (
    <>
      <PageHeader
        kicker="Newsroom"
        title="Desk settings"
        description="Keys stay in this browser. Demo mode signs testnet writes on the server."
        actions={<DemoSwitch />}
      />
      <DemoBanner />
      <div className="grid cols-2">
        <Card>
          <h2 className="h3">Keys</h2>
          <p className="muted" style={{ marginTop: 8 }}>
            {d.demo
              ? 'Demo mode uses the shared testnet desk key. Press Create demo desk so the public key on Arkiv matches it.'
              : 'Generate or import the desk key. The private key stays in your browser. Back it up.'}
          </p>
          {!d.demo && (
            <div className="ctaRow" style={{ marginTop: 14 }}>
              <button type="button" className="btn primary" onClick={() => void d.generateDeskKey()}>
                Generate desk key
              </button>
              <label className="btn" style={{ cursor: 'pointer' }}>
                Import key
                <input type="file" accept="application/json" onChange={(e) => e.target.files?.[0] && void d.importDeskKey(e.target.files[0])} style={{ display: 'none' }} />
              </label>
              <button type="button" className="btn" onClick={() => void d.downloadDeskKey()} disabled={!d.priv}>
                Download backup
              </button>
              <button type="button" className="btn danger" onClick={() => d.setConfirm('clear')} disabled={!d.priv}>
                Clear keys
              </button>
            </div>
          )}
          <div style={{ marginTop: 16 }}>
            <label className="small">Desk name</label>
            <input value={d.deskName} onChange={(e) => d.setDeskName(e.target.value)} />
          </div>
          <div style={{ marginTop: 16 }}>
            <label className="small" htmlFor="desk-domain">Declared domain</label>
            <input
              id="desk-domain"
              value={d.deskDomain}
              onChange={(e) => d.setDeskDomain(e.target.value)}
              placeholder="newsroom.example"
            />
            <p className="muted" style={{ marginTop: 8 }}>
              We fetch that host /.well-known/canarydrop.json and its DNS TXT record.
            </p>
          </div>
          <div className="ctaRow" style={{ marginTop: 14 }}>
            <button
              type="button"
              className="btn primary"
              onClick={() => void d.createDeskFlow(false)}
              disabled={d.busy || (d.demo ? !d.demoKey : !d.priv)}
            >
              {d.busy ? 'Working' : d.demo ? 'Create demo desk' : 'Create desk and canary'}
            </button>
            <button type="button" className="btn" onClick={() => void d.createDeskFlow(true)} disabled={d.busy}>
              Dry run
            </button>
          </div>
        </Card>
        <Card>
          <h2 className="h3">Status</h2>
          <p className="muted" style={{ marginTop: 8 }}>
            Demo mode signs transactions on the server with testnet keys. Never enable it on a real desk. Judges without a wallet should leave Demo mode on.
          </p>
          <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
            <CopyField label="Creator" value={d.creator ?? 'Not set'} />
            <CopyField label="Desk" value={d.deskKey ?? 'Not set'} />
            <CopyField label="Canary" value={d.canaryKey ?? 'None yet'} />
          </div>
          {d.tx && (
            <div className="ctaRow" style={{ marginTop: 14 }}>
              <a className="btn sm" href={txUrl(d.tx)} target="_blank" rel="noreferrer">
                Tx {shortHex(d.tx, 8, 6)}
              </a>
            </div>
          )}
        </Card>
        <SiweCard />
      </div>
    </>
  );
}
