'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function Nav() {
  const [addr, setAddr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const deskCreator = process.env.NEXT_PUBLIC_DESK_ADDRESS || '0x';

  async function connect() {
    try {
      if (!(window as any).ethereum) return;
      const [a] = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
      setAddr(a);
      setOpen(false);
    } catch {}
  }

  useEffect(() => {
    (async () => {
      try {
        if (!(window as any).ethereum) return;
        const as = await (window as any).ethereum.request({ method: 'eth_accounts' });
        if (as?.length) setAddr(as[0]);
      } catch {}
    })();
  }, []);

  return (
    <div className="site-nav">
      <div className="wrap nav-inner">
        <div className="nav-left" style={{ flexWrap: 'nowrap' }}>
          <Link href="/" className="logo">
            <span>CANARYDROP</span>
          </Link>
          <nav className="nav-links" style={{ flexWrap: 'nowrap', overflow: 'hidden' }}>
            <a href="/#how">How it works</a>
            <Link href="/submit">Submit</Link>
            <Link href="/desk">Desk</Link>
            <Link href="/r">Verify</Link>
            <Link href={`/canary/${deskCreator}`}>Canary</Link>
            <Link href="/explorer">Explorer</Link>
            <Link href="/docs">Docs</Link>
          </nav>
        </div>
        <div className="nav-right" style={{ flexWrap: 'nowrap' }}>
          <span className="pill">Tiramisu testnet</span>
          <button className="btn connect" onClick={connect}>
            {addr ? `Wallet ${addr.slice(0, 6)}…${addr.slice(-4)}` : 'Connect wallet'}
          </button>
          <button
            className="btn"
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
            style={{ display: 'none' }}
            id="hamburger"
          >
            ☰
          </button>
        </div>
      </div>
      {/* Mobile panel */}
      <div
        className="wrap"
        style={{
          display: open ? 'block' : 'none',
          paddingBottom: 12,
        }}
      >
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Link href="/#how" onClick={() => setOpen(false)}>
            How it works
          </Link>
          <Link href="/submit" onClick={() => setOpen(false)}>
            Submit a tip
          </Link>
          <Link href="/desk" onClick={() => setOpen(false)}>
            Desk
          </Link>
          <Link href="/r" onClick={() => setOpen(false)}>
            Verify receipt
          </Link>
          <Link href={`/canary/${deskCreator}`} onClick={() => setOpen(false)}>
            Canary
          </Link>
          <Link href="/explorer" onClick={() => setOpen(false)}>
            Explorer
          </Link>
          <Link href="/docs" onClick={() => setOpen(false)}>
            Docs
          </Link>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <span className="pill">Tiramisu testnet</span>
            <button className="btn" onClick={connect}>
              {addr ? `Wallet ${addr.slice(0, 6)}…${addr.slice(-4)}` : 'Connect wallet'}
            </button>
          </div>
        </div>
      </div>
      <style jsx>{`
        @media (max-width: 900px) {
          .nav-links {
            display: none;
          }
          #hamburger {
            display: inline-flex !important;
          }
        }
      `}</style>
    </div>
  );
}

