# Static build and self hosting

Pinned tools: Node 20.18.x, `npm ci` from `package-lock.json`, `@arkiv-network/sdk` 0.8.1, Tiramisu chain 7738577.

The primary static mirror is a separate Vercel project that serves only `out/`. Placeholder URL: https://canarydrop-static.vercel.app. That project has no functions and no API routes. Config: `vercel.static.json` (`buildCommand` `npm run build:static`, `outputDirectory` `out`, plus CSP and no-referrer headers).

```bash
npm ci
npm run build:static
```

That script moves `app/api` and `middleware.ts` aside, runs Next static export, writes `out/build.sha256`, then puts those files back. The build id is the git commit SHA when available.

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
