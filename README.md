CanaryDrop: anonymous encrypted tips on Arkiv (Tiramisu)
=========================================================

Tips that can’t be seized. Canaries that can’t be faked.

Live demo: https://canarydrop.vercel.app

Demo video: https://canarydrop.vercel.app/demo.mp4

Verify in 60 seconds, no keys needed
------------------------------------

You do not need a wallet and you do not need to install anything.

1. Open https://canarydrop.vercel.app/verify (or `/verify` on a preview).
2. Open the public canary page. It should say ALIVE if the demo desk has been renewed.
3. Open Submit. Write a fake sentence. Send it. The sponsor pays the fee.
4. Open Explorer. Find a tip row. Sealed tips show the burn owner.
5. Open How we use Arkiv. Each claim is a live Tiramisu read with explorer links.
6. Optional: open Desk, turn on Demo mode. A fresh browser loads a shared testnet desk key so you can read tips. Do not use Demo mode for a real newsroom.

Local readback, still no private keys:

```bash
npm i
NEXT_PUBLIC_DESK_ADDRESS=0x1da3c22c079c264536D831F6F1fCe638aB0b20B0 \
NEXT_PUBLIC_RELAY_ADDRESS=0xa6Aa6a1409eb54028550466169A29EAfd8f7a442 \
npm run verify
```

Threat model: `/threat` and `SECURITY.md`. Friction report: `arkiv/friction.md` (`npm run friction`).
Static build: `docs/static-build.md` and `/how#static-build`. Ethereum gaps: `docs/friction.md`.

Why the Privacy pillar
----------------------
Sources and whistleblowers are exposed when tip‑line databases are seized and when canary pages are quietly edited. CanaryDrop keeps plaintext off servers, locks every tip on the sender’s device, and makes canaries self‑expiring so the absence is the signal.

Why Arkiv (and what stays off Arkiv)
------------------------------------
Arkiv is a Web3 database with entity expiration and lifetime extension. It lets us:
- Prove sealed expiry: tips are read‑only and handed to a burn address; nobody can extend or delete them.
- Tie reads to the real newsroom via `createdBy(...)`, so impostors never match.
- Read directly from Arkiv in the browser; there is no read API to censor.
Kept off Arkiv on purpose: plaintext tips, private keys, IP addresses, identities.

What it is
----------

CanaryDrop is an anonymous, encrypted tip line for small newsrooms. A newsroom operates a “desk” identified by a P‑256 public key published on Arkiv. Sources don’t need a wallet: their tip is encrypted in the browser and posted via a server relay that pays gas. The relay creates the tip entity and, in the same batch, transfers ownership to `0x000000000000000000000000000000000000dEaD`, guaranteeing a sealed expiry: nobody can extend, patch or delete it after creation.

A “warrant canary” entity is renewed daily. If it isn’t renewed within 26 hours, it lapses on its own. The absence is the signal. The newsroom reads tips via a live inbox that connects directly to the Arkiv RPC over WebSocket; decryption happens only in the browser. The desk can reply (encrypted), and the source reads replies at `/r` using their private receipt code stored only on their device.

Why Arkiv (vs Postgres/IPFS/subgraph/own API)
---------------------------------------------

- Immutable expiry guarantees: the sealed-ownership pattern (create + ownership change to `0x…dEaD` in one batch) means even the relay cannot extend or delete a tip later. A database or even most chains without first‑class expirations would require an application policy that can be bypassed by the operator.
- On‑chain access control: every read in the app is pinned to the real newsroom’s `createdBy(deskWallet)` address. An impersonator that publishes a desk with the same “name” from a different wallet is ignored reliably. With Postgres or IPFS this becomes a centralized allow‑list.
- Censorship resistance for reads: the desk and source UIs read directly from Arkiv RPC/WS in the browser. There is no read API to censor. A subgraph or your own API would centralize read access again.
- Built‑in expiry and leasing: canaries and desks use `extendEntity` to renew their leases. Expiry fires no event (see Friction §6), so the app polls the canonical `gt("$expiresAt", u64(head))` query.
- What stays off Arkiv by design: plaintext, private keys (desk P‑256 in the browser with a downloadable backup; the source receipt private key remains only on the source’s device), IP addresses (the relay keeps no logs; platform logs are a residual risk).

