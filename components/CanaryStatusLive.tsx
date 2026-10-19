'use client';

import { useEffect, useState } from 'react';
import type { Hex } from 'viem';
import Link from 'next/link';
import { canaryAtBlock, pub } from '@/lib/arkiv';
import { atBlockAbsenceDetail } from '@/lib/at-block-copy';
import { PROJECT } from '@/lib/constants';
import { addressUrl, entityUrl, TIRAMISU_EXPLORER } from '@/lib/chain';
import CopyField from '@/components/ui/CopyField';
import StaleNote from '@/components/ui/StaleNote';
import CanaryAutoVerify from '@/components/CanaryAutoVerify';
import CanarySig from '@/components/CanarySig';
import DeskListingBadge from '@/components/DeskListingBadge';
import { publicDeskHref } from '@/lib/desk-href';
import { fetchDeskLive, type DeskLiveView } from '@/lib/live-client';
import { withReadBackoff } from '@/lib/retry';

function asTime(
  timing: { currentBlockTime: number; blockDuration: number; currentBlock: bigint },
  atBlock: bigint,
) {
  const duration = timing.blockDuration || 2;
  const raw = timing.currentBlockTime;
  const nowSec = raw > 1e12 ? raw / 1000 : raw;
  const blocksAgo = Number(timing.currentBlock - atBlock);
  const ts = nowSec - blocksAgo * duration;
  const d = new Date(ts * 1000);
  if (Number.isNaN(d.getTime())) return `block ${atBlock.toString()}`;
  return d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
}

const EMPTY: DeskLiveView = {
  creator: '0x0000000000000000000000000000000000000000',
  deskKey: null,
  canaryKey: null,
  alive: false,
  name: 'CanaryDrop desk',
  deskPub: null,
  expiresAt: null,
  createdAt: null,
  currentBlock: null,
  blockDuration: 2,
  domain: null,
  canaryStatement: null,
  canaryIssuedAt: null,
  canarySig: null,
  stale: false,
  staleAgeMs: 0,
  note: null,
};

