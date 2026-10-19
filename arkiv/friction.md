# Friction report: CanaryDrop on Arkiv Tiramisu

## Top 5

1. `$createdAt` has no index. We sort in JS and write `slot` as u64 YYYYMMDD (F1).
2. Bare numbers become i32 and `$expiresAt` needs `u64(head)` (F2, F3).
3. `predictEntityKeys` races under concurrent creates from one owner (F9).
4. Expiry fires no event, so a dead canary is silent unless we poll (F8).
5. Anonymous RPC is rate limited. We fail fast and serve last-good reads (F10).

Environment: `@arkiv-network/sdk` 0.8.1, viem 2.57.7, Node 20+, Tiramisu chain 7738577.
Date of this pass: 19 Oct 2026. Head at repro time: block 772182, 2s blocks.
Repro: `npm run friction` runs `arkiv/repro/run-all.mjs`. Every script is read only and needs no wallet.

This report lists only issues we reproduced in this repo or measured against the live Tiramisu RPC. Severity is from the point of view of an app that posts sealed tips and a warrant canary. All sixteen original findings remain below, plus later ones.

## Summary table

| ID | Surface | Severity | Status in this app |
|---|---|---|---|
| F1 | `$createdAt` has no index | High for range queries | Sort in JS. New tips also store `slot` as u64 YYYYMMDD |
| F2 | Bare numbers default to i32 | High | Wrap with `u64(...)`. Never pass `Date.now()` as an attribute |
| F3 | `$expiresAt` is u64, bigint is u256 | High | `gt("$expiresAt", u64(head))` |
| F4 | SDK accepts `renewedAt`, chain may not | High | Lowercase names only. We use `slot` |
| F5 | Page field is `cursor`, not `nextCursor` | Medium | Explorer and inbox use `page.cursor` |
| F6 | `extendEntity` SETS expiry from now | Medium | Documented on the renew path |
| F7 | Events carry no attributes | Medium | `getEntity` after `watchEntityEvents` |
| F8 | Expiry fires no event | Medium | Poll `$expiresAt` and watch `onExpiryExtended` |
| F9 | `predictEntityKeys` races | High | Serial queue plus pending nonce |
| F10 | Anonymous RPC budget | High | `retryCount: 0`, 20s timeout, public errors |
| F11 | WebSocket watch has no replay | Medium | Reconnect then `inboxPage` catch up |
| F12 | QueryResult vs a hand rolled nextCursor | Medium | Use the SDK page type |
| F13 | Attribute names are case sensitive | Medium | SDK `isValidAttributeName` is not the chain |
| F14 | Faucet insolvency | Ops | Measured earlier. No write in this pass |
| F15 | `permissionlessExtension` would fake a canary | Product | We do not set it on canaries |
| F16 | 128 KiB payload / 32 attributes | Low | Tips are padded 2 KiB buckets, well under |
| F17 | `QueryResult.next()` throws `NoMoreResultsError` | Medium | Check `hasNextPage()` or a missing `cursor` |
| F18 | `TxParams.nonce` is how you pin a pending nonce | Medium | We pass `{ nonce }` into `executeBatch` |
| F19 | `jsonToPayload` is not for ciphertext | Low | Tips stay `Uint8Array`. We never call `Entity.toJson()` |
| F20 | `exists` / `NOT EXISTS` | Medium | QueryError kind `type`. We never ship this operator |
| F21 | `ne` / `!=` | Medium | QueryError kind `type`. Filters stay positive `eq` |
| F22 | `hasType` / `TYPEOF` | Medium | QueryError kind `type`. Types are set at write time |
| F23 | Empty `toString()` | Low | A query needs at least one filter |
| F24 | `getEntityCount` is chain wide | Medium | We print it as whole-chain, then query `project` |
| F25 | `toString()` is predicate only | Low | Judge page shows the predicate, not SELECT/LIMIT |
| F26 | No stealth address registry | Product | ERC-5564 announcements stay local. See `docs/friction.md` |
| F27 | No native typed-data entity | Product | EIP-712 canary signatures live in the payload or offline |
| F28 | Static export cannot run middleware | Product | CSP nonce and Origin checks are the server path. Static talks to Arkiv from the browser |
| F29 | `str()` is 128 UTF-8 bytes | High | EIP-712 sigs stay in the canary payload. Attributes never call `str(sig)` |

