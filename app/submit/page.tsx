'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Hex } from 'viem';
import { canaryAlive, getDesk } from '@/lib/arkiv';
import type { DeskRow } from '@/lib/arkiv';
import { bytesToB64 } from '@/lib/bytes';
import { appFetch } from '@/lib/client-fetch';
import { DEFAULT_DESK, LIFETIME_KEYS, type Lifetime } from '@/lib/constants';
import { sealTo } from '@/lib/crypto';
import { asAddress } from '@/lib/hex';
import { deskPubBytes, parseDeskPayload } from '@/lib/payload';
import { uiError } from '@/lib/ui-error';
import Link from 'next/link';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { entityUrl, shortHex, txUrl } from '@/lib/chain';

export default function SubmitPage() {
  const push = useToast();
  const [creator, setCreator] = useState<Hex>(() => asAddress(process.env.NEXT_PUBLIC_DESK_ADDRESS || '', DEFAULT_DESK));
  const [desk, setDesk] = useState<DeskRow | null>(null);
  const [deskKey, setDeskKey] = useState<Hex | null>(null);
  const [alive, setAlive] = useState<boolean | null>(null);
  const [text, setText] = useState('');
  const [life, setLife] = useState<Lifetime>('24h');
  const [sending, setSending] = useState(false);
  const [ok, setOk] = useState<{ tipKey: Hex; txHash: Hex; receipt: JsonWebKey } | null>(null);
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

  async function send(dryRun: boolean) {
    if (!deskKey || !deskPubRaw || !text.trim()) return;
    setSending(true);
    try {
      const { wire, receipt } = await sealTo(deskPubRaw, text);
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
              <p className="muted" style={{ marginTop: 8 }} role="status">
                {alive === null && !deskKey
                  ? 'Looking up this desk on Arkiv…'
                  : `Canary: ${alive === null ? 'unknown' : alive ? 'ALIVE' : 'GONE'}`}
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
                <select value={life} onChange={(e) => onLife(e.target.value)} style={{ background: 'transparent', color: 'inherit', border: 'none', outline: 'none' }}>
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