export default function CanaryStatusLive({ creator }: { creator: Hex }) {
  const [live, setLive] = useState<DeskLiveView>({ ...EMPTY, creator });
  const [pastNote, setPastNote] = useState<string | null>(null);
  const [lastRenewed, setLastRenewed] = useState('...');
  const [lastRenewedBlock, setLastRenewedBlock] = useState<bigint | null>(null);
  const [hoursLeft, setHoursLeft] = useState<number | null>(null);
  const [blocksLeft, setBlocksLeft] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await fetchDeskLive(creator);
      if (cancelled) return;
      setLive(next);
      const head = next.currentBlock ? BigInt(next.currentBlock) : 0n;
      const duration = next.blockDuration || 2;
      const expiresAt = next.expiresAt ? BigInt(next.expiresAt) : null;
      const createdAt = next.createdAt ? BigInt(next.createdAt) : null;
      const current = next.currentBlock ? BigInt(next.currentBlock) : 0n;
      const left = expiresAt ? Number(expiresAt - current) : 0;
      setBlocksLeft(Math.max(0, left));
      setHoursLeft(Math.max(0, (left * duration) / 3600));
      const lifeBlocks = BigInt(Math.round((26 * 3600) / duration));
      let renewed = expiresAt ? expiresAt - lifeBlocks : null;
      if (renewed && createdAt && renewed < createdAt) renewed = createdAt;
      setLastRenewedBlock(renewed);
      if (renewed && next.deskKey && next.canaryKey && head > 0n) {
        try {
          const timing = await withReadBackoff(() => pub().getBlockTiming());
          if (cancelled) return;
          setLastRenewed(asTime(timing, renewed));
          const hourAgo = head > 1800n ? head - 1800n : 0n;
          const past = await withReadBackoff(() => canaryAtBlock(creator, next.deskKey as Hex, hourAgo));
          if (cancelled) return;
          setPastNote(
            atBlockAbsenceDetail({
              hourAgo,
              pastAlive: past !== null,
              createdAt: next.createdAt ? BigInt(next.createdAt) : null,
            }).detail,
          );
        } catch {
          setLastRenewed(renewed ? `block ${renewed.toString()}` : 'Not renewed yet');
        }
      } else {
        setLastRenewed(renewed ? `block ${renewed.toString()}` : 'Not renewed yet');
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [creator]);

  const unavailable = !live.deskKey && !!live.note && !live.stale;
  const alive = live.alive;
  const duration = live.blockDuration || 2;
  const statusWord = !ready ? '...' : unavailable ? 'Not available' : alive ? 'ALIVE' : 'GONE';
  const statusClass = !ready || unavailable ? '' : alive ? 'status-alive' : 'status-gone';
  const head = live.currentBlock ?? '...';
  const query = live.deskKey
    ? `select key, expiresAt where project = "${PROJECT}" and type = "canary" and desk = key(${live.deskKey}) and $expiresAt > u64(${live.currentBlock ?? '0'}) createdBy(${creator}) limit 1`
    : 'Desk not found for this creator.';

  return (
    <section className="section" style={{ paddingBottom: 48 }}>
      <div className="wrap" style={{ maxWidth: 860 }}>
        <p className="kicker">Public warrant canary</p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <h1 className="h2" style={{ margin: 0 }}>Canary status</h1>
          <DeskListingBadge creator={creator} domain={live.domain} />
        </div>
        <p className="lead" style={{ marginTop: 10 }}>
          If this page says GONE, the newsroom has not renewed its canary. That is the signal.
        </p>
        <StaleNote text={live.note} />

        <div className="card" style={{ marginTop: 22, textAlign: 'center', padding: '36px 20px' }}>
          <div className={`status-word ${statusClass}`}>{statusWord}</div>
          {!ready ? (
            <p className="lead" style={{ marginTop: 14 }}>Reading the canary…</p>
          ) : unavailable ? (
            <p className="lead" style={{ marginTop: 14 }}>
              The live canary could not be read just now. This is not a GONE signal.
            </p>
          ) : alive ? (
            <p className="lead" style={{ marginTop: 14 }}>
              {(hoursLeft ?? 0).toFixed(1)} hours left · {blocksLeft ?? 0} blocks left
            </p>
          ) : (
            <p className="lead" style={{ marginTop: 14 }}>
              No live canary for this creator.
            </p>
          )}
        </div>

        <div className="grid cols-2" style={{ marginTop: 16 }}>
          <div className="card">
            <div className="kicker">Last renewed</div>
            <div className="mono" style={{ marginTop: 8 }}>{lastRenewed}</div>
            {lastRenewedBlock && (
              <div className="muted" style={{ marginTop: 6 }}>
                block {lastRenewedBlock.toString()}
              </div>
            )}
            {pastNote && (
              <div className="muted" style={{ marginTop: 8 }}>
                {pastNote}
              </div>
            )}
          </div>
          <div className="card">
            <div className="kicker">Desk wallet</div>
            <div style={{ marginTop: 10 }}>
              <CopyField label="Creator" value={creator} />
            </div>
            <div className="ctaRow" style={{ justifyContent: 'flex-start', marginTop: 12 }}>
              <a className="btn" href={addressUrl(creator)} target="_blank" rel="noreferrer">
                View creator <span className="arrow" aria-hidden="true" />
              </a>
              <a className="btn" href={TIRAMISU_EXPLORER} target="_blank" rel="noreferrer">
                Open explorer <span className="arrow" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="muted">Desk key</div>
          <div style={{ marginTop: 8 }}>
            {live.deskKey ? <CopyField value={live.deskKey} /> : <span className="muted">No live desk found.</span>}
          </div>
          {live.canaryKey && (
            <div style={{ marginTop: 12 }}>
              <div className="muted">Canary key</div>
              <div style={{ marginTop: 8 }}>
                <CopyField value={live.canaryKey} />
              </div>
              <div className="ctaRow" style={{ justifyContent: 'flex-start', marginTop: 12 }}>
                <a className="btn primary" href={entityUrl(live.canaryKey)} target="_blank" rel="noreferrer">
                  View canary entity <span className="arrow" aria-hidden="true" />
                </a>
              </div>
            </div>
          )}
          <div className="muted" style={{ marginTop: 12 }}>
            Latest block {head} · {duration}s per block
          </div>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <strong>Verify this yourself</strong>
          <p className="muted" style={{ marginTop: 8 }}>
            Reads are pinned to this newsroom wallet. An impostor with the same name does not match.
          </p>
          <pre className="query-box">{query}</pre>
        </div>

        <CanaryAutoVerify
          desk={creator}
          statement={live.canaryStatement}
          issuedAt={live.canaryIssuedAt}
          signature={live.canarySig}
        />
        <CanarySig desk={creator} />

        <div className="ctaRow" style={{ justifyContent: 'flex-start' }}>
          <Link className="btn" href={publicDeskHref(creator)}>
            Send this desk a tip <span className="arrow" aria-hidden="true" />
          </Link>
          <Link className="btn" href="/desk">
            Open the desk <span className="arrow" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
