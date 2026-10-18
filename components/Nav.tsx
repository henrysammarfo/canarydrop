'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function Nav() {
  const [addr, setAddr] = useState<string | null>(null);
  const deskCreator = process.env.NEXT_PUBLIC_DESK_ADDRESS || '0x';

  async function connect() {
    try {
      if (!(window as any).ethereum) return;
      const [a] = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
      setAddr(a);
    } catch {}
  }

  useEffect(() => {
    // on load, see if already connected
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
        <div className="nav-left">
          <Link href="/" className="logo">
            <span>CANARYDROP</span>
          </Link>
          <nav className="nav-links">
            <a href="/#how">How it works</a>
            <Link href="/submit">Submit a tip</Link>
            <Link href="/desk">Desk</Link>
            <Link href="/r">Verify receipt</Link>
            <Link href={`/canary/${deskCreator}`}>Canary</Link>
            <Link href="/explorer">Explorer</Link>
            <Link href="/docs">Docs</Link>
          </nav>
        </div>
        <div className="nav-right">
          <span className="pill">Tiramisu testnet</span>
          <button className="btn" onClick={connect}>
            {addr ? `Connected ${addr.slice(0, 6)}…${addr.slice(-4)}` : 'Connect wallet'}
          </button>
        </div>
      </div>
    </div>
  );
}

