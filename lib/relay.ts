// Server only (Next.js route handler). Pays gas for anonymous sources; the source never needs a wallet.
import { createPublicClient, createWalletClient } from "@arkiv-network/sdk"
import { key } from "@arkiv-network/sdk/attr"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { http, type Hex } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { LIFETIMES, PROJECT, SEALED_OWNER } from "./arkiv"

/** Create the tip and hand ownership to 0x…dEaD in ONE atomic batch: nobody (not us, not the desk) can extend,
 *  patch or delete it afterwards, so the lifetime the source picked is the lifetime it gets. */
export async function postTip(deskKey: Hex, wire: Uint8Array, life: keyof typeof LIFETIMES) {
  const account = privateKeyToAccount(process.env.RELAY_PRIVATE_KEY as Hex) // Vercel env var, never in code
  const pub = createPublicClient({ chain: tiramisu, transport: http() })
  const w = createWalletClient({ chain: tiramisu, transport: http(), account })
  if (wire.length > 8192) throw new Error("too large")
  const [tip] = await pub.predictEntityKeys({ owner: account.address, count: 1 })
  const r = await w.executeBatch({
    creates: [{ salt: tip.salt, payload: wire, contentType: "application/octet-stream",
      attributes: { project: PROJECT, type: "tip", desk: key(deskKey) },
      expires: LIFETIMES[life], flags: { readonly: true } }],
    ownershipChanges: [{ entityKey: tip.key, newOwner: SEALED_OWNER }],
  })
  return { tipKey: r.createdEntities[0], txHash: r.txHash }
}
