# Static build and self hosting

> **In plain words:** CanaryDrop can be built as a folder of plain files that anyone can host, with no server at all. We publish a list of fingerprints (SHA256 hashes) for every file, so anyone can rebuild it and check they got exactly the same thing we did.

Pinned tools: Node 24.22.0 (`.nvmrc`) with `engines.node` set to `24.x` so Vercel uses Node 24, `npm ci` from `package-lock.json`, `@arkiv-network/sdk` 0.8.1, Tiramisu chain 7738577. The static export uses a fixed `generateBuildId`, a clean build env (`HOME=/tmp/canarydrop-home`, `TZ=UTC`, `LANG=C`), content hashes instead of chunk hashes, and no size based lib split. App chrome lives on desk, explorer, how, and verify layouts so site pages do not pick up an `(app)/layout-*.js` chunk.

The primary static mirror is a separate Vercel project that serves only `out/`. Placeholder URL: https://canarydrop-static.vercel.app. That project has no functions and no API routes. Config: `vercel.static.json` (`buildCommand` `npm run build:static`, `outputDirectory` `out`, plus CSP and no-referrer headers).

A judge on every machine and every checkout path should get the same `out/build.sha256` as `expected.sha256`:

```bash
nvm use
npm ci
npm run build:static
npm run verify:static -- expected.sha256
```

`nvm use` reads `.nvmrc` and must print v24.22.0. `npm ci` installs from `package-lock.json`. `build:static` ignores host `VERCEL_*` and `NEXT_PUBLIC_*` values and pins the demo desk and relay addresses. `verify:static` rebuilds and diffs the file list.

That script moves `app/api` and `middleware.ts` aside, runs Next static export, writes `out/build.sha256`, then puts those files back. The build id defaults to `canarydrop-v7` unless `NEXT_PUBLIC_BUILD_ID` is set. `npm run repro:hash` builds `out/` twice and compares the two manifests.

```bash
diff -u expected.sha256 out/build.sha256
npm run repro:hash
```

Self host the same `out/` folder anywhere:

- Plain static file server: `npx serve out`
- IPFS: `ipfs add -r out`
- Optional GitHub Pages workflow: `.github/workflows/pages.yml` (not required; Actions may be unavailable)

The convenience Vercel app at https://canarydrop.vercel.app keeps the sponsor path, CSRF, CSP nonce, and Origin checks unchanged.

To attach the static mirror project:

```bash
vercel --local-config vercel.static.json
```

Or set that project to Build Command `npm run build:static`, Output Directory `out`, Framework Other.
