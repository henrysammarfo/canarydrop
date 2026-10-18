import fs from 'node:fs';
import path from 'node:path';

function readFile(p: string) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

export default function DocsPage() {
  const root = process.cwd();
  const schema = readFile(path.join(root, 'arkiv/schema.md'));
  const friction = readFile(path.join(root, 'arkiv/friction.md'));
  return (
    <section className="section">
      <div className="wrap" style={{ maxWidth: 980 }}>
        <h1 className="h2">Documentation</h1>
        <p className="lead">Architecture overview, schema, and how to run locally.</p>
        <div className="card" style={{ marginTop: 16 }}>
          <strong>Run locally</strong>
          <pre className="muted" style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{`npm i\nnpm run dev\n# Set RELAY_PRIVATE_KEY, DESK_PRIVATE_KEY, NEXT_PUBLIC_* envs`}</pre>
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

