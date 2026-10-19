'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Hex } from 'viem';
import {
  canaryAlive,
  createDesk,
  getDesk,
  inboxPage,
  type CanaryRow,
  type DeskRow,
  pub,
  renew,
  reply,
  walletFromProvider,
  watchInbox,
} from '@/lib/arkiv';
import { bytesEqual, bytesToB64 } from '@/lib/bytes';
import { appFetch } from '@/lib/client-fetch';
import { DEFAULT_DESK } from '@/lib/constants';
import {
  exportPrivJwk,
  exportPub,
  importPrivJwk,
  jwkToUncompressed,
  newKeyPair,
  openAsDesk,
  sealReply,
} from '@/lib/crypto';
import { asAddress } from '@/lib/hex';
import { getInjectedProvider } from '@/lib/injected';
import {
  createdDeskAndCanary,
  DESK_CREATED_NOTICE,
  DESK_CREATED_TOAST,
  fetchedDeskIsReady,
} from '@/lib/desk-pick';
import { bumpGeneration, isStaleGeneration } from '@/lib/load-gen';
import { deskPubBytes, parseDeskPayload } from '@/lib/payload';
import { uiError } from '@/lib/ui-error';
import { connectTiramisu } from '@/lib/wallet';
import { shortHex, txUrl } from '@/lib/chain';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';

type TipView = {
  key: Hex;
  createdAt: bigint;
  text: string;
  ephPub: CryptoKey;
  replyText?: string;
};

const DESK_KEY_STORE = 'canarydrop/deskPrivJwk';

type DemoKey = { jwk: JsonWebKey; pub: Uint8Array };

