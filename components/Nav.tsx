'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { shortHex } from '@/lib/chain';
import { connectTiramisu, existingAccount } from '@/lib/wallet';
import { useToast } from './Toast';
import { IcoMenu } from './ui/icons';

export default function Nav() {
  const push = useToast();
  const pathname = usePathname();
  const [addr, setAddr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const deskCreator = /^0x[0-9a-fA-F]{40}$/.test(process.env.NEXT_PUBLIC_DESK_ADDRESS || '')
    ? process.env.NEXT_PUBLIC_DESK_ADDRESS!
    : '0x1da3c22c079c264536D831F6F1fCe638aB0b20B0';

  async function connect() {
    const result = await connectTiramisu();
    if ('error' in result) {
      push({ kind: 'error', text: result.error });
      return;
    }
    setAddr(result.address);
    setOpen(false);
    push({ kind: 'success', text: `Wallet connected ${shortHex(result.address)}` });
  }

  useEffect(() => {
    (async () => {
      const a = await existingAccount();
      if (a) setAddr(a);
    })();
  }, []);

  useEffect(() => {
    function onResize() {
      if (window.innerWidth > 1100) setOpen(false);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const items = [
    { href: '/#how', label: 'How it works' },
    { href: '/submit', label: 'Submit' },
    { href: '/desk', label: 'Desk' },
    { href: `/canary/${deskCreator}`, label: 'Canary' },
    { href: '/explorer', label: 'Explorer' },
    { href: '/docs', label: 'Docs' },
  ];

  const links = (
    <>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={pathname === item.href ? 'page' : undefined}
          onClick={() => setOpen(false)}
        >
          {item.label}
        </Link>
      ))}
    </>
  );

  return (
    <div className="site-nav">
      <div className="wrap nav-inner">
        <div className="nav-left">
          <Link href="/" className="logo" aria-label="Home">
            <span className="logo-mark">CANARYDROP</span>
          </Link>
          <span className="pill testnet-pill">Testnet</span>
          <nav className="nav-links" aria-label="Primary">
            {links}
          </nav>
        </div>
        <div className="nav-right">
          <span className="pill network-pill">Tiramisu testnet</span>
          <button type="button" className="btn connect sm" onClick={() => void connect()}>
            {addr ? `Wallet ${shortHex(addr)}` : 'Connect wallet'}
          </button>
          <button
            type="button"
            className="btn hamburger sm"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            <IcoMenu />
          </button>
        </div>
      </div>
      <div id="mobile-menu" className={`nav-panel ${open ? 'open' : ''}`}>
        <div className="wrap">
          <div className="card nav-panel-inner">
            {links}
            <Link href="/verify" onClick={() => setOpen(false)}>
              Verify
            </Link>
            <Link href="/how" onClick={() => setOpen(false)}>
              How we use Arkiv
            </Link>
            <a href="https://github.com/henrysammarfo/canarydrop" target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
              GitHub
            </a>
            <div className="nav-panel-actions">
              <span className="pill">Tiramisu testnet</span>
              <button type="button" className="btn primary sm" onClick={() => void connect()}>
                {addr ? `Wallet ${shortHex(addr)}` : 'Connect wallet'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
