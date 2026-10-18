'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { Hex } from 'viem';
import { custom } from 'viem';
import { createWalletClient } from '@arkiv-network/sdk';
import { tiramisu } from '@arkiv-network/sdk/chains';
import { http } from 'viem';
import { canaryAlive, getDesk, pub, renew, reply, watchInbox } from '@/lib/arkiv';
import {
  exportPrivJwk,
  exportPub,
  importPrivJwk,
  importPub,
  newKeyPair,
  openAsDesk,
  sealReply,
} from '@/lib/crypto';

declare global {
  interface Window {
    ethereum?: any;
  }
}
type TipView = {
  key: Hex;
  createdAt: bigint;
  text: string;
  ephPub: CryptoKey; // to reply
  replyText?: string;
};

const VIDEO =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260912_104303_0c6d60b2-9353-408e-944-585108a22fb5.mp4';
const POSTER =
  'https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/130837c4-0244-4f37-9c61-8d801d93fd29.jpg';

const CHAIN_ID_HEX = '0x7614d1'; // 7738577
const DESK_KEY_STORE = 'canarydrop/deskPrivJwk';

export default function DeskPage() {
  const [demo, setDemo] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('canarydrop/demo') === '1';
  });
  const [creator, setCreator] = useState<Hex | null>(process.env.NEXT_PUBLIC_DESK_ADDRESS as Hex | null);
  const [connected, setConnected] = useState<Hex | null>(null);
  const [deskName, setDeskName] = useState('CanaryDrop Demo Desk');
  const [deskKey, setDeskKey] = useState<Hex | null>(null);
  const [canaryKey, setCanaryKey] = useState<Hex | null>(null);
  const [alive, setAlive] = useState<boolean | null>(null);
  const [priv, setPriv] = useState<CryptoKey | null>(null);
  const [tips, setTips] = useState<TipView[]>([]);
  const unwatchRef = useRef<(() => void) | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tx, setTx] = useState<Hex | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('canarydrop/demo', demo ? '1' : '0');
  }, [demo]);

  // Load or init desk ECDH key
  useEffect(() => {
    (async () => {
      try {
        const raw = localStorage.getItem(DESK_KEY_STORE);
        if (raw) {
          setPriv(await importPrivJwk(JSON.parse(raw)));
        }
      } catch (e) {
        console.warn('Failed to import stored desk key', e);
      }
    })();
  }, []);

  const connect = useCallback(async () => {
    setErr(null);
    if (!window.ethereum) {
      setErr('MetaMask not found');
      return;
    }
    try {
      try {
        await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_ID_HEX }] });
      } catch (e: any) {
        if (e?.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: CHAIN_ID_HEX,
                chainName: 'Arkiv Tiramisu Testnet',
                rpcUrls: ['https://rpc.tiramisu.db-chain.testnet.arkiv.network'],
                nativeCurrency: { name: 'GLM', symbol: 'GLM', decimals: 18 },
                blockExplorerUrls: ['https://hub.arkiv.network/tiramisu'],
              },
            ],
          });
        } else {
          throw e;
        }
      }
      const [addr] = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[];
      setConnected(addr as Hex);
      setCreator(demo ? (process.env.NEXT_PUBLIC_DESK_ADDRESS as Hex | null) : (addr as Hex));
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    }
  }, [demo]);

  // Load current desk by creator
  useEffect(() => {
    (async () => {
      if (!creator) return;
      try {
        const d = await getDesk(creator);
        if (d) {
          setDeskKey(d.key);
          setCanaryKey(null); // unknown until next query
          const c = await canaryAlive(creator, d.key);
          if (c) setCanaryKey(c.key);
          setAlive(!!c);
          // start live inbox
          if (unwatchRef.current) unwatchRef.current();
          unwatchRef.current = watchInbox(d.key, (k) => {
            loadTip(k);
          });
        } else {
          setDeskKey(null);
          setAlive(null);
        }
      } catch (e: any) {
        setErr(String(e?.message ?? e));
      }
    })();
    // cleanup watcher
    return () => {
      if (unwatchRef.current) unwatchRef.current();
    };
  }, [creator]);

  async function generateDeskKey() {
    const kp = await newKeyPair();
    const jwk = await exportPrivJwk(kp.privateKey);
    localStorage.setItem(DESK_KEY_STORE, JSON.stringify(jwk));
    setPriv(kp.privateKey);
  }
  async function downloadDeskKey() {
    if (!priv) return;
    const jwk = await exportPrivJwk(priv);
    const blob = new Blob([JSON.stringify(jwk, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'canarydrop-desk-key.json';
    a.click();
    URL.revokeObjectURL(url);
  }
  async function importDeskKey(file: File) {
    const text = await file.text();
    const jwk = JSON.parse(text);
    const k = await importPrivJwk(jwk);
    localStorage.setItem(DESK_KEY_STORE, JSON.stringify(jwk));
    setPriv(k);
  }

  async function createDeskFlow() {
    setBusy(true);
    setErr(null);
    setTx(null);
    try {
      if (!priv) throw new Error('Generate or import a desk key first');
      // The public key for priv is not derivable in WebCrypto. Generate a fresh pair and replace priv with it.
      const pair = await newKeyPair();
      const pubRaw = await exportPub(pair.publicKey);
      const jwk = await exportPrivJwk(pair.privateKey);
      localStorage.setItem(DESK_KEY_STORE, JSON.stringify(jwk));
      setPriv(pair.privateKey);

      if (demo) {
        const r = await fetch('/api/demo/desk/create', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: deskName, deskPubRawB64: Buffer.from(pubRaw).toString('base64') }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error ?? 'failed');
        setTx(j.txHash);
      } else {
        if (!connected) await connect();
        if (!window.ethereum) throw new Error('No wallet');
        const w = createWalletClient({ chain: tiramisu, transport: custom(window.ethereum as any) });
        const owner = (await (window.ethereum as any).request({ method: 'eth_accounts' }))[0] as Hex;
        const { createDesk } = await import('@/lib/arkiv');
        const out = await createDesk(w as any, owner, deskName, pubRaw);
        setTx(out.txHash);
      }
      // refresh creator-bound view
      if (creator) {
        const d = await getDesk(creator);
        if (d) {
          setDeskKey(d.key);
          const c = await canaryAlive(creator, d.key);
          setCanaryKey(c?.key ?? null);
          setAlive(!!c);
        }
      }
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function renewFlow() {
    if (!deskKey || !canaryKey) return;
    setBusy(true);
    setErr(null);
    setTx(null);
    try {
      if (demo) {
        const r = await fetch('/api/demo/desk/renew', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ deskKey, canaryKey }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error ?? 'failed');
        setTx(j.txHash);
      } else {
        if (!connected) await connect();
        const w = createWalletClient({ chain: tiramisu, transport: custom((window as any).ethereum) });
        const out = await renew(w as any, deskKey, canaryKey);
        setTx(out.txHash);
      }
      if (creator) setAlive(!!(await canaryAlive(creator, deskKey)));
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function loadTip(entityKey: Hex) {
    try {
      const e = await pub.getEntity(entityKey);
      const wire = new Uint8Array(e.payload!);
      if (!priv) return;
      const { text, ephPub } = await openAsDesk(priv, wire);
      setTips((old) => {
        const next = [...old, { key: entityKey, createdAt: e.createdAt!, text, ephPub }];
        next.sort((a, b) => Number(a.createdAt - b.createdAt));
        return next;
      });
    } catch (e) {
      console.error('Failed to open tip', e);
    }
  }

  async function sendReply(t: TipView) {
    try {
      if (!t.replyText || !deskKey) return;
      if (demo) {
        const w = await sealReply(priv!, t.ephPub, t.replyText);
        const r = await fetch('/api/demo/reply', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ tipKey: t.key, wireB64: Buffer.from(w).toString('base64') }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error ?? 'failed');
        setTx(j.txHash);
      } else {
        if (!connected) await connect();
        const w = createWalletClient({ chain: tiramisu, transport: custom((window as any).ethereum) });
        const wire = await sealReply(priv!, t.ephPub, t.replyText);
        const out = await reply(w as any, t.key, wire);
        setTx(out.txHash);
      }
      // Clear
      setTips((arr) => arr.map((x) => (x.key === t.key ? { ...x, replyText: '' } : x)));
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    }
  }

  return (
    <div className="container">
      <video className="art" autoPlay muted loop playsInline preload="auto" aria-hidden="true" poster={POSTER} src={VIDEO} />
      <div className="veil" />
      <header className="header">
        <Link className="brand" href="/">
          CANARYDROP
        </Link>
        <div style={{ display: 'flex', gap: 12 }}>
          <label className="badge" title="Server-signed testnet demo — no wallet extension required.">
            <input
              type="checkbox"
              checked={demo}
              onChange={(e) => setDemo(e.target.checked)}
              style={{ accentColor: '#69e3ff', marginRight: 8 }}
            />
            Demo mode
          </label>
          {!demo && (
            <button className="cta secondary" onClick={connect}>
              {connected ? `Wallet: ${connected.slice(0, 6)}…${connected.slice(-4)}` : 'Connect MetaMask'}
            </button>
          )}
        </div>
      </header>
      <main className="hero">
        <div style={{ width: '100%', maxWidth: 980 }}>
          <h1 className="title">Desk</h1>
          <p className="sub">
            Create the newsroom desk (a P‑256 encryption key) and a daily warrant canary. The inbox updates live and decrypts in
            your browser.
          </p>

          <div className="ctaRow" style={{ marginTop: 16 }}>
            <button className="cta" onClick={generateDeskKey}>
              Generate desk key
            </button>
            <label className="cta secondary" style={{ cursor: 'pointer' }}>
              Import key
              <input
                type="file"
                accept="application/json"
                onChange={(e) => e.target.files?.[0] && importDeskKey(e.target.files[0])}
                style={{ display: 'none' }}
              />
            </label>
            <button className="cta secondary" onClick={downloadDeskKey} disabled={!priv}>
              Download backup
            </button>
          </div>

          <div style={{ marginTop: 18 }}>
            <label className="badge" style={{ display: 'block', marginBottom: 8 }}>
              Desk name
            </label>
            <input
              value={deskName}
              onChange={(e) => setDeskName(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(8,12,18,.45)',
                border: '1px solid rgba(160,190,210,.35)',
                color: 'var(--ink)',
                borderRadius: 12,
                padding: 12,
                outline: 'none',
              }}
            />
          </div>

          <div className="ctaRow" style={{ marginTop: 12 }}>
            <button className="cta" onClick={createDeskFlow} disabled={busy || !priv}>
              <span className="dot" />
              {busy ? 'Working…' : 'Create desk + canary'}
            </button>
            <button className="cta secondary" onClick={renewFlow} disabled={!deskKey || !canaryKey || busy}>
              Renew today’s canary
            </button>
          </div>

          <div style={{ marginTop: 16 }}>
            <p className="sub">
              Creator: <code>{creator ?? '—'}</code> · Desk: <code>{deskKey ?? '—'}</code> · Canary:{' '}
              <code>{canaryKey ?? '—'}</code> · Status:{' '}
              {alive === null ? (
                'unknown'
              ) : alive ? (
                <span style={{ color: '#7ae6ff' }}>ALIVE</span>
              ) : (
                <span style={{ color: '#ffb048' }}>DEAD</span>
              )}
            </p>
          </div>

          <hr style={{ opacity: 0.2, margin: '16px 0' }} />

          <h2 className="sub" style={{ fontSize: 18, marginBottom: 8 }}>
            Inbox
          </h2>
          {tips.length === 0 ? (
            <p className="sub">No tips yet. This view updates live.</p>
          ) : (
            <ul style={{ padding: 0 }}>
              {tips.map((t) => (
                <li key={t.key} style={{ listStyle: 'none', marginBottom: 14 }}>
                  <div
                    style={{
                      background: 'rgba(8,12,18,.45)',
                      border: '1px solid rgba(160,190,210,.35)',
                      color: 'var(--ink)',
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 6 }}>
                      <code>{t.key}</code>
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{t.text}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <input
                        value={t.replyText ?? ''}
                        onChange={(e) =>
                          setTips((arr) => arr.map((x) => (x.key === t.key ? { ...x, replyText: e.target.value } : x)))
                        }
                        placeholder="Write a reply…"
                        style={{
                          flex: 1,
                          background: 'rgba(8,12,18,.45)',
                          border: '1px solid rgba(160,190,210,.35)',
                          color: 'var(--ink)',
                          borderRadius: 10,
                          padding: 10,
                          outline: 'none',
                        }}
                      />
                      <button className="cta" onClick={() => sendReply(t)}>
                        Send reply
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {tx && (
            <div style={{ marginTop: 10 }}>
              <a className="cta secondary" href={`https://hub.arkiv.network/tiramisu/tx/${tx}`} target="_blank" rel="noreferrer">
                Tx: {tx.slice(0, 8)}…{tx.slice(-6)}
              </a>
            </div>
          )}
          {err && (
            <p className="sub" style={{ color: '#ffb048', marginTop: 10 }}>
              {err}
            </p>
          )}
        </div>
      </main>
      <footer className="footer">
        Demo mode signs transactions on the server using testnet-only keys. Never enable in production.
      </footer>
    </div>
  );
}