## Method

1. Call the public Tiramisu RPC through `createPublicClient({ chain: tiramisu, transport: http(undefined, { retryCount: 0, timeout: 20_000 }) })`.
2. For each claim, run a script under `arkiv/repro/` and paste the exact class name the SDK threw.
3. Read SDK source in `node_modules/@arkiv-network/sdk` for `QueryResult`, `EntityMutationError`, `validateAttributeName`, and `executeBatch`.
4. Do not treat docs as ground truth when the node disagrees.

We did not rebroadcast writes in this pass. Write evidence from the earlier seed is in `arkiv/evidence.json`.

## F1. `$createdAt` cannot be filtered

Script: `arkiv/repro/f1-created-at.mjs`

```
pub.select({ key: true }).where(gt("$createdAt", 0)).limit(1).fetch()
```

Actual:

```
InvalidPredicateError "$createdAt" is returned in query results but carries no index, so it cannot be filtered on. Select it and filter the results in JavaScript instead.
```

`$createdAt` is a block height, not a Unix time. AGENTS.md and some samples still show a range filter on it. The engine source lists it in result-only system attributes.

Workaround we ship: select `createdAt`, sort in the client. For a durable daily cap we also write `slot: u64(YYYYMMDD)` on new tips and replies and query that. Old tips without `slot` are not counted toward the new cap. That is honest.

## F2. Bare JS numbers become i32

Script: `arkiv/repro/f2-bare-number.mjs`

```
gt("$expiresAt", Date.now())
```

Actual:

```
InvalidValueError Invalid i32 value 1792389889768: outside the i32 range [-2147483648, 2147483647] — use u64(...) for large counters, timestamps and block heights (Date.now() does not fit an i32), or u256(...) beyond 2**64 - 1.
```

Best Practices snippets that pass `Date.now() - 86400000` as a bare number will throw. The SDK error is good. The docs still lag.

Workaround: always construct with `u64`, `i32`, `str`, `key` from `@arkiv-network/sdk/attr`.

## F3. `getBlockTiming().currentBlock` is the wrong width until wrapped

Script: `arkiv/repro/f3-head-type.mjs`

Raw bigint:

```
InvalidPredicateError "$expiresAt" is a u64, but the value is a u256. System attributes have a fixed type — write u64(...) around the value.
```

Wrapped:

```
F3 wrap ok entities 1 block 772182
```

A canary "is alive" query that forgets `u64(...)` looks like an empty result if you swallow the error. We never swallow it on the canary page.

## F4. SDK name grammar is wider than Tiramisu

Script: `arkiv/repro/f4-attribute-name.mjs`

| Name | SDK `isValidAttributeName` | Notes |
|---|---|---|
| `renewedAt` | accepts | Chain has reverted with `Ident32InvalidByte` on uppercase in this repo's seed day |
| `createdAt` | accepts | Fine as a user attribute, easy to confuse with `$createdAt` |
| `slot` | accepts | What we write |
| `NOT` | rejects | Reserved |
| `$expiresAt` | rejects | System prefix |
| `--dash` | rejects | Comment opener / not a leading letter |

The SDK grammar allows `A-Z`. The Tiramisu `Ident32` path we hit during seeding did not. The safe rule for this chain is: start with a lowercase letter, then `a-z`, `0-9`, `_` only. We do not write uppercase names.

This is a client vs engine split. A local `isValidAttributeName` check is not enough.

## F5. Pagination field is `cursor`

Script: `arkiv/repro/f5-query-page.mjs`

```
F5 keys entities,true,true,false
F5 cursorType string
F5 hasNext true
F5 count 5 block 772183
```

