import { http, webSocket } from 'viem';

/** Public Tiramisu RPC only. Never append access keys here. */
export function rpcHttp() {
  return http(undefined, { retryCount: 0, timeout: 20_000 });
}

export function rpcWs() {
  return webSocket(undefined, { retryCount: 0, timeout: 20_000 });
}
