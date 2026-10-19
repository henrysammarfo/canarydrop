import { fallback, http, webSocket } from 'viem';
import { TIRAMISU_RPC } from './chain';

const HTTP_OPTS = { retryCount: 0, timeout: 12_000 } as const;
const WS_OPTS = { retryCount: 0, timeout: 12_000 } as const;

/**
 * Arkiv currently publishes one public HTTP RPC for Tiramisu.
 * A Hub access key on that same host raises the anonymous limit.
 * Optional ARKIV_RPC_URL is server-only and must stay on that host.
 */
export function extraRpcUrl(
  env: { ARKIV_RPC_URL?: string | undefined } = { ARKIV_RPC_URL: process.env.ARKIV_RPC_URL },
): string | undefined {
  const raw = env.ARKIV_RPC_URL?.trim();
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return undefined;
    if (url.hostname !== 'rpc.tiramisu.db-chain.testnet.arkiv.network') return undefined;
    const href = url.toString().replace(/\/$/, '');
    if (href === TIRAMISU_RPC) return undefined;
    return href;
  } catch {
    return undefined;
  }
}

export function rpcHttp() {
  const extra = typeof window === 'undefined' ? extraRpcUrl() : undefined;
  const primary = http(undefined, HTTP_OPTS);
  if (!extra) return primary;
  return fallback([http(extra, HTTP_OPTS), primary], { retryCount: 0 });
}

export function rpcWs() {
  return webSocket(undefined, WS_OPTS);
}