Live pages
----------

- `/` : explainer hero and entry points. One sentence for tips, one for the canary.
- `/desk` : newsroom desk dashboard with tabs (Inbox, Canary, Keys, Settings). Single connect button in nav, demo mode toggle in header. Create desk + canary, renew canary, live inbox, reply
- `/d/[creator]` : public desk page: canary badge, submit form
- `/r` : read replies with tip key + receipt code
- `/submit` : submit flow with desk creator picker
- `/explorer` : live feed of CanaryDrop entities on Tiramisu
- `/canary/[creator]` : public canary status page
- `/docs` : architecture, schema and friction report
- `/how` : live Tiramisu proofs for every Arkiv feature the product uses, plus static build verification
- `/verify` : sixty second judge path, no keys needed
- `/threat` : what Arkiv hides, what it does not, and why to use Tor Browser
- `/desk/drop` : demo dead drop on silence (synthetic data only)

Design
------

Full‑viewport dark hero with the Motion Sites “Neural Pathway” artwork as a looping video background (Sora font, subtle entrance animations that honour `prefers-reduced-motion`). Palette nudged to deep navy with cyan (alive) and amber (dead) accents. See `app/globals.css`. The poster frame and veil avoid flashes/illegibility over the video’s centre flare.

Arkiv usage (feature-by-feature)
--------------------------------

All Arkiv calls are implemented in `lib/arkiv.ts` and `lib/relay.ts`, verified against `@arkiv-network/sdk` 0.8.1.

- Create desk + canary in one batch using keys from `predictEntityKeys`:
  - `createDesk(w, owner, name, deskPubRaw)` in `lib/arkiv.ts`
- Renew canary + desk lease:
  - `renew(w, deskKey, canaryKey)`
- Source posts a tip via a relay:
  - Server `postTip(deskKey, wire, life)` in `lib/relay.ts` uses
    - `predictEntityKeys({ owner: relay })`
    - `executeBatch({ creates:[…], ownershipChanges:[{ newOwner: 0x…dEaD }] })`
- Read canary status and list tips:
  - `getDesk(deskCreator)`: desk pinned to the newsroom’s wallet
  - `canaryAlive(deskCreator, deskKey)`: polls (expiry fires no event)
  - `canaryAtBlock(deskCreator, deskKey, block)`: the same canary query at a pinned block
  - `inboxPage(deskKey)`: cursor‑paginated tips, `.createdBy(RELAY)` only, `hasNextPage()`
  - `watchInbox`: WebSocket live events including seal, patch, and delete, then `getEntity` and decrypt client‑side
- Reply (desk) and read replies (source):
  - `reply(w, tipKey, wire)` uses `executeBatch` (same as other writes) and `repliesFor(tipKey, deskCreator)`
- Sealed proof and explorer:
  - `sealedTips()`: `.createdBy(RELAY).ownedBy(0x…dEaD)` plus `creationFlags`
  - `explorerPage({ kind, sealed })`: type filters and burn owner
  - `tipsOrCanaries()`: `or(eq("type","tip"), eq("type","canary"))`
- Honest chain facts:
  - `getEntityNonce(owner)` is the mint counter `predictEntityKeys` reads
  - `getEntityCount()` is every live entity on Tiramisu, not this project. Queries always add `project`.

Crypto
------

Browser‑only ECIES: P‑256 ECDH to HKDF‑SHA256 to AES‑256‑GCM. Tip plaintexts are padded to 2 KiB buckets to reduce length leakage. See `lib/crypto.ts`.

- Source to desk: `sealTo(deskPubRaw, text)` returns `{ wire, receiptJwk }`, where `receiptJwk` is the source’s ephemeral private key in JWK form (kept only by the source).
- Desk to source: `openAsDesk(deskPriv, wire)` returns `{ text, ephPub }` for replies; desk replies with `sealReply(deskPriv, ephPub, text)`.
- Source reads replies with `openReply(receiptPriv, deskPub, wire)`.

