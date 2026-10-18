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
- `predictEntityKeys` + `executeBatch` create‑then‑reference in one tx — OK in dry‑run; to be confirmed on-chain after seeding.
- Atomic tip creation + `ownershipChanges` to `0x…dEaD` — OK in dry‑run; on‑chain evidence to be added post‑seed.
- `extendEntity` renew sets a later expiry and reverts earlier — OK (dry‑run); to be confirmed on-chain.