`nextCursor` is not on the SDK `QueryResult`. Main's explorer used `r.nextCursor`, so Load more never armed. v2 uses `page.cursor`, `page.blockNumber`, and `page.hasNextPage()`.

Cursors are bound to the block they were read at. Walk with `.atBlock(head)` on every page of one walk. If the node returns `QueryError` kind `cursor`, start over.

## F6. `extendEntity` sets a new deadline from now

This is in the SDK wallet decorator and the skills `AGENTS.md`. An extension of 26 hours does not add 26 hours to the remaining lifetime. It sets expiry to now plus 26 hours.

If a canary has 20 hours left and you "renew" it, you get 26 hours from the tx block, not 46. Our UI copy says that. Tests do not broadcast a renew in CI.

A renew that aims at a time earlier than the current expiry is rejected (`ExpiryNotExtended`). We always pass `ExpirationTime.fromHours(26)` and `fromDays(30)`.

## F7. Live events have no attributes

`watchEntityEvents` decodes logs. `EntityCreatedEvent` has `entityKey`, `owner`, `expiresAt`, `creationFlags`. It does not have `type` or `desk`.

The inbox watcher therefore:

1. Ignores owners other than the relay.
2. Calls `getEntity`.
3. Reads `attributes.type` and `attributes.desk`.

That is an extra read per create. An attribute topic on the log would remove it. We also listen for `onExpiryExtended` so a canary renew can flip the ALIVE badge without a full poll, `onOwnershipTransferred` so a seal to the burn address is visible, and `onEntityPatched` / `onEntityDeleted` so a change attempt is visible.

## F8. Expiry is silent

An entity that reaches `$expiresAt` is gone. There is no log. Watchers that only listen for deletes will think a canary is still live.

We poll `gt("$expiresAt", u64(head))` and we also use `.atBlock` on the public canary page to show whether the same canary was alive about an hour ago. That is a small time machine, not a full history product.

## F9. `predictEntityKeys` is only true if nothing else from that owner is in flight

The public client reads the entity-minting nonce. Two `postTip` calls at once from the same relay predict the same first key or overlapping keys. The batch then lands on a different key than the `ownershipChanges` target, or the tx nonce collides at the Ethereum layer.

SDK docs say: a prediction holds only while no other create from this wallet lands first. For a key you can rely on, read it from the create result.

What we do:

- A Redis lock per paying wallet (`cd:lock:{relay|desk}:{address}`) so two Vercel isolates cannot sign at once.
- A `SerialQueue` per process inside that lock for relay writes and desk writes.
- `getTransactionCount({ blockTag: "pending" })` passed into `executeBatch`.
- Backoff on nonce, 429, timeout, and replacement errors.
- No retry when `EntityMutationError.txHash` is set. That case means the tx may have landed and a replay would double spend.
- We do not store the next Ethereum nonce in Redis. A skipped nonce would stall the wallet.

If Redis REST env vars are missing, this falls back to the process queue and one warning is logged. The Arkiv daily `slot` cap and the GLM floor still bound spend.

## F10. Anonymous RPC budget

The default Tiramisu HTTP URL is public and rate limited. viem's default transport retries with Retry-After. Under `ANON_COST_LIMITED` that hang looks like a frozen inbox.

We set `retryCount: 0` and `timeout: 20_000` on both HTTP and WebSocket. Failures map to `rate_limited` or `try_later`. We never log the RPC URL with a credential appended. This repo does not use a Hub access key.

We did not measure a fresh 429 in this pass. Our change is fail fast, which we can unit test, plus live reads in the test suite that fail loudly if the public RPC is down.

## F11. WebSocket watch does not replay a gap

`watchEntityEvents` with `webSocket()` is the right transport for a live desk. After a drop, viem reconnects without replaying missed logs unless you pass `fromBlock`.

We restart the watcher on `onError` and then reload `inboxPage`. That catch-up is a query, not an event replay. Tips that arrived during the gap still appear.

