/* Source page: encrypt a tip to a desk and post via the relay */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { Hex } from 'viem';
import { canaryAlive, getDesk, pub } from '@/lib/arkiv';
import { sealTo } from '@/lib/crypto';

type Desk = Awaited<ReturnType<typeof getDesk>>;

const VIDEO =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260912_104303_0c6d60b2-9353-408e-944-585108a22fb5.mp4';
const POSTER =
  'https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/130837c4-4f37-9c61-8d801d93fd29.jpg';

export default function SourceDeskPage() {
  const { creator } = useParams<{ creator: Hex }>();
  const [desk, setDesk] = useState<Desk | null>(null);
  const [deskKey, setDeskKey] = useState<Hex | null>(null);
  const [alive, setAlive] = useState<boolean | null>(null);
  const [text, setText] = useState('');
  const [life, setLife] = useState<'1h' | '24h' | '72h' | '7d'>('24h');

  const [sending, setSending] = useState(false);
  const [ok, setOk] = useState<{ tipKey: Hex; txHash: Hex; receipt: object } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const d = await getDesk(creator);
        setDesk(d ?? null);
        if (d) {
          setDeskKey(d.key);
          const isAlive = await canaryAlive(creator, d.key);
          setAlive(!!isAlive);
        } else {
          setAlive(null);
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
      <div className="wrap" style={{ maxWidth: 760 }}>
        <h1 className="h2">Send a tip</h1>
        <p className="lead">
          Synthetic data only. Your tip is locked on your device before you send it. Only the newsroom can open it.
        </p>

          <div style={{ marginTop: 18 }}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write your tip here (synthetic data only)."
              style={{
                height: 180,
                resize: 'vertical',
              }}
            />
          </div>
          <div className="ctaRow" style={{ marginTop: 12, justifyContent: 'flex-start' }}>
            <label className="badge" style={{ background: 'rgba(10,16,24,.45)' }}>
              Lifetime:&nbsp;
              <select
                value={life}
                onChange={(e) => setLife(e.target.value as any)}
                style={{ background: 'transparent', color: 'inherit', border: 'none', outline: 'none' }}
              >
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
          </div>

          <div style={{ marginTop: 24 }}>
            <p className="muted">
              Canary status:{' '}
              {alive === null ? (
                'unknown'
              ) : alive ? (
                <span style={{ color: '#7ae6ff' }}>ALIVE</span>
              ) : (
                <span style={{ color: '#ffb048' }}>DEAD</span>
              )}
            </p>
          </div>

          {ok && (
            <div style={{ marginTop: 20, textAlign: 'left' }}>
              <p className="lead">Tip created.</p>
              <ul style={{ fontSize: 14, lineHeight: 1.5 }}>
                <li>
                  Tip key: <code>{ok.tipKey}</code>
                </li>
                <li>
                  Tx hash: <code>{ok.txHash}</code>
                </li>
                <li>
                  Receipt code (keep it private, stored only on this device):
                  <textarea
                    readOnly
                    value={JSON.stringify(ok.receipt)}
                    style={{
                      height: 110,
                      marginTop: 8,
                      fontSize: 12,
                    }}
                  />
                </li>
                <li style={{ marginTop: 8 }}>
                  Explorer:{' '}
                  <a
                    className="btn"
                    href={`https://hub.arkiv.network/tiramisu/entity/${ok.tipKey}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on Arkiv Hub
                  </a>
                </li>
                <li style={{ marginTop: 8 }}>
                  Read replies at{' '}
                  <Link className="btn" href="/r">
                    /r
                  </Link>{' '}
                  using your tip key and receipt code.
                </li>
              </ul>
            </div>
          )}
          {err && <p className="muted" style={{ color: '#ffb048', marginTop: 10 }}>{err}</p>}
      </div>
    </section>
  );
}

