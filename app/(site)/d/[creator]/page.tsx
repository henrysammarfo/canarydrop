'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { Hex } from 'viem';
import { bytesToB64 } from '@/lib/bytes';
import { appFetch } from '@/lib/client-fetch';
import { CHAIN_READ_FAILED, LIFETIME_KEYS, type Lifetime } from '@/lib/constants';
import { sealTo } from '@/lib/crypto';
import { fetchDeskLive } from '@/lib/live-client';
import { uiError } from '@/lib/ui-error';
import Modal from '@/components/Modal';
import StaleNote from '@/components/ui/StaleNote';
import { useToast } from '@/components/Toast';
import { entityUrl, txUrl } from '@/lib/chain';
import CopyField from '@/components/ui/CopyField';
import VerifiedBadge from '@/components/VerifiedBadge';
import { fakeDeskSignal, fetchDeskRecord, wellKnownUrl, type DeskListing } from '@/lib/domain-verify';

export default function SourceDeskPage() {
  const push = useToast();
  const { creator } = useParams<{ creator: Hex }>();
  const [deskName, setDeskName] = useState('CanaryDrop desk');
  const [deskKey, setDeskKey] = useState<Hex | null>(null);
  const [deskPubRaw, setDeskPubRaw] = useState<Uint8Array | null>(null);
  const [alive, setAlive] = useState<boolean | null>(null);
  const [text, setText] = useState('');
  const [life, setLife] = useState<Lifetime>('24h');
  const [sending, setSending] = useState(false);
  const [ok, setOk] = useState<{ tipKey: Hex; txHash: Hex; receipt: JsonWebKey } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [staleNote, setStaleNote] = useState<string | null>(null);
  const [listing, setListing] = useState<DeskListing>('unknown');

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const deadline = Date.now() + 28_000;
    setDeskKey(null);
    setDeskPubRaw(null);
    setAlive(null);
    setLookupError(null);
    setStaleNote(null);

    async function attempt() {
      try {
        const live = await fetchDeskLive(creator);
        if (cancelled) return;
        setDeskName(live.name);
        setDeskKey(live.deskKey);
        setDeskPubRaw(live.deskPub);
        setAlive(live.deskKey ? live.alive : null);
        setLookupError(null);
        setStaleNote(live.note);
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
        timer = window.setTimeout(() => {
          void attempt();
        }, 15_000);
        return;
      }
      setLookupError(CHAIN_READ_FAILED);
      timer = window.setTimeout(() => {
        void attempt();
      }, 5000);
    }

    void attempt();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [creator]);

  useEffect(() => {
    let cancelled = false;
    void fetchDeskRecord(wellKnownUrl()).then((rec) => {
      if (!cancelled) setListing(fakeDeskSignal(rec?.desk ?? null, creator));
    });
    return () => {
      cancelled = true;
    };
  }, [creator]);

  async function send() {
    if (!deskKey || !deskPubRaw || !text.trim()) return;
    setSending(true);
    try {
      const { wire, receipt } = await sealTo(deskPubRaw, text);
      const res = await appFetch('/api/tip', {
        method: 'POST',
        body: JSON.stringify({ deskKey, wireB64: bytesToB64(wire), lifetime: life }),
      });
      const j = (await res.json()) as { message?: string; error?: string; tipKey?: Hex; txHash?: Hex };
      if (!res.ok) throw new Error(j.message ?? j.error ?? 'failed');
      if (!j.tipKey || !j.txHash) throw new Error('The tip was not confirmed.');
      setOk({ tipKey: j.tipKey, txHash: j.txHash, receipt });
      setText('');
      push({ kind: 'success', text: 'Tip sent. Keep your receipt private.' });
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
      <div className="wrap" style={{ maxWidth: 760 }}>
        <p className="kicker">Public desk</p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <h1 className="h2" style={{ margin: 0 }}>{deskName}</h1>
          <VerifiedBadge signal={listing} />
        </div>
        <p className="lead" style={{ marginTop: 10 }}>
          Synthetic data only. Your tip is locked on your device before you send it. Only the newsroom can open it.
        </p>
        <StaleNote text={staleNote} />
        <div className="page-note" style={{ marginTop: 16 }}>
          You do not need a wallet. We pay the fee.
        </div>
        <p className="muted" style={{ marginTop: 14 }} role="status">
          Canary status:{' '}
          {lookupError && !deskKey
            ? lookupError
            : alive === null
              ? 'unknown'
              : alive
                ? <span className="status-alive">ALIVE</span>
                : <span className="status-gone">GONE</span>}
        </p>
        <div className="ctaRow" style={{ justifyContent: 'flex-start', marginTop: 8 }}>
          <Link className="btn" href={`/canary/${creator}`}>
            Full canary page <span className="arrow" aria-hidden="true" />
          </Link>
        </div>
        <div style={{ marginTop: 18 }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write your tip here (synthetic data only)."
            style={{ height: 180, resize: 'vertical' }}
          />
        </div>
        <div className="ctaRow" style={{ marginTop: 12, justifyContent: 'flex-start' }}>
          <label className="badge" style={{ background: 'rgba(10,16,24,.45)' }}>
            Lifetime:&nbsp;
            <select value={life} onChange={(e) => onLife(e.target.value)} style={{ background: 'transparent', color: 'inherit', border: 'none', outline: 'none' }}>
              <option value="1h">1 hour</option>
              <option value="24h">24 hours</option>
              <option value="72h">72 hours</option>
              <option value="7d">7 days</option>
            </select>
          </label>
          <button className="btn primary" onClick={() => setConfirmOpen(true)} disabled={!deskKey || !deskPubRaw || sending || !text.trim()}>
            Submit tip <span className="arrow" aria-hidden="true" />
          </button>
        </div>

        {ok && (
          <div className="card" style={{ marginTop: 20 }}>
            <p className="lead">Tip created.</p>
            <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
              <CopyField label="Tip" value={ok.tipKey} />
              <CopyField label="Tx" value={ok.txHash} />
            </div>
            <div className="muted" style={{ marginTop: 8 }}>Receipt (keep it private):</div>
            <textarea readOnly value={JSON.stringify(ok.receipt)} style={{ height: 110, marginTop: 8 }} />
            <div className="ctaRow" style={{ justifyContent: 'flex-start' }}>
              <a className="btn" href={entityUrl(ok.tipKey)} target="_blank" rel="noreferrer">View on Arkiv <span className="arrow" aria-hidden="true" /></a>
              <a className="btn" href={txUrl(ok.txHash)} target="_blank" rel="noreferrer">View transaction <span className="arrow" aria-hidden="true" /></a>
              <Link className="btn" href="/r">Read replies <span className="arrow" aria-hidden="true" /></Link>
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
        onConfirm={send}
      >
        The tip will be locked on this device and posted by our sponsor. You do not need a wallet. We pay the fee.
      </Modal>
    </section>
  );
}