Exact queries (schema and indexes)
----------------------------------

Inlined in `arkiv/schema.md` under “Queries the app runs”; reproduced here for convenience:

```ts
// 1. Desk page (source side)
select({key,creator,expiresAt,payload})
  .where(eq("project",P), eq("type","desk"), gt("$expiresAt", u64(head)))
  .createdBy(DESK).limit(1)
// 2. Canary status
select({key,expiresAt,creationFlags,owner})
  .where(eq("project",P), eq("type","canary"), eq("desk", key(deskKey)), gt("$expiresAt", u64(head)))
  .createdBy(DESK).limit(1)
// 3. Desk inbox
select({key,createdAt,expiresAt,payload})
  .where(eq("project",P), eq("type","tip"), eq("desk", key(deskKey)))
  .createdBy(RELAY).limit(50).atBlock(head).cursor(c)
// 4. Replies a source can trust
select({key,payload})
  .where(eq("project",P), eq("type","reply"), eq("tip", key(tipKey)))
  .createdBy(DESK).limit(20)
// 5. Sealed tips (create plus burn owner in one query)
select({key,owner,creator,creationFlags})
  .where(eq("project",P), eq("type","tip"))
  .createdBy(RELAY).ownedBy(0x…dEaD).limit(20)
```

Wallet addresses (testnet only)
-------------------------------

These are used in the demo and on‑chain tests. Keys are never committed; see `/home/.../uploads/canarydrop-testnet-wallets_*.json` locally.

- Relay: `0xa6Aa6a1409eb54028550466169A29EAfd8f7a442`
- Demo desk: `0x1da3c22c079c264536D831F6F1fCe638aB0b20B0`
- Impersonator: `0x97250dcDbE5fB229Fb532AAC0d62be44e028b7Af`
Explorer links:
- Relay: https://hub.arkiv.network/tiramisu/address/0xa6Aa6a1409eb54028550466169A29EAfd8f7a442
- Desk: https://hub.arkiv.network/tiramisu/address/0x1da3c22c079c264536D831F6F1fCe638aB0b20B0
- Impersonator: https://hub.arkiv.network/tiramisu/address/0x97250dcDbE5fB229Fb532AAC0d62be44e028b7Af

Run locally
-----------

Prereqs: Node 20+, pnpm or npm.

1) Install

```bash
npm i
```

2) Create `.env.local` with testnet values:

```bash
# server-only; pays gas for tips
RELAY_PRIVATE_KEY=0x...           # DO NOT commit
# optional demo mode for the desk (server-signed txns)
DESK_PRIVATE_KEY=0x...            # DO NOT commit
# public addrs to verify creator filters in the UI
NEXT_PUBLIC_RELAY_ADDRESS=0xa6Aa6a1409eb54028550466169A29EAfd8f7a442
NEXT_PUBLIC_DESK_ADDRESS=0x1da3c22c079c264536D831F6F1fCe638aB0b20B0
```

3) Dev

```bash
npm run dev
```

4) Build

```bash
npm run build
```

Vercel deployment
-----------------

Set these Environment Variables (Production + Preview):

- `RELAY_PRIVATE_KEY` : server‑only
- `DESK_PRIVATE_KEY` : optional, enables Demo Mode
- `NEXT_PUBLIC_RELAY_ADDRESS` : relay wallet address
- `NEXT_PUBLIC_DESK_ADDRESS` : demo desk creator address

Production URL: https://canarydrop.vercel.app

Shared limits
-------------

Per IP sliding windows and relay or desk wallet locks use a Redis REST store when those env vars are already present. If they are missing, the app still boots. Limits and locks stay in that process, and one warning is logged. The Arkiv daily `slot` cap and the GLM floor still bound spend either way.

Local `npm run dev` without a shared store is expected.

Chain configuration
-------------------

- Chain: Tiramisu testnet (`chainId = 7738577`, hex `0x7614d1`)
- RPC: `https://rpc.tiramisu.db-chain.testnet.arkiv.network`
- WS: `wss://rpc.tiramisu.db-chain.testnet.arkiv.network`
- Native token: GLM (Golem)
- Explorer: `https://hub.arkiv.network/tiramisu`

