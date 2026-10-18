import { createPublicClient, createWalletClient } from "@arkiv-network/sdk"
import { key, u64 } from "@arkiv-network/sdk/attr"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { eq, gt } from "@arkiv-network/sdk/query"
import { ExpirationTime, jsonToPayload } from "@arkiv-network/sdk/utils"
import { http, webSocket, type Hex } from "viem"

export const PROJECT = "canarydrop-gts26-hm" // unique project attribute on every entity + query (Best Practices §1)
export const SEALED_OWNER = "0x000000000000000000000000000000000000dEaD" as Hex
export const RELAY = (process.env.NEXT_PUBLIC_RELAY_ADDRESS ?? "0x0") as Hex

export const pub = createPublicClient({ chain: tiramisu, transport: http() })
export const ws: ReturnType<typeof createPublicClient> = createPublicClient({ chain: tiramisu, transport: webSocket() }) // real socket, no fromBlock
export type Wallet = ReturnType<typeof createWalletClient>

const head = async () => u64((await pub.getBlockTiming()).currentBlock) // $expiresAt is u64: wrap the bigint

/** Desk onboarding: desk + first canary land atomically; canary points at the desk key it is minted with. */
export async function createDesk(w: Wallet, owner: Hex, name: string, deskPubRaw: Uint8Array) {
  const [desk, canary] = await pub.predictEntityKeys({ owner, count: 2 })
  return w.executeBatch({
    creates: [
      { salt: desk.salt, payload: jsonToPayload({ name, pub: Array.from(deskPubRaw) }),
        contentType: "application/json", attributes: { project: PROJECT, type: "desk" },
        expires: ExpirationTime.fromDays(30) },                       // lease, renewed by desk activity
      { salt: canary.salt, payload: jsonToPayload({ statement: "No warrants or gag orders received." }),
        contentType: "application/json", attributes: { project: PROJECT, type: "canary", desk: key(desk.key) },
        expires: ExpirationTime.fromHours(26), flags: { readonly: true } }, // text frozen, only renewable
    ],
  })
}
/** Daily canary signature + desk lease renewal in one tx. extendEntity SETS expiry; must be later than current. */
export const renew = (w: Wallet, deskKey: Hex, canaryKey: Hex) =>
  w.executeBatch({ extensions: [
    { entityKey: canaryKey, expires: ExpirationTime.fromHours(26) },
    { entityKey: deskKey, expires: ExpirationTime.fromDays(30) },
  ] })

/** Desk lookup pinned to the newsroom's on-chain creator: an impersonator's desk never matches. */
export async function getDesk(deskCreator: Hex) {
  const r = await pub.select({ key: true, creator: true, expiresAt: true, payload: true })
    .where(eq("project", PROJECT), eq("type", "desk"), gt("$expiresAt", await head()))
    .createdBy(deskCreator).limit(1).fetch()
  return r.entities[0]
}
/** Canary is alive only if a canary by the same creator for this desk has not expired. Expiry fires no event: query. */
export async function canaryAlive(deskCreator: Hex, deskKey: Hex) {
  const r = await pub.select({ key: true, expiresAt: true })
    .where(eq("project", PROJECT), eq("type", "canary"), eq("desk", key(deskKey)), gt("$expiresAt", await head()))
    .createdBy(deskCreator).limit(1).fetch()
  return r.entities[0] ?? null
}
/** Desk inbox, cursor-paginated (max 200/page, no server ordering: sort by createdAt client-side). */
export async function inboxPage(deskKey: Hex, cursor?: string) {
  let q = pub.select({ key: true, createdAt: true, expiresAt: true, payload: true })
    .where(eq("project", PROJECT), eq("type", "tip"), eq("desk", key(deskKey)))
    .createdBy(RELAY).limit(50)
  if (cursor) q = q.cursor(cursor)
  return q.fetch()
}
/** Replies the source can read: only those written by the real desk creator count. */
export async function repliesFor(tipKey: Hex, deskCreator: Hex) {
  return (await pub.select({ key: true, payload: true })
    .where(eq("project", PROJECT), eq("type", "reply"), eq("tip", key(tipKey)))
    .createdBy(deskCreator).limit(20).fetch()).entities
}
export const reply = (w: Wallet, tipKey: Hex, wire: Uint8Array) =>
  w.createEntity({ payload: wire, contentType: "application/octet-stream",
    attributes: { project: PROJECT, type: "reply", tip: key(tipKey) }, expires: ExpirationTime.fromHours(72) })

/** Live inbox without a refresh loop. Events carry no attributes, so read the entity and check it. */
export function watchInbox(deskKey: Hex, onTip: (k: Hex) => void) {
  return ws.watchEntityEvents({
    onEntityCreated: async ({ entityKey, owner }) => {
      if (owner.toLowerCase() !== RELAY.toLowerCase()) return
      const e = await pub.getEntity(entityKey)
      if (e.attributes?.type?.value === "tip" && e.attributes?.desk?.value === deskKey) onTip(entityKey)
    },
    onError: (err) => console.error(err),
  })
}
export const LIFETIMES = { "1h": ExpirationTime.fromHours(1), "24h": ExpirationTime.fromHours(24),
  "72h": ExpirationTime.fromHours(72), "7d": ExpirationTime.fromDays(7) } as const
