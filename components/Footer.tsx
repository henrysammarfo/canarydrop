import { TIRAMISU_EXPLORER } from '@/lib/chain';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="wrap" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>MIT. Built for Arkiv Global Tour on Tiramisu testnet.</div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Link href="/how">How we use Arkiv</Link>
          <a href="https://github.com/henrysammarfo/canarydrop" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a href={TIRAMISU_EXPLORER} target="_blank" rel="noreferrer">
            Tiramisu explorer
          </a>
        </div>
      </div>
    </footer>
  );
}
