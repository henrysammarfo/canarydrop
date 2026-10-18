'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Hex } from 'viem';
import { canaryAlive, getDesk } from '@/lib/arkiv';
import { sealTo } from '@/lib/crypto';
import Link from 'next/link';

export default function SubmitPage() {
  const [creator, setCreator] = useState<Hex>((process.env.NEXT_PUBLIC_DESK_ADDRESS as Hex) || ('0x' as Hex));
  const [desk, setDesk] = useState<any>(null);
  const [deskKey, setDeskKey] = useState<Hex | null>(null);
  const [alive, setAlive] = useState<boolean | null>(null);
  const [text, setText] = useState('');
  const [life, setLife] = useState<'1h' | '24h' | '72h' | '7d'>('24h');
  const [sending, setSending] = useState(false);
  const [ok, setOk] = useState<{ tipKey: Hex; txHash: Hex; receipt: object } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setDesk(null); setDeskKey(null); setAlive(null); setErr(null);
      try {
        const d = await getDesk(creator);
        setDesk(d ?? null);
        if (d) {
          setDeskKey(d.key);
          const isAlive = await canaryAlive(creator, d.key);
          setAlive(!!isAlive);
        }
      } catch (e: any) {
        setErr(String(e?.message ?? e));
      }
    })();
  }, [creator]);

  const deskPubRaw = useMemo(() => {
    if (!desk?.payload) return null;
    try {
      const j = JSON.parse(new TextDecoder().decode(desk.payload));
      return new Uint8Array(j.pub as number[]);
    } catch {
      return null;
    }
  }, [desk]);

  async function submit() {
    if (!deskKey || !deskPubRaw || !text.trim()) return;
    setSending(true);
    setErr(null);
    setOk(null);
    try {
      const { wire, receipt } = await sealTo(deskPubRaw, text);
      const res = await fetch('/api/tip', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deskKey, wireB64: Buffer.from(wire).toString('base64'), lifetime: life }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? 'failed');
      setOk({ tipKey: j.tipKey as Hex, txHash: j.txHash as Hex, receipt });
      setText('');
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="section">
      <div className="wrap" style={{ maxWidth: 860 }}>
        <h1 className="h2">Submit a tip</h1>
        <p className="lead">Synthetic data only. Your words are locked on this device, then posted by a sponsor wallet.</p>
        <div style={{ display: 'grid', gap: 16, marginTop: 18 }}>
          <div>
            <label className="small">Desk creator address</label>
            <input value={creator} onChange={(e) => setCreator(e.target.value as Hex)} placeholder="0x…" />
          </div>
          <div>
            <label className="small">Your tip</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write your tip here (synthetic data only)."
              style={{ height: 200, resize: 'vertical' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <label className="badge" style={{ background: 'rgba(10,16,24,.45)' }}>
              Lifetime:&nbsp;
              <select value={life} onChange={(e) => setLife(e.target.value as any)} style={{ background: 'transparent', color: 'inherit', border: 'none', outline: 'none' }}>
                <option value="1h">1 hour</option>
                <option value="24h">24 hours</option>
                <option value="72h">72 hours</option>
                <option value="7d">7 days</option>
              </select>
            </label>
            <button className="btn primary" onClick={submit} disabled={!deskKey || !deskPubRaw || sending}>
              <span className="dot" />
              {sending ? 'Sending…' : 'Submit tip'}
            </button>
            <span className="muted">Canary: {alive === null ? 'unknown' : alive ? 'ALIVE' : 'DEAD'}</span>
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
              <a className="btn" href={`https://hub.arkiv.network/tiramisu/entity/${ok.tipKey}`} target="_blank">View on Arkiv</a>
              <Link className="btn" href="/r">Verify receipt</Link>
            </div>
          </div>
        )}
        {err && <p className="muted" style={{ color: '#ffb048', marginTop: 10 }}>{err}</p>}
      </div>
    </section>
  );
}

