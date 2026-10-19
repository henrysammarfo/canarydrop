'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CHAIN_READ_FAILED, SEALED_TIPS_EMPTY } from '@/lib/constants';
import { explorerPage, pub, type ExplorerKind } from '@/lib/arkiv';
import { addressUrl, entityUrl, isSealedOwner, shortHex } from '@/lib/chain';
import { explorerTypeBadges, SEALED_BADGE } from '@/lib/explorer-label';
import { mapExplorerEntity, type ExplorerItem } from '@/lib/explorer-map';
import { fetchExplorerLive } from '@/lib/live-client';
import { bumpGeneration, isStaleGeneration } from '@/lib/load-gen';
import { sleep, withBackoff } from '@/lib/retry';
import { remainingPhrase } from '@/lib/time';
import Flag from '@/components/ui/Flag';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';

type Item = ExplorerItem;

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
  const sealed = isSealedOwner(item.owner);
  return (
    <span className="flag-row">
      <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{item.type}</strong>
      {flags.map((b) => (
        <Flag key={b.full} short={b.short} full={b.full} tone={b.short === 'Canonical' ? 'gold' : b.short === 'Impostor' ? 'wait' : 'muted'} />
      ))}
      {item.readonly && <Flag short="Readonly" full="Readonly: nobody can change it" />}
      {sealed ? (
        <Flag short={SEALED_BADGE.short} full={SEALED_BADGE.full} tone="ok" />
      ) : !item.openExtend && item.readonly ? (
        <Flag short="Locked" full="No open extend" />
      ) : null}
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
  const [canonicalKey, setCanonicalKey] = useState<Item['key'] | undefined>(undefined);
  const [currentBlock, setCurrentBlock] = useState<bigint | null>(null);
  const [blockDuration, setBlockDuration] = useState(2);
  const gen = useRef({ current: 0 });

  const load = useCallback(
    async (mode: 'replace' | 'append', nextCursor?: string, nextBlock?: bigint) => {
      const started = bumpGeneration(gen.current);
      try {
        setLoading(true);
        setErr(null);
        try {
          const liveOpts: { cursor?: string; atBlock?: bigint } = {};
          if (nextCursor) liveOpts.cursor = nextCursor;
          if (nextBlock !== undefined) liveOpts.atBlock = nextBlock;
          const live = await fetchExplorerLive(filter, liveOpts);
          if (isStaleGeneration(started, gen.current.current)) return;
          setItems((arr) => (mode === 'append' ? [...arr, ...live.items] : live.items));
          setCursor(live.cursor);
          setAtBlock(live.atBlock);
          setHasMore(live.hasMore);
          if (live.currentBlock != null) setCurrentBlock(live.currentBlock);
          setBlockDuration(live.blockDuration);
          if (live.canonicalDeskKey) setCanonicalKey(live.canonicalDeskKey);
          return;
        } catch {
          // Fall through to a direct chain read from this browser.
        }
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
          const mapped = mapExplorerEntity(entity, canonicalKey);
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
            <colgroup>
              <col className="col-type" />
              <col className="col-key" />
              <col className="col-creator" />
              <col className="col-owner" />
              <col className="col-expires" />
              <col className="col-actions" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col">Key</th>
                <th scope="col">Creator</th>
                <th scope="col">Owner</th>
                <th scope="col">Expires</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const exp = expiryView(it.expiresAt, currentBlock, blockDuration);
                return (
                  <tr key={it.key}>
                    <td className="type-cell">
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
                    <td className="owner-cell">
                      <span className="key-mono" title={isSealedOwner(it.owner) ? `${it.owner} (sealed)` : it.owner}>
                        {shortHex(it.owner)}
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
                      {err
                        ? 'Still reading Tiramisu…'
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
                    <span className="key-mono" title={isSealedOwner(it.owner) ? `${it.owner} (sealed)` : it.owner}>
                      {shortHex(it.owner)}
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
              {err
                ? 'Still reading Tiramisu…'
                : filter === 'sealed'
                  ? SEALED_TIPS_EMPTY
                  : 'No rows for this filter.'}
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