HTTP polling `watchEntityEvents` works too and is what the intro docs show. We keep WebSocket as the product path.

## F12. Typed pages vs `as any`

`client.select({ key: true, payload: true })` returns `QueryResult<ProjectedEntity<S>>`. Fields you did not select are a type error.

Footgun: storing the selection in a `let` widens `true` to `boolean` and you lose the narrowing. Use `as const` or pass the object inline. We export `const INBOX_SELECT = { ... } as const`.

`Entity.toJson()` is still `any` in the SDK (comment: JSON.parse). We never call it. We parse payloads with `parseDeskPayload`.

## F13. Case sensitivity and reserved words

Query keywords are case insensitive. Attribute names are case sensitive. `Level` and `level` are different attributes. `NOT` as a name cannot be queried.

We only write `project`, `type`, `desk`, `tip`, `slot`, and short labels such as `statement` or `path`. The canary signature is not an attribute (F29).

## F14. Faucet insolvency (ops, previously measured)

On 18 Oct 2026 the Hub faucet required a wallet sign in and then failed. The hot wallet `0x815Ad950ae49102952C10ceBB18901E9e28AC712` held about 9.9954 GLM while a claim needed 10 GLM plus gas. There was no second faucet. Docs said to ask on Discord.

This pass did not retry claims. Suggestion stands: a balance alarm, a smaller drip, or more than one pool.

## F15. `permissionlessExtension` is a footgun for a canary

If a canary is `permissionlessExtension: true`, anyone can keep it alive. That destroys the signal. We set `readonly: true` and we do not set permissionless extension.

`readonly` still allows the owner to extend, transfer, or delete. Sealed tips therefore also transfer ownership to the burn address in the same batch. After that, even we cannot extend them.

## F16. Payload and attribute limits

`MAX_PAYLOAD_BYTES` is 128 KiB. `MAX_ATTRIBUTES` is 32. String attributes are 128 UTF-8 bytes. Indexed attributes are public.

We put ciphertext in the payload, not in attributes. Labels are short. Tips pad plaintext to 2 KiB buckets so length leaks less. The relay still sees ciphertext size.

## F29. `str()` rejects a 132-character EIP-712 signature

An ECDSA signature on secp256k1 is 65 bytes. Written as `0x` plus 130 hex chars it is 132 UTF-8 bytes. SDK `str()` throws `InvalidValueError` at 129 bytes. Putting `sig: str(signature)` on a canary create therefore 500s on renew and on signed create-desk.

Repro: `str('0x' + 'ab'.repeat(65))` throws. `tests/unit/write-strings.test.ts` calls the real SDK helper on every product string attribute and asserts the 132-character sig is absent from `canaryWriteAttrs`.

Workaround we ship: `statement` and `issuedAt` stay queryable attributes. The signature lives only in the JSON payload. `canarySigFromRow` already prefers `payload.sig`.

## What worked, with evidence

These paths were already on chain from the seed (see `arkiv/evidence.json` and the README explorer links):

- `predictEntityKeys` plus `executeBatch` to create a desk and a canary that reference each other in one tx.
- Tip create plus `ownershipChanges` to `0x…dEaD` in one batch.
- `extendEntity` renewing canary and desk together.
- `createdBy` ignoring an impersonator desk.
- `getBlockTiming` plus `u64` expiry queries.
- `QueryResult.cursor` pagination on live `project = canarydrop-gts26-hm` rows (F5, 5 entities at block 772183).

## Checked and found smooth

These paths were used again in v7 without a new failure class:

- Browser `PublicArkivClient` against the public Tiramisu HTTP URL for static reads.
- `predictEntityKeys` count 3 for drop plus release plus hold, then `ownershipChanges` on the drop only.
- `ownedBy(burn)` without `createdBy(relay)` so throwaway creators still appear as sealed tips.
- `verifyTypedData` / `verifyMessage` from viem for EIP-712 and EIP-4361. Arkiv is not in that path.
- `ExpirationTime.fromHours(26)` on both canary and hold so silence releases the drop by absence.

