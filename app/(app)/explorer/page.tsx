'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Hex } from 'viem';
import { CHAIN_READ_FAILED, DEFAULT_DESK, DEFAULT_IMPOSTOR, SEALED_TIPS_EMPTY } from '@/lib/constants';
import { deskAddress, explorerPage, getDesk, pub, type ExplorerKind } from '@/lib/arkiv';
import { attrKey, attrStr } from '@/lib/attr';
import { addressUrl, entityUrl, isSealedOwner, shortHex } from '@/lib/chain';
import { explorerRowFlags, explorerTypeBadges, olderDemoLabel, SEALED_BADGE } from '@/lib/explorer-label';
import { fetchSharedDemoPub } from '@/lib/demo-pub-client';
import { bumpGeneration, isStaleGeneration } from '@/lib/load-gen';
import { sleep, withBackoff } from '@/lib/retry';
import { remainingPhrase } from '@/lib/time';
import Flag from '@/components/ui/Flag';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';

type Item = {
  key: Hex;
  type: string;
  creator: Hex;
  owner: Hex;
  expiresAt: bigint | null;
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

function CopyAction({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn sm"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        });
      }}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function TypeFlags({ item }: { item: Item }) {
  const flags = explorerTypeBadges({
    impostor: item.impostor,
    canonicalDemo: item.canonicalDemo,
    olderDemoDesk: item.olderDemo === 'Older demo desk, replaced',
    olderDemoCanary: item.olderDemo === 'Older demo canary, replaced',
  });
  return (
    <span className="flag-row">
      <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{item.type}</strong>
      {flags.map((b) => (
        <Flag key={b.full} short={b.short} full={b.full} tone={b.short === 'Canonical' ? 'gold' : b.short === 'Impostor' ? 'wait' : 'muted'} />
      ))}
      {item.readonly && <Flag short="Readonly" full="Readonly: nobody can change it" />}
      {!item.openExtend && item.readonly && <Flag short="Locked" full="No open extend" />}
    </span>
  );
}

function expiryView(expiresAt: bigint | null, current: bigint | null, duration: number) {
  if (expiresAt == null) return { text: 'n/a', title: 'No expiry on this entity' };
  const title = `Block ${expiresAt.toString()}`;
  if (current == null) return { text: `block ${expiresAt.toString()}`, title };
  return { text: remainingPhrase(expiresAt, current, duration), title };
}

export default function ExplorerPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [atBlock, setAtBlock] = useState<bigint | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<(typeof KINDS)[number]['id']>('all');
  const [canonicalKey, setCanonicalKey] = useState<Hex | undefined>(undefined);
  const [currentBlock, setCurrentBlock] = useState<bigint | null>(null);
  const [blockDuration, setBlockDuration] = useState(2);
  const gen = useRef({ current: 0 });

  useEffect(() => {
    void (async () => {
      const shared = await fetchSharedDemoPub();
      if (!shared) return;
      try {
        const desk = await getDesk(deskAddress(), shared);
        if (desk?.key) setCanonicalKey(desk.key);
      } catch {
        // Labels still work from the known replaced keys.
      }
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
      expiresAt: e.expiresAt ?? null,
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
        const r = await withBackoff(() => explorerPage(opts), 8, (ms) => sleep(Math.max(400, ms)));
        if (isStaleGeneration(started, gen.current.current)) return;
        try {
          const timing = await pub().getBlockTiming();
          if (!isStaleGeneration(started, gen.current.current)) {
            setCurrentBlock(timing.currentBlock);
            setBlockDuration(timing.blockDuration || 2);
          }
        } catch {
          // Expiry can fall back to the raw block number.
        }
        const rows: Item[] = [];
        for (const entity of r.entities) {
          const mapped = mapRow(entity);
          if (mapped) rows.push(mapped);
        }
        setItems((arr) => (mode === 'append' ? [...arr, ...rows] : rows));
        setCursor(r.cursor);
        setAtBlock(r.blockNumber);
        setHasMore(r.hasNextPage());
      } catch {
        if (isStaleGeneration(started, gen.current.current)) return;
        setErr(CHAIN_READ_FAILED);
      } finally {
        if (!isStaleGeneration(started, gen.current.current)) setLoading(false);
      }
    },
    [filter, canonicalKey],
  );

  useEffect(() => {
    void load('replace');
  }, [load]);

  useEffect(() => {
    if (!err || items.length > 0 || loading) return;
    const timer = window.setTimeout(() => {
      void load('replace');
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [err, items.length, loading, load]);

  function rowActions(it: Item) {
    return (
      <div className="ctaRow">
        <CopyAction value={it.key} />
        <a href={entityUrl(it.key)} target="_blank" rel="noreferrer" className="btn sm">
          Open
        </a>
      </div>
    );
  }

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

        {loading && items.length === 0 && (
          <p className="muted" role="status" style={{ marginTop: 18 }}>
            Loading live rows…
          </p>
        )}

        <div className="explorer-table" style={{ marginTop: 18 }}>
          <Table caption="CanaryDrop entities on Tiramisu">
            <thead>
              <tr>
                <th scope="col" style={{ width: '28%' }}>Type</th>
                <th scope="col" style={{ width: '22%' }}>Key</th>
                <th scope="col" style={{ width: '14%' }}>Creator</th>
                <th scope="col" style={{ width: '16%' }}>Owner</th>
                <th scope="col" style={{ width: '10%' }}>Expires</th>
                <th scope="col" style={{ width: '10%' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const exp = expiryView(it.expiresAt, currentBlock, blockDuration);
                return (
                  <tr key={it.key}>
                    <td>
                      <TypeFlags item={it} />
                    </td>
                    <td>
                      <span className="key-mono" title={it.key}>
                        {shortHex(it.key)}
                      </span>
                    </td>
                    <td>
                      <a href={addressUrl(it.creator)} target="_blank" rel="noreferrer" className="muted">
                        {shortHex(it.creator)}
                      </a>
                    </td>
                    <td>
                      <span className="flag-row">
                        <span title={it.owner}>{shortHex(it.owner)}</span>
                        {isSealedOwner(it.owner) && <Flag short={SEALED_BADGE.short} full={SEALED_BADGE.full} tone="ok" />}
                      </span>
                    </td>
                    <td>
                      <span title={exp.title}>{exp.text}</span>
                    </td>
                    <td className="actions-cell">{rowActions(it)}</td>
                  </tr>
                );
              })}
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="muted" style={{ whiteSpace: 'normal', height: 'auto' }}>
                    <span role="status">
                      {filter === 'sealed' ? SEALED_TIPS_EMPTY : 'No rows for this filter.'}
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>

        <div className="explorer-cards" style={{ marginTop: 18 }}>
          {items.map((it) => {
            const exp = expiryView(it.expiresAt, currentBlock, blockDuration);
            return (
              <article key={it.key} className="explorer-card">
                <header>
                  <TypeFlags item={it} />
                </header>
                <code className="key-mono" title={it.key}>
                  {shortHex(it.key, 10, 8)}
                </code>
                <div className="meta">
                  <span>
                    <span>Creator</span>
                    <a href={addressUrl(it.creator)} target="_blank" rel="noreferrer">
                      {shortHex(it.creator)}
                    </a>
                  </span>
                  <span>
                    <span>Owner</span>
                    <span className="flag-row">
                      {shortHex(it.owner)}
                      {isSealedOwner(it.owner) && <Flag short={SEALED_BADGE.short} full={SEALED_BADGE.full} tone="ok" />}
                    </span>
                  </span>
                  <span>
                    <span>Expires</span>
                    <span title={exp.title}>{exp.text}</span>
                  </span>
                </div>
                {rowActions(it)}
              </article>
            );
          })}
          {items.length === 0 && !loading && (
            <p className="muted" role="status">
              {filter === 'sealed' ? SEALED_TIPS_EMPTY : 'No rows for this filter.'}
            </p>
          )}
        </div>

        <div className="ctaRow" style={{ justifyContent: 'flex-start', marginTop: 16 }}>
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
