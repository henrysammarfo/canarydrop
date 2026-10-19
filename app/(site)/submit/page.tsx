'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Hex } from 'viem';
import { canaryAlive, getDesk } from '@/lib/arkiv';
import { preferPubForCreatorClient } from '@/lib/demo-pub-client';
import type { DeskRow } from '@/lib/arkiv';
import { bytesToB64 } from '@/lib/bytes';
import { appFetch } from '@/lib/client-fetch';
import { CHAIN_READ_FAILED, DEFAULT_DESK, LIFETIME_KEYS, type Lifetime } from '@/lib/constants';
import { sealTo } from '@/lib/crypto';
import { asAddress } from '@/lib/hex';
import { deskPubBytes, parseDeskPayload } from '@/lib/payload';
import { uiError } from '@/lib/ui-error';
import { sleep, withBackoff } from '@/lib/retry';
import Link from 'next/link';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { entityUrl, shortHex, txUrl } from '@/lib/chain';
import CopyField from '@/components/ui/CopyField';
import { IcoVerify } from '@/components/ui/icons';

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
  const [looking, setLooking] = useState(true);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const deskName = useMemo(() => {
    if (!desk?.payload) return 'CanaryDrop desk';
    return parseDeskPayload(desk.payload)?.name ?? 'CanaryDrop desk';
  }, [desk]);

  useEffect(() => {
    (async () => {
      setDesk(null);
      setDeskKey(null);
      setAlive(null);
      setLooking(true);
      setLookupError(null);
      try {
        const prefer = await preferPubForCreatorClient(creator);
        const d = await withBackoff(() => getDesk(creator, prefer), 8, (ms) => sleep(Math.max(400, ms)));
        setDesk(d ?? null);
        if (d) {
          setDeskKey(d.key);
          const isAlive = await canaryAlive(creator, d.key);
          setAlive(!!isAlive);
        }
      } catch {
        setLookupError(CHAIN_READ_FAILED);
      } finally {
        setLooking(false);
      }
    })();
  }, [creator]);

  const deskPubRaw = useMemo(() => {
    if (!desk?.payload) return null;
    const parsed = parseDeskPayload(desk.payload);
    return parsed ? deskPubBytes(parsed) : null;
  }, [desk]);

  const valid = !!deskKey && !!deskPubRaw && !!text.trim() && !sending;
  const step1 = deskKey ? 'done' : looking ? 'on' : 'on';
  const step2 = deskKey && text.trim() ? 'done' : deskKey ? 'on' : '';
  const step3 = valid ? 'on' : '';

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
      <div className="wrap submit-panel">
        <p className="eyebrow">Anonymous tip</p>
        <h1 className="h2">Submit a tip</h1>
        <p className="lead" style={{ marginTop: 10 }}>
          Synthetic data only. Your words are locked on this device, then posted by a sponsor wallet.
        </p>

        <div className="steps" style={{ marginTop: 20 }}>
          <div className={`step ${step1}`}>
            <div className="n">01</div>
            <div>{deskKey ? 'Desk verified' : 'Find desk'}</div>
          </div>
          <div className={`step ${step2}`}>
            <div className="n">02</div>
            <div>{text.trim() ? 'Tip written' : 'Write tip'}</div>
          </div>
          <div className={`step ${step3}`}>
            <div className="n">03</div>
            <div>{valid ? 'Ready to send' : 'Send'}</div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 22 }}>
          <div className="verified-desk">
            <div className={`verified-mark${deskKey ? '' : ' muted'}`} aria-hidden="true">
              <IcoVerify />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p className="eyebrow">{looking ? 'Checking Arkiv' : deskKey ? 'Verified desk' : lookupError ? 'Desk lookup' : 'Desk not found'}</p>
              <h2 className="h3" style={{ marginTop: 4 }}>{deskName}</h2>
              <p className="muted" style={{ marginTop: 6 }} role="status">
                {looking
                  ? 'Looking up this desk on Arkiv…'
                  : lookupError
                    ? lookupError
                    : `Canary ${alive === null ? 'unknown' : alive ? 'ALIVE' : 'GONE'}${deskKey ? `. Desk ${shortHex(deskKey)}.` : ''}`}
              </p>
              <div className="ctaRow" style={{ marginTop: 12 }}>
                <Link className="btn" href={`/canary/${creator}`}>
                  View canary
                </Link>
                <button type="button" className="btn" onClick={() => setInfoOpen(true)}>
                  How sending works
                </button>
              </div>
            </div>
          </div>
          <p className="muted" style={{ marginTop: 14 }}>
            You do not need a wallet. We pay the fee.
          </p>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
            <label className="badge">
              Lifetime
              <select value={life} onChange={(e) => onLife(e.target.value)} style={{ background: 'transparent', color: 'inherit', border: 'none', outline: 'none', marginLeft: 6 }}>
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
                className={`btn lg${valid ? ' primary' : ''}`}
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
