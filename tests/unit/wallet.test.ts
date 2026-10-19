import { describe, expect, it } from 'vitest';
import { walletErrorCode, walletErrorMessage } from '@/lib/injected';
import { hasInjectedWallet } from '@/lib/wallet';

describe('wallet helpers', () => {
  it('reads numeric codes', () => {
    expect(walletErrorCode({ code: 4902 })).toBe(4902);
    expect(walletErrorCode({ code: '4902' })).toBeUndefined();
    expect(walletErrorCode(null)).toBeUndefined();
  });

  it('reads messages', () => {
    expect(walletErrorMessage(new Error('nope'))).toBe('nope');
    expect(walletErrorMessage({ message: 'x' })).toBe('x');
    expect(walletErrorMessage(1)).toBeUndefined();
  });

  it('has no injected wallet in node tests', () => {
    expect(hasInjectedWallet()).toBe(false);
  });

  it('ignores objects without a code field', () => {
    expect(walletErrorCode({ message: 'nope' })).toBeUndefined();
    expect(walletErrorCode('4001')).toBeUndefined();
  });

  it('reads 4001 user rejection', () => {
    expect(walletErrorCode({ code: 4001 })).toBe(4001);
    expect(walletErrorMessage({ message: 'User rejected the request.' })).toBe('User rejected the request.');
  });
});
