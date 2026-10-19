import { TIRAMISU_CHAIN, TIRAMISU_CHAIN_ID_HEX } from './chain';
import { getInjectedProvider, walletErrorCode } from './injected';

export type WalletResult = { address: string } | { error: string };

export function hasInjectedWallet() {
  return !!getInjectedProvider();
}

export async function connectTiramisu(): Promise<WalletResult> {
  const eth = getInjectedProvider();
  if (!eth) {
    return { error: 'No wallet found. Install MetaMask, or use Demo mode on the desk.' };
  }
  try {
    try {
      await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: TIRAMISU_CHAIN_ID_HEX }] });
    } catch (e: unknown) {
      const code = walletErrorCode(e);
      if (code === 4902) {
        await eth.request({ method: 'wallet_addEthereumChain', params: [TIRAMISU_CHAIN] });
      } else if (code === 4001) {
        return { error: 'Wallet request was rejected.' };
      } else {
        return { error: 'Wrong network. Please switch to Tiramisu (chain 7738577).' };
      }
    }
    const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as unknown;
    if (!Array.isArray(accounts) || typeof accounts[0] !== 'string' || !accounts[0]) {
      return { error: 'No account returned by the wallet.' };
    }
    return { address: accounts[0] };
  } catch (e: unknown) {
    if (walletErrorCode(e) === 4001) return { error: 'Wallet request was rejected.' };
    return { error: 'Could not connect the wallet.' };
  }
}

export async function existingAccount(): Promise<string | null> {
  const eth = getInjectedProvider();
  if (!eth) return null;
  try {
    const accounts = (await eth.request({ method: 'eth_accounts' })) as unknown;
    if (!Array.isArray(accounts) || typeof accounts[0] !== 'string') return null;
    return accounts[0] ?? null;
  } catch {
    return null;
  }
}
