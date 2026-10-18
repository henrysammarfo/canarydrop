'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { Hex } from 'viem';
import { canaryAlive, getDesk } from '@/lib/arkiv';
import { sealTo } from '@/lib/crypto';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { entityUrl, txUrl } from '@/lib/chain';

export default function SourceDeskPage() {
  const push = useToast();
  const { creator } = useParams<{ creator: Hex }>();
  const [desk, setDesk] = useState<any>(null);
  const [deskKey, setDeskKey] = useState<Hex | null>(null);
  const [alive, setAlive] = useState<boolean | null>(null);
  const [text, setText] = useState('');
  const [life, setLife] = useState<'1h' | '24h' | '72h' | '7d'>('24h');
  const [sending, setSending] = useState(false);
  const [ok, setOk] = useState<{ tipKey: Hex; txHash: Hex; receipt: object } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await getDesk(creator);
        setDesk(d ?? null);
        if (d) {
          setDeskKey(d.key);
          setAlive(!!(await canaryAlive(creator, d.key)));
        }
      } catch (e: any) {
        push({ kind: 'error', text: String(e?.message ?? e) });
      }
    })();
  }, [creator, push]);

  const deskPubRaw = useMemo(() => {
    if (!desk?.payload) return null;
    try {
      return new Uint8Array(JSON.parse(new TextDecoder().decode(desk.payload)).pub as number[]);
    } catch {
      return null;
    }
  }, [desk]);

  async function send() {
    if (!deskKey || !deskPubRaw || !text.trim()) return;
    setSending(true);
    try {
      const { wire, receipt } = await sealTo(deskPubRaw, text);
      const res = await fetch('/api/tip', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deskKey, wireB64: Buffer.from(wire).toString('base64'), lifetime: life }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message ?? j?.error ?? 'failed');
      setOk({ tipKey: j.tipKey as Hex, txHash: j.txHash as Hex, receipt });
      setText('');
      push({ kind: 'success', text: 'Tip sent. Keep your receipt private.' });
    } catch (e: any) {
      push({ kind: 'error', text: String(e?.message ?? e) });
    } finally {
      setSending(false);
      setConfirmOpen(false);
    }
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
            <select value={life} onChange={(e) => setLife(e.target.value as any)} style={{ background: 'transparent', color: 'inherit', border: 'none', outline: 'none' }}>
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
            <p className="muted">Tip key: <code>{ok.tipKey}</code></p>
            <p className="muted">Tx hash: <code>{ok.txHash}</code></p>
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
