# CanaryDrop: Arkiv schema

## Why each Arkiv feature

| Feature | Why we use it |
|---|---|
| `predictEntityKeys` | Know desk, canary, tip, drop, release, and hold keys before the batch so later steps can reference them in the same transaction. |
| `executeBatch` | Create desk plus canary, or tip plus seal, or drop plus release plus hold, without a gap a seized operator could abuse. |
| `changeOwnership` / `ownershipChanges` | Hand a tip or drop to `0x…dEaD` in the same batch so nobody can extend, patch, or delete it later. |
| `ExpirationTime` / `extendEntity` | Canary and hold die if they are not renewed. Desk leases last 30 days. Drops last 90 days. |
| `createdBy` | Reads of desk, canary, and replies are pinned to the newsroom wallet. A copycat name does not match. |
| `ownedBy` | Explorer and proofs ask for burn-owned sealed tips, including throwaway creators. |
| `readonly` | Tips, canaries, and drops cannot be patched. We never set `permissionlessExtension` on a canary. |
| `atBlock` | Ask whether the same canary was alive about an hour ago. |
| `watchEntityEvents` | Live inbox over WebSocket. Catch-up is a query because expiry fires no event. |
| `slot` u64 | Daily spend cap. `$createdAt` has no index. |
| Public RPC from the browser | Static builds and the desk UI read Tiramisu directly. There is no read API to censor. |

Network: Tiramisu (chain 7738577) · SDK `@arkiv-network/sdk` 0.8.1 · project attribute `project = "canarydrop-gts26-hm"` on every entity and every query.
All payloads are synthetic test data. Plaintext never touches Arkiv.

## Wallets (on-chain evidence)
| Role | Address | Creates |
|---|---|---|
| Relay (pays gas for anonymous sources) | 0xa6Aa6a1409eb54028550466169A29EAfd8f7a442 | `tip` |
| Demo newsroom desk | 0x1da3c22c079c264536D831F6F1fCe638aB0b20B0 | `desk`, `canary`, `reply` |
| Impersonator (demo only) | 0x97250dcDbE5fB229Fb532AAC0d62be44e028b7Af | a fake `desk` to show `$creator` filtering |

## Entity types
| Type | Attributes (all queryable) | Payload (not queryable) | Expiration | Flags / owner |
|---|---|---|---|---|
| `desk` | project:str, type:str, slot:u64 (UTC YYYYMMDD on new desks) | JSON `{name, pub}` (P-256 public key, 65 bytes) | `fromDays(30)` lease, renewed by `extendEntity` each desk session | owner = creator = newsroom wallet |
| `canary` | project, type, desk:key | JSON `{statement}` | `fromHours(26)`, renewed daily; if it lapses the canary is dead | `readonly` (statement frozen, only renewable). Deliberately NOT `permissionlessExtension`: anyone could fake a live canary |
| `tip` | project, type, desk:key, slot:u64 (UTC YYYYMMDD) | bytes `[v1 \| ephPub 65 \| iv 12 \| AES-GCM ct]`, plaintext padded to 2 KiB buckets | chosen by source: 1h / 24h / 72h / 7d | `readonly`; ownership moved to `0x…dEaD` in the same batch so nobody can extend, patch or delete; the source's lifetime is final |
| `reply` | project, type, tip:key, slot:u64 | bytes `[v1 \| iv 12 \| ct]` (same ECDH secret as the tip) | `fromHours(72)` | owner = desk |
| `drop` | project, type, desk:key, slot:u64 | sealed statement bytes | `fromDays(90)` | `readonly`; ownership moved to `0x…dEaD` at create |
| `release` | project, type, desk:key, drop:key, slot:u64 | JSON wraps of the release key to each recipient | `fromDays(90)` | owned by the desk so it outlives the canary |
| `hold` | project, type, desk:key, drop:key | JSON `{kind, drop}` | `fromHours(26)`, renewed with the canary | if this and the canary lapse, the drop is treated as released |

No timestamps, names, emails, IPs or hashes of personal data are stored as attributes. `$createdAt` (a block number) and `$expiresAt` are the only time signals.

