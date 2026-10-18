import { createPublicClient } from "@arkiv-network/sdk"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { eq, gt } from "@arkiv-network/sdk/query"
import { http, webSocket } from "viem"
import { u64 } from "@arkiv-network/sdk/attr"
const c = createPublicClient({ chain: tiramisu, transport: http() })
const {currentBlock} = await c.getBlockTiming()
const q = c.select({key:true, creator:true, expiresAt:true, createdAt:true, creationFlags:true, attributes:true}).where(gt("$expiresAt", u64(currentBlock))).limit(2)
console.log(q.toString())
try { const r = await q.fetch(); console.log(r.entities.length, JSON.stringify(r.entities[0],(k,v)=>typeof v==='bigint'?v.toString():v).slice(0,400), "next?", r.hasNextPage()) } catch(e){ console.log("ERR", e.message) }
try { gt("created", Date.now()-86400000); console.log("bare Date.now ok") } catch(e) { console.log("BP-doc snippet ERR:", e.message.slice(0,200)) }
const w = createPublicClient({ chain: tiramisu, transport: webSocket() })
let n=0; const t0=Date.now(); const un = w.watchEntityEvents({ onEvent: e => { n++; if(n<3) console.log("ws event", e.type, e.blockNumber, Date.now()-t0,"ms") }, onError: e=>console.log("wserr", e.message) })
await new Promise(r=>setTimeout(r,10000)); un(); console.log("ws events in 10s:", n); process.exit(0)
