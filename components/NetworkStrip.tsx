import { pub } from '@/lib/arkiv';
import { eq } from '@arkiv-network/sdk/query';
import { PROJECT, canaryAlive, getDesk } from '@/lib/arkiv';

export default async function NetworkStrip() {
  async function gather() {
    try {
      const timing = await pub.getBlockTiming();
      const deskAddr = (process.env.NEXT_PUBLIC_DESK_ADDRESS || '0x') as `0x${string}`;
      const relayAddr = (process.env.NEXT_PUBLIC_RELAY_ADDRESS || '0x') as `0x${string}`;
      let lastCanary: string | null = null;
      let tips = 0, desks = 0, canariesAlive = 0;
      try {
        const d = await pub.select({ key: true }).where(eq('project', PROJECT), eq('type','desk')).createdBy(deskAddr).limit(1).fetch();
        desks = d.entities.length;
        if (d.entities[0]) {
          const c = await canaryAlive(deskAddr as any, d.entities[0].key);
          if (c) { canariesAlive = 1; lastCanary = c.expiresAt?.toString() ?? null; }
        }
        const t = await pub.select({ key: true }).where(eq('project', PROJECT), eq('type','tip')).createdBy(relayAddr).limit(50).fetch();
        tips = t.entities.length;
      } catch {}
      return { block: timing.currentBlock.toString(), tips, desks, canariesAlive, lastCanary };
    } catch {
      return { block: '—', tips: 0, desks: 0, canariesAlive: 0, lastCanary: null };
    }
  }
  const data = await gather();
  return (
    <div className="wrap" style={{ marginTop: 18 }}>
      <div className="card" style={{ display: 'flex', gap: 14, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div><span className="muted">Latest block</span><div style={{ fontWeight: 600 }}>{data.block}</div></div>
        <div><span className="muted">Tips sealed</span><div style={{ fontWeight: 600 }}>{data.tips}</div></div>
        <div><span className="muted">Desks</span><div style={{ fontWeight: 600 }}>{data.desks}</div></div>
        <div><span className="muted">Canaries alive</span><div style={{ fontWeight: 600 }}>{data.canariesAlive}</div></div>
        <div>
          <span className="muted">Last canary renewal</span>
          <div style={{ fontWeight: 600 }}>{data.lastCanary ? `expires@ ${data.lastCanary}` : 'None yet'}</div>
        </div>
      </div>
    </div>
  );
}

