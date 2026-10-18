'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Hex } from 'viem';
import { canaryAlive, getDesk } from '@/lib/arkiv';
import { sealTo } from '@/lib/crypto';
import Link from 'next/link';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { entityUrl, shortHex, txUrl } from '@/lib/chain';

export default function SubmitPage() {
  const push = useToast();
  const [creator, setCreator] = useState<Hex>(() => {
    const raw = process.env.NEXT_PUBLIC_DESK_ADDRESS || '';
    return /^0x[0-9a-fA-F]{40}$/.test(raw)
      ? (raw as Hex)
      : ('0x1da3c22c079c264536D831F6F1fCe638aB0b20B0' as Hex);
  });
  const [desk, setDesk] = useState<any>(null);
  const [deskKey, setDeskKey] = useState<Hex | null>(null);
  const [alive, setAlive] = useState<boolean | null>(null);
  const [text, setText] = useState('');
  const [life, setLife] = useState<'1h' | '24h' | '72h' | '7d'>('24h');
  const [sending, setSending] = useState(false);
  const [ok, setOk] = useState<{ tipKey: Hex; txHash: Hex; receipt: object } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const step = !deskKey ? 1 : !text.trim() ? 2 : 3;

  useEffect(() => {
    (async () => {
      setDesk(null);
      setDeskKey(null);
      setAlive(null);
      try {
        const d = await getDesk(creator);
        setDesk(d ?? null);
        if (d) {
          setDeskKey(d.key);
          const isAlive = await canaryAlive(creator, d.key);
          setAlive(!!isAlive);
        }
      } catch (e: any) {
        push({ kind: 'error', text: String(e?.message ?? e) });
      }
    })();
  }, [creator, push]);

  const deskPubRaw = useMemo(() => {
    if (!desk?.payload) return null;
    try {
      const j = JSON.parse(new TextDecoder().decode(desk.payload));
      return new Uint8Array(j.pub as number[]);
    } catch {
      return null;
    }
  }, [desk]);

  async function send(dryRun: boolean) {
    if (!deskKey || !deskPubRaw || !text.trim()) return;
    setSending(true);
    try {
      const { wire, receipt } = await sealTo(deskPubRaw, text);
      const res = await fetch(`/api/tip${dryRun ? '?dryRun=1' : ''}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deskKey, wireB64: Buffer.from(wire).toString('base64'), lifetime: life }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message ?? j?.error ?? 'failed');
      if (dryRun) {
        push({ kind: 'info', text: `Dry run ok. Predicted tip key ${shortHex(String(j.predictedTipKey ?? ''), 6, 4) || 'unknown'}. Nothing was sent.` });
      } else {
        setOk({ tipKey: j.tipKey as Hex, txHash: j.txHash as Hex, receipt });
        setText('');
        push({ kind: 'success', text: 'Tip sent. Keep your receipt private.' });
      }
    } catch (e: any) {
      push({ kind: 'error', text: String(e?.message ?? e) });
    } finally {
      setSending(false);
      setConfirmOpen(false);
    }
  }

  return (
    <section className="section">
      <div className="wrap">
        <p className="kicker">Anonymous tip</p>
        <h1 className="h2">Submit a tip</h1>
        <p className="lead" style={{ marginTop: 10 }}>
          Synthetic data only. Your words are locked on this device, then posted by a sponsor wallet.
        </p>

        <div className="steps" style={{ marginTop: 20 }}>
          <div className={`step ${step === 1 ? 'on' : ''}`}>
            <div className="n">01</div>
            <div>Choose desk</div>
          </div>
          <div className={`step ${step === 2 ? 'on' : ''}`}>
            <div className="n">02</div>
            <div>Write tip</div>
          </div>
          <div className={`step ${step === 3 ? 'on' : ''}`}>
            <div className="n">03</div>
            <div>Send</div>
          </div>
        </div>

        <div className="grid cols-2" style={{ marginTop: 22 }}>
          <div>
            <div className="page-note">
              You do not need a wallet. We pay the fee.
            </div>
            <div className="ctaRow" style={{ justifyContent: 'flex-start', marginTop: 12 }}>
              <button type="button" className="btn" onClick={() => setInfoOpen(true)}>
                How sending works
              </button>
            </div>
            <div className="card" style={{ marginTop: 14 }}>
              <div className="kicker">Desk</div>
              <p className="muted" style={{ marginTop: 8 }}>
                Canary: {alive === null ? 'unknown' : alive ? 'ALIVE' : 'GONE'}
              </p>
              <p className="muted" style={{ marginTop: 6 }}>
                Desk key: {deskKey ? <code>{deskKey.slice(0, 10)}…</code> : 'Not found'}
              </p>
              <div className="ctaRow" style={{ justifyContent: 'flex-start', marginTop: 10 }}>
                <Link className="btn" href={`/canary/${creator}`}>
                  View canary <span className="arrow" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>

          <div className="card">
            <label className="small">Desk creator address</label>
            <input value={creator} onChange={(e) => setCreator(e.target.value as Hex)} placeholder="0x…" />
            <div style={{ marginTop: 14 }}>
              <label className="small">Your tip</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Write your tip here (synthetic data only)."
                style={{ height: 200, resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
              <label className="badge" style={{ background: 'rgba(10,16,24,.45)' }}>
                Lifetime:&nbsp;
                <select value={life} onChange={(e) => setLife(e.target.value as any)} style={{ background: 'transparent', color: 'inherit', border: 'none', outline: 'none' }}>
                  <option value="1h">1 hour</option>
                  <option value="24h">24 hours</option>
                  <option value="72h">72 hours</option>
                  <option value="7d">7 days</option>
                </select>
              </label>
              <button className="btn" type="button" onClick={() => send(true)} disabled={!deskKey || !deskPubRaw || sending || !text.trim()}>
                Dry run
              </button>
              <button className="btn primary" type="button" onClick={() => setConfirmOpen(true)} disabled={!deskKey || !deskPubRaw || sending || !text.trim()}>
                Submit tip <span className="arrow" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {ok && (
          <div className="card" style={{ marginTop: 16 }}>
            <strong>Tip created</strong>
            <div className="muted" style={{ marginTop: 6 }}>
              Tip key: <code>{ok.tipKey}</code>
            </div>
            <div className="muted">
              Tx hash: <code>{ok.txHash}</code>
            </div>
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
        The tip will be locked on this device and posted by our sponsor. You do not need a wallet. We pay the fee.
      </Modal>
      <Modal
        open={infoOpen}
        title="How sending works"
        cancelLabel="Close"
        onClose={() => setInfoOpen(false)}
      >
        Your device locks the tip. We post it and pay the network fee. You do not need a wallet.
      </Modal>
    </section>
  );
}
