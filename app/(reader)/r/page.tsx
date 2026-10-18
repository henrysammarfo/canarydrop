'use client';

import { useState } from 'react';
import type { Hex } from 'viem';
import Link from 'next/link';
import { pub, repliesFor } from '@/lib/arkiv';
import { importPrivJwk, importPub, openReply } from '@/lib/crypto';

const VIDEO =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260912_104303_0c6d60b2-9353-408e-944-585108a22fb5.mp4';
const POSTER =
  'https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/130837c4-0244-4f37-9c61-8d801d93fd29.jpg';

export default function ReaderPage() {
  const [tipKey, setTipKey] = useState<Hex>('0x');
  const [receipt, setReceipt] = useState<string>('');
  const [reading, setReading] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setReading(true);
    setMessages([]);
    setError(null);
    try {
      const tip = await pub.getEntity(tipKey);
      const deskKey = tip.attributes?.desk?.value as Hex | undefined;
      if (!deskKey) throw new Error('tip missing desk attribute');
      const desk = await pub.getEntity(deskKey);
      const deskPubRaw = new Uint8Array(JSON.parse(new TextDecoder().decode(desk.payload)).pub as number[]);
      const deskPub = await importPub(deskPubRaw);
      const ephPriv = await importPrivJwk(JSON.parse(receipt));
      const rs = await repliesFor(tipKey, tip.creator as Hex);
      const outs: string[] = [];
      for (const r of rs) {
        const text = await openReply(ephPriv, deskPub, new Uint8Array(r.payload!));
        outs.push(text);
      }
      setMessages(outs);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setReading(false);
    }
  }

  return (
    <div className="container">
      <video className="art" autoPlay muted loop playsInline preload="auto" aria-hidden="true" poster={POSTER} src={VIDEO} />
      <div className="veil" />
      <header className="header">
        <Link href="/" className="brand">
          CANARYDROP
        </Link>
        <span className="badge">Replies</span>
      </header>
      <main className="hero">
        <div style={{ width: '100%', maxWidth: 820 }}>
          <h1 className="title">Read replies</h1>
          <p className="sub">Provide the tip key and your receipt code (the JSON blob shown after sending the tip).</p>

          <div style={{ marginTop: 18 }}>
            <label className="badge" style={{ display: 'block', marginBottom: 8 }}>
              Tip key
            </label>
            <input
              value={tipKey}
              onChange={(e) => setTipKey(e.target.value as Hex)}
              style={{
                width: '100%',
                background: 'rgba(8,12,18,.45)',
                border: '1px solid rgba(160,190,210,.35)',
                color: 'var(--ink)',
                borderRadius: 12,
                padding: 12,
                outline: 'none',
              }}
            />
          </div>

          <div style={{ marginTop: 18 }}>
            <label className="badge" style={{ display: 'block', marginBottom: 8 }}>
              Receipt code
            </label>
            <textarea
              value={receipt}
              onChange={(e) => setReceipt(e.target.value)}
              placeholder="Paste the JSON receipt you saved when submitting."
              style={{
                width: '100%',
                height: 140,
                resize: 'vertical',
                background: 'rgba(8,12,18,.45)',
                border: '1px solid rgba(160,190,210,.35)',
                color: 'var(--ink)',
                borderRadius: 12,
                padding: 14,
                outline: 'none',
              }}
            />
          </div>

          <div className="ctaRow" style={{ marginTop: 12 }}>
            <button className="cta" onClick={load} disabled={reading}>
              {reading ? 'Loading…' : 'Fetch replies'}
            </button>
          </div>

          {messages.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <p className="sub">{messages.length} reply(ies):</p>
              <ul style={{ marginTop: 10, padding: 0 }}>
                {messages.map((m, i) => (
                  <li key={i} style={{ listStyle: 'none', marginBottom: 12 }}>
                    <div
                      style={{
                        background: 'rgba(8,12,18,.45)',
                        border: '1px solid rgba(160,190,210,.35)',
                        color: 'var(--ink)',
                        borderRadius: 12,
                        padding: 12,
                      }}
                    >
                      {m}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {error && (
            <p className="sub" style={{ color: '#ffb048', marginTop: 10 }}>
              {error}
            </p>
          )}
        </div>
      </main>
      <footer className="footer">Store the receipt securely; it is the only way to read replies.</footer>
    </div>
  );
}

