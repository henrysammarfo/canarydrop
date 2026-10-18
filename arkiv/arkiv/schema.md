# CanaryDrop: Arkiv schema

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
| `desk` | project:str, type:str | JSON `{name, pub}` (P-256 public key, 65 bytes) | `fromDays(30)` lease, renewed by `extendEntity` each desk session | owner = creator = newsroom wallet |
| `canary` | project, type, desk:key | JSON `{statement}` | `fromHours(26)`, renewed daily; if it lapses the canary is dead | `readonly` (statement frozen, only renewable). Deliberately NOT `permissionlessExtension`: anyone could fake a live canary |
| `tip` | project, type, desk:key | bytes `[v1 \| ephPub 65 \| iv 12 \| AES-GCM ct]`, plaintext padded to 2 KiB buckets | chosen by source: 1h / 24h / 72h / 7d | `readonly`; ownership moved to `0x…dEaD` in the same batch so nobody can extend, patch or delete; the source's lifetime is final |
| `reply` | project, type, tip:key | bytes `[v1 \| iv 12 \| ct]` (same ECDH secret as the tip) | `fromHours(72)` | owner = desk |

No timestamps, names, emails, IPs or hashes of personal data are stored as attributes. `$createdAt` (a block number) and `$expiresAt` are the only time signals.

## Queries the app runs
```ts
// 1. Desk page (source side): pinned to the newsroom's on-chain creator, so impersonators never match
select({key,creator,expiresAt,payload}).where(eq("project",P), eq("type","desk"), gt("$expiresAt", u64(head))).createdBy(DESK).limit(1)
// 2. Canary status
select({key,expiresAt}).where(eq("project",P), eq("type","canary"), eq("desk", key(deskKey)), gt("$expiresAt", u64(head))).createdBy(DESK).limit(1)
// 3. Desk inbox (cursor pagination, client-side sort by createdAt)
select({key,createdAt,expiresAt,payload}).where(eq("project",P), eq("type","tip"), eq("desk", key(deskKey))).createdBy(RELAY).limit(50).cursor(c)
// 4. Replies a source can trust
select({key,payload}).where(eq("project",P), eq("type","reply"), eq("tip", key(tipKey))).createdBy(DESK).limit(20)
```
Live: `watchEntityEvents({ onEntityCreated })` over a `webSocket()` transport, no `fromBlock`.

## Writes
- `executeBatch({ creates:[desk, canary] })` with keys from `predictEntityKeys` (canary references desk in the same tx)
- `executeBatch({ extensions:[canary 26h, desk 30d] })` = "sign today's canary"
- `executeBatch({ creates:[tip], ownershipChanges:[{ entityKey: tip, newOwner: 0x…dEaD }] })` (relay)
- `createEntity` (reply)

## Kept off Arkiv on purpose
Plaintext, private keys (desk key stays in the browser plus a downloaded backup; the source's receipt key only on their device), IP addresses (the relay keeps no logs; Vercel platform logs are a known limitation), and any identity of the source.
