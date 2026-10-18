'use client';

import { useEffect, useState } from 'react';
import type { Hex } from 'viem';
import { eq } from '@arkiv-network/sdk/query';
import { pub, PROJECT } from '@/lib/arkiv';
import { addressUrl, entityUrl, isSealedOwner, shortHex } from '@/lib/chain';
import { useToast } from '@/components/Toast';

type Item = {
  key: Hex;
  type: string;
  creator: Hex;
  owner: Hex;
  expires?: string;
};

export default function ExplorerPage() {
  const push = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function mapRow(e: any): Item {
    return {
      key: e.key as Hex,
      type: String(e.attributes?.type?.value ?? 'unknown'),
      creator: (e.creator as Hex) || ('0x' as Hex),
      owner: (e.owner as Hex) || (e.creator as Hex) || ('0x' as Hex),
      expires: e.expiresAt != null ? String(e.expiresAt) : 'n/a',
    };
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const r = await pub
          .select({ key: true, attributes: true, creator: true, owner: true, expiresAt: true, createdAt: true })
          .where(eq('project', PROJECT))
          .limit(20)
          .fetch()
          .catch(() => ({ entities: [], nextCursor: null } as any));
        const rows = (r.entities ?? []).map(mapRow);
        setItems(rows);
        setCursor(r.nextCursor ?? null);
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        setErr(msg);
        push({ kind: 'error', text: msg });
      } finally {
        setLoading(false);
      }
    })();
  }, [push]);

  async function loadMore() {
    if (!cursor) return;
    try {
      setLoading(true);
      const r = await pub
        .select({ key: true, attributes: true, creator: true, owner: true, expiresAt: true, createdAt: true })
        .where(eq('project', PROJECT))
        .limit(20)
        .cursor(cursor)
        .fetch();
      const more = (r.entities ?? []).map(mapRow);
      setItems((arr) => [...arr, ...more]);
      setCursor((r as any).nextCursor ?? null);
      push({ kind: 'info', text: `Loaded ${more.length} more rows.` });
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      setErr(msg);
      push({ kind: 'error', text: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="section">
      <div className="wrap">
        <p className="kicker">Tiramisu</p>
        <h1 className="h2">Explorer</h1>
        <p className="lead" style={{ marginTop: 10 }}>
          Live CanaryDrop entities. Impostor desks are ignored in the app because reads are pinned to the real $creator.
        </p>

        <div className="table-wrap" style={{ marginTop: 18 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Key</th>
                <th>Creator</th>
                <th>Owner</th>
                <th>Expires</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.key}>
                  <td>{it.type}</td>
                  <td>
                    <a href={entityUrl(it.key)} target="_blank" rel="noreferrer">
                      {shortHex(it.key, 8, 6)}
                    </a>
                  </td>
                  <td>
                    <a href={addressUrl(it.creator)} target="_blank" rel="noreferrer">
                      {shortHex(it.creator)}
                    </a>
                  </td>
                  <td>
                    <div>{shortHex(it.owner)}</div>
                    {isSealedOwner(it.owner) && (
                      <span className="pill" style={{ marginTop: 6 }}>
                        Sealed: nobody can change it
                      </span>
                    )}
                  </td>
                  <td>{it.expires}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    {loading ? 'Loading…' : 'No rows yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="ctaRow" style={{ justifyContent: 'flex-start' }}>
          <button className="btn primary" onClick={loadMore} disabled={!cursor || loading} type="button">
            {loading ? 'Loading' : 'Load more'} <span className="arrow" aria-hidden="true" />
          </button>
        </div>
        {err && (
          <div className="muted" style={{ color: '#ffb048', marginTop: 8 }}>
            {err}
          </div>
        )}
      </div>
    </section>
  );
}
