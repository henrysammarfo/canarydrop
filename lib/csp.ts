const RPC_HTTP = 'https://rpc.tiramisu.db-chain.testnet.arkiv.network';
const RPC_WS = 'wss://rpc.tiramisu.db-chain.testnet.arkiv.network';
const MEDIA_A = 'https://d8j0ntlcm91z4.cloudfront.net';
const MEDIA_B = 'https://d2ol7oe51mr4n9.cloudfront.net';

export function buildCsp(nonce: string): string {
  // nonce + strict-dynamic is the real policy. unsafe-inline is ignored by CSP3
  // when a nonce is present, and is only there so older browsers can still boot Next.
  const script = `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline'`;
  const directives = [
    `default-src 'self'`,
    `script-src ${script}`,
    `script-src-elem ${script}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: ${MEDIA_B}`,
    `media-src ${MEDIA_A} ${MEDIA_B}`,
    `font-src 'self' data:`,
    `connect-src 'self' ${RPC_HTTP} ${RPC_WS}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `worker-src 'none'`,
    `manifest-src 'self'`,
    `upgrade-insecure-requests`,
  ];
  return directives.join('; ');
}

export function cspAllowsUnsafeEval(header: string): boolean {
  return /script-src[^;]*unsafe-eval/.test(header);
}

export function cspAllowsUnsafeInlineScript(header: string): boolean {
  const script = header.split(';').find((part) => part.trim().startsWith('script-src'));
  if (!script) return false;
  return /'unsafe-inline'/.test(script) && !/'nonce-/.test(script) && !/'strict-dynamic'/.test(script);
}
