# Static build and self hosting

Pinned tools: Node 20.18.x, `npm ci` from `package-lock.json`, `@arkiv-network/sdk` 0.8.1, Tiramisu chain 7738577.

```bash
npm ci
STATIC_EXPORT=1 NEXT_PUBLIC_STATIC=1 npm run build:static
```

That script moves `app/api` and `middleware.ts` aside, runs Next static export, writes `out/build.sha256`, then puts those files back.

Verify a published hash:

```bash
npm run verify:static -- path/to/build.sha256
```

Self host the `out/` folder with any static file server. The browser reads and writes Tiramisu directly. You do not need our Next server.

Optional: `ipfs add -r out`.

The Vercel app stays as a convenience mirror with the sponsor path, CSRF, CSP nonce, and Origin checks unchanged.
