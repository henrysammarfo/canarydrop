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
  const [tab, setTab] = useState<'inbox' | 'canary' | 'keys' | 'settings'>('inbox');

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
      <header className="section" style={{ paddingBottom: 0 }}>
        <div className="wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h1 className="h2" style={{ margin: 0 }}>Newsroom desk</h1>
            <p className="muted" style={{ marginTop: 6 }}>Create your desk, keep the canary alive, and read encrypted tips.</p>
          </div>
          <label className="badge" title="Server-signed testnet demo; never enable in production.">
            <input
              type="checkbox"
              checked={demo}
              onChange={(e) => setDemo(e.target.checked)}
              style={{ accentColor: '#69e3ff', marginRight: 8 }}
            />
            Demo mode
          </label>
        </div>
      </header>
      <main className="section" style={{ paddingTop: 'var(--space-2)' }}>
        <div className="wrap">
          <div className="grid cols-3">
            <div className="card">
              <strong>Canary</strong>
              <div className="muted" style={{ marginTop: 6 }}>
                {alive === null ? 'Unknown' : alive ? 'Alive' : 'Expired'}
              </div>
              <div className="ctaRow" style={{ justifyContent: 'flex-start', marginTop: 10 }}>
                <button className="btn primary" onClick={renewFlow} disabled={!deskKey || !canaryKey || busy}>
                  Renew canary
                </button>
              </div>
            </div>
            <div className="card">
              <strong>Desk</strong>
              <div className="muted" style={{ marginTop: 6 }}>
                Creator <code>{creator ?? '—'}</code>
                <br />
                Desk key <code>{deskKey ?? '—'}</code>
              </div>
            </div>
            <div className="card">
              <strong>Next steps</strong>
              <ol className="muted" style={{ marginTop: 6, paddingLeft: 16 }}>
                <li>Generate your desk keys</li>
                <li>Create your desk and first canary</li>
                <li>Share your public tip link</li>
              </ol>
            </div>
          </div>
          <hr style={{ opacity: 0.2, margin: '16px 0' }} />
          <p className="lead">Operate your newsroom desk. The inbox updates in real time and decrypts on this device.</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {(['inbox','canary','keys','settings'] as const).map(k => (
              <button key={k} className={`btn ${tab===k?'primary':''}`} onClick={()=>setTab(k)}>{k.charAt(0).toUpperCase()+k.slice(1)}</button>
            ))}
          </div>

          <div style={{ marginTop: 18 }}>
            <div className="card" style={{ marginBottom: 12 }}>
              <strong>Status</strong>
              <div className="muted" style={{ marginTop: 6 }}>
                Creator: <code>{creator ?? '—'}</code> · Desk: <code>{deskKey ?? '—'}</code> · Canary: <code>{canaryKey ?? '—'}</code> ·{' '}
                Status: {alive === null ? 'unknown' : alive ? <span style={{ color: '#7ae6ff' }}>ALIVE</span> : <span style={{ color: '#ffb048' }}>DEAD</span>}
              </div>
            </div>

            {tab === 'inbox' && (
              <div className="card">
                <strong>Inbox</strong>
                {tips.length === 0 ? (
                  <p className="muted" style={{ marginTop: 8 }}>No tips yet. This view updates live.</p>
                ) : (
                  <ul style={{ padding: 0, marginTop: 12 }}>
                    {tips.map((t) => (
                      <li key={t.key} style={{ listStyle: 'none', marginBottom: 14 }}>
                        <div className="card" style={{ padding: 12 }}>
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
                            />
                            <button className="btn primary" onClick={() => sendReply(t)}>Send reply</button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {tab === 'canary' && (
              <div className="card">
                <strong>Canary</strong>
                <div className="muted" style={{ marginTop: 6 }}>Daily TTL 26h; absence is the signal.</div>
                <div className="ctaRow" style={{ justifyContent:'flex-start', marginTop: 12 }}>
                  <button className="btn primary" onClick={renewFlow} disabled={!deskKey || !canaryKey || busy}>
                    Renew today’s canary
                  </button>
                </div>
              </div>
            )}

            {tab === 'keys' && (
              <div className="card">
                <strong>Keys</strong>
                <p className="muted" style={{ marginTop: 6 }}>Generate/import the desk’s P‑256 key. The private key stays in your browser; back it up.</p>
                <div className="ctaRow" style={{ justifyContent:'flex-start', marginTop: 8 }}>
                  <button className="btn primary" onClick={generateDeskKey}><span className="dot" />Generate desk key</button>
                  <label className="btn" style={{ cursor: 'pointer' }}>
                    Import key
                    <input type="file" accept="application/json" onChange={(e) => e.target.files?.[0] && importDeskKey(e.target.files[0])} style={{ display: 'none' }} />
                  </label>
                  <button className="btn" onClick={downloadDeskKey} disabled={!priv}>Download backup</button>
                </div>
                <div style={{ marginTop: 12 }}>
                  <label className="small">Desk name</label>
                  <input value={deskName} onChange={(e) => setDeskName(e.target.value)} />
                </div>
                <div className="ctaRow" style={{ justifyContent:'flex-start', marginTop: 12 }}>
                  <button className="btn primary" onClick={createDeskFlow} disabled={busy || !priv}>
                    <span className="dot" />{busy ? 'Working…' : 'Create desk + canary'}
                  </button>
                </div>
              </div>
            )}

            {tab === 'settings' && (
              <div className="card">
                <strong>Settings</strong>
                <p className="muted" style={{ marginTop: 6 }}>Demo mode signs transactions server‑side with testnet keys. Never enable in production.</p>
              </div>
            )}

            {tx && (
              <div style={{ marginTop: 10 }}>
                <a className="btn" href={`https://hub.arkiv.network/tiramisu/tx/${tx}`} target="_blank" rel="noreferrer">
                  Tx: {tx.slice(0, 8)}…{tx.slice(-6)}
                </a>
              </div>
            )}
            {err && <p className="muted" style={{ color: '#ffb048', marginTop: 10 }}>{err}</p>}
          </div>
        </div>
      </main>
      <footer className="footer">
        Demo mode signs transactions on the server using testnet-only keys. Never enable in production.
      </footer>
    </div>
  );
}

