'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Hex } from 'viem';
import { bytesToB64 } from '@/lib/bytes';
import { appFetch } from '@/lib/client-fetch';
import { CHAIN_READ_FAILED, DEFAULT_DESK, LIFETIME_KEYS, type Lifetime } from '@/lib/constants';
import { sealTo } from '@/lib/crypto';
import { TIRAMISU_HUB } from '@/lib/chain';
import { canaryHref } from '@/lib/desk-href';
import { postDirectTip, throwawayAccount, throwawayBalance } from '@/lib/direct-tip';
import { listingForDesk } from '@/lib/listing-client';
import {
  clearThrowawayKey,
  formatGlm,
  loadOrCreateThrowawayKey,
} from '@/lib/throwaway-store';
import type { DeskListing } from '@/lib/domain-verify';
import { asAddress } from '@/lib/hex';
import { fetchDeskLive } from '@/lib/live-client';
import { sameOriginApi } from '@/lib/runtime';
import { uiError } from '@/lib/ui-error';
import Link from 'next/link';
import Modal from '@/components/Modal';
import StaleNote from '@/components/ui/StaleNote';
import { useToast } from '@/components/Toast';
import { entityUrl, shortHex, txUrl } from '@/lib/chain';
import CopyField from '@/components/ui/CopyField';
import VerifiedBadge from '@/components/VerifiedBadge';
import { IcoVerify } from '@/components/ui/icons';

export default function SubmitPage() {
  return (
    <Suspense fallback={<section className="section"><div className="wrap"><p className="lead">Loading the tip form…</p></div></section>}>
      <SubmitForm />
    </Suspense>
  );
}

