import { describe, expect, it } from 'vitest';
import { extraRpcUrl } from '@/lib/rpc';
import { TIRAMISU_RPC } from '@/lib/chain';

describe('extraRpcUrl', () => {
  it('accepts a keyed URL on the public Tiramisu host', () => {
    const url = extraRpcUrl({
      ARKIV_RPC_URL: 'https://rpc.tiramisu.db-chain.testnet.arkiv.network/test-key',
    });
    expect(url).toContain('rpc.tiramisu.db-chain.testnet.arkiv.network');
    expect(url).toContain('test-key');
    expect(url).not.toBe(TIRAMISU_RPC);
  });

  it('rejects a different host', () => {
    expect(
      extraRpcUrl({ ARKIV_RPC_URL: 'https://example.com/rpc' }),
    ).toBeUndefined();
  });

  it('rejects http', () => {
    expect(
      extraRpcUrl({
        ARKIV_RPC_URL: 'http://rpc.tiramisu.db-chain.testnet.arkiv.network/key',
      }),
    ).toBeUndefined();
  });

  it('ignores the public URL with no access key', () => {
    expect(extraRpcUrl({ ARKIV_RPC_URL: TIRAMISU_RPC })).toBeUndefined();
  });
});
