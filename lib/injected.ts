export type InjectedRequestArgs = {
  method: string;
  params?: unknown[];
};

export type InjectedProvider = {
  request: (args: InjectedRequestArgs) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

export function getInjectedProvider(): InjectedProvider | null {
  if (typeof window === 'undefined') return null;
  const candidate = window.ethereum;
  if (!candidate || typeof candidate.request !== 'function') return null;
  return candidate;
}

export function walletErrorCode(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  if (!('code' in err)) return undefined;
  const code = (err as { code: unknown }).code;
  return typeof code === 'number' ? code : undefined;
}

export function walletErrorMessage(err: unknown): string | undefined {
  if (err instanceof Error) return err.message;
  if (typeof err !== 'object' || err === null) return undefined;
  if (!('message' in err)) return undefined;
  const message = (err as { message: unknown }).message;
  return typeof message === 'string' ? message : undefined;
}