## Queries the app runs
```ts
// 1. Desk page (source side): pinned to the newsroom's on-chain creator, so impersonators never match
select({key,creator,expiresAt,payload}).where(eq("project",P), eq("type","desk"), gt("$expiresAt", u64(head))).createdBy(DESK).limit(20)
// 2. Canary status, including creationFlags so the page can show readonly / no open extend
select({key,expiresAt,creationFlags,owner}).where(eq("project",P), eq("type","canary"), eq("desk", key(deskKey)), gt("$expiresAt", u64(head))).createdBy(DESK).limit(1)
// 3. Desk inbox (cursor pagination, pin the block, client-side sort by createdAt)
select({key,createdAt,expiresAt,payload}).where(eq("project",P), eq("type","tip"), eq("desk", key(deskKey))).createdBy(RELAY).limit(50).atBlock(head).cursor(c)
// 4. Replies a source can trust
select({key,payload}).where(eq("project",P), eq("type","reply"), eq("tip", key(tipKey))).createdBy(DESK).limit(20)
// 5. Sealed tips: creator is the sponsor, owner is the burn address
select({key,owner,creator,creationFlags}).where(eq("project",P), eq("type","tip")).createdBy(RELAY).ownedBy(0x…dEaD).limit(20)
// 6. Explorer filters: type and optional ownedBy(burn)
select({key,attributes,creator,owner,expiresAt,createdAt,creationFlags}).where(eq("project",P), eq("type", kind?)).ownedBy(burn?).limit(20).atBlock(head)
```
Live: `watchEntityEvents({ onEntityCreated, onExpiryExtended, onOwnershipTransferred, onEntityPatched, onEntityDeleted })` over a `webSocket()` transport, no `fromBlock`. Walk extra pages only when `hasNextPage()` is true.

`getEntityNonce(owner)` is the mint counter `predictEntityKeys` reads. It is not the Ethereum pending nonce.

`getEntityCount()` is every live entity on Tiramisu. It is not "how many CanaryDrop entities exist". Project counts still use `eq("project", P)`.

`builder.toString()` is the predicate only. It does not print SELECT or LIMIT.

## Writes
- `executeBatch({ creates:[desk, canary] })` with keys from `predictEntityKeys` (canary references desk in the same tx)
- `executeBatch({ extensions:[canary 26h, desk 30d] })` = "sign today's canary"
- `executeBatch({ creates:[tip], ownershipChanges:[{ entityKey: tip, newOwner: 0x…dEaD }] })` (relay)
- `executeBatch({ creates:[reply], extensions:[desk 30d] })` (desk reply)

## Example on‑chain keys and tx hashes (Tiramisu)
- Desk `0x874e543a36fd673980ca4f2cd992ef9ac1aca38218f1232452bb5d7a7fac6231` and canary `0x5a9cc9685585f462cc85dfdc2884f06309aa2cda9cc10acfeaa1a260e5a7cc70` created atomically — tx https://tiramisu.explorer.arkiv.network/tx/0x6558bfd29237fd4b131fbee1d74f13ac3ce1152d88a5ae05d24d5f33a1dc35be
- Sealed tips:  
  `0xd4f74471b97a44751650ccb4fd473a6056715d327497838f2a1c36da13e67f51` — https://tiramisu.explorer.arkiv.network/tx/0xfba666e2ed91c4cd35f0020959cfe48520247f3ab6a96efa1b5e0ed2868744d9  
  `0xb4301aeffa5a5364d2de46b6485c04cc44fcf2000ebc1194a672769d5014cab8` — https://tiramisu.explorer.arkiv.network/tx/0x2401d9b57ae4545d4f2aee716476db731bcd7cc260c9c1ae42f1ec5e0b6df83c  
  `0x4e65bf8206c285562c47d5893f15c7f78beb06337e80fe3414b1c196ebfc82b2` — https://tiramisu.explorer.arkiv.network/tx/0x96c37ab0a3592f02abe6ac75565fb5b0c400bb451156d2c156246728f3fc886f
- Reply — tx https://tiramisu.explorer.arkiv.network/tx/0x3372344033724934a4e5cd09d9512fc1cf5cf221a5e05f11daecd814055227c1
- Renew canary and desk (lifetime extension) — https://tiramisu.explorer.arkiv.network/tx/0x348fcd830adef7e6cbf5e8201d425e208ef01be8cc6321e41bfa1a6b5f5df466
- Impersonator fake desk — `0x4d8e321f65850a6ea1d7bfa5bc59a2256e1cf9e09007011f69cb5d61645106ef` — https://tiramisu.explorer.arkiv.network/tx/0x953418573cb61d2e3174f1729162d0ee76e280c43e3633ccba3956b500ff4706

## Kept off Arkiv on purpose
Plaintext, private keys (desk key stays in the browser plus a downloaded backup; the source's receipt key only on their device), IP addresses (the relay keeps no logs; Vercel platform logs are a known limitation), and any identity of the source.