function SubmitForm() {
  const push = useToast();
  const search = useSearchParams();
  const [creator, setCreator] = useState<Hex>(() =>
    asAddress(search.get('desk') || process.env.NEXT_PUBLIC_DESK_ADDRESS || '', DEFAULT_DESK),
  );
  const [deskName, setDeskName] = useState('CanaryDrop desk');
  const [deskKey, setDeskKey] = useState<Hex | null>(null);
  const [deskPubRaw, setDeskPubRaw] = useState<Uint8Array | null>(null);
  const [alive, setAlive] = useState<boolean | null>(null);
  const [text, setText] = useState('');
  const [life, setLife] = useState<Lifetime>('24h');
  const [sending, setSending] = useState(false);
  const [ok, setOk] = useState<{ tipKey: Hex; txHash: Hex; receipt: JsonWebKey } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [looking, setLooking] = useState(true);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [staleNote, setStaleNote] = useState<string | null>(null);
  const [listing, setListing] = useState<DeskListing>('unknown');
  const [path, setPath] = useState<'sponsor' | 'direct'>(() => (sameOriginApi() ? 'sponsor' : 'direct'));
  const [throwaway, setThrowaway] = useState<string | null>(null);
  const [throwawayKey, setThrowawayKey] = useState<Hex | null>(null);
  const [throwawayBal, setThrowawayBal] = useState<string | null>(null);
  const [checkingFunds, setCheckingFunds] = useState(false);
  const [declaredDomain, setDeclaredDomain] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const deadline = Date.now() + 28_000;
    setDeskKey(null);
    setDeskPubRaw(null);
    setAlive(null);
    setLooking(true);
    setLookupError(null);
    setStaleNote(null);

    async function attempt() {
      try {
        const live = await fetchDeskLive(creator);
        if (cancelled) return;
        setDeskName(live.name);
        setDeskKey(live.deskKey);
        setDeskPubRaw(live.deskPub);
        setDeclaredDomain(live.domain);
        setAlive(live.deskKey ? live.alive : null);
        setLookupError(null);
        setStaleNote(live.note);
        setLooking(false);
        if (live.stale || live.note) {
          timer = window.setTimeout(() => {
            void attempt();
          }, 15_000);
        }
        return;
      } catch {
        // Keep retrying quietly on a first visit.
      }
      if (cancelled) return;
      if (Date.now() < deadline) {
        setLooking(true);
        timer = window.setTimeout(() => {
          void attempt();
        }, 15_000);
        return;
      }
      setLookupError(CHAIN_READ_FAILED);
      setLooking(false);
      timer = window.setTimeout(() => {
        void attempt();
      }, 30_000);
    }

    void attempt();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [creator]);

  useEffect(() => {
    let cancelled = false;
    void listingForDesk(creator, declaredDomain).then((signal) => {
      if (!cancelled) setListing(signal);
    });
    return () => {
      cancelled = true;
    };
  }, [creator, declaredDomain]);

  useEffect(() => {
    if (path !== 'direct') return;
    const key = loadOrCreateThrowawayKey();
    setThrowawayKey(key);
    setThrowaway(throwawayAccount(key).address);
  }, [path]);

  async function refreshFunds() {
    if (!throwawayKey) return;
    setCheckingFunds(true);
    try {
      const bal = await throwawayBalance(throwawayAccount(throwawayKey).address);
      setThrowawayBal(formatGlm(bal));
    } catch {
      setThrowawayBal('Could not read the balance.');
    } finally {
      setCheckingFunds(false);
    }
  }

  function resetThrowaway() {
    clearThrowawayKey();
    const key = loadOrCreateThrowawayKey();
    setThrowawayKey(key);
    setThrowaway(throwawayAccount(key).address);
    setThrowawayBal(null);
  }

  const valid = !!deskKey && !!deskPubRaw && !!text.trim() && !sending;
  const step1 = deskKey ? 'done' : looking ? 'on' : 'on';
  const step2 = deskKey && text.trim() ? 'done' : deskKey ? 'on' : '';
  const step3 = valid ? 'on' : '';
  const verified = !!deskKey;

  async function send(dryRun: boolean) {
    if (!deskKey || !deskPubRaw || !text.trim()) return;
    setSending(true);
    try {
      const { wire, receipt } = await sealTo(deskPubRaw, text);
      if (path === 'direct') {
        const key = throwawayKey ?? loadOrCreateThrowawayKey();
        setThrowawayKey(key);
        const out = await postDirectTip({ privateKey: key, deskKey, wire, life, dryRun });
        setThrowaway(out.owner);
        if (dryRun) {
          push({ kind: 'info', text: `Dry run ok. Predicted tip key ${shortHex(String(out.tipKey), 6, 4) || 'unknown'}. Nothing was sent.` });
        } else {
          if (!out.txHash) throw new Error('The tip was not confirmed.');
          setOk({ tipKey: out.tipKey, txHash: out.txHash, receipt });
          setText('');
          push({ kind: 'success', text: 'Tip sent from a throwaway key. Keep your receipt private.' });
        }
        return;
      }
      const res = await appFetch(`/api/tip${dryRun ? '?dryRun=1' : ''}`, {
        method: 'POST',
        body: JSON.stringify({ deskKey, wireB64: bytesToB64(wire), lifetime: life }),
      });
      const j = (await res.json()) as { message?: string; error?: string; predictedTipKey?: string; tipKey?: Hex; txHash?: Hex };
      if (!res.ok) throw new Error(j.message ?? j.error ?? 'failed');
      if (dryRun) {
        push({ kind: 'info', text: `Dry run ok. Predicted tip key ${shortHex(String(j.predictedTipKey ?? ''), 6, 4) || 'unknown'}. Nothing was sent.` });
      } else {
        if (!j.tipKey || !j.txHash) throw new Error('The tip was not confirmed.');
        setOk({ tipKey: j.tipKey, txHash: j.txHash, receipt });
        setText('');
        push({ kind: 'success', text: 'Tip sent. Keep your receipt private.' });
      }
    } catch (e: unknown) {
      push({ kind: 'error', text: uiError(e) });
    } finally {
      setSending(false);
      setConfirmOpen(false);
    }
  }

  function onLife(value: string) {
    if ((LIFETIME_KEYS as readonly string[]).includes(value)) setLife(value as Lifetime);
  }

  return (
    <section className="section">
      <div className="wrap submit-panel">
        <p className="eyebrow">Anonymous tip</p>
        <h1 className="h2">Submit a tip</h1>
        <p className="lead" style={{ marginTop: 10 }}>
          {path === 'direct'
            ? 'Synthetic data only. Your words are locked on this device, then posted by a throwaway key in this tab.'
            : 'Synthetic data only. Your words are locked on this device, then posted by a sponsor wallet.'}
        </p>
        <StaleNote text={staleNote} />

        <div className="steps" style={{ marginTop: 20 }}>
          <div className={`step ${step1}`}>
            <div className="n">{deskKey ? 'Done' : '1'}</div>
            <div>{deskKey ? 'Desk verified' : looking ? 'Finding desk' : 'Find desk'}</div>
          </div>
          <div className={`step ${step2}`}>
            <div className="n">{text.trim() ? 'Done' : '2'}</div>
            <div>{text.trim() ? 'Tip written' : 'Write tip'}</div>
          </div>
          <div className={`step ${step3}`}>
            <div className="n">{valid ? 'Go' : '3'}</div>
            <div>{valid ? 'Ready to send' : 'Send'}</div>
          </div>
        </div>

        <div className={`card${verified ? ' verified-card' : ''}`} style={{ marginTop: 22 }}>
          <div className="verified-desk">
            <div className={`verified-mark${verified ? '' : ' muted'}`} aria-hidden="true">
              <IcoVerify />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p className="eyebrow">{looking ? 'Checking Arkiv' : verified ? 'Verified desk' : lookupError || staleNote ? 'Desk lookup' : 'Desk not found'}</p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
                <h2 className="h3" style={{ margin: 0 }}>{deskName}</h2>
                <VerifiedBadge signal={listing} />
              </div>
              <p className="muted" style={{ marginTop: 6 }} role="status">
                {looking
                  ? 'Looking up this desk on Arkiv…'
                  : verified
                    ? `Canary ${alive === null ? 'unknown' : alive ? 'alive' : 'gone'}${deskKey ? `. Desk ${shortHex(deskKey)}.` : ''}`
                    : lookupError || staleNote || 'No live desk found.'}
              </p>
              <div className="ctaRow" style={{ marginTop: 12 }}>
                <Link className="btn" href={canaryHref(creator)}>
                  View canary
                </Link>
                <button type="button" className="btn" onClick={() => setInfoOpen(true)}>
                  How sending works
                </button>
              </div>
            </div>
          </div>
          <p className="muted" style={{ marginTop: 14 }}>
            {path === 'direct'
              ? 'This browser makes a throwaway key and pays the fee itself.'
              : 'You do not need a wallet. We pay the fee.'}
          </p>
          <fieldset className="send-path">
            <legend className="small">How to send</legend>
            <label>
              <input
                type="radio"
                name="send-path"
                checked={path === 'sponsor'}
                disabled={!sameOriginApi()}
                onChange={() => setPath('sponsor')}
              />
              Use the sponsor
            </label>
            <label>
              <input type="radio" name="send-path" checked={path === 'direct'} onChange={() => setPath('direct')} />
              Send without the sponsor
            </label>
          </fieldset>
          {path === 'direct' && throwaway && (
            <div className="throwaway-fund" style={{ marginTop: 14 }}>
              <p className="small">This tab keeps one throwaway key until you clear it.</p>
              <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                <CopyField label="Address" value={throwaway} />
                <CopyField label="Balance" value={throwawayBal ?? 'Not checked yet'} />
              </div>
              <div className="ctaRow" style={{ marginTop: 12, justifyContent: 'flex-start' }}>
                <button type="button" className="btn" onClick={() => void refreshFunds()} disabled={checkingFunds}>
                  {checkingFunds ? 'Checking' : 'Check funds'}
                </button>
                <a className="btn" href={TIRAMISU_HUB} target="_blank" rel="noreferrer">
                  Open faucet
                </a>
                <button type="button" className="btn" onClick={resetThrowaway}>
                  Clear key
                </button>
              </div>
            </div>
          )}
          <details className="advanced">
            <summary>Use a different desk</summary>
            <label className="small" htmlFor="desk-creator">Desk creator address</label>
            <input
              id="desk-creator"
              value={creator}
              onChange={(e) => setCreator(e.target.value as Hex)}
              placeholder="0x…"
            />
          </details>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <label className="small" htmlFor="tip-body">Your tip</label>
          <textarea
            id="tip-body"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write your tip here (synthetic data only)."
            style={{ height: 200, resize: 'vertical' }}
          />
          <div className="submit-toolbar">
            <label className="life-control" htmlFor="tip-life">
              Lifetime
              <select id="tip-life" value={life} onChange={(e) => onLife(e.target.value)}>
                <option value="1h">1 hour</option>
                <option value="24h">24 hours</option>
                <option value="72h">72 hours</option>
                <option value="7d">7 days</option>
              </select>
            </label>
            <div className="ctaRow">
              <button className="btn lg" type="button" onClick={() => send(true)} disabled={!valid}>
                Dry run
              </button>
              <button
                className="btn lg primary"
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={!valid}
              >
                Submit tip <span className="arrow" aria-hidden="true" />
              </button>
            </div>
          </div>
          <p className="muted" style={{ marginTop: 10 }}>
            New tips stay live at least until 27 Oct 2026.
          </p>
        </div>

        {ok && (
          <div className="card" style={{ marginTop: 16 }}>
            <strong>Tip created</strong>
            <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
              <CopyField label="Tip" value={ok.tipKey} />
              <CopyField label="Tx" value={ok.txHash} />
            </div>
            {throwaway && <CopyField label="Throwaway creator" value={throwaway} />}
            <div className="muted" style={{ marginTop: 8 }}>Receipt (keep it private):</div>
            <textarea readOnly value={JSON.stringify(ok.receipt)} style={{ height: 120, marginTop: 6 }} />
            <div className="ctaRow" style={{ justifyContent: 'flex-start', marginTop: 12 }}>
              <a className="btn" href={entityUrl(ok.tipKey)} target="_blank" rel="noreferrer">View on Arkiv <span className="arrow" aria-hidden="true" /></a>
              <a className="btn" href={txUrl(ok.txHash)} target="_blank" rel="noreferrer">View transaction <span className="arrow" aria-hidden="true" /></a>
              <Link className="btn" href="/r">Verify receipt <span className="arrow" aria-hidden="true" /></Link>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={confirmOpen}
        title="Send this tip?"
        confirmLabel="Send tip"
        busy={sending}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => send(false)}
      >
        {path === 'direct'
          ? 'The tip will be locked on this device and posted by a throwaway key in this browser.'
          : 'The tip will be locked on this device and posted by our sponsor. You do not need a wallet. We pay the fee.'}
      </Modal>
      <Modal
        open={infoOpen}
        title="How sending works"
        cancelLabel="Close"
        onClose={() => setInfoOpen(false)}
      >
        Your device locks the tip. You can use the sponsor, or send with a throwaway key from this browser.
      </Modal>
    </section>
  );
}
