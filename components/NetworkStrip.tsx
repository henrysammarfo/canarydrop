import { eq } from '@arkiv-network/sdk/query';
import { PROJECT, canaryAlive, getDesk, listDesks, pub } from '@/lib/arkiv';
import { DEFAULT_DESK } from '@/lib/constants';
import { preferPubForCreator } from '@/lib/demo-pub';
import { asAddress } from '@/lib/hex';

export default async function NetworkStrip() {
  async function gather() {
    try {
      const timing = await pub().getBlockTiming();
      const deskAddr = asAddress(process.env.NEXT_PUBLIC_DESK_ADDRESS || '', DEFAULT_DESK);
      const relayAddr = asAddress(process.env.NEXT_PUBLIC_RELAY_ADDRESS || '', '0xa6Aa6a1409eb54028550466169A29EAfd8f7a442');
      let lastCanary: string | null = null;
      let tips = 0;
      let desks = 0;
      let canariesAlive = 0;
      try {
        const listed = await listDesks(deskAddr);
        desks = listed.length;
        const canonical = await getDesk(deskAddr, preferPubForCreator(deskAddr));
        if (canonical) {
          const c = await canaryAlive(deskAddr, canonical.key);
          if (c) {
            canariesAlive = 1;
            lastCanary = c.expiresAt?.toString() ?? null;
          }
        }
        const t = await pub().select({ key: true }).where(eq('project', PROJECT), eq('type', 'tip')).createdBy(relayAddr).limit(50).fetch();
        tips = t.entities.length;
      } catch {
        // Keep the strip visible with zeros if a live query fails.
      }
      return { block: timing.currentBlock.toString(), tips, desks, canariesAlive, lastCanary };
    } catch {
      return { block: 'n/a', tips: 0, desks: 0, canariesAlive: 0, lastCanary: null };
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
          <div style={{ fontWeight: 600 }}>{data.lastCanary ? `Expires at block ${data.lastCanary}` : 'None yet'}</div>
        </div>
      </div>
    </div>
  );
}
