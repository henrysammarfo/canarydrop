import { TIRAMISU_EXPLORER } from '@/lib/chain';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="wrap" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ opacity: 0.9 }}>
          MIT · Built for Arkiv Global Tour · Tiramisu testnet
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <a className="btn" href="/how">
            How we use Arkiv <span className="arrow" aria-hidden="true" />
          </a>
          <a className="btn" href="https://github.com/henrysammarfo/canarydrop" target="_blank" rel="noreferrer">
            GitHub <span className="arrow" aria-hidden="true" />
          </a>
          <a className="btn" href={TIRAMISU_EXPLORER} target="_blank" rel="noreferrer">
            Tiramisu explorer <span className="arrow" aria-hidden="true" />
          </a>
        </div>
      </div>
    </footer>
  );
}