Landing copy
------------

Tips: Your tip is locked on your device and only the newsroom can open it.

Canary: If the newsroom goes quiet the canary dies on its own.

Relay-free tips
---------------

Sources can send a sealed tip with a throwaway key created in the browser. The tip is still handed to `0x…dEaD` in the same batch. The sponsor path stays optional on the Next server. The static build has no write API of its own.

Verified domain
---------------

`/.well-known/canarydrop.json` lists the desk address. DNS TXT `canarydrop-desk=0x…` is the same claim. Pages show a Verified domain badge when the record matches. A desk that is not the listed address is flagged for fake desk detection.

Dead drop on silence
--------------------

A newsroom can pre-seal a statement to chosen recipients. `predictEntityKeys` books drop, release, and hold keys. The drop is sealed with `changeOwnership`. The hold shares the canary expiry. If the canary lapses, the hold is treated as released. The demo desk seeds synthetic data only.

Static build
------------

```bash
npm ci
npm run build:static
```

`out/build.sha256` is the published SHA256 list. `expected.sha256` is the checked in copy. `npm run verify:static -- expected.sha256` rebuilds and compares. `npm run repro:hash` shows two identical trees hash the same way.

The primary static mirror is a separate Vercel project that serves only `out/` (no functions, no API). Placeholder: https://canarydrop-static.vercel.app. Config: `vercel.static.json`.

Self host the same `out/` folder with a plain static file server (`npx serve out`), IPFS (`ipfs add -r out`), or the optional GitHub Pages workflow in `.github/workflows/pages.yml`. The convenience Vercel app stays at https://canarydrop.vercel.app with the sponsor path.

Security notes
--------------

Full threat model: `SECURITY.md`. Short version:

- Write APIs require an allowed Origin. A missing Origin is 403. Host checks are exact hostname matches, not `includes()`.
- Same-origin GET reads allow a missing Origin when `Sec-Fetch-Site` is `same-origin` (real browsers omit Origin on those GETs). Writes still require Origin.
- CSRF cookie `cd_csrf` must match header `x-csrf-token`. `Sec-Fetch-Site: cross-site` and `same-site` are rejected.
- The relay calls `getEntity` and refuses to pay if the target is not a live CanaryDrop desk.
- Concurrent tips take a Redis lock per relay or desk wallet when a REST store is configured, then a per process queue, a pending nonce, and backoff. A mutation error with a tx hash is not retried. Redis is not used as an Ethereum nonce counter.
- Durable spend caps live on Arkiv: `slot` is the UTC day on new tips, replies, and desks. GLM below 0.02 stops writes. Per IP sliding windows use a Redis REST store when those env vars are set. If they are missing, the app still runs with an in process window and logs one warning.
- Ciphertext cap is 8192 bytes after base64 decode. Zod and the relay share that constant.
- Route handlers map failures to public codes. RPC text and stacks are not returned.
- CSP drops `unsafe-eval`, uses a per request script nonce with `strict-dynamic`, and allowlists Tiramisu RPC on `connect-src`. `style-src` still has `unsafe-inline` because React sets element styles.
- Demo mode fetches a shared testnet P-256 key derived from `DESK_PRIVATE_KEY` so a fresh browser can open demo tips. That key is not committed.

Friction and SDK notes
----------------------

See `arkiv/friction.md` (F1 to F25, live error text from Tiramisu). Repro: `npm run friction` runs `arkiv/repro/run-all.mjs`. Only issues reproduced in this repo are listed.

AI usage
--------

This project’s UI was styled against a provided “Neural Pathway” motion design brief. Code generation assistants were used to scaffold Next.js pages and CSS and to speed up boilerplate, but all Arkiv calls were implemented by hand against the SDK and verified with the docs and the SDK’s source. All cryptography was implemented against WebCrypto and is tested by round‑trip.

What’s verified on-chain
---------------------------------------------

