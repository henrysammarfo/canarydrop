import type { Hex } from 'viem';
import { canaryAlive, getDesk } from '@/lib/arkiv';

export default async function CanaryStatus({ params }: { params: { creator: Hex } }) {
  const creator = params.creator as Hex;
  const desk = await getDesk(creator);
  const alive = desk ? await canaryAlive(creator, desk.key) : null;
  return (
    <section className="section">
      <div className="wrap" style={{ maxWidth: 780 }}>
        <h1 className="h2">Canary status</h1>
        {!desk && <p className="lead">No live desk found for creator <code>{creator}</code>.</p>}
        {desk && (
          <div className="card" style={{ marginTop: 12 }}>
            <div><strong>Desk</strong> <code>{desk.key}</code></div>
            <div style={{ marginTop: 6 }}>
              Status:&nbsp;
              {alive ? <span style={{ color: '#7ae6ff' }}>ALIVE</span> : <span style={{ color: '#ffb048' }}>DEAD</span>}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

