'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { Hex } from 'viem';
import { canaryAlive, getDesk } from '@/lib/arkiv';
import { preferPubForCreatorClient } from '@/lib/demo-pub-client';
import type { DeskRow } from '@/lib/arkiv';
import { bytesToB64 } from '@/lib/bytes';
import { appFetch } from '@/lib/client-fetch';
import { LIFETIME_KEYS, type Lifetime } from '@/lib/constants';
import { sealTo } from '@/lib/crypto';
import { deskPubBytes, parseDeskPayload } from '@/lib/payload';
import { uiError } from '@/lib/ui-error';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { entityUrl, txUrl } from '@/lib/chain';
import CopyField from '@/components/ui/CopyField';

export default function SourceDeskPage() {
  const push = useToast();
  const { creator } = useParams<{ creator: Hex }>();
  const [desk, setDesk] = useState<DeskRow | null>(null);
  const [deskKey, setDeskKey] = useState<Hex | null>(null);
  const [alive, setAlive] = useState<boolean | null>(null);
  const [text, setText] = useState('');
  const [life, setLife] = useState<Lifetime>('24h');
  const [sending, setSending] = useState(false);
  const [ok, setOk] = useState<{ tipKey: Hex; txHash: Hex; receipt: JsonWebKey } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await getDesk(creator, await preferPubForCreatorClient(creator));
        setDesk(d ?? null);
        if (d) {
          setDeskKey(d.key);
          setAlive(!!(await canaryAlive(creator, d.key)));
        }
      } catch (e: unknown) {
        push({ kind: 'error', text: uiError(e) });
      }
    })();
  }, [creator, push]);

  const deskPubRaw = useMemo(() => {
    if (!desk?.payload) return null;
    const parsed = parseDeskPayload(desk.payload);
    return parsed ? deskPubBytes(parsed) : null;
  }, [desk]);

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
        <h1 className="h2">Send a tip</h1>
        <p className="lead" style={{ marginTop: 10 }}>
          Synthetic data only. Your tip is locked on your device before you send it. Only the newsroom can open it.
        </p>
        <div className="page-note" style={{ marginTop: 16 }}>
          You do not need a wallet. We pay the fee.
        </div>
        <p className="muted" style={{ marginTop: 14 }}>
          Canary status:{' '}
          {alive === null ? 'unknown' : alive ? <span className="status-alive">ALIVE</span> : <span className="status-gone">GONE</span>}
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
