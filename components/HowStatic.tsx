import CopyField from '@/components/ui/CopyField';
import { STATIC_MIRROR_URL } from '@/lib/constants';

export default function HowStatic() {
  return (
    <article id="static-build" className="card proof-card" style={{ marginTop: 22 }}>
      <div className="proof-head">
        <h2 className="proof-title">Static build you can host yourself</h2>
      </div>
      <p className="muted" style={{ marginTop: 8 }}>
        The hosted Vercel app is a convenience mirror with the sponsor path. The primary static mirror is a separate Vercel project at {STATIC_MIRROR_URL}. It serves only the files in out/. There are no functions and no write API.
      </p>
      <div className="proof-facts">
        <CopyField label="Build" value="nvm use && npm ci && npm run build:static" />
        <CopyField label="Verify" value="npm run verify:static -- expected.sha256" />
        <CopyField label="Self host" value="npx serve out" />
        <CopyField label="Mirror" value={STATIC_MIRROR_URL} />
      </div>
      <pre className="query-box" tabIndex={0}>{`# same hash on every machine
nvm use
npm ci
npm run build:static
npm run verify:static -- expected.sha256
# nvm use reads .nvmrc (24.22.0)
# out/build.sha256 lists
# sha256 of each file
# self host: npx serve out
# or: ipfs add -r out
# optional workflow: .github/workflows/pages.yml
# static Vercel project: vercel.static.json`}</pre>
      <p style={{ marginTop: 10 }}>
        Reads go to the public Tiramisu RPC. Writes use a throwaway in browser key. The sponsor path needs the Next server and stays optional. You can self host the same out/ folder with a plain static file server, IPFS, or the optional GitHub Pages workflow.
      </p>
    </article>
  );
}
