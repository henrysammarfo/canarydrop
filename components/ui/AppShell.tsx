'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { shortHex } from '@/lib/chain';
import { connectTiramisu, existingAccount } from '@/lib/wallet';
import { useToast } from '@/components/Toast';
import {
  IcoCanary,
  IcoCollapse,
  IcoExplorer,
  IcoHow,
  IcoInbox,
  IcoMenu,
  IcoOverview,
  IcoReplies,
  IcoSettings,
  IcoVerify,
} from './icons';

const DESK = [
  { href: '/desk', label: 'Overview', icon: IcoOverview, exact: true },
  { href: '/desk/inbox', label: 'Inbox', icon: IcoInbox },
  { href: '/desk/canary', label: 'Canary', icon: IcoCanary },
  { href: '/desk/replies', label: 'Replies', icon: IcoReplies },
  { href: '/desk/settings', label: 'Desk settings', icon: IcoSettings },
];

const WORK = [
  { href: '/explorer', label: 'Explorer', icon: IcoExplorer },
  { href: '/how', label: 'How it uses Arkiv', icon: IcoHow },
  { href: '/verify', label: 'Verify', icon: IcoVerify },
];

function active(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const push = useToast();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [addr, setAddr] = useState<string | null>(null);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    (async () => {
      const a = await existingAccount();
      if (a) setAddr(a);
    })();
  }, []);

  async function connect() {
    const result = await connectTiramisu();
    if ('error' in result) {
      push({ kind: 'error', text: result.error });
      return;
    }
    setAddr(result.address);
    window.dispatchEvent(new Event('canarydrop-wallet'));
    push({ kind: 'success', text: `Wallet connected ${shortHex(result.address)}` });
  }

  const shellClass = ['app-shell', collapsed ? 'collapsed' : '', mobileOpen ? 'mobile-open' : ''].filter(Boolean).join(' ');

  return (
    <div className={shellClass}>
      <div className="app-scrim" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      <aside className="app-sidebar" aria-label="Desk navigation">
        <Link href="/" className="brand">
          <span className="pill">CD</span>
          <span className="brand-name">CanaryDrop</span>
        </Link>
        <div className="side-label">Desk</div>
        {DESK.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={`side-link${active(pathname, item.href, item.exact) ? ' active' : ''}`}
            aria-current={active(pathname, item.href, item.exact) ? 'page' : undefined}
          >
            <item.icon />
            <span className="label">{item.label}</span>
          </Link>
        ))}
        <div className="side-label">Workspace</div>
        {WORK.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={`side-link${active(pathname, item.href) ? ' active' : ''}`}
            aria-current={active(pathname, item.href) ? 'page' : undefined}
          >
            <item.icon />
            <span className="label">{item.label}</span>
          </Link>
        ))}
        <div className="side-spacer" />
        <div className="side-foot">
          <span className="pill">Tiramisu</span>
        </div>
      </aside>
      <div className="app-main">
        <header className="app-top">
          <div className="ctaRow">
            <button
              type="button"
              className="btn ghost icon-btn side-toggle"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMobileOpen((v) => !v)}
            >
              <IcoMenu />
            </button>
            <button
              type="button"
              className="btn ghost icon-btn desk-collapse"
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <IcoCollapse flipped={collapsed} />
            </button>
            <span className="app-top-title">{titleFor(pathname)}</span>
          </div>
          <div className="ctaRow">
            <span className="pill">Testnet</span>
            <button type="button" className="btn connect" onClick={() => void connect()}>
              {addr ? `Wallet ${shortHex(addr)}` : 'Connect wallet'}
            </button>
            <Link className="btn" href="/">
              Site
            </Link>
          </div>
        </header>
        <main id="main" className="app-content">
          {children}
        </main>
      </div>
    </div>
  );
}

function titleFor(pathname: string) {
  const deskHit = DESK.find((item) => active(pathname, item.href, item.exact));
  if (deskHit) return deskHit.label;
  const workHit = WORK.find((item) => active(pathname, item.href));
  return workHit?.label ?? 'CanaryDrop';
}
