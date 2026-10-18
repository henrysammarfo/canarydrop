# Friction report: CanaryDrop

Environment: `@arkiv-network/sdk` 0.8.1, viem 2.57.7, Node 20.19.2, Tiramisu (7738577), 18 Oct 2026.
Repro script: `arkiv/repro/friction-repro.mjs` (read-only, needs no wallet).

### 1. `$createdAt` cannot be filtered
- Surface: Query builder; AGENTS.md suggests range-filter on `$createdAt`.
- Steps: `pub.select({key:true}).where(gt("$createdAt", 0))`.
- Expected: a range query on creation time.  
  Actual: `InvalidPredicateError: "$createdAt" is returned in query results but carries no index, so it cannot be filtered on.` (source: `src/query/expression.ts`, `RESULT_ONLY_SYSTEM_ATTRIBUTES`).
- Workaround: store your own numeric attribute (e.g. `created: u64(Date.now())`) and range-filter on it. We do this in seeds.

### 2. Doc snippet numeric type
- Surface: Best Practices §5: `gt("created", Date.now() - 86400000)`.
- Actual: `InvalidValueError: Invalid i32 value ... use u64(...)`. Bare numbers default to i32.
- Fix: use `u64(Date.now() - 86_400_000)`.

### 3. `getBlockTiming().currentBlock` type
- Steps: `gt("$expiresAt", currentBlock)`.
- Actual: `InvalidPredicateError ... u256`.  
  Workaround: `u64(currentBlock)`.

### 4. `$createdAt` is block height
- Observation: it is the block number, not a Unix time. Not a bug; worth one line in docs.

### 5. Live events transport
- Docs intro mentions polling; a `webSocket()` transport works great and should be the lead example.

### 6. Expiry has no event (acknowledged)
- Apps must poll `gt("$expiresAt", u64(head))` for canaries. A future “expiring before N” subscription would help.

### 7. Event payload
- `watchEntityEvents` carries no attributes, so we call `getEntity` per event to inspect `type`/`desk`. An attribute filter or topics would reduce reads.

### 8. Faucet outage on deadline day
- Surface: https://hub.arkiv.network/faucet required a wallet sign‑in, then failed repeatedly. The faucet hot wallet `0x815Ad950ae49102952C10ceBB18901E9e28AC712` held ~9.9954 GLM while each claim needs 10 GLM plus gas, so claims failed for hours. There was no alternative faucet; docs say to ask on Discord.
- Suggestion: a balance alarm on the faucet wallet, a smaller per‑claim drip (e.g. 1–2 GLM) or multiple pools.

### Tested paths that worked
- `createPublicClient({ chain: tiramisu, transport: webSocket() }).watchEntityEvents(...)` — delivered events promptly in ~2–3 s.
- `predictEntityKeys` + `executeBatch` create‑then‑reference in one tx — on chain: https://tiramisu.explorer.arkiv.network/tx/0x6558bfd29237fd4b131fbee1d74f13ac3ce1152d88a5ae05d24d5f33a1dc35be
- Atomic tip creation + `ownershipChanges` to `0x…dEaD` — on chain: https://tiramisu.explorer.arkiv.network/tx/0xfba666e2ed91c4cd35f0020959cfe48520247f3ab6a96efa1b5e0ed2868744d9 / https://tiramisu.explorer.arkiv.network/tx/0x2401d9b57ae4545d4f2aee716476db731bcd7cc260c9c1ae42f1ec5e0b6df83c / https://tiramisu.explorer.arkiv.network/tx/0x96c37ab0a3592f02abe6ac75565fb5b0c400bb451156d2c156246728f3fc886f
- `extendEntity` renew later expiry — on chain: https://tiramisu.explorer.arkiv.network/tx/0x348fcd830adef7e6cbf5e8201d425e208ef01be8cc6321e41bfa1a6b5f5df466

### New items from seeding day
- Attribute key casing: using an uppercase letter in a key (e.g., `renewedAt`) made `executeBatch` revert with `Ident32InvalidByte(uint256 position, bytes1 value)` = (7, 0x41). Expected: a client‑side validation error. Suggestion: SDK should enforce “attribute keys must be lowercase a‑z, 0‑9, underscore” and fail early.
- Bare JS numbers: a raw `Date.now()` attribute value reverted until wrapped with `u64(...)`. Suggestion: expand docs and examples; possibly coerce integers to `u64` when the target attribute is declared numeric.
