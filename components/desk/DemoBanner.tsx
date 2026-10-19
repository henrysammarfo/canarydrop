'use client';

import Link from 'next/link';
import { useDesk } from './DeskProvider';

export default function DemoBanner() {
  const d = useDesk();
  const showMissingDesk =
    d.demo && d.demoKey && !d.deskKey && !d.loadingDesk && !d.loadError && !d.createdNotice;

  return (
    <>
      {d.createdNotice && !d.demo && (
        <div className="page-note" role="status" style={{ marginBottom: 16 }}>
          {d.createdNotice}
        </div>
      )}
      {d.demo && (
        <div className="page-note compact" role="status" style={{ marginBottom: 16 }}>
          Demo mode is on. Shared testnet desk. Do not use this for a real newsroom.
          {d.createdNotice && <div style={{ marginTop: 8 }}>{d.createdNotice}</div>}
          {d.demoKeyError && <div style={{ marginTop: 8 }}>{d.demoKeyError}</div>}
          {d.deskKey && d.pubMatch === false && !d.createdNotice && !d.loadingDesk && (
            <div style={{ marginTop: 8 }}>
              The live desk still has an older public key. Open Desk settings and press Create demo desk so new tips match this browser.
              <div className="ctaRow" style={{ marginTop: 10 }}>
                <Link className="btn primary" href="/desk/settings">
                  Desk settings
                </Link>
              </div>
            </div>
          )}
          {showMissingDesk && (
            <div style={{ marginTop: 8 }}>
              No live demo desk yet. Open Desk settings and press Create demo desk. The server wallet publishes the shared public key.
              <div className="ctaRow" style={{ marginTop: 10 }}>
                <Link className="btn primary" href="/desk/settings">
                  Create demo desk
                </Link>
              </div>
            </div>
          )}
        </div>
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
