'use client';

import { useState } from 'react';
import type { Hex } from 'viem';
import { pub, repliesFor } from '@/lib/arkiv';
import { attrKey } from '@/lib/attr';
import { importPrivJwk, importPub, openReply } from '@/lib/crypto';
import { parseDeskPayload, deskPubBytes } from '@/lib/payload';
import { uiError } from '@/lib/ui-error';
import { useToast } from '@/components/Toast';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';

export default function ReaderPage() {
  const push = useToast();
  const [tipKey, setTipKey] = useState('');
  const [receipt, setReceipt] = useState('');
  const [reading, setReading] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [looked, setLooked] = useState(false);

  async function load() {
    setReading(true);
    setMessages([]);
    setLooked(false);
    try {
      const tip = await pub().getEntity(tipKey as Hex);
      const deskKey = attrKey(tip.attributes, 'desk');
      if (!deskKey) throw new Error('This tip is missing its desk label.');
      const desk = await pub().getEntity(deskKey);
      if (!desk.payload) throw new Error('This desk has no public key on chain.');
      const parsed = parseDeskPayload(desk.payload);
      if (!parsed) throw new Error('This desk public key could not be read.');
      const deskPub = await importPub(deskPubBytes(parsed));
      const ephPriv = await importPrivJwk(JSON.parse(receipt) as JsonWebKey);
      const creator = tip.creator;
      if (!creator) throw new Error('This tip is missing its creator.');
      const rs = await repliesFor(tipKey as Hex, creator);
      const outs: string[] = [];
      for (const r of rs) {
        if (!r.payload) continue;
        outs.push(await openReply(ephPriv, deskPub, new Uint8Array(r.payload)));
      }
      setMessages(outs);
      setLooked(true);
      push({ kind: outs.length ? 'success' : 'info', text: outs.length ? `Found ${outs.length} replies.` : 'No replies yet.' });
    } catch (e: unknown) {
      push({ kind: 'error', text: uiError(e) });
    } finally {
      setReading(false);
    }
  }

  return (
    <section className="section">
      <div className="wrap" style={{ maxWidth: 820 }}>
        <PageHeader
          kicker="Source inbox"
          title="Read replies"
          description="Provide the tip key and your receipt code. The receipt stays on this device."
        />

        <Card>
          <label className="small">Tip key</label>
          <input value={tipKey} onChange={(e) => setTipKey(e.target.value)} />
          <div style={{ marginTop: 16 }}>
            <label className="small">Receipt code</label>
            <textarea
              value={receipt}
              onChange={(e) => setReceipt(e.target.value)}
              placeholder="Paste the JSON receipt you saved when submitting."
              style={{ height: 140, resize: 'vertical' }}
            />
          </div>
          <div className="ctaRow" style={{ justifyContent: 'flex-start', marginTop: 12 }}>
            <button className="btn primary" onClick={load} disabled={reading}>
              {reading ? 'Loading' : 'Fetch replies'} <span className="arrow" aria-hidden="true" />
            </button>
          </div>
        </Card>

        {looked && messages.length === 0 && (
          <EmptyState title={reading ? 'Looking up replies on Arkiv…' : 'No replies yet for this tip.'} />
        )}
        {messages.length > 0 && (
          <div className="card" style={{ marginTop: 18 }}>
            <p className="muted" role="status">{messages.length} replies</p>
            <ul style={{ marginTop: 10, padding: 0 }}>
              {messages.map((m, i) => (
                <li key={i} style={{ listStyle: 'none', marginBottom: 12 }}>
                  <div className="card" style={{ padding: 12 }}>{m}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
