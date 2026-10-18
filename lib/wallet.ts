import { TIRAMISU_CHAIN, TIRAMISU_CHAIN_ID_HEX } from './chain';

export type WalletResult = { address: string } | { error: string };

function ethereum() {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { ethereum?: any }).ethereum ?? null;
}

export function hasInjectedWallet() {
  return !!ethereum();
}

export async function connectTiramisu(): Promise<WalletResult> {
  const eth = ethereum();
  if (!eth) {
    return { error: 'No wallet found. Install MetaMask, or use Demo mode on the desk.' };
  }
  try {
    try {
      await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: TIRAMISU_CHAIN_ID_HEX }] });
    } catch (e: any) {
      if (e?.code === 4902) {
        await eth.request({ method: 'wallet_addEthereumChain', params: [TIRAMISU_CHAIN] });
      } else if (e?.code === 4001) {
        return { error: 'Wallet request was rejected.' };
      } else {
        return { error: 'Wrong network. Please switch to Tiramisu (chain 7738577).' };
      }
    }
    const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
    if (!accounts?.[0]) return { error: 'No account returned by the wallet.' };
    return { address: accounts[0] };
  } catch (e: any) {
    if (e?.code === 4001) return { error: 'Wallet request was rejected.' };
    return { error: String(e?.message ?? e) };
  }
}

export async function existingAccount(): Promise<string | null> {
  const eth = ethereum();
  if (!eth) return null;
  try {
    const accounts = (await eth.request({ method: 'eth_accounts' })) as string[];
    return accounts?.[0] ?? null;
  } catch {
    return null;
  }
}
