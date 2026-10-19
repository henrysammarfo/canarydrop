import type { InjectedProvider } from './lib/injected';

declare global {
  interface Window {
    ethereum?: InjectedProvider;
  }
}

export {};

