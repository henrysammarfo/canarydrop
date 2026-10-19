'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Hex } from 'viem';
import { DEFAULT_DESK, DEFAULT_IMPOSTOR, SEALED_TIPS_EMPTY } from '@/lib/constants';
import { deskAddress, explorerPage, getDesk, type ExplorerKind } from '@/lib/arkiv';
import { attrKey, attrStr } from '@/lib/attr';
import { addressUrl, entityUrl, isSealedOwner, shortHex } from '@/lib/chain';
import { explorerRowFlags, olderDemoLabel } from '@/lib/explorer-label';
import { fetchSharedDemoPub } from '@/lib/demo-pub-client';
import { bumpGeneration, isStaleGeneration } from '@/lib/load-gen';
import { useToast } from '@/components/Toast';
import { uiError } from '@/lib/ui-error';
import CopyField from '@/components/ui/CopyField';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';

type Item = {
  key: Hex;
  type: string;
  creator: Hex;
  owner: Hex;
  expires: string;
  impostor: boolean;
  canonicalDemo: boolean;
  olderDemo: string | null;
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
  const [canonicalKey, setCanonicalKey] = useState<Hex | undefined>(undefined);
  const gen = useRef({ current: 0 });

  useEffect(() => {
    void (async () => {
      const pub = await fetchSharedDemoPub();
      if (!pub) return;
      const desk = await getDesk(deskAddress(), pub);
      if (desk?.key) setCanonicalKey(desk.key);
    })();
  }, []);

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
    const type = attrStr(e.attributes, 'type') ?? 'unknown';
    const flags = explorerRowFlags({
      type,
      key: e.key,
      creator,
      deskAttr: attrKey(e.attributes, 'desk'),
      canonicalDeskKey: canonicalKey,
      demoCreator: DEFAULT_DESK,
      impostorCreator: DEFAULT_IMPOSTOR,
    });
    return {
      key: e.key,
      type,
      creator,
      owner: e.owner ?? creator,
      expires: e.expiresAt != null ? String(e.expiresAt) : 'n/a',
      impostor: flags.impostor,
      canonicalDemo: flags.canonicalDemo,
      olderDemo: olderDemoLabel(flags),
      readonly: e.creationFlags?.readonly === true,
      openExtend: e.creationFlags?.permissionlessExtension === true,
    };
  }

  const load = useCallback(
    async (mode: 'replace' | 'append', nextCursor?: string, nextBlock?: bigint) => {
      const started = bumpGeneration(gen.current);
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
        if (isStaleGeneration(started, gen.current.current)) return;
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
        if (isStaleGeneration(started, gen.current.current)) return;
        const msg = uiError(e);
        setErr(msg);
        push({ kind: 'error', text: msg });
      } finally {
        if (!isStaleGeneration(started, gen.current.current)) setLoading(false);
      }
    },
    [filter, push, canonicalKey],
  );

  useEffect(() => {
    void load('replace');
  }, [load]);

  return (
    <>
      <PageHeader
        kicker="Tiramisu"
        title="Explorer"
        description="Live CanaryDrop entities. Impostor desks are marked. Sealed tips show a burn owner."
        actions={<Button href="/how">How we use Arkiv</Button>}
      />
        <div className="filter-row" role="tablist" aria-label="Entity filter">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              role="tab"
              aria-selected={filter === k.id}
              className={`btn sm ${filter === k.id ? 'primary' : ''}`}
              onClick={() => setFilter(k.id)}
            >
              {k.label}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 18 }}>
          <Table caption="CanaryDrop entities on Tiramisu">
            <thead>
              <tr>
                <th scope="col" style={{ width: '18%' }}>Type</th>
                <th scope="col" style={{ width: '32%' }}>Key</th>
                <th scope="col" style={{ width: '16%' }}>Creator</th>
                <th scope="col" style={{ width: '22%' }}>Owner</th>
                <th scope="col" style={{ width: '12%' }}>Expires</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.key}>
                  <td>
                    <div className="ctaRow" style={{ gap: 6 }}>
                      <strong>{it.type}</strong>
                      {it.impostor && <span className="pill">Ignored impostor</span>}
                      {it.canonicalDemo && <span className="pill">Canonical demo desk</span>}
                      {it.olderDemo && <span className="pill">{it.olderDemo}</span>}
                      {it.readonly && <span className="pill">Readonly</span>}
                      {!it.openExtend && it.readonly && <span className="pill">No open extend</span>}
                    </div>
                  </td>
                  <td>
                    <CopyField value={it.key} />
                    <a href={entityUrl(it.key)} target="_blank" rel="noreferrer" className="muted" style={{ display: 'inline-block', marginTop: 6 }}>
                      Open
                    </a>
                  </td>
                  <td>
                    <a href={addressUrl(it.creator)} target="_blank" rel="noreferrer" className="muted">
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
                    <span role="status">
                      {loading
                        ? 'Loading live rows…'
                        : filter === 'sealed'
                          ? SEALED_TIPS_EMPTY
                          : 'No rows for this filter.'}
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
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
          <div className="muted" style={{ color: 'var(--warn)', marginTop: 8 }} role="alert">
            {err}
          </div>
        )}
    </>
  );
}
