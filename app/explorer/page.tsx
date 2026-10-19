'use client';

import { useEffect, useState } from 'react';
import type { Hex } from 'viem';
import { DEFAULT_DESK, DEFAULT_IMPOSTOR } from '@/lib/constants';
import { explorerPage } from '@/lib/arkiv';
import { attrStr } from '@/lib/attr';
import { addressUrl, entityUrl, isSealedOwner, shortHex } from '@/lib/chain';
import { useToast } from '@/components/Toast';
import { uiError } from '@/lib/ui-error';

type Item = {
  key: Hex;
  type: string;
  creator: Hex;
  owner: Hex;
  expires: string;
  impostor: boolean;
};

export default function ExplorerPage() {
  const push = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [atBlock, setAtBlock] = useState<bigint | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  function mapRow(e: {
    key?: Hex;
    creator?: Hex;
    owner?: Hex;
    expiresAt?: bigint;
    attributes?: Parameters<typeof attrStr>[0];
  }): Item | null {
    if (!e.key) return null;
    const creator = e.creator ?? ('0x' as Hex);
    return {
      key: e.key,
      type: attrStr(e.attributes, 'type') ?? 'unknown',
      creator,
      owner: e.owner ?? creator,
      expires: e.expiresAt != null ? String(e.expiresAt) : 'n/a',
      impostor: creator.toLowerCase() === DEFAULT_IMPOSTOR.toLowerCase() ||
        (creator.toLowerCase() !== DEFAULT_DESK.toLowerCase() && attrStr(e.attributes, 'type') === 'desk'),
    };
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const r = await explorerPage();
        const rows: Item[] = [];
        for (const entity of r.entities) {
          const mapped = mapRow(entity);
          if (mapped) rows.push(mapped);
        }
        setItems(rows);
        setCursor(r.cursor);
        setAtBlock(r.blockNumber);
      } catch (e: unknown) {
        const msg = uiError(e);
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
      const r = await explorerPage({ cursor, atBlock });
      const more: Item[] = [];
      for (const entity of r.entities) {
        const mapped = mapRow(entity);
        if (mapped) more.push(mapped);
      }
      setItems((arr) => [...arr, ...more]);
      setCursor(r.cursor);
      push({ kind: 'info', text: `Loaded ${more.length} more rows.` });
    } catch (e: unknown) {
      const msg = uiError(e);
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
          Live CanaryDrop entities. Impostor desks are marked. The app only trusts the real desk wallet.
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
                  <td>
                    {it.type}
                    {it.impostor && (
                      <div>
                        <span className="pill" style={{ marginTop: 6 }}>Ignored impostor</span>
                      </div>
                    )}
                  </td>
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
