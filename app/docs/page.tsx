import fs from 'node:fs';
import path from 'node:path';
import Link from 'next/link';

function readFile(p: string) {
  try {
    return fs.readFileSync(p, 'utf8').replace(/[\u2013\u2014]/g, ' ');
  } catch {
    return null;
  }
}

export default function DocsPage() {
  const root = process.cwd();
  const schema = readFile(path.join(root, 'arkiv/schema.md'));
  const friction = readFile(path.join(root, 'arkiv/friction.md'));
  return (
    <section className="section">
      <div className="wrap" style={{ maxWidth: 980 }}>
        <p className="kicker">For judges</p>
        <h1 className="h2">Documentation</h1>
        <p className="lead" style={{ marginTop: 10 }}>
          How the tip line works, what lives on Arkiv, and how to run it locally.
        </p>
        <div className="grid cols-2" style={{ marginTop: 18 }}>
          <div className="card">
            <strong>Run locally</strong>
            <pre className="muted" style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{`npm i\nnpm run dev`}</pre>
            <p className="muted" style={{ marginTop: 8 }}>Set RELAY_PRIVATE_KEY, DESK_PRIVATE_KEY and NEXT_PUBLIC values in a local env file. Do not commit them.</p>
          </div>
          <div className="card">
            <strong>Live pages</strong>
            <div className="ctaRow" style={{ justifyContent: 'flex-start', marginTop: 10 }}>
              <Link className="btn" href="/verify">Verify <span className="arrow" aria-hidden="true" /></Link>
              <Link className="btn" href="/how">How we use Arkiv <span className="arrow" aria-hidden="true" /></Link>
              <Link className="btn" href="/submit">Submit <span className="arrow" aria-hidden="true" /></Link>
              <Link className="btn" href="/desk">Desk <span className="arrow" aria-hidden="true" /></Link>
              <Link className="btn" href="/explorer">Explorer <span className="arrow" aria-hidden="true" /></Link>
            </div>
          </div>
        </div>
        <div className="card" style={{ marginTop: 16 }}>
          <strong>Threat model</strong>
          <p className="muted" style={{ marginTop: 8 }}>Read SECURITY.md in the repo for attacks we block, residual risk, and why Demo mode exists.</p>
        </div>
        <div className="card" style={{ marginTop: 16 }}>
          <strong>Arkiv schema</strong>
          <pre className="muted" style={{ whiteSpace: 'pre-wrap', marginTop: 8, maxHeight: 420, overflow: 'auto' }}>{schema ?? 'schema.md not found'}</pre>
        </div>
        <div className="card" style={{ marginTop: 16 }}>
          <strong>Friction report</strong>
          <pre className="muted" style={{ whiteSpace: 'pre-wrap', marginTop: 8, maxHeight: 420, overflow: 'auto' }}>{friction ?? 'friction.md not found'}</pre>
        </div>
      </div>
    </section>
  );
}