On Tiramisu the relay `0xa6Aa6a1409eb54028550466169A29EAfd8f7a442` and desk `0x1da3c22c079c264536D831F6F1fCe638aB0b20B0` are live. Evidence in `arkiv/evidence.json`: desk `0x874e543a36fd673980ca4f2cd992ef9ac1aca38218f1232452bb5d7a7fac6231` and canary `0x5a9cc9685585f462cc85dfdc2884f06309aa2cda9cc10acfeaa1a260e5a7cc70` created together at https://tiramisu.explorer.arkiv.network/tx/0x6558bfd29237fd4b131fbee1d74f13ac3ce1152d88a5ae05d24d5f33a1dc35be. Three sealed tips at https://tiramisu.explorer.arkiv.network/tx/0xfba666e2ed91c4cd35f0020959cfe48520247f3ab6a96efa1b5e0ed2868744d9, https://tiramisu.explorer.arkiv.network/tx/0x2401d9b57ae4545d4f2aee716476db731bcd7cc260c9c1ae42f1ec5e0b6df83c, and https://tiramisu.explorer.arkiv.network/tx/0x96c37ab0a3592f02abe6ac75565fb5b0c400bb451156d2c156246728f3fc886f. Reply at https://tiramisu.explorer.arkiv.network/tx/0x3372344033724934a4e5cd09d9512fc1cf5cf221a5e05f11daecd814055227c1. Lifetime extension at https://tiramisu.explorer.arkiv.network/tx/0x348fcd830adef7e6cbf5e8201d425e208ef01be8cc6321e41bfa1a6b5f5df466. Impersonator desk at https://tiramisu.explorer.arkiv.network/tx/0x953418573cb61d2e3174f1729162d0ee76e280c43e3633ccba3956b500ff4706. Readback at head 749645 saw 1 desk and 3 tips.

Tests
-----

Run these locally. Do not wait on hosted workflows.

- Unit: crypto, origin, CSRF, rate limit, Redis store, wallet lock, retry, CSP, schemas, errors, spend caps, chain helpers, proofs text, EIP-712, SIWE, stealth addresses, dead drop, verified domain, Tor banner, static runtime
- API: tip and demo routes, missing Origin, CSRF mismatch, size caps, missing desk, demo key
- Integration: live Tiramisu reads (sealed tips, `ownedBy`, flags, nonce, count), inbox pagination mock, dry run against a live desk
- E2E: routes including `/how`, `/threat`, `/desk/drop`, mobile overflow, dry run toast, desk Demo mode, real-browser demo key GET, CSP header, verify page, CSRF cookie, landing copy, well known record

Current local counts: 428 vitest, 137 Playwright (134 passed, 3 skipped without PRODUCTION_URL).

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

Load test (autocannon, production)
----------------------------------

| Target | Connections | Duration | Avg req/s | Avg latency |
|---|---:|---:|---:|---:|
| `/` (Vercel prod) | 10 | 5 s | ~2938 | ~2.9 ms |

Notes: includes static asset misses counted as non‑200 by autocannon output; primary HTML route sustained comfortably within limits.

Dry‑run mode
------------

All write APIs support a dry‑run that builds and simulates the transaction without broadcasting. Add `?dryRun=1` or header `x-dry-run: 1`. Returns predicted entity keys and attributes. Used in tests to exercise flows without test tokens.

Arkiv patterns and references adopted
-------------------------------------

- Predict then create and reference in a single batch (SDK `predictEntityKeys` + `executeBatch`): inspired by `arkiv-sdk-js` examples and `dashboard-demo`.
- Read‑only creator filters (`.createdBy(wallet)`) to ignore impersonators: seen in `builders-challenge-online-forum-example`.
- Ownership sealing to `0x…dEaD` in the same batch using `executeBatch.ownershipChanges`, making tips unchangeable until expiry: pattern discussed in Arkiv DevRel posts.
- WebSocket live event watching (`watchEntityEvents` with a real `webSocket()` transport) then `getEntity` to inspect attributes: validated against `docs` and `code-samples`.
- Explicit expiry management via `ExpirationTime` and `extendEntity` for canaries and desk leases.
- All calls verified against `arkiv-sdk-js` v0.8.x source and docs prior to shipping.