## Smooth SDK paths we now lean on

From Arkiv docs, `arkiv-sdk-js` 0.8.1, and `Arkiv-Network/skills` AGENTS.md:

- `PublicArkivClient` / `WalletArkivClient` instead of `any` wallets.
- `EntityMutationError` and `NoEntityFoundError` as the control flow for writes and missing desks.
- `.atBlock` on every paginated inbox walk.
- `onExpiryExtended` and `onOwnershipTransferred` in addition to `onEntityCreated`.
- Explicit `str`, `key`, `u64` constructors on writes.
- Fail fast HTTP, no Hub key in git.
- `.ownedBy` plus `.createdBy` in one sealed-tip query.
- `creationFlags` on canary and sealed tip rows.
- `or(...)` for mixed type explorer pages.
- `QueryResult.hasNextPage()` instead of guessing at `nextCursor`.

## What we did not reproduce this pass

- A live `ANON_COST_LIMITED` hang, because we disabled viem retries. We still treat that string as `rate_limited` if it appears.
- A live uppercase attribute revert, because we no longer send uppercase names. The SDK still accepts `renewedAt` (F4).
- A faucet claim. No wallet in CI.
- Compression APIs. They are not public in 0.8.1.

## How to re-run

```bash
npm i
npm run friction
```

Expected: each script prints an `F*` line. `run-all.mjs` exits 0 if every script exits 0. F1 to F3 and F20 to F23 are successful when they throw the documented SDK error. F3 wrap, F4, F5, F24, and F25 are successful when they return.

## Notes for SDK authors

1. Document `$createdAt` as select only, block height, no filter.
2. Show `u64(currentBlock)` in every expiry example.
3. Reject uppercase attribute names in `validateAttributeName` if Tiramisu will revert them, or document the chain split in one line.
4. Put `QueryResult.cursor` in the first pagination example. `nextCursor` is a trap.
5. Lead with WebSocket `watchEntityEvents` and say events have no attributes.
6. Say `extendEntity` sets, it does not add.
7. Say `predictEntityKeys` is racy under concurrent creates from one owner.
8. Either implement `exists`, `ne`, and `hasType` on Tiramisu or stop exporting them from 0.8.1. The current error is QueryError kind `type` with "Requested resource not available."
9. Say `getEntityCount` is chain wide.
10. Say `toString()` is the predicate only.

## Honesty

This report is longer because the earlier 47 line file skipped the live error text. Length is not the goal. Reproducible error classes are. If a future SDK release fixes F1 to F4 or F20 to F22, the scripts here will start exiting 2.

## Query cookbook we actually run

These are the live shapes. `P` is `canarydrop-gts26-hm`. `head` is `u64((await pub.getBlockTiming()).currentBlock)`.

Desk for a creator:

```
select({ key, creator, expiresAt, payload, createdAt })
  .where(eq("project", P), eq("type", "desk"), gt("$expiresAt", head))
  .createdBy(DESK)
  .limit(20)
```

We take the newest `createdAt` in JS because the engine has no ORDER BY.

Canary alive:

```
select({ key, expiresAt, createdAt })
  .where(eq("project", P), eq("type", "canary"), eq("desk", key(deskKey)), gt("$expiresAt", head))
  .createdBy(DESK)
  .limit(1)
```

Canary at a pinned block (time machine):

```
...same where...
  .atBlock(earlier)
```

Inbox page:

```
select({ key, createdAt, expiresAt, payload })
  .where(eq("project", P), eq("type", "tip"), eq("desk", key(deskKey)))
  .createdBy(RELAY)
  .limit(50)
  .atBlock(pageBlock)
  .cursor(c?)
```

Daily spend (new tips only):

```
select({ key: true })
  .where(eq("project", P), eq("type", "tip"), eq("slot", u64(YYYYMMDD)))
  .createdBy(RELAY)
  .limit(200)
```

Trusted replies:

