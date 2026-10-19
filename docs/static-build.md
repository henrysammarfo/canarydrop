# Static build and self hosting

Pinned tools: Node 20.18.0 exactly (`.nvmrc` and `engines.node`), `npm ci` from `package-lock.json`, `@arkiv-network/sdk` 0.8.1, Tiramisu chain 7738577. The static hash changes if the Node version does not match. The static export uses a fixed `generateBuildId` and deterministic webpack module/chunk ids. App chrome lives on desk, explorer, how, and verify layouts so site pages do not pick up an `(app)/layout-*.js` chunk.

The primary static mirror is a separate Vercel project that serves only `out/`. Placeholder URL: https://canarydrop-static.vercel.app. That project has no functions and no API routes. Config: `vercel.static.json` (`buildCommand` `npm run build:static`, `outputDirectory` `out`, plus CSP and no-referrer headers).

```bash
npm ci
npm run build:static
```

That script moves `app/api` and `middleware.ts` aside, runs Next static export, writes `out/build.sha256`, then puts those files back. The build id defaults to `canarydrop-v7` unless `NEXT_PUBLIC_BUILD_ID` is set. `npm run repro:hash` builds `out/` twice and compares the two manifests.

Verify a published hash:

```bash
npm run verify:static -- expected.sha256
# or
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
