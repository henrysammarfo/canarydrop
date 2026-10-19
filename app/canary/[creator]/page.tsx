import type { Hex } from 'viem';
import Link from 'next/link';
import { canaryAlive, canaryAtBlock, getDesk, pub } from '@/lib/arkiv';
import type { CanaryRow } from '@/lib/arkiv';
import { PROJECT } from '@/lib/constants';
import { addressUrl, entityUrl, shortHex, TIRAMISU_EXPLORER } from '@/lib/chain';
import { uiError } from '@/lib/ui-error';

export const dynamic = 'force-dynamic';

function asTime(timing: { currentBlockTime: number; blockDuration: number; currentBlock: bigint }, atBlock: bigint) {
  const duration = timing.blockDuration || 2;
  const raw = timing.currentBlockTime;
  const nowSec = raw > 1e12 ? raw / 1000 : raw;
  const blocksAgo = Number(timing.currentBlock - atBlock);
  const ts = nowSec - blocksAgo * duration;
  const d = new Date(ts * 1000);
  if (Number.isNaN(d.getTime())) return `block ${atBlock.toString()}`;
  return d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
}

export default async function CanaryStatus({ params }: { params: { creator: string } }) {
  const creator = params.creator as Hex;
  let desk: Awaited<ReturnType<typeof getDesk>> | null = null;
  let canary: CanaryRow | null = null;
  let pastAlive: boolean | null = null;
  let timing: { currentBlock: bigint; currentBlockTime: number; blockDuration: number } | null = null;
  let loadError: string | null = null;
  let head = 0n;

  try {
    timing = await pub().getBlockTiming();
    head = timing.currentBlock;
    desk = (await getDesk(creator)) ?? null;
    if (desk) {
      canary = await canaryAlive(creator, desk.key);
      const hourAgo = head > 1800n ? head - 1800n : 0n;
      pastAlive = !!(await canaryAtBlock(creator, desk.key, hourAgo));
    }
  } catch (e: unknown) {
    loadError = uiError(e);
  }

  const alive = !!canary;
  const duration = timing?.blockDuration || 2;
  const expiresAt = canary?.expiresAt ? BigInt(canary.expiresAt) : null;
  const createdAt = canary?.createdAt ? BigInt(canary.createdAt) : null;
  const current = timing?.currentBlock ?? 0n;
  const blocksLeft = expiresAt ? Number(expiresAt - current) : 0;
  const hoursLeft = Math.max(0, (blocksLeft * duration) / 3600);
  const lifeBlocks = BigInt(Math.round((26 * 3600) / duration));
  let lastRenewedBlock = expiresAt ? expiresAt - lifeBlocks : null;
  if (lastRenewedBlock && createdAt && lastRenewedBlock < createdAt) lastRenewedBlock = createdAt;
  const lastRenewed =
    lastRenewedBlock && timing ? asTime(timing, lastRenewedBlock) : 'Not renewed yet';

  const query = desk
    ? `select key, expiresAt where project = "${PROJECT}" and type = "canary" and desk = key(${desk.key}) and $expiresAt > u64(${head.toString()}) createdBy(${creator}) limit 1`
    : 'Desk not found for this creator.';

  return (
    <section className="section" style={{ paddingBottom: 48 }}>
      <div className="wrap" style={{ maxWidth: 860 }}>
        <p className="kicker">Public warrant canary</p>
        <h1 className="h2">Canary status</h1>
        <p className="lead" style={{ marginTop: 10 }}>
          If this page says GONE, the newsroom has not renewed its canary. That is the signal.
        </p>

        <div className="card" style={{ marginTop: 22, textAlign: 'center', padding: '36px 20px' }}>
          <div className={`status-word ${alive ? 'status-alive' : 'status-gone'}`}>{alive ? 'ALIVE' : 'GONE'}</div>
          {alive ? (
            <p className="lead" style={{ marginTop: 14 }}>
              {hoursLeft.toFixed(1)} hours left · {Math.max(0, blocksLeft)} blocks left
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
            <div style={{ marginTop: 8, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{lastRenewed}</div>
            {lastRenewedBlock && (
              <div className="muted" style={{ marginTop: 6 }}>
                block {lastRenewedBlock.toString()}
              </div>
            )}
            {pastAlive !== null && (
              <div className="muted" style={{ marginTop: 8 }}>
                About one hour ago this canary was {pastAlive ? 'ALIVE' : 'GONE'} at a pinned block.
              </div>
            )}
          </div>
          <div className="card">
            <div className="kicker">Desk wallet</div>
            <div className="creator-badge" style={{ marginTop: 10 }}>
              <span className="pill"><code>$creator</code></span>
              <code>{shortHex(creator, 8, 6)}</code>
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
          <div style={{ marginTop: 6 }}>
            {desk ? <code>{desk.key}</code> : <span className="muted">No live desk found.</span>}
          </div>
          {canary?.key && (
            <div style={{ marginTop: 12 }}>
              <div className="muted">Canary key</div>
              <div style={{ marginTop: 6 }}>
                <code>{canary.key}</code>
              </div>
              <div className="ctaRow" style={{ justifyContent: 'flex-start', marginTop: 12 }}>
                <a className="btn primary" href={entityUrl(canary.key)} target="_blank" rel="noreferrer">
                  View canary entity <span className="arrow" aria-hidden="true" />
                </a>
              </div>
            </div>
          )}
          {timing && (
            <div className="muted" style={{ marginTop: 12 }}>
              Latest block {timing.currentBlock.toString()} · {duration}s per block
            </div>
          )}
          {loadError && <p className="muted" style={{ color: '#ffb048', marginTop: 10 }}>{loadError}</p>}
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <strong>Verify this yourself</strong>
          <p className="muted" style={{ marginTop: 8 }}>
            Reads are pinned to this newsroom wallet. An impostor with the same name does not match.
          </p>
          <pre className="query-box">{query}</pre>
        </div>

        <div className="ctaRow" style={{ justifyContent: 'flex-start' }}>
          <Link className="btn" href={`/d/${creator}`}>
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
