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
  deskAndCanary,
  type CanaryRow,
  type DeskRow,
  pub,
  renew,
  reply,
  walletFromProvider,
  watchInbox,
} from '@/lib/arkiv';
import { canarySignPayload } from '@/lib/canary-sign';
import { extendableHoldKeys, liveHoldKeys, writeDeadDrop } from '@/lib/dead-drop';
import { renewNotice } from '@/lib/renew-ui';
import { DEFAULT_CANARY_STATEMENT, issuedAtNow } from '@/lib/eip712';
import { deskWriteAllowed, restoreSiweSession, saveSiweSession, type SiweSession } from '@/lib/siwe-session';
import { announcementForReply, loadOrCreateStealthMeta } from '@/lib/stealth-store';
import { buildSiweMessage, newsroomSiweFields, verifySiwe } from '@/lib/siwe';
import { bytesEqual, bytesToB64 } from '@/lib/bytes';
import { appFetch } from '@/lib/client-fetch';
import { CHAIN_READ_FAILED, DEFAULT_DESK, ENTITY_KEY_RE } from '@/lib/constants';
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
import { fetchDeskLive, fetchInboxLive, type DeskLiveView } from '@/lib/live-client';
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
  sentReplyKey?: Hex | null;
  sentStealth?: Hex | null;
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
  holdAlive: boolean | null;
  priv: CryptoKey | null;
  tips: TipView[];
  setTips: Dispatch<SetStateAction<TipView[]>>;
  busy: boolean;
  tx: Hex | null;
  txConfirming: boolean;
  confirm: ConfirmKind;
  setConfirm: (v: ConfirmKind) => void;
  inboxCursor: string | undefined;
  inboxBlock: bigint | undefined;
  loadingInbox: boolean;
  skippedTips: number;
  demoKey: DemoKey | null;
  demoKeyError: string | null;
  pubMatch: boolean | null;
  createdNotice: string | null;
  loadingDesk: boolean;
  loadError: string | null;
  staleNote: string | null;
  chainName: string;
  canaryExpiresAt: bigint | null;
  canaryCreatedAt: bigint | null;
  currentBlock: bigint | null;
  blockDuration: number;
  connect: () => Promise<void>;
  loadHistory: (key: Hex, deskPriv: CryptoKey, cursor?: string, atBlock?: bigint) => Promise<void>;
  generateDeskKey: () => Promise<void>;
  downloadDeskKey: () => Promise<void>;
  importDeskKey: (file: File) => Promise<void>;
  clearKeys: () => void;
  createDeskFlow: (dryRun?: boolean) => Promise<void>;
  renewFlow: (dryRun?: boolean) => Promise<void>;
  sendReply: (t: TipView) => Promise<void>;
  sealDropFlow: (title: string, text: string, recipients: { label: string; pub: number[] }[], dryRun?: boolean) => Promise<void>;
  deskDomain: string;
  setDeskDomain: (v: string) => void;
  siweAddress: Hex | null;
  canDeskWrite: boolean;
  signSiwe: () => Promise<void>;
  lastDrop: { dropKey?: Hex | undefined; releaseKey?: Hex | undefined; holdKey?: Hex | undefined; txHash?: Hex | undefined } | null;
  deskPubRaw: Uint8Array | null;
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
  const [deskDomain, setDeskDomain] = useState('');
  const [siweAddress, setSiweAddress] = useState<Hex | null>(null);
  const [lastDrop, setLastDrop] = useState<{
    dropKey?: Hex | undefined;
    releaseKey?: Hex | undefined;
    holdKey?: Hex | undefined;
    txHash?: Hex | undefined;
  } | null>(null);
  const [deskKey, setDeskKey] = useState<Hex | null>(null);
  const [canaryKey, setCanaryKey] = useState<Hex | null>(null);
  const [alive, setAlive] = useState<boolean | null>(null);
  const [holdAlive, setHoldAlive] = useState<boolean | null>(null);
  const [priv, setPriv] = useState<CryptoKey | null>(null);
  const [tips, setTips] = useState<TipView[]>([]);
  const unwatchRef = useRef<(() => void) | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [tx, setTx] = useState<Hex | null>(null);
  const [txConfirming, setTxConfirming] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmKind>(null);
  const [inboxCursor, setInboxCursor] = useState<string | undefined>(undefined);
  const [inboxBlock, setInboxBlock] = useState<bigint | undefined>(undefined);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [skippedTips, setSkippedTips] = useState(0);
  const [demoKey, setDemoKey] = useState<DemoKey | null>(null);
  const [demoKeyError, setDemoKeyError] = useState<string | null>(null);
  const [pubMatch, setPubMatch] = useState<boolean | null>(null);
  const [createdNotice, setCreatedNotice] = useState<string | null>(null);
  const [loadingDesk, setLoadingDesk] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [staleNote, setStaleNote] = useState<string | null>(null);
  const [chainName, setChainName] = useState('CanaryDrop Demo Desk');
  const [canaryExpiresAt, setCanaryExpiresAt] = useState<bigint | null>(null);
  const [canaryCreatedAt, setCanaryCreatedAt] = useState<bigint | null>(null);
  const [currentBlock, setCurrentBlock] = useState<bigint | null>(null);
  const [blockDuration, setBlockDuration] = useState(2);
  const [deskPubRaw, setDeskPubRaw] = useState<Uint8Array | null>(null);
  const seenTips = useRef(new Set<string>());
  const deskLoad = useRef({ current: 0 });
  const privRef = useRef<CryptoKey | null>(null);
  const deskKeyRef = useRef<Hex | null>(null);
  privRef.current = priv;
  deskKeyRef.current = deskKey;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('canarydrop/demo', demo ? '1' : '0');
  }, [demo]);

  useEffect(() => {
    let cancelled = false;
    void restoreSiweSession(window.location.host).then((session) => {
      if (!cancelled && session) setSiweAddress(session.address);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const canDeskWrite = deskWriteAllowed({ creator, signer: siweAddress, demo });

  function requireWriter() {
    if (demo) return;
    if (!deskWriteAllowed({ creator, signer: siweAddress, demo })) {
      throw new Error('Sign in with the desk wallet first. The signer must be the desk creator.');
    }
  }

  async function signSiwe() {
    const eth = getInjectedProvider();
    if (!eth) throw new Error('No wallet found. Connect a wallet first.');
    const address = (connected ?? (await existingAccount())) as Hex | null;
    if (!address) throw new Error('Connect a wallet first.');
    const fields = newsroomSiweFields({
      domain: window.location.host,
      address,
      uri: window.location.origin,
    });
    const message = buildSiweMessage(fields);
    const signature = (await eth.request({
      method: 'personal_sign',
      params: [message, address],
    })) as Hex;
    const checked = await verifySiwe(message, signature);
    if (!checked.ok) throw new Error('That sign in could not be verified.');
    const session: SiweSession = { address: checked.address, message, signature };
    saveSiweSession(session);
    setSiweAddress(checked.address);
    push({ kind: 'success', text: 'Signed in with Ethereum.' });
  }

  async function signCanary(address: Hex) {
    const issuedAt = issuedAtNow();
    const input = { desk: address, statement: DEFAULT_CANARY_STATEMENT, issuedAt };
    const eth = getInjectedProvider();
    if (!eth) throw new Error('No wallet found. Install MetaMask, or use Demo mode on the desk.');
    const payload = canarySignPayload(input);
    const signature = (await eth.request({
      method: 'eth_signTypedData_v4',
      params: [address, JSON.stringify(payload)],
    })) as Hex;
    return { statement: DEFAULT_CANARY_STATEMENT, issuedAt, signature };
  }

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
      setDemoKeyError(null);
      return;
    }
    (async () => {
      setDemoKeyError(null);
      try {
        const r = await appFetch('/api/demo/desk/key');
        const j = (await r.json()) as { jwk?: JsonWebKey; pubB64?: string; message?: string; error?: string };
        if (!r.ok || !j.jwk) {
          if (j.error === 'demo_disabled' || j.error === 'rate_limited' || j.error === 'try_later') {
            setDemoKeyError(
              'The shared desk key is not available right now. Live canary status still loads. Tips cannot be opened here.',
            );
            return;
          }
          throw new Error(j.message ?? 'Demo mode could not load the shared desk key.');
        }
        const k = await importPrivJwk(j.jwk);
        setPriv(k);
        setDemoKey({ jwk: j.jwk, pub: jwkToUncompressed(j.jwk) });
        setCreator(asAddress(process.env.NEXT_PUBLIC_DESK_ADDRESS || '', DEFAULT_DESK));
      } catch (e: unknown) {
        setDemoKeyError(uiError(e));
      }
    })();
  }, [demo]);

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
      const liveOpts: { cursor?: string; atBlock?: bigint } = {};
      if (cursor) liveOpts.cursor = cursor;
      if (atBlock !== undefined) liveOpts.atBlock = atBlock;
      const page = await fetchInboxLive(key, liveOpts);
      if (page.note) setStaleNote(page.note);
      for (const row of page.tips) {
        await ingestTip(row.key, row.payload, row.createdAt, deskPriv);
      }
      setInboxCursor(page.hasMore ? page.cursor : undefined);
      setInboxBlock(page.atBlock);
    } catch {
      // Keep the inbox quiet. A later watch or retry can fill it.
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
        if (privRef.current) void loadHistory(dKey, privRef.current);
      },
    });
  }

  async function refreshHolds(key: Hex | null) {
    if (!key) {
      setHoldAlive(null);
      return;
    }
    try {
      const keys = await liveHoldKeys(key);
      setHoldAlive(keys.length > 0);
    } catch {
      setHoldAlive(null);
    }
  }

  function applyFetchedDesk(d: DeskRow, c: CanaryRow | null) {
    setDeskKey(d.key);
    setCanaryKey(c?.key ?? null);
    setAlive(!!c);
    void refreshHolds(d.key);
    setCanaryExpiresAt(c?.expiresAt ?? null);
    setCanaryCreatedAt(c?.createdAt ?? null);
    const payload = d.payload ? parseDeskPayload(d.payload) : null;
    if (payload?.name) setChainName(payload.name);
    setDeskPubRaw(payload ? deskPubBytes(payload) : null);
    if (d.key) startWatch(d.key, c?.key ?? null);
  }

  function applyLive(live: DeskLiveView) {
    setDeskKey(live.deskKey);
    setCanaryKey(live.canaryKey);
    setAlive(live.deskKey ? live.alive : null);
    void refreshHolds(live.deskKey);
    setCanaryExpiresAt(live.expiresAt);
    setCanaryCreatedAt(live.createdAt);
    if (live.currentBlock != null) setCurrentBlock(live.currentBlock);
    setBlockDuration(live.blockDuration || 2);
    if (live.name) setChainName(live.name);
    setDeskPubRaw(live.deskPub);
    if (live.domain) setDeskDomain(live.domain);
    setStaleNote(live.note);
    if (live.deskKey) startWatch(live.deskKey, live.canaryKey);
  }

  async function refreshDeskFromChain(preferPub?: Uint8Array, expectedKey?: Hex) {
    if (!creator) return;
    const started = bumpGeneration(deskLoad.current);
    for (let i = 0; i < 8; i++) {
      if (isStaleGeneration(started, deskLoad.current.current)) return;
      const bundle = await deskAndCanary(creator, preferPub);
      if (bundle.desk && fetchedDeskIsReady(bundle.desk, preferPub, expectedKey)) {
        if (isStaleGeneration(started, deskLoad.current.current)) return;
        applyFetchedDesk(bundle.desk, bundle.canary);
        setCurrentBlock(bundle.currentBlock);
        setBlockDuration(bundle.blockDuration || 2);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    if (expectedKey) return;
    if (isStaleGeneration(started, deskLoad.current.current)) return;
    const bundle = await deskAndCanary(creator, preferPub);
    if (!bundle.desk || isStaleGeneration(started, deskLoad.current.current)) return;
    applyFetchedDesk(bundle.desk, bundle.canary);
    setCurrentBlock(bundle.currentBlock);
    setBlockDuration(bundle.blockDuration || 2);
  }

  useEffect(() => {
    if (!deskPubRaw || !demoKey) {
      setPubMatch(demoKey ? false : null);
      return;
    }
    setPubMatch(bytesEqual(deskPubRaw, demoKey.pub));
  }, [deskPubRaw, demoKey]);

  useEffect(() => {
    const started = bumpGeneration(deskLoad.current);
    if (!creator) {
      setLoadingDesk(false);
      return;
    }
    if (!deskKeyRef.current) setLoadingDesk(true);
    setLoadError(null);
    let cancelled = false;
    let timer: number | undefined;
    const deadline = Date.now() + 28_000;

    async function attempt() {
      if (cancelled || isStaleGeneration(started, deskLoad.current.current)) return;
      try {
        const live = await fetchDeskLive(creator!);
        if (cancelled || isStaleGeneration(started, deskLoad.current.current)) return;
        applyLive(live);
        setLoadError(null);
        setLoadingDesk(false);
        if (live.stale || live.note) {
          timer = window.setTimeout(() => {
            void attempt();
          }, 15_000);
        }
        return;
      } catch {
        // Keep retrying quietly on a first visit.
      }
      if (cancelled || isStaleGeneration(started, deskLoad.current.current)) return;
      if (Date.now() < deadline) {
        if (!deskKeyRef.current) setLoadingDesk(true);
        timer = window.setTimeout(() => {
          void attempt();
        }, 15_000);
        return;
      }
      if (!deskKeyRef.current) setLoadError(CHAIN_READ_FAILED);
      setLoadingDesk(false);
      timer = window.setTimeout(() => {
        void attempt();
      }, 30_000);
    }

    void attempt();
    return () => {
      cancelled = true;
      bumpGeneration(deskLoad.current);
      if (timer) window.clearTimeout(timer);
      if (unwatchRef.current) unwatchRef.current();
    };
  }, [creator, demo]);

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
      if (!dryRun) requireWriter();
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
          body: JSON.stringify({
            name: deskName,
            deskPubRawB64: bytesToB64(pubRaw),
            ...(deskDomain.trim() ? { domain: deskDomain.trim().toLowerCase() } : {}),
          }),
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
            if (creator) {
              try {
                applyLive(await fetchDeskLive(creator, true));
              } catch {
                await refreshDeskFromChain(demoKey?.pub, hinted.deskKey);
              }
            }
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
        const signed = dryRun ? undefined : await signCanary(owner);
        const out = await createDesk(w, owner, deskName, pubRaw, undefined, {
          domain: deskDomain.trim() ? deskDomain.trim().toLowerCase() : undefined,
          signed,
        });
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
          if (creator) {
            try {
              applyLive(await fetchDeskLive(creator, true));
            } catch {
              await refreshDeskFromChain(undefined, hinted.deskKey);
            }
          }
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
    setTxConfirming(false);
    try {
      if (!dryRun) requireWriter();
      if (demo || dryRun) {
        const r = await appFetch(`/api/demo/desk/renew${dryRun ? '?dryRun=1' : ''}`, {
          method: 'POST',
          body: JSON.stringify({ deskKey, canaryKey }),
        });
        const j = (await r.json()) as {
          message?: string;
          error?: string;
          txHash?: Hex;
          confirming?: boolean;
          dryRun?: boolean;
        };
        const notice = renewNotice(r.status, j);
        if (notice.txHash) setTx(notice.txHash as Hex);
        if (notice.kind === 'error') throw new Error(notice.text);
        if (notice.kind === 'confirming') setTxConfirming(true);
        push({
          kind: notice.kind === 'ok' ? 'success' : 'info',
          text: notice.text,
        });
      } else {
        if (!connected) await connect();
        const provider = getInjectedProvider();
        if (!provider) throw new Error('No wallet found. Install MetaMask, or use Demo mode on the desk.');
        const w = walletFromProvider(provider);
        const owner = connected;
        if (!owner) throw new Error('No account returned by the wallet.');
        const signed = await signCanary(owner);
        const holdKeys = await extendableHoldKeys(deskKey, owner);
        const out = await renew(w, deskKey, canaryKey, undefined, { holdKeys, signed, owner });
        setTx(out.txHash);
        push({ kind: 'success', text: 'Canary renewed.' });
      }
      if (creator && !dryRun) {
        try {
          applyLive(await fetchDeskLive(creator, true));
        } catch {
          setAlive(!!(await canaryAlive(creator, deskKey)));
        }
      }
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
      requireWriter();
      if (!priv) throw new Error('Load a desk key first.');
      let replyKey: Hex | null = null;
      const stealth = announcementForReply(loadOrCreateStealthMeta().meta);
      if (demo) {
        const w = await sealReply(priv, t.ephPub, t.replyText);
        const r = await appFetch('/api/demo/reply', {
          method: 'POST',
          body: JSON.stringify({
            tipKey: t.key,
            wireB64: bytesToB64(w),
            stealthAddress: stealth.stealthAddress,
            ephemeralPub: stealth.ephemeralPub,
            viewTag: stealth.viewTag,
          }),
        });
        const j = (await r.json()) as { message?: string; error?: string; txHash?: Hex; replyKey?: Hex };
        if (!r.ok) throw new Error(j.message ?? j.error ?? 'failed');
        if (j.txHash) setTx(j.txHash);
        if (typeof j.replyKey === 'string') replyKey = j.replyKey;
      } else {
        if (!connected) await connect();
        const provider = getInjectedProvider();
        if (!provider) throw new Error('No wallet found. Install MetaMask, or use Demo mode on the desk.');
        const w = walletFromProvider(provider);
        const wire = await sealReply(priv, t.ephPub, t.replyText);
        const out = await reply(w, t.key, wire, deskKey, undefined, stealth);
        setTx(out.txHash);
        const created = Array.isArray(out.createdEntities) ? out.createdEntities[0] : undefined;
        if (typeof created === 'string' && ENTITY_KEY_RE.test(created)) replyKey = created;
      }
      setTips((arr) =>
        arr.map((x) =>
          x.key === t.key ? { ...x, replyText: '', sentReplyKey: replyKey, sentStealth: stealth.stealthAddress } : x,
        ),
      );
      push({ kind: 'success', text: 'Reply sent to a one time address. Experimental.' });
    } catch (e: unknown) {
      push({ kind: 'error', text: uiError(e) });
    }
  }

  async function sealDropFlow(
    title: string,
    text: string,
    recipients: { label: string; pub: number[] }[],
    dryRun = false,
  ) {
    if (!deskKey) return;
    setBusy(true);
    setTx(null);
    try {
      if (!dryRun) requireWriter();
      const { sealDropPacket } = await import('@/lib/drop-seal');
      const packet = await sealDropPacket({ title, text }, recipients);
      if (demo || dryRun) {
        const r = await appFetch(`/api/demo/drop${dryRun ? '?dryRun=1' : ''}`, {
          method: 'POST',
          body: JSON.stringify({
            deskKey,
            dropPayloadB64: bytesToB64(packet.dropPayload),
            releasePayloadB64: bytesToB64(packet.releasePayload),
          }),
        });
        const j = (await r.json()) as {
          message?: string;
          error?: string;
          txHash?: Hex;
          dropKey?: Hex;
          releaseKey?: Hex;
          holdKey?: Hex;
        };
        if (!r.ok) throw new Error(j.message ?? j.error ?? 'failed');
        if (dryRun) {
          push({ kind: 'info', text: 'Dry run ok. The dead drop was not written.' });
          return;
        }
        if (j.txHash) setTx(j.txHash);
        setLastDrop({ dropKey: j.dropKey, releaseKey: j.releaseKey, holdKey: j.holdKey, txHash: j.txHash });
        if (j.holdKey) setHoldAlive(true);
        else void refreshHolds(deskKey);
        push({ kind: 'success', text: 'Dead drop sealed.' });
        return;
      }
      if (!connected) await connect();
      const provider = getInjectedProvider();
      if (!provider) throw new Error('No wallet found. Install MetaMask, or use Demo mode on the desk.');
      const w = walletFromProvider(provider);
      const owner = connected;
      if (!owner) throw new Error('No account returned by the wallet.');
      const out = await writeDeadDrop(w, owner, deskKey, packet.dropPayload, packet.releasePayload);
      setTx(out.txHash);
      const created = Array.isArray(out.createdEntities) ? out.createdEntities : [];
      setLastDrop({
        dropKey: created[0],
        releaseKey: created[1],
        holdKey: created[2],
        txHash: out.txHash,
      });
      if (created[2]) setHoldAlive(true);
      else void refreshHolds(deskKey);
      push({ kind: 'success', text: 'Dead drop sealed.' });
    } catch (e: unknown) {
      push({ kind: 'error', text: uiError(e) });
    } finally {
      setBusy(false);
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
    holdAlive,
    priv,
    tips,
    setTips,
    busy,
    tx,
    txConfirming,
    confirm,
    setConfirm,
    inboxCursor,
    inboxBlock,
    loadingInbox,
    skippedTips,
    demoKey,
    demoKeyError,
    pubMatch,
    createdNotice,
    loadingDesk,
    loadError,
    staleNote,
    chainName,
    canaryExpiresAt,
    canaryCreatedAt,
    currentBlock,
    blockDuration,
    connect,
    loadHistory,
    generateDeskKey,
    downloadDeskKey,
    importDeskKey,
    clearKeys,
    createDeskFlow,
    renewFlow,
    sendReply,
    sealDropFlow,
    deskDomain,
    setDeskDomain,
    siweAddress,
    canDeskWrite,
    signSiwe,
    lastDrop,
    deskPubRaw,
  };

  return <DeskContext.Provider value={value}>{children}</DeskContext.Provider>;
}