```
select({ key, payload, createdAt })
  .where(eq("project", P), eq("type", "reply"), eq("tip", key(tipKey)))
  .createdBy(DESK)
  .limit(20)
```

Explorer:

```
select({ key, attributes, creator, owner, expiresAt, createdAt, creationFlags })
  .where(eq("project", P))
  .limit(20)
  .atBlock(head)
```

Sealed tips:

```
select({ key, owner, creator, creationFlags })
  .where(eq("project", P), eq("type", "tip"))
  .createdBy(RELAY)
  .ownedBy(0x…dEaD)
  .limit(20)
```

Tips or canaries:

```
select({ key, attributes, owner, creator })
  .where(eq("project", P), or(eq("type", "tip"), eq("type", "canary")))
  .limit(20)
```

If you copy these into a one off script, wrap every numeric compare with `u64`. Do not filter `$createdAt`. Do not use `exists`, `ne`, or `hasType` on this node. They throw QueryError kind `type`.

## Concurrent write sequence

Happy path for one tip:

1. Origin, CSRF, and per IP window.
2. Decode base64, check `MAX_WIRE_BYTES` (8192) once.
3. `getEntity(deskKey)`. Missing, wrong type, or expired: stop. No GLM spent.
4. `getBalance(relay)`. Below 0.02 GLM: stop.
5. Count today's `slot` tips. At cap: stop.
6. Enter the process queue.
7. `getTransactionCount(pending)`.
8. `predictEntityKeys({ owner: relay, count: 1 })`.
9. `executeBatch({ creates: [tip with salt], ownershipChanges: [burn] }, { nonce })`.
10. Return `createdEntities[0]` and `txHash`.

Failure path:

- `nonce too low` / replacement / 429 / timeout: wait 50, 100, 200, 400 ms and retry from step 7.
- `EntityMutationError` with `txHash`: stop. Tell the user to check the explorer. Do not send a second batch.
- Out of funds: stop. Public message only.

Two Vercel isolates can still overlap at step 7. That is a residual race. The durable cap is the `slot` count plus the GLM floor, not the queue.

## SDK types we pinned so `any` could leave the repo

From `@arkiv-network/sdk` 0.8.1:

- `PublicArkivClient` for `pub()` and `ws()`
- `WalletArkivClient` for relay and injected wallets
- `ProjectedEntity<typeof SELECT>` for desk, canary, inbox, reply rows
- `QueryResult<T>` for pages (`entities`, `cursor`, `blockNumber`, `hasNextPage`, `next`)
- `FullEntity` for `getEntity`
- `EntityCreatedEvent`, `ExpiryExtendedEvent`, `EntityPatchedEvent`, `EntityDeletedEvent`
- `ExecuteBatchReturnType` for `txHash` and `createdEntities`
- `EntityMutationError`, `NoEntityFoundError`
- `Attributes` plus small helpers `attrStr`, `attrKey`, `attrU64`

`window.ethereum` is `InjectedProvider` with `request(method, params?)`. Wallet errors use `code: number`, not a catch-all.

## Watcher policy, written down

`watchEntityEvents` options we use:

- `onEntityCreated`: owner must be the relay, then `getEntity`, then `type === "tip"` and `desk === deskKey`
- `onExpiryExtended`: if the key is the current canary, mark ALIVE
- `onOwnershipTransferred`: if `newOwner` is the burn address, the tip is sealed
- `onEntityPatched` / `onEntityDeleted`: toast so a change attempt is visible
- `onError`: unwatch, wait 2s, watch again, then `inboxPage` catch up

We do not pass `fromBlock` on the first subscribe, because a desk that has been open for days would replay the chain. Catch up is a query, which is cheaper than a full log rewind.

## Product friction that is on us, not the SDK

1. Demo decrypt on a fresh browser needs a shared P-256 key. Real desks must not use it. We derive it from `DESK_PRIVATE_KEY` at runtime so it is not in git.

