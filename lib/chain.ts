export const TIRAMISU_CHAIN_ID = 7738577;
export const TIRAMISU_CHAIN_ID_HEX = '0x7614d1';
export const TIRAMISU_RPC = 'https://rpc.tiramisu.db-chain.testnet.arkiv.network';
export const TIRAMISU_EXPLORER = 'https://tiramisu.explorer.arkiv.network';
export const TIRAMISU_HUB = 'https://hub.arkiv.network/tiramisu';

export const TIRAMISU_CHAIN = {
  chainId: TIRAMISU_CHAIN_ID_HEX,
  chainName: 'Arkiv Tiramisu Testnet',
  nativeCurrency: { name: 'GLM', symbol: 'GLM', decimals: 18 },
  rpcUrls: [TIRAMISU_RPC],
  blockExplorerUrls: [TIRAMISU_EXPLORER],
};

export function entityUrl(key: string) {
  return `${TIRAMISU_EXPLORER}/entity/${key}`;
}
export function txUrl(hash: string) {
  return `${TIRAMISU_EXPLORER}/tx/${hash}`;
}
export function addressUrl(addr: string) {
  return `${TIRAMISU_EXPLORER}/address/${addr}`;
}

export function shortHex(value: string, head = 6, tail = 4) {
  if (!value) return '';
  if (value.length <= head + tail + 2) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function isSealedOwner(owner?: string | null) {
  return !!owner && owner.toLowerCase() === '0x000000000000000000000000000000000000dead';
}
