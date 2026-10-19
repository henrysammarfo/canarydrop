'use client';

import Link from 'next/link';
import Card from '@/components/ui/Card';
import { useDesk } from './DeskProvider';

export default function DemoBanner() {
  const d = useDesk();
  return (
    <>
      {d.createdNotice && !d.demo && (
        <div className="page-note" role="status" style={{ marginBottom: 16 }}>
          {d.createdNotice}
        </div>
      )}
      {d.demo && (
        <div className="page-note" style={{ marginBottom: 16 }}>
          Demo mode is on. This browser loads a shared testnet desk key so a judge can open tips without the original laptop. Do not use this for a real newsroom.
          {d.createdNotice && (
            <div style={{ marginTop: 8 }} role="status">
              {d.createdNotice}
            </div>
          )}
          {d.deskKey && d.pubMatch === false && !d.createdNotice && (
            <div style={{ marginTop: 8 }}>
              The live desk still has an older public key. Open Desk settings and press Create demo desk so new tips match this browser.
              <div className="ctaRow" style={{ marginTop: 10 }}>
                <Link className="btn primary sm" href="/desk/settings">
                  Desk settings
                </Link>
              </div>
            </div>
          )}
          {d.pubMatch === true && <div style={{ marginTop: 8 }}>The live desk matches the shared demo key. New tips will open here.</div>}
          {d.demo && !d.deskKey && d.demoKey && (
            <div style={{ marginTop: 8 }}>
              No live demo desk yet. Open Desk settings and press Create demo desk. The server wallet publishes the shared public key.
              <div className="ctaRow" style={{ marginTop: 10 }}>
                <Link className="btn primary sm" href="/desk/settings">
                  Create demo desk
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
      {!d.demo && !d.connected && (
        <Card style={{ textAlign: 'center', padding: 28, marginBottom: 16 }}>
          <h2 className="h3">Choose how to run the desk</h2>
          <p className="lead" style={{ margin: '8px auto 0', maxWidth: 420 }}>
            Connect a wallet to own your entities, or use Demo mode for judges without a wallet.
          </p>
          <div className="ctaRow" style={{ justifyContent: 'center', marginTop: 16 }}>
            <button type="button" className="btn primary" onClick={() => void d.connect()}>
              Connect wallet
            </button>
            <button type="button" className="btn" onClick={() => d.setDemo(true)}>
              Use Demo mode
            </button>
          </div>
        </Card>
      )}
    </>
  );
}

export function DemoSwitch() {
  const d = useDesk();
  return (
    <label className="badge" title="Server signed testnet demo. Never enable in production.">
      <input
        type="checkbox"
        checked={d.demo}
        onChange={(e) => d.setDemo(e.target.checked)}
        style={{ accentColor: '#e8c458', marginRight: 4 }}
      />
      Demo mode
    </label>
  );
}