export default function DeskPage() {
  const push = useToast();
  const [demo, setDemo] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('canarydrop/demo') === '1';
  });
  const [creator, setCreator] = useState<Hex | null>(() => asAddress(process.env.NEXT_PUBLIC_DESK_ADDRESS || '', DEFAULT_DESK));
  const [connected, setConnected] = useState<Hex | null>(null);
  const [deskName, setDeskName] = useState('CanaryDrop Demo Desk');
  const [deskKey, setDeskKey] = useState<Hex | null>(null);
  const [canaryKey, setCanaryKey] = useState<Hex | null>(null);
  const [alive, setAlive] = useState<boolean | null>(null);
  const [priv, setPriv] = useState<CryptoKey | null>(null);
  const [tips, setTips] = useState<TipView[]>([]);
  const unwatchRef = useRef<(() => void) | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [tx, setTx] = useState<Hex | null>(null);
  const [tab, setTab] = useState<'inbox' | 'canary' | 'keys' | 'settings'>('inbox');
  const [confirm, setConfirm] = useState<null | 'renew' | 'clear'>(null);
  const [inboxCursor, setInboxCursor] = useState<string | undefined>(undefined);
  const [inboxBlock, setInboxBlock] = useState<bigint | undefined>(undefined);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [skippedTips, setSkippedTips] = useState(0);
  const [demoKey, setDemoKey] = useState<DemoKey | null>(null);
  const [pubMatch, setPubMatch] = useState<boolean | null>(null);
  const [createdNotice, setCreatedNotice] = useState<string | null>(null);
  const seenTips = useRef(new Set<string>());
  const deskLoad = useRef({ current: 0 });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('canarydrop/demo', demo ? '1' : '0');
  }, [demo]);

  useEffect(() => {
    if (demo) return;
    (async () => {
      try {
        const raw = localStorage.getItem(DESK_KEY_STORE);
        if (raw) setPriv(await importPrivJwk(JSON.parse(raw) as JsonWebKey));
      } catch {
        push({ kind: 'error', text: 'Could not open the desk key stored in this browser.' });
      }
    })();
  }, [demo, push]);

  useEffect(() => {
    if (!demo) {
      setDemoKey(null);
      return;
    }
    (async () => {
      try {
        const r = await appFetch('/api/demo/desk/key');
        const j = (await r.json()) as { jwk?: JsonWebKey; pubB64?: string; message?: string };
        if (!r.ok || !j.jwk) throw new Error(j.message ?? 'Demo mode could not load the shared desk key.');
        const k = await importPrivJwk(j.jwk);
        setPriv(k);
        setDemoKey({ jwk: j.jwk, pub: jwkToUncompressed(j.jwk) });
        setCreator(asAddress(process.env.NEXT_PUBLIC_DESK_ADDRESS || '', DEFAULT_DESK));
        push({ kind: 'success', text: 'Demo mode loaded the shared desk key for this browser.' });
      } catch (e: unknown) {
        push({ kind: 'error', text: uiError(e) });
      }
    })();
  }, [demo, push]);

  const connect = useCallback(async () => {
    const result = await connectTiramisu();
    if ('error' in result) {
      push({ kind: 'error', text: result.error });
      return;
    }
    setConnected(result.address as Hex);
    setCreator(demo ? asAddress(process.env.NEXT_PUBLIC_DESK_ADDRESS || '', DEFAULT_DESK) : (result.address as Hex));
    push({ kind: 'success', text: `Wallet connected ${shortHex(result.address)}` });
  }, [demo, push]);

  async function ingestTip(entityKey: Hex, wire: Uint8Array, createdAt: bigint, deskPriv: CryptoKey) {
    if (seenTips.current.has(entityKey)) return;
    try {
      const { text, ephPub } = await openAsDesk(deskPriv, wire);
      seenTips.current.add(entityKey);
      setTips((old) => {
        const next = [...old, { key: entityKey, createdAt, text, ephPub }];
        next.sort((a, b) => Number(b.createdAt - a.createdAt));
        return next;
      });
    } catch {
      setSkippedTips((n) => n + 1);
    }
  }

  async function loadHistory(key: Hex, deskPriv: CryptoKey, cursor?: string, atBlock?: bigint) {
    setLoadingInbox(true);
    try {
      const opts: { cursor?: string; atBlock?: bigint } = {};
      if (cursor) opts.cursor = cursor;
      if (atBlock !== undefined) opts.atBlock = atBlock;
      const page = await inboxPage(key, opts);
      for (const row of page.entities) {
        if (row.key && row.payload) await ingestTip(row.key, row.payload, row.createdAt ?? 0n, deskPriv);
      }
      setInboxCursor(page.hasNextPage() ? page.cursor : undefined);
      setInboxBlock(page.blockNumber);
    } catch (e: unknown) {
      push({ kind: 'error', text: uiError(e) });
    } finally {
      setLoadingInbox(false);
    }
  }

  function startWatch(dKey: Hex, cKey: Hex | null) {
    if (unwatchRef.current) unwatchRef.current();
    unwatchRef.current = watchInbox(dKey, {
      onTip: (k) => {
        void loadTip(k);
      },
      onExpiry: (k) => {
        if (cKey && k === cKey) setAlive(true);
      },
      onSealed: () => {
        push({ kind: 'info', text: 'A tip for this desk was sealed to the burn address.' });
      },
      onPatched: () => {
        push({ kind: 'info', text: 'A tip for this desk was patched. Sealed tips should never patch.' });
      },
      onDeleted: (k) => {
        push({ kind: 'info', text: `A tip for this desk was deleted ${shortHex(k)}.` });
      },
      onError: () => {
        if (priv) void loadHistory(dKey, priv);
      },
    });
  }

  function applyFetchedDesk(d: DeskRow, c: CanaryRow | null) {
    setDeskKey(d.key);
    setCanaryKey(c?.key ?? null);
    setAlive(!!c);
    const payload = d.payload ? parseDeskPayload(d.payload) : null;
    if (demoKey) {
      setPubMatch(payload ? bytesEqual(deskPubBytes(payload), demoKey.pub) : false);
    } else {
      setPubMatch(null);
    }
    if (d.key) startWatch(d.key, c?.key ?? null);
  }

  async function refreshDeskFromChain(preferPub?: Uint8Array, expectedKey?: Hex) {
    if (!creator) return;
    const started = bumpGeneration(deskLoad.current);
    for (let i = 0; i < 8; i++) {
      if (isStaleGeneration(started, deskLoad.current.current)) return;
      const d = await getDesk(creator, preferPub);
      if (d && fetchedDeskIsReady(d, preferPub, expectedKey)) {
        if (isStaleGeneration(started, deskLoad.current.current)) return;
        const c = await canaryAlive(creator, d.key);
        if (isStaleGeneration(started, deskLoad.current.current)) return;
        applyFetchedDesk(d, c);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    // Keep keys adopted from the create receipt. A lagging index must not restore the old desk.
    if (expectedKey) return;
    if (isStaleGeneration(started, deskLoad.current.current)) return;
    const d = await getDesk(creator, preferPub);
    if (!d || isStaleGeneration(started, deskLoad.current.current)) return;
    const c = await canaryAlive(creator, d.key);
    if (isStaleGeneration(started, deskLoad.current.current)) return;
    applyFetchedDesk(d, c);
  }

  useEffect(() => {
    const started = bumpGeneration(deskLoad.current);
    (async () => {
      if (!creator) return;
      if (demo && !demoKey) return;
      try {
        const d = await getDesk(creator, demoKey?.pub);
        if (isStaleGeneration(started, deskLoad.current.current)) return;
        if (d) {
          const c = await canaryAlive(creator, d.key);
          if (isStaleGeneration(started, deskLoad.current.current)) return;
          applyFetchedDesk(d, c);
        } else {
          setDeskKey(null);
          setCanaryKey(null);
          setAlive(null);
          setPubMatch(demoKey ? false : null);
        }
      } catch (e: unknown) {
        if (isStaleGeneration(started, deskLoad.current.current)) return;
        push({ kind: 'error', text: uiError(e) });
      }
    })();
    return () => {
      bumpGeneration(deskLoad.current);
      if (unwatchRef.current) unwatchRef.current();
    };
  }, [creator, demo, demoKey, push, priv]);

  useEffect(() => {
    if (!deskKey || !priv) return;
    seenTips.current.clear();
    setTips([]);
    setSkippedTips(0);
    void loadHistory(deskKey, priv);
  }, [deskKey, priv]);

  async function generateDeskKey() {
    const kp = await newKeyPair();
    const jwk = await exportPrivJwk(kp.privateKey);
    localStorage.setItem(DESK_KEY_STORE, JSON.stringify(jwk));
    setPriv(kp.privateKey);
    push({ kind: 'success', text: 'Desk key generated and stored in this browser.' });
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
    push({ kind: 'info', text: 'Desk key backup downloaded.' });
  }
  async function importDeskKey(file: File) {
    try {
      const jwk = JSON.parse(await file.text()) as JsonWebKey;
      const k = await importPrivJwk(jwk);
      localStorage.setItem(DESK_KEY_STORE, JSON.stringify(jwk));
      setPriv(k);
      push({ kind: 'success', text: 'Desk key imported.' });
    } catch (e: unknown) {
      push({ kind: 'error', text: uiError(e) });
    }
  }
  function clearKeys() {
    localStorage.removeItem(DESK_KEY_STORE);
    setPriv(null);
    setConfirm(null);
    push({ kind: 'success', text: 'Desk keys cleared from this browser.' });
  }

  async function createDeskFlow(dryRun = false) {
    setBusy(true);
    setTx(null);
    try {
      if (!priv && !dryRun && !demo) throw new Error('Generate or import a desk key first');
      if (demo && !demoKey) throw new Error('Demo mode is still loading the shared desk key.');
      let pubRaw: Uint8Array;
      if (demo && demoKey) {
        pubRaw = demoKey.pub;
      } else {
        const pair = await newKeyPair();
        pubRaw = await exportPub(pair.publicKey);
        if (!dryRun) {
          const jwk = await exportPrivJwk(pair.privateKey);
          localStorage.setItem(DESK_KEY_STORE, JSON.stringify(jwk));
          setPriv(pair.privateKey);
        }
      }

      if (demo || dryRun) {
        const r = await appFetch(`/api/demo/desk/create${dryRun ? '?dryRun=1' : ''}`, {
          method: 'POST',
          body: JSON.stringify({ name: deskName, deskPubRawB64: bytesToB64(pubRaw) }),
        });
        const j = (await r.json()) as {
          message?: string;
          error?: string;
          predicted?: string[];
          txHash?: Hex;
          created?: unknown;
        };
        if (!r.ok) throw new Error(j.message ?? j.error ?? 'failed');
        if (dryRun) {
          push({ kind: 'info', text: `Dry run ok. Predicted keys ${Array.isArray(j.predicted) ? j.predicted.join(', ') : 'ready'}.` });
        } else {
          if (j.txHash) setTx(j.txHash);
          const hinted = createdDeskAndCanary(j.created);
          bumpGeneration(deskLoad.current);
          if (hinted.deskKey) {
            setDeskKey(hinted.deskKey);
            setCanaryKey(hinted.canaryKey ?? null);
            setAlive(true);
            startWatch(hinted.deskKey, hinted.canaryKey ?? null);
          }
          if (demoKey) setPubMatch(true);
          setCreatedNotice(DESK_CREATED_NOTICE);
          push({ kind: 'success', text: DESK_CREATED_TOAST });
          try {
            if (creator) await refreshDeskFromChain(demoKey?.pub, hinted.deskKey);
          } catch {
            // Keep the receipt keys. The index can catch up on the next load.
          }
        }
      } else {
        if (!connected) await connect();
        const provider = getInjectedProvider();
        if (!provider) throw new Error('No wallet found. Install MetaMask, or use Demo mode on the desk.');
        const w = walletFromProvider(provider);
        const accounts = (await provider.request({ method: 'eth_accounts' })) as unknown;
        const owner = Array.isArray(accounts) && typeof accounts[0] === 'string' ? (accounts[0] as Hex) : null;
        if (!owner) throw new Error('No account returned by the wallet.');
        const out = await createDesk(w, owner, deskName, pubRaw);
        setTx(out.txHash);
        const hinted = createdDeskAndCanary(out.createdEntities);
        bumpGeneration(deskLoad.current);
        if (hinted.deskKey) {
          setDeskKey(hinted.deskKey);
          setCanaryKey(hinted.canaryKey ?? null);
          setAlive(true);
          startWatch(hinted.deskKey, hinted.canaryKey ?? null);
        }
        setCreatedNotice(DESK_CREATED_NOTICE);
        push({ kind: 'success', text: DESK_CREATED_TOAST });
        try {
          if (creator) await refreshDeskFromChain(undefined, hinted.deskKey);
        } catch {
          // Keep the receipt keys. The index can catch up on the next load.
        }
      }
    } catch (e: unknown) {
      push({ kind: 'error', text: uiError(e) });
    } finally {
      setBusy(false);
    }
  }

  async function renewFlow(dryRun = false) {
    if (!deskKey || !canaryKey) return;
    setBusy(true);
    setTx(null);
    try {
      if (demo || dryRun) {
        const r = await appFetch(`/api/demo/desk/renew${dryRun ? '?dryRun=1' : ''}`, {
          method: 'POST',
          body: JSON.stringify({ deskKey, canaryKey }),
        });
        const j = (await r.json()) as { message?: string; error?: string; txHash?: Hex };
        if (!r.ok) throw new Error(j.message ?? j.error ?? 'failed');
        if (dryRun) {
          push({ kind: 'info', text: 'Dry run ok. Lifetime extension was not sent.' });
        } else {
          if (j.txHash) setTx(j.txHash);
          push({ kind: 'success', text: 'Canary renewed.' });
        }
      } else {
        if (!connected) await connect();
        const provider = getInjectedProvider();
        if (!provider) throw new Error('No wallet found. Install MetaMask, or use Demo mode on the desk.');
        const w = walletFromProvider(provider);
        const out = await renew(w, deskKey, canaryKey);
        setTx(out.txHash);
        push({ kind: 'success', text: 'Canary renewed.' });
      }
      if (creator && !dryRun) setAlive(!!(await canaryAlive(creator, deskKey)));
    } catch (e: unknown) {
      push({ kind: 'error', text: uiError(e) });
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  async function loadTip(entityKey: Hex) {
    try {
      const e = await pub().getEntity(entityKey);
      const wire = new Uint8Array(e.payload ?? new Uint8Array());
      if (!priv) return;
      await ingestTip(entityKey, wire, e.createdAt ?? 0n, priv);
    } catch {
      setSkippedTips((n) => n + 1);
    }
  }

  async function sendReply(t: TipView) {
    try {
      if (!t.replyText || !deskKey) return;
      if (!priv) throw new Error('Load a desk key first.');
      if (demo) {
        const w = await sealReply(priv, t.ephPub, t.replyText);
        const r = await appFetch('/api/demo/reply', {
          method: 'POST',
          body: JSON.stringify({ tipKey: t.key, wireB64: bytesToB64(w) }),
        });
        const j = (await r.json()) as { message?: string; error?: string; txHash?: Hex };
        if (!r.ok) throw new Error(j.message ?? j.error ?? 'failed');
        if (j.txHash) setTx(j.txHash);
      } else {
        if (!connected) await connect();
        const provider = getInjectedProvider();
        if (!provider) throw new Error('No wallet found. Install MetaMask, or use Demo mode on the desk.');
        const w = walletFromProvider(provider);
        const wire = await sealReply(priv, t.ephPub, t.replyText);
        const out = await reply(w, t.key, wire, deskKey);
        setTx(out.txHash);
      }
      setTips((arr) => arr.map((x) => (x.key === t.key ? { ...x, replyText: '' } : x)));
      push({ kind: 'success', text: 'Reply sent.' });
    } catch (e: unknown) {
      push({ kind: 'error', text: uiError(e) });
    }
  }

  return (
    <>
      <header className="section" style={{ paddingBottom: 0 }}>
        <div className="wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <p className="kicker">Newsroom</p>
            <h1 className="h2" style={{ margin: 0 }}>Newsroom desk</h1>
            <p className="muted" style={{ marginTop: 6 }}>Create your desk, keep the canary alive, and read locked tips.</p>
          </div>
          <label className="badge" title="Server signed testnet demo. Never enable in production.">
            <input
              type="checkbox"
              checked={demo}
              onChange={(e) => setDemo(e.target.checked)}
              style={{ accentColor: '#f5d24a', marginRight: 8 }}
            />
            Demo mode
          </label>
        </div>
      </header>
      <div className="section" style={{ paddingTop: 'var(--space-2)' }}>
        <div className="wrap">
          {createdNotice && !demo && (
            <div className="page-note" role="status" style={{ marginBottom: 16 }}>
              {createdNotice}
            </div>
          )}
          {demo && (
            <div className="page-note" style={{ marginBottom: 16 }}>
              Demo mode is on. This browser loads a shared testnet desk key so a judge can open tips without the original laptop. Do not use this for a real newsroom.
              {createdNotice && (
                <div style={{ marginTop: 8 }} role="status">
                  {createdNotice}
                </div>
              )}
              {deskKey && pubMatch === false && !createdNotice && (
                <div style={{ marginTop: 8 }}>
                  The live desk still has an older public key. Press Create demo desk so new tips match this browser.
                  <div className="ctaRow" style={{ justifyContent: 'flex-start', marginTop: 10 }}>
                    <button className="btn primary" type="button" onClick={() => void createDeskFlow(false)} disabled={busy || !demoKey}>
                      {busy ? 'Working' : 'Create demo desk'} <span className="arrow" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
              {pubMatch === true && <div style={{ marginTop: 8 }}>The live desk matches the shared demo key. New tips will open here.</div>}
              {demo && !deskKey && demoKey && (
                <div style={{ marginTop: 8 }}>
                  No live demo desk yet. Press Create demo desk. The server wallet publishes the shared public key.
                  <div className="ctaRow" style={{ justifyContent: 'flex-start', marginTop: 10 }}>
                    <button className="btn primary" type="button" onClick={() => void createDeskFlow(false)} disabled={busy}>
                      {busy ? 'Working' : 'Create demo desk'} <span className="arrow" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {!demo && !connected && (
            <div className="card" style={{ textAlign: 'center', padding: '32px', marginBottom: 16 }}>
              <h2 className="h2">Choose how to run the desk</h2>
              <p className="lead">Connect a wallet to own your entities, or use Demo mode for judges without a wallet.</p>
              <div className="ctaRow" style={{ justifyContent: 'center', marginTop: 12 }}>
                <button className="btn primary" onClick={connect}>Connect wallet <span className="arrow" aria-hidden="true" /></button>
                <button className="btn" onClick={() => setDemo(true)}>Use Demo mode</button>
              </div>
            </div>
          )}
          <div className="grid cols-3">
            <div className="card">
              <strong>Canary</strong>
              <div className="muted" style={{ marginTop: 6 }}>
                {alive === null ? 'No canary yet. Create your desk to start one.' : alive ? 'ALIVE' : 'GONE'}
              </div>
              <div className="ctaRow" style={{ justifyContent: 'flex-start', marginTop: 10 }}>
                <button className="btn primary" onClick={() => setConfirm('renew')} disabled={!deskKey || !canaryKey || busy}>
                  Renew canary <span className="arrow" aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="card">
              <strong>Desk</strong>
              <div className="muted" style={{ marginTop: 6 }}>
                Creator <code>{creator ?? 'Not set'}</code>
                <br />
                Desk key <code>{deskKey ?? 'Not set'}</code>
              </div>
            </div>
            <div className="card">
              <strong>Next steps</strong>
              <ol className="muted" style={{ marginTop: 6, paddingLeft: 16 }}>
                <li>Generate your desk keys, or turn on Demo mode</li>
                <li>Create your desk and first canary</li>
                <li>Share your public tip link</li>
              </ol>
            </div>
          </div>

          <div className="tabs" style={{ marginTop: 18 }}>
            {(['inbox', 'canary', 'keys', 'settings'] as const).map((k) => (
              <button
                key={k}
                type="button"
                className={`btn ${tab === k ? 'primary' : ''}`}
                onClick={() => setTab(k)}
                aria-pressed={tab === k}
              >
                {k}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 18 }}>
            <div className="card" style={{ marginBottom: 12 }}>
              <strong>Status</strong>
              <div className="muted" style={{ marginTop: 6 }}>
                Creator: <code>{creator ?? 'Not set'}</code> · Desk: <code>{deskKey ?? 'Not set'}</code> · Canary: <code>{canaryKey ?? 'None yet'}</code> ·{' '}
                Status: {alive === null ? 'unknown' : alive ? <span className="status-alive">ALIVE</span> : <span className="status-gone">GONE</span>}
              </div>
            </div>

            {tab === 'inbox' && (
              <div className="card">
                <strong>Inbox</strong>
                <p className="muted" style={{ marginTop: 8 }}>
                  Older tips load from Arkiv. New tips arrive live. {skippedTips > 0 ? `${skippedTips} sealed tips could not be opened with this key.` : ''}
                </p>
                {tips.length === 0 ? (
                  <p className="muted empty-state" style={{ marginTop: 8 }} role="status">
                    {loadingInbox ? 'Loading tips from Arkiv…' : 'No tips yet. This view updates live when a source sends one.'}
                  </p>
                ) : (
                  <ul style={{ padding: 0, marginTop: 12 }}>
                    {tips.map((t) => (
                      <li key={t.key} style={{ listStyle: 'none', marginBottom: 14 }}>
                        <div className="card" style={{ padding: 12 }}>
                          <div className="muted" style={{ marginBottom: 6 }}>
                            <code>{t.key}</code>
                          </div>
                          <div style={{ whiteSpace: 'pre-wrap' }}>{t.text}</div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                            <input
                              value={t.replyText ?? ''}
                              onChange={(e) =>
                                setTips((arr) => arr.map((x) => (x.key === t.key ? { ...x, replyText: e.target.value } : x)))
                              }
                              placeholder="Write a reply"
                            />
                            <button className="btn primary" onClick={() => sendReply(t)}>Send reply <span className="arrow" aria-hidden="true" /></button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="ctaRow" style={{ justifyContent: 'flex-start', marginTop: 12 }}>
                  <button
                    className="btn"
                    type="button"
                    disabled={!inboxCursor || !deskKey || !priv || loadingInbox}
                    onClick={() => deskKey && priv && loadHistory(deskKey, priv, inboxCursor, inboxBlock)}
                  >
                    {loadingInbox ? 'Loading' : 'Load older tips'}
                  </button>
                </div>
              </div>
            )}

            {tab === 'canary' && (
              <div className="card">
                <strong>Canary</strong>
                <div className="muted" style={{ marginTop: 6 }}>Daily lifetime is 26 hours. If it is missing, that is the signal.</div>
                <div className="ctaRow" style={{ justifyContent: 'flex-start', marginTop: 12 }}>
                  <button className="btn primary" onClick={() => setConfirm('renew')} disabled={!deskKey || !canaryKey || busy}>
                    Renew the daily canary <span className="arrow" aria-hidden="true" />
                  </button>
                  <button className="btn" onClick={() => renewFlow(true)} disabled={!deskKey || !canaryKey || busy}>
                    Dry run
                  </button>
                </div>
              </div>
            )}

            {tab === 'keys' && (
              <div className="card">
                <strong>Keys</strong>
                <p className="muted" style={{ marginTop: 6 }}>
                  {demo
                    ? 'Demo mode uses the shared testnet desk key. Press Create demo desk so the public key on Arkiv matches it.'
                    : 'Generate or import the desk key. The private key stays in your browser. Back it up.'}
                </p>
                {!demo && (
                  <div className="ctaRow" style={{ justifyContent: 'flex-start', marginTop: 8 }}>
                    <button className="btn primary" onClick={generateDeskKey}>Generate desk key <span className="arrow" aria-hidden="true" /></button>
                    <label className="btn" style={{ cursor: 'pointer' }}>
                      Import key
                      <input type="file" accept="application/json" onChange={(e) => e.target.files?.[0] && importDeskKey(e.target.files[0])} style={{ display: 'none' }} />
                    </label>
                    <button className="btn" onClick={downloadDeskKey} disabled={!priv}>Download backup</button>
                    <button className="btn" onClick={() => setConfirm('clear')} disabled={!priv}>Clear keys</button>
                  </div>
                )}
                <div style={{ marginTop: 12 }}>
                  <label className="small">Desk name</label>
                  <input value={deskName} onChange={(e) => setDeskName(e.target.value)} />
                </div>
                <div className="ctaRow" style={{ justifyContent: 'flex-start', marginTop: 12 }}>
                  <button className="btn primary" onClick={() => createDeskFlow(false)} disabled={busy || (demo ? !demoKey : !priv)}>
                    {busy ? 'Working' : demo ? 'Create demo desk' : 'Create desk + canary'} <span className="arrow" aria-hidden="true" />
                  </button>
                  <button className="btn" onClick={() => createDeskFlow(true)} disabled={busy}>Dry run</button>
                </div>
              </div>
            )}

            {tab === 'settings' && (
              <div className="card">
                <strong>Settings</strong>
                <p className="muted" style={{ marginTop: 6 }}>Demo mode signs transactions on the server with testnet keys. Never enable it on a real desk.</p>
                <p className="muted" style={{ marginTop: 8 }}>Judges without a wallet should leave Demo mode on. A fresh browser can still open demo tips.</p>
              </div>
            )}

            {tx && (
              <div style={{ marginTop: 10 }}>
                <a className="btn" href={txUrl(tx)} target="_blank" rel="noreferrer">
                  Tx: {shortHex(tx, 8, 6)} <span className="arrow" aria-hidden="true" />
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={confirm === 'renew'}
        title="Renew this canary?"
        confirmLabel="Renew canary"
        busy={busy}
        onClose={() => setConfirm(null)}
        onConfirm={() => renewFlow(false)}
      >
        This extends the canary lifetime by 26 hours and the desk lease by 30 days.
      </Modal>
      <Modal
        open={confirm === 'clear'}
        title="Clear desk keys?"
        confirmLabel="Clear keys"
        onClose={() => setConfirm(null)}
        onConfirm={clearKeys}
      >
        This removes the desk key from this browser. Download a backup first if you still need it.
      </Modal>
    </>
  );
}

