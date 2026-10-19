import { describe, expect, it } from 'vitest';
import { MIN_WALLET_WEI } from '@/lib/constants';
import { directTipAttributes, hasGas, newThrowawayKey, throwawayAccount } from '@/lib/direct-tip';
import { isAddress, isPrivateKey } from '@/lib/hex';

describe('relay-free tips', () => {
  it('makes a throwaway key and account without logging the key', () => {
    const key = newThrowawayKey();
    expect(isPrivateKey(key)).toBe(true);
    const account = throwawayAccount(key);
    expect(isAddress(account.address)).toBe(true);
  });

  it('rejects a malformed key', () => {
    expect(() => throwawayAccount('0x1' as never)).toThrow(/not valid/);
  });

  it('requires the same GLM floor as the sponsor', () => {
    expect(hasGas(0n)).toBe(false);
    expect(hasGas(MIN_WALLET_WEI - 1n)).toBe(false);
    expect(hasGas(MIN_WALLET_WEI)).toBe(true);
  });

  it('marks direct tips with a path attribute', () => {
    const desk = `0x${'ab'.repeat(32)}` as const;
    const attrs = directTipAttributes(desk);
    expect((attrs.path as { value?: string }).value).toBe('direct');
    expect((attrs.type as { value?: string }).value).toBe('tip');
  });
});
