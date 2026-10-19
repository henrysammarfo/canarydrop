import CopyField from '@/components/ui/CopyField';

export default function HowStatic() {
  return (
    <article id="static-build" className="card proof-card" style={{ marginTop: 22 }}>
      <div className="proof-head">
        <h2 className="proof-title">Static build you can host yourself</h2>
      </div>
      <p className="muted" style={{ marginTop: 8 }}>
        The hosted Vercel app is a convenience mirror. The same UI can be built as static files that talk to Tiramisu from the browser. GitHub Pages publishes that build and a SHA256 list of every file.
      </p>
      <div className="proof-facts">
        <CopyField label="Build" value="npm ci && npm run build:static" />
        <CopyField label="Verify" value="npm run verify:static -- out/build.sha256" />
        <CopyField label="Self host" value="npx serve out" />
      </div>
      <pre className="query-box" tabIndex={0}>{`# pinned tools
node 20.18.x
npm ci
STATIC_EXPORT=1 NEXT_PUBLIC_STATIC=1 npm run build:static
# out/build.sha256 lists sha256 of each file
# optional: ipfs add -r out`}</pre>
      <p style={{ marginTop: 10 }}>
        Reads go to the public Tiramisu RPC. Writes use a throwaway in-browser key. The sponsor path needs the Next server and stays optional.
      </p>
    </article>
  );
}
