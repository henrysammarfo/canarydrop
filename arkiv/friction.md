# Friction report: CanaryDrop

Environment: `@arkiv-network/sdk` 0.8.1, viem 2.57.7, Node 20.19.2, Tiramisu (7738577), 18 Oct 2026.
Repro script: `arkiv/repro/friction-repro.mjs` (read-only, needs no wallet).

> Builder: re-run each item yourself before submitting and delete anything you cannot reproduce. Add items you hit while building.

### 1. `$createdAt` cannot be filtered, but the challenge AGENTS.md says to range-filter on it
- Surface: query builder; global-tour-stop-pre-devcon/AGENTS.md ("range-filter on `$createdAt`").
- Steps: `pub.select({key:true}).where(gt("$createdAt", 0))`
- Expected: a range query on creation time. Actual: throws `InvalidPredicateError: "$createdAt" is returned in query results but carries no index, so it cannot be filtered on.` (source: `src/query/expression.ts`, `RESULT_ONLY_SYSTEM_ATTRIBUTES`).
- Fix: correct AGENTS.md; suggest storing a `u64` block or time attribute yourself.

### 2. Best Practices snippet throws
- Surface: docs.arkiv.network/typescript-sdk/best-practices §5: `gt("created", Date.now() - 86400000)`.
- Actual: `InvalidValueError: Invalid i32 value 1792256551806 ... use u64(...)`. A bare number defaults to i32. The SDK's error message is excellent; the doc snippet is wrong.
- Fix: `gt("created", u64(Date.now() - 86_400_000))`.

### 3. A bigint from `getBlockTiming()` is rejected for `$expiresAt`
- Steps: `const { currentBlock } = await pub.getBlockTiming(); gt("$expiresAt", currentBlock)`
- Actual: `InvalidPredicateError: "$expiresAt" is a u64, but the value is a u256`. A bare bigint infers u256.
- Expected: system attributes have a fixed type, so the SDK could coerce a bare bigint to u64. Workaround: `u64(currentBlock)`.

### 4. `$createdAt` is a block number
- Selecting `createdAt` returns e.g. `746592n`, equal to the block height, not a Unix time. The name suggests a timestamp. Worth one line in the docs.

### 5. Live events: docs say "polls", WebSocket works
- The Live Events page intro says the method "polls the chain"; the challenge AGENTS.md says a WebSocket transport without `fromBlock` opens a real socket.
- Tested: `createPublicClient({ chain: tiramisu, transport: webSocket() }).watchEntityEvents({ onEvent })` delivered 8 events in 10 s, first after about 2.3 s. Works; the docs should show the `webSocket()` variant.

### 6. Expiry fires no event (documented)
- A dead-man's-switch (our canary) has to poll `gt("$expiresAt", u64(head))`. An `EntityExpired` event or a "expiring before block N" subscription would remove that polling.

### 7. Events carry no attributes
- `onEntityCreated` gives the key, owner and expiresAt only, so each event costs one `getEntity` to check `type` and `desk`. Indexed attribute topics or an attribute filter on `watchEntityEvents` would help.

### 8. README
- npm README example shows `"@arkiv-network/sdk": "^0.6.0"` after installing 0.8.x, and publishes a shared example private key.

### Tested paths that worked (fill in while building)
- `predictEntityKeys` + `executeBatch` create-then-reference in one tx: expected …, actual …
- create + `ownershipChanges` to `0x…dEaD` in one batch: expected the tip to be unextendable; actual … (tx hash)
- `extendEntity` with an earlier expiry reverts (as documented): actual …
