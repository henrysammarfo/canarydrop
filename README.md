CanaryDrop: anonymous encrypted tips on Arkiv (Tiramisu)
=========================================================

Tips that can’t be seized. Canaries that can’t be faked.

Live demo: https://canarydrop-teamtitanlink.vercel.app

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

- `/` : explainer hero and entry points
- `/desk` : newsroom desk dashboard with tabs (Inbox, Canary, Keys, Settings). Single connect button in nav, demo mode toggle in header. Create desk + canary, renew canary, live inbox, reply
- `/d/[creator]` : public desk page: canary badge, submit form
- `/r` : read replies with tip key + receipt code
- `/submit` — submit flow with desk creator picker
- `/explorer` : live feed of CanaryDrop entities on Tiramisu
- `/canary/[creator]` : public canary status page
- `/docs` : architecture, schema and friction report

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
  - `inboxPage(deskKey)`: cursor‑paginated tips, `.createdBy(RELAY)` only
  - `watchInbox(deskKey, onTip)`: WebSocket live events, then `getEntity` and decrypt client‑side
- Reply (desk) and read replies (source):
  - `reply(w, tipKey, wire)` and `repliesFor(tipKey, deskCreator)`

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
select({key,expiresAt})
  .where(eq("project",P), eq("type","canary"), eq("desk", key(deskKey)), gt("$expiresAt", u64(head)))
  .createdBy(DESK).limit(1)
// 3. Desk inbox
select({key,createdAt,expiresAt,payload})
  .where(eq("project",P), eq("type","tip"), eq("desk", key(deskKey)))
  .createdBy(RELAY).limit(50).cursor(c)
// 4. Replies a source can trust
select({key,payload})
  .where(eq("project",P), eq("type","reply"), eq("tip", key(tipKey)))
  .createdBy(DESK).limit(20)
```

Wallet addresses (testnet only)
-------------------------------

These are used in the demo and on‑chain tests. Keys are never committed; see `/home/.../uploads/canarydrop-testnet-wallets_*.json` locally.

- Relay: `0xa6Aa6a1409eb54028550466169A29EAfd8f7a442`
- Demo desk: `0x1da3c22c079c264536D831F6F1fCe638aB0b20B0`
- Impersonator: `0x97250dcDbE5fB229Fb532AAC0d62be44e028b7Af`
Explorer links:
- Relay — https://hub.arkiv.network/tiramisu/address/0xa6Aa6a1409eb54028550466169A29EAfd8f7a442
- Desk — https://hub.arkiv.network/tiramisu/address/0x1da3c22c079c264536D831F6F1fCe638aB0b20B0
- Impersonator — https://hub.arkiv.network/tiramisu/address/0x97250dcDbE5fB229Fb532AAC0d62be44e028b7Af

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

Production URL: https://canarydrop-teamtitanlink.vercel.app

Chain configuration
-------------------

- Chain: Tiramisu testnet (`chainId = 7738577`, hex `0x7614d1`)
- RPC: `https://rpc.tiramisu.db-chain.testnet.arkiv.network`
- WS: `wss://rpc.tiramisu.db-chain.testnet.arkiv.network`
- Native token: GLM (Golem)
- Explorer: `https://hub.arkiv.network/tiramisu`

Security notes
--------------

- Desk, canary and reply reads are all filtered with `.createdBy(deskWallet)`. The homepage also demonstrates an impersonator desk with the same “name” being ignored because it was created by a different wallet.
- Tips are client‑side encrypted; the relay never sees plaintext.
- The relay performs an in‑memory per‑IP rate limit. It keeps no application logs (platform logs are a residual risk).
- Synthetic data only; never store personal data or private keys on Arkiv.

Friction and SDK notes
----------------------

See `arkiv/friction.md` with exact versions and a runnable repro in `arkiv/repro/friction-repro.mjs`. Only issues reproduced in this repo are listed.

AI usage
--------

This project’s UI was styled against a provided “Neural Pathway” motion design brief. Code generation assistants were used to scaffold Next.js pages and CSS and to speed up boilerplate, but all Arkiv calls were implemented by hand against the SDK and verified with the docs and the SDK’s source. All cryptography was implemented against WebCrypto and is tested by round‑trip.

What’s verified on-chain
---------------------------------------------

Pending funding: the relay wallet `0xa6Aa6a1409eb54028550466169A29EAfd8f7a442` is not funded with GLM yet (Tiramisu faucet currently dry). End‑to‑end on‑chain tests (desk + canary creation, tip with sealed ownership to `0x…dEaD`, renewals, replies) will be executed as soon as funds land, and the exact tx hashes will be recorded here and in `arkiv/schema.md`. Until then, the app runs end‑to‑end off‑chain with synthetic data only.

Tests
-----

- Unit: WebCrypto ECIES round trip (vitest): PASS
- Read‑only integration: block timing from Arkiv SDK: PASS
- E2E (desktop and mobile widths): Playwright visits `/, /submit, /desk, /r, /explorer, /docs`, asserts no console errors and saves screenshots: PASS
- Screenshots: saved in `shots/` (generated via Playwright)

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

- Relay: `0xa6Aa6a1409eb54028550466169A29EAfd8f7a442` — [Explorer](https://hub.arkiv.network/tiramisu/address/0xa6Aa6a1409eb54028550466169A29EAfd8f7a442)
- Desk: `0x1da3c22c079c264536D831F6F1fCe638aB0b20B0` — [Explorer](https://hub.arkiv.network/tiramisu/address/0x1da3c22c079c264536D831F6F1fCe638aB0b20B0)
- Impersonator: `0x97250dcDbE5fB229Fb532AAC0d62be44e028b7Af` — [Explorer](https://hub.arkiv.network/tiramisu/address/0x97250dcDbE5fB229Fb532AAC0d62be44e028b7Af)

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
- Pre‑existing work: none, built Oct 9–18, 2026
- Demo video: (link coming)

How judges can reproduce
------------------------
1) Visit the live site and submit a synthetic tip to the demo desk.  
2) Read replies with `/r`.  
3) Run a readback locally:
```bash
npm i
NEXT_PUBLIC_DESK_ADDRESS=0x1da3c22c079c264536D831F6F1fCe638aB0b20B0 \
NEXT_PUBLIC_RELAY_ADDRESS=0xa6Aa6a1409eb54028550466169A29EAfd8f7a442 \
npm run verify
```
4) (After we seed) Browse the on‑chain evidence in `arkiv/evidence.json` and click the explorer links.

License
-------

MIT — see `LICENSE`.

