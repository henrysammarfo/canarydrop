'use client';

import { useEffect, useState } from 'react';
import type { Hex } from 'viem';
import { pub, watchInbox, RELAY, PROJECT } from '@/lib/arkiv';

type Item = { key: Hex; type: string; createdAt?: bigint; owner: Hex };

export default function ExplorerPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Seed with recent entities (best-effort)
        const r = await pub.select({ key: true, attributes: true, creator: true, createdAt: true })
          .limit(20).fetch().catch(()=>({ entities:[] } as any));
        const base: Item[] = (r.entities ?? []).map((e: any) => ({
          key: e.key as Hex, owner: e.creator as Hex, createdAt: e.createdAt,
          type: e.attributes?.type?.value ?? 'unknown'
        }));
        setItems(base);
      } catch {}
    })();
    const un = (pub as any).watchEntityEvents ? (pub as any).watchEntityEvents({
      onEntityCreated: async ({ entityKey, owner }: any) => {
        try {
          const e = await pub.getEntity(entityKey);
          if (e.attributes?.project?.value !== PROJECT) return;
          const t = String(e.attributes?.type?.value ?? 'unknown');
          setItems((arr: Item[]) => [{ key: entityKey, type: t, owner }, ...arr].slice(0,50));
        } catch {}
      },
      onError: (e: any) => setErr(String(e?.message ?? e)),
    }) : () => {};
    return () => { try { un(); } catch {} };
  }, []);

  return (
    <section className="section">
      <div className="wrap">
        <h1 className="h2">Explorer</h1>
        <p className="lead">Live feed of CanaryDrop entities on Tiramisu. Impersonator desks are ignored via creator filters in the app.</p>
        <div className="card" style={{ marginTop: 12 }}>
          <ul style={{ padding: 0, margin: 0 }}>
            {items.map((it) => (
              <li key={it.key} style={{ listStyle: 'none', padding: 10, borderBottom: '1px solid rgba(170,200,222,.12)' }}>
                <code>{it.key}</code> · <span className="muted">{it.type}</span> · owner <code>{it.owner}</code>
              </li>
            ))}
            {items.length === 0 && <li className="muted">Waiting for events…</li>}
          </ul>
          {err && <div className="muted" style={{ color: '#ffb048', marginTop: 8 }}>{err}</div>}
        </div>
      </div>
    </section>
  );
}

