'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { Hex } from 'viem';
import { DEFAULT_DESK, DEFAULT_IMPOSTOR } from '@/lib/constants';
import { explorerPage, type ExplorerKind } from '@/lib/arkiv';
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
  readonly: boolean;
  openExtend: boolean;
};

const KINDS: { id: 'all' | ExplorerKind | 'sealed'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'tip', label: 'Tips' },
  { id: 'sealed', label: 'Sealed tips' },
  { id: 'desk', label: 'Desks' },
  { id: 'canary', label: 'Canaries' },
  { id: 'reply', label: 'Replies' },
];

export default function ExplorerPage() {
  const push = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [atBlock, setAtBlock] = useState<bigint | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<(typeof KINDS)[number]['id']>('all');

  function mapRow(e: {
    key?: Hex;
    creator?: Hex;
    owner?: Hex;
    expiresAt?: bigint;
    attributes?: Parameters<typeof attrStr>[0];
    creationFlags?: { readonly?: boolean; permissionlessExtension?: boolean };
  }): Item | null {
    if (!e.key) return null;
    const creator = e.creator ?? ('0x' as Hex);
    return {
      key: e.key,
      type: attrStr(e.attributes, 'type') ?? 'unknown',
      creator,
      owner: e.owner ?? creator,
      expires: e.expiresAt != null ? String(e.expiresAt) : 'n/a',
      impostor:
        creator.toLowerCase() === DEFAULT_IMPOSTOR.toLowerCase() ||
        (creator.toLowerCase() !== DEFAULT_DESK.toLowerCase() && attrStr(e.attributes, 'type') === 'desk'),
      readonly: e.creationFlags?.readonly === true,
      openExtend: e.creationFlags?.permissionlessExtension === true,
    };
  }

  const load = useCallback(
    async (mode: 'replace' | 'append', nextCursor?: string, nextBlock?: bigint) => {
      try {
        setLoading(true);
        setErr(null);
        const opts: Parameters<typeof explorerPage>[0] = {};
        if (filter === 'sealed') {
          opts.sealed = true;
          opts.kind = 'tip';
        } else if (filter !== 'all') opts.kind = filter;
        if (nextCursor) opts.cursor = nextCursor;
        if (nextBlock !== undefined) opts.atBlock = nextBlock;
        const r = await explorerPage(opts);
        const rows: Item[] = [];
        for (const entity of r.entities) {
          const mapped = mapRow(entity);
          if (mapped) rows.push(mapped);
        }
        setItems((arr) => (mode === 'append' ? [...arr, ...rows] : rows));
        setCursor(r.cursor);
        setAtBlock(r.blockNumber);
        setHasMore(r.hasNextPage());
        if (mode === 'append') push({ kind: 'info', text: `Loaded ${rows.length} more rows.` });
      } catch (e: unknown) {
        const msg = uiError(e);
        setErr(msg);
        push({ kind: 'error', text: msg });
      } finally {
        setLoading(false);
      }
    },
    [filter, push],
  );

  useEffect(() => {
    void load('replace');
  }, [load]);

  return (
    <section className="section">
      <div className="wrap">
        <p className="kicker">Tiramisu</p>
        <h1 className="h2">Explorer</h1>
        <p className="lead" style={{ marginTop: 10 }}>
          Live CanaryDrop entities. Impostor desks are marked. Sealed tips show a burn owner. Readonly means the payload cannot change.
        </p>
        <div className="ctaRow" style={{ justifyContent: 'flex-start', marginTop: 12 }}>
          <Link className="btn" href="/how">
            How we use Arkiv <span className="arrow" aria-hidden="true" />
          </Link>
        </div>

        <div className="filter-row" role="tablist" aria-label="Entity filter" style={{ marginTop: 16 }}>
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              role="tab"
              aria-selected={filter === k.id}
              className={`btn ${filter === k.id ? 'primary' : ''}`}
              onClick={() => setFilter(k.id)}
            >
              {k.label}
            </button>
          ))}
        </div>

        <div className="table-wrap" style={{ marginTop: 18 }}>
          <table className="data-table">
            <caption className="sr-only">CanaryDrop entities on Tiramisu</caption>
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col">Key</th>
                <th scope="col">Creator</th>
                <th scope="col">Owner</th>
                <th scope="col">Expires</th>
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
                    {it.readonly && (
                      <div>
                        <span className="pill" style={{ marginTop: 6 }}>Readonly</span>
                      </div>
                    )}
                    {!it.openExtend && it.readonly && (
                      <div>
                        <span className="pill" style={{ marginTop: 6 }}>No open extend</span>
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
                    <span role="status">{loading ? 'Loading live rows…' : 'No rows for this filter.'}</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="ctaRow" style={{ justifyContent: 'flex-start' }}>
          <button className="btn primary" onClick={() => void load('append', cursor, atBlock)} disabled={!hasMore || loading} type="button">
            {loading ? 'Loading' : 'Load more'} <span className="arrow" aria-hidden="true" />
          </button>
        </div>
        {atBlock !== undefined && (
          <p className="muted" style={{ marginTop: 8 }}>
            Pinned to block {atBlock.toString()} so extra pages cannot shift.
          </p>
        )}
        {err && (
          <div className="muted" style={{ color: '#ffb048', marginTop: 8 }} role="alert">
            {err}
          </div>
        )}
      </div>
    </section>
  );
}