Wallets (testnet)
-----------------

- Relay: `0xa6Aa6a1409eb54028550466169A29EAfd8f7a442` ([Explorer](https://hub.arkiv.network/tiramisu/address/0xa6Aa6a1409eb54028550466169A29EAfd8f7a442))
- Desk: `0x1da3c22c079c264536D831F6F1fCe638aB0b20B0` ([Explorer](https://hub.arkiv.network/tiramisu/address/0x1da3c22c079c264536D831F6F1fCe638aB0b20B0))
- Impersonator: `0x97250dcDbE5fB229Fb532AAC0d62be44e028b7Af` ([Explorer](https://hub.arkiv.network/tiramisu/address/0x97250dcDbE5fB229Fb532AAC0d62be44e028b7Af))

Submission checklist (Arkiv Global Tour Stop)
---------------------------------------------

- MIT license in repo root: Yes (`LICENSE`)
- Live deployment URL in README: Yes
- `arkiv/schema.md` present at `arkiv/schema.md`: Yes
- `arkiv/friction.md` present at `arkiv/friction.md`, with reproduced issues and repro script path: Yes
- Wallet addresses listed in README: Yes
- Synthetic data only, no personal data on Arkiv: Yes
- Source UI requires no wallet; relay posts tips: Yes
- Canary renewal implemented and documented: Yes
- Docs page with schema and notes: Yes
- Demo-mode toggle and no keys shipped to client by default: Yes
- Tests and load checks included, results in README: Yes
- Pre-existing work: none, built Oct 9 to 18, 2026
- Demo video: https://canarydrop.vercel.app/demo.mp4

How judges can reproduce
------------------------
Start at `/verify`. That is the sixty second path. Then use the explorer links in `arkiv/evidence.json` if you want the older on chain seed.

On‑chain evidence (Tiramisu)
----------------------------
- Desk `0x874e543a36fd673980ca4f2cd992ef9ac1aca38218f1232452bb5d7a7fac6231` and canary `0x5a9cc9685585f462cc85dfdc2884f06309aa2cda9cc10acfeaa1a260e5a7cc70` created atomically. Tx https://tiramisu.explorer.arkiv.network/tx/0x6558bfd29237fd4b131fbee1d74f13ac3ce1152d88a5ae05d24d5f33a1dc35be
- Sealed tips:  
  `0xd4f74471b97a44751650ccb4fd473a6056715d327497838f2a1c36da13e67f51` : https://tiramisu.explorer.arkiv.network/tx/0xfba666e2ed91c4cd35f0020959cfe48520247f3ab6a96efa1b5e0ed2868744d9  
  `0xb4301aeffa5a5364d2de46b6485c04cc44fcf2000ebc1194a672769d5014cab8` : https://tiramisu.explorer.arkiv.network/tx/0x2401d9b57ae4545d4f2aee716476db731bcd7cc260c9c1ae42f1ec5e0b6df83c  
  `0x4e65bf8206c285562c47d5893f15c7f78beb06337e80fe3414b1c196ebfc82b2` : https://tiramisu.explorer.arkiv.network/tx/0x96c37ab0a3592f02abe6ac75565fb5b0c400bb451156d2c156246728f3fc886f
- Reply: https://tiramisu.explorer.arkiv.network/tx/0x3372344033724934a4e5cd09d9512fc1cf5cf221a5e05f11daecd814055227c1
- Renew canary and desk (lifetime extension): https://tiramisu.explorer.arkiv.network/tx/0x348fcd830adef7e6cbf5e8201d425e208ef01be8cc6321e41bfa1a6b5f5df466
- Impersonator fake desk `0x4d8e321f65850a6ea1d7bfa5bc59a2256e1cf9e09007011f69cb5d61645106ef`: https://tiramisu.explorer.arkiv.network/tx/0x953418573cb61d2e3174f1729162d0ee76e280c43e3633ccba3956b500ff4706

License
-------

MIT. See `LICENSE`.