2. Per IP sliding windows and wallet locks use a Redis REST store when those env vars are set. Without them the in process Map and queue remain, and we log one warning. That fallback is honest in SECURITY.md.

3. `style-src 'unsafe-inline'` stays because React sets element styles. Script eval is gone. That is a trade, not a win on every axis.

4. Historical tips without `slot` do not count toward the new daily cap. Operators who want a hard global cap still have the GLM floor.

5. `getDesk` now prefers the newest live desk for a creator. Creating a second demo desk hides the old one. Old ciphertext will not open with the new public key. The inbox reports how many sealed tips it could not open.

## F17. `next()` is not a boolean

`QueryResult` in 0.8.1 has `cursor: string | undefined`, `blockNumber`, `entities`, `hasNextPage()`, and `next()`. Calling `next()` after the last page throws `NoMoreResultsError` ("the last page carried no cursor").

Main treated `nextCursor` as a string field. That field does not exist, so "Load more" never armed. The typed helper is:

```
if (!page.hasNextPage()) stop
const more = await page.next()
```

or walk with `.cursor(page.cursor)` and `.atBlock(page.blockNumber)` yourself. We do the second so inbox and explorer share one `PageWalk` type.

Cursors are bound to the block they were read at. Mixing a cursor from block N with a fetch at head is how you get `QueryError` kind `cursor`. Pin the block.

## F18. Pending nonce is a `TxParams` field, not a guess

`executeBatch(input, { nonce })` is the supported way to pin the Ethereum tx nonce. Reading `getTransactionCount({ blockTag: "pending" })` without passing it in still races because another `eth_sendRawTransaction` can land between the read and the sign.

The SDK wallet client will fill a nonce if you omit it. That is fine for a human MetaMask click. It is not fine for a relay that may have two serverless isolates. We still pass `{ nonce }` so a retry on a 429 does not reuse a consumed prediction by accident: the retry reads pending count again inside the lock and queue.

`predictEntityKeys` is a separate counter (entity minting nonce). The wallet lock plus `SerialQueue` keep both reads together across isolates when a Redis REST store is configured.

## F19. JSON helpers are for JSON entities only

`jsonToPayload` / `payloadToJson` are for desks and canaries. Tips and replies are `Uint8Array` ciphertext with `contentType: application/octet-stream`. Putting a tip through `payloadToJson` throws or yields garbage.

`Entity.toJson()` in the SDK is typed as `any` because it is `JSON.parse`. We never call it. Desk JSON is parsed with `parseDeskPayload`, which checks `name` and a 65 byte `pub` array.

## F20. `exists` is in the SDK and dead on Tiramisu

Script: `arkiv/repro/f20-exists.mjs`

```
pub.select({ key: true }).where(eq("project", P), eq("type", "tip"), exists("slot")).limit(1).fetch()
```

Actual:

```
QueryError type Query rejected (type, -32002): Requested resource not available.. Query: project = str('canarydrop-gts26-hm') AND type = str('tip') AND EXISTS(slot)
QueryError type Query rejected (type, -32002): Requested resource not available.. Query: project = str('canarydrop-gts26-hm') AND type = str('tip') AND NOT EXISTS(slot)
```

The SDK still exports `exists`. We wanted this to split seed tips (no `slot`) from new tips. Instead we query `eq("slot", u64(YYYYMMDD))` for the daily cap and we do not pretend older rows are in that bucket.

## F21. `ne` is in the SDK and dead on Tiramisu

Script: `arkiv/repro/f21-ne.mjs`

```
pub.select({ key: true }).where(eq("project", P), ne("type", "desk")).limit(1).fetch()
```

Actual:

```
QueryError type Query rejected (type, -32002): Requested resource not available.. Query: project = str('canarydrop-gts26-hm') AND type != str('desk')
```

Explorer filters therefore use `eq("type", kind)` for one type, or `or(eq("type","tip"), eq("type","canary"))` when a mixed page is useful. There is no working "not this type" operator on this node.

## F22. `hasType` is in the SDK and dead on Tiramisu

