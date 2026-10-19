# CanaryDrop threat model

This is a testnet demo. It is not a production newsroom product. Residual risk remains. Nothing here is unhackable.

## What we protect

Sources send synthetic tips. The plaintext is locked on the source device with P-256 ECDH, HKDF-SHA256, and AES-256-GCM. The relay posts ciphertext only. Tips are created and handed to `0x000000000000000000000000000000000000dEaD` in one Arkiv batch, with the readonly flag set, so nobody can extend, patch, or delete them later.

The newsroom canary is not `permissionlessExtension`. Only the desk wallet can renew it. Reads of desk, canary, and replies are pinned with `createdBy(deskWallet)`. An impostor desk with the same name does not match.

## Attacks we block

1. **Scripted drain of the demo wallets with a missing Origin.** Write APIs now require an allowed Origin. A request with no Origin is rejected. The old `includes()` host check is gone, so `https://canarydrop.vercel.app.evil.com` is not treated as our site.

2. **Cross site posts.** `Sec-Fetch-Site: cross-site` and `same-site` are rejected. A CSRF cookie must match the `x-csrf-token` header. SameSite=Lax stops ordinary cross site cookie use.

3. **Paying gas for a desk that does not exist.** `postTip` calls `getEntity` and checks type, project, and expiry before it signs.

4. **Concurrent tips colliding on nonce.** Relay writes run in a per process queue. Each write reads `pending` transaction count and retries nonce, 429, and timeout errors with backoff. If `EntityMutationError` carries a tx hash, we do not retry.

5. **A single serverless instance rate limit being the only cap.** Per IP windows still live in memory (honest limit on Vercel). Durable caps are on Arkiv: `slot` is the UTC day on each new tip, reply, and desk, queried with `createdBy` the paying wallet. Caps are 120 tips, 40 replies, and 10 demo desk creates per UTC day. GLM balance is checked before a write. If the wallet is below 0.02 GLM, the write is refused.

6. **Ciphertext size disagreement.** One cap: 8192 bytes after base64 decode. The Zod max and the relay max are derived from the same constant.

7. **Raw revert text in the browser.** Route handlers map failures to public codes. RPC text, stacks, and key material are not returned.

8. **Clickjacking and wild script eval.** CSP sets `frame-ancestors 'none'`, drops `unsafe-eval`, uses a per request script nonce with `strict-dynamic`, and allowlists Tiramisu RPC on `connect-src` instead of `https:`.

9. **Inbox that only sees live events.** The desk loads `inboxPage` with `.atBlock` and a cursor, then watches new creates. Older tips are a button away.

10. **A judge in a fresh browser who cannot open demo tips.** Demo mode fetches a shared testnet P-256 key derived on the server from `DESK_PRIVATE_KEY`. That key is not an Ethereum key and is not committed. It exists so judges can reproduce the desk inbox. A real newsroom must generate its own key in the browser and keep a backup.

## Attacks we do not claim to block

- The relay still sees ciphertext, size, and the chosen lifetime. A seized Vercel account can still post junk tips until spend caps bite.
- Platform logs may record IPs. We do not write IPs to Arkiv.
- Anonymous Tiramisu RPC can return 429. Reads then fail until the budget recovers.
- Demo mode trust is weaker than a wallet owned desk. Anyone who can call the demo key route from an allowed Origin can open demo tips.
- `style-src` still allows `unsafe-inline` because React sets element styles. Script eval is the part we tightened.
- Per IP limits reset when a serverless instance dies. The Arkiv daily cap and the GLM floor are the durable brakes.
- Historical tips sealed to an older desk public key cannot be opened with the shared demo key. Create the desk again in Demo mode so the on-chain public key matches.

## Trust boundaries

| Piece | Trust |
|---|---|
| Source browser | Holds the receipt private key. If the device is seized, replies for that tip can be opened. |
| Desk browser (real mode) | Holds the P-256 desk key in local storage. Backup is a file the newsroom downloads. |
| Desk browser (demo mode) | Uses a shared testnet key. Fine for judges. Wrong for a real newsroom. |
| Relay server | Pays GLM. Must not see plaintext. Guarded by Origin, CSRF, IP window, Arkiv daily cap, and a balance floor. |
| Arkiv Tiramisu | Public metadata. Ciphertext in payloads. Creator is the access control we actually use. |

## Keys and secrets

Never commit, print, or log Ethereum private keys, seed phrases, or RPC URLs with credentials. Integration tests generate throwaway keys in memory. The demo P-256 key is derived at runtime from `DESK_PRIVATE_KEY` and returned only to allowed Origins.
