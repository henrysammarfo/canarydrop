'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
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
import { connectTiramisu, existingAccount } from '@/lib/wallet';
import { shortHex } from '@/lib/chain';
import { useToast } from '@/components/Toast';

export type TipView = {
  key: Hex;
  createdAt: bigint;
  text: string;
  ephPub: CryptoKey;
  replyText?: string;
};

const DESK_KEY_STORE = 'canarydrop/deskPrivJwk';
type DemoKey = { jwk: JsonWebKey; pub: Uint8Array };
type ConfirmKind = 'renew' | 'clear' | null;

export type DeskContextValue = {
  demo: boolean;
  setDemo: (v: boolean) => void;
  creator: Hex | null;
  connected: Hex | null;
  deskName: string;
  setDeskName: (v: string) => void;
  deskKey: Hex | null;
  canaryKey: Hex | null;
  alive: boolean | null;
  priv: CryptoKey | null;
  tips: TipView[];
  setTips: Dispatch<SetStateAction<TipView[]>>;
  busy: boolean;
  tx: Hex | null;
  confirm: ConfirmKind;
  setConfirm: (v: ConfirmKind) => void;
  inboxCursor: string | undefined;
  inboxBlock: bigint | undefined;
  loadingInbox: boolean;
  skippedTips: number;
  demoKey: DemoKey | null;
  pubMatch: boolean | null;
  createdNotice: string | null;
  connect: () => Promise<void>;
  loadHistory: (key: Hex, deskPriv: CryptoKey, cursor?: string, atBlock?: bigint) => Promise<void>;
  generateDeskKey: () => Promise<void>;
  downloadDeskKey: () => Promise<void>;
  importDeskKey: (file: File) => Promise<void>;
  clearKeys: () => void;
  createDeskFlow: (dryRun?: boolean) => Promise<void>;
  renewFlow: (dryRun?: boolean) => Promise<void>;
  sendReply: (t: TipView) => Promise<void>;
};

const DeskContext = createContext<DeskContextValue | null>(null);

export function useDesk() {
  const ctx = useContext(DeskContext);
  if (!ctx) throw new Error('useDesk must be used inside DeskProvider');
  return ctx;
}

export default function DeskProvider({ children }: { children: ReactNode }) {
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
  const [confirm, setConfirm] = useState<ConfirmKind>(null);
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
    async function syncWallet() {
      const a = await existingAccount();
      if (!a) return;
      setConnected(a as Hex);
      if (!demo) setCreator(a as Hex);
    }
    void syncWallet();
    const onWallet = () => {
      void syncWallet();
    };
    window.addEventListener('canarydrop-wallet', onWallet);
    return () => window.removeEventListener('canarydrop-wallet', onWallet);
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
            // Keep the receipt keys.
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
          // Keep the receipt keys.
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

  const value: DeskContextValue = {
    demo,
    setDemo,
    creator,
    connected,
    deskName,
    setDeskName,
    deskKey,
    canaryKey,
    alive,
    priv,
    tips,
    setTips,
    busy,
    tx,
    confirm,
    setConfirm,
    inboxCursor,
    inboxBlock,
    loadingInbox,
    skippedTips,
    demoKey,
    pubMatch,
    createdNotice,
    connect,
    loadHistory,
    generateDeskKey,
    downloadDeskKey,
    importDeskKey,
    clearKeys,
    createDeskFlow,
    renewFlow,
    sendReply,
  };

  return <DeskContext.Provider value={value}>{children}</DeskContext.Provider>;
}