Script: `arkiv/repro/f22-has-type.mjs`

```
pub.select({ key: true }).where(eq("project", P), hasType("slot", "u64")).limit(1).fetch()
```

Actual:

```
QueryError type Query rejected (type, -32002): Requested resource not available.. Query: project = str('canarydrop-gts26-hm') AND TYPEOF(slot) = u64
```

Attribute types are fixed at write time. We wrap writes with `str`, `key`, `u64` and we do not ask the node to filter by type of an attribute.

## F23. An empty query has no spelling

Script: `arkiv/repro/f23-empty-query.mjs`

```
pub.select({ key: true }).toString()
```

Actual:

```
InvalidPredicateError A query needs at least one filter — the language has no spelling for 'match every entity". Add a where(...) predicate, or narrow by ownedBy(...) / createdBy(...).
```

We always start from `eq("project", P)`. That is also why `getEntityCount()` cannot replace a project query.

## F24. `getEntityCount` is the whole chain

Script: `arkiv/repro/f24-entity-count.mjs`

`getEntityCount()` returns every live entity on Tiramisu. On this pass: `F24 count 35916 projectPage 7`. One CanaryDrop page with `limit(20)` is not in the same class of number. The How page prints the chain count and says so. Product counts still use `eq("project", P)` plus `type`.

## F25. `toString()` is the predicate, not the full request

Script: `arkiv/repro/f25-query-text.mjs`

`SelectQueryBuilder.toString()` prints the filter the node will parse. A sealed tips builder renders as:

```
project = str('canarydrop-gts26-hm') AND type = str('tip') AND $owner = addr(0x000000000000000000000000000000000000dEaD) AND $creator = addr(0xa6Aa6a1409eb54028550466169A29EAfd8f7a442)
```

It does not print SELECT, LIMIT, or the projection. The How page shows that string on purpose. Copying it into a raw RPC without a select still needs those fields.

## Remaining unknowns

- Exact anonymous RPC quota per day. We fail fast instead of guessing.
- Whether a future Tiramisu build will accept uppercase names. F4 will then be stale.
- Whether `watchEntityEvents` on HTTP polling would be more reliable than WebSocket behind some NATs. We did not A/B that on a panel of networks.

## File map

| Path | Role |
|---|---|
| `arkiv/repro/f1-created-at.mjs` | `$createdAt` filter |
| `arkiv/repro/f2-bare-number.mjs` | i32 overflow |
| `arkiv/repro/f3-head-type.mjs` | u256 vs u64 |
| `arkiv/repro/f4-attribute-name.mjs` | SDK name grammar |
| `arkiv/repro/f5-query-page.mjs` | `cursor` field |
| `arkiv/repro/f20-exists.mjs` | `exists` QueryError |
| `arkiv/repro/f21-ne.mjs` | `ne` QueryError |
| `arkiv/repro/f22-has-type.mjs` | `hasType` QueryError |
| `arkiv/repro/f23-empty-query.mjs` | empty `toString()` |
| `arkiv/repro/f24-entity-count.mjs` | chain wide count |
| `arkiv/repro/f25-query-text.mjs` | predicate `toString()` |
| `arkiv/repro/run-all.mjs` | runner |
| `lib/arkiv.ts` | queries, watch, batch helpers. Canary `sig` is payload-only (F29) |
| `lib/write-strings.ts` | Every product `str()` value for the unmocked cap test |
| `tests/unit/write-strings.test.ts` | Real SDK `str()` on each write attribute |
| `lib/relay.ts` | sealed tip write |
| `lib/retry.ts` | queue and backoff |
| `lib/store.ts` | optional Redis REST creds, fallback warning |
| `lib/wallet-lock.ts` | distributed lock per relay or desk wallet |
| `lib/rate-limit.ts` | Redis sliding window plus in process fallback |
| `lib/proofs.ts` | live How page claims |
| `SECURITY.md` | attacks we block and residual risk |
| `lib/guard.ts` | GLM floor and Arkiv `slot` daily caps |

