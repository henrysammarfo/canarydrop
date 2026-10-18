import { pub } from '@/lib/arkiv';
import { eq } from '@arkiv-network/sdk/query';
import { PROJECT, canaryAlive, getDesk } from '@/lib/arkiv';

export default async function NetworkStrip() {
  async function gather() {
    try {
      const timing = await pub.getBlockTiming();
      const deskAddr = (process.env.NEXT_PUBLIC_DESK_ADDRESS || '0x') as `0x${string}`;
      let lastCanary: string | null = null;
      try {
        const desk = await getDesk(deskAddr as any);
        if (desk) {
          const c = await canaryAlive(deskAddr as any, desk.key);
          if (c) lastCanary = c.expiresAt?.toString() ?? null;
        }
      } catch {}
      let approx = '—';
      try {
        const r = await pub.select({ key: true }).where(eq('project', PROJECT)).limit(100).fetch();
        approx = r.entities.length >= 100 ? `>= ${r.entities.length}` : `${r.entities.length}`;
      } catch {}
      return { block: timing.currentBlock.toString(), approx, lastCanary };
    } catch {
      return { block: '—', approx: '—', lastCanary: null };
    }
  }
  const data = await gather();
  return (
    <div className="wrap" style={{ marginTop: 18 }}>
      <div className="card" style={{ display: 'flex', gap: 14, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div><span className="muted">Latest block</span><div style={{ fontWeight: 600 }}>{data.block}</div></div>
        <div><span className="muted">CanaryDrop entities</span><div style={{ fontWeight: 600 }}>{data.approx}</div></div>
        <div>
          <span className="muted">Last canary renewal</span>
          <div style={{ fontWeight: 600 }}>{data.lastCanary ? `expires@ ${data.lastCanary}` : '—'}</div>
        </div>
      </div>
    </div>
  );
}

