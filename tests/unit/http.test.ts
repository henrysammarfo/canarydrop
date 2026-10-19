import { describe, expect, it, vi } from 'vitest';
import { EntityMutationError } from '@arkiv-network/sdk';
import type { Hex } from 'viem';
import { AppError } from '@/lib/errors';
import { jsonFail, jsonOk, sanitizeLogText } from '@/lib/http';

describe('http helpers', () => {
  it('jsonOk returns the payload and 200', async () => {
    const r = jsonOk({ ok: true, predictedTipKey: '0x1' });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, predictedTipKey: '0x1' });
  });

  it('jsonFail maps AppError to a public body', async () => {
    const r = jsonFail(new AppError('no_desk'));
    expect(r.status).toBe(400);
    const j = await r.json();
    expect(j.error).toBe('no_desk');
    expect(j.message).toBe('That desk does not exist.');
  });

  it('jsonFail never returns Ident32 text', async () => {
    const r = jsonFail(new Error('execution reverted: Ident32InvalidByte(1, 0x41)'));
    const j = await r.json();
    expect(j.error).toBe('server_error');
    expect(String(j.message)).not.toMatch(/Ident32|0x41|reverted/);
  });

  it('jsonFail maps funds and rate limits', async () => {
    expect((await jsonFail(new Error('insufficient funds')).json()).error).toBe('unfunded');
    expect((await jsonFail(new Error('ANON_COST_LIMITED')).json()).error).toBe('rate_limited');
  });

  it('strips key-like and URL-like values from log text', () => {
    const hash = `0x${'ab'.repeat(32)}`;
    const addr = `0x${'cd'.repeat(20)}`;
    const bare = 'ef'.repeat(32);
    const out = sanitizeLogText(`fail ${hash} wallet ${addr} key ${bare} see https://rpc.example/path and wss://rpc.example/ws`);
    expect(out).not.toContain(hash);
    expect(out).not.toContain(addr);
    expect(out).not.toContain(bare);
    expect(out).not.toContain('https://rpc.example');
    expect(out).not.toContain('wss://rpc.example');
    expect(out).toContain('0x…');
    expect(out).toContain('[url]');
  });

  it('logs a stripped server error for status 500 and above', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const hash = `0x${'11'.repeat(32)}`;
    jsonFail(new Error(`execution reverted at ${hash} via https://rpc.example`));
    expect(spy).toHaveBeenCalled();
    const logged = spy.mock.calls.map((c) => c.map(String).join(' ')).join('\n');
    expect(logged).toMatch(/server error/);
    expect(logged).not.toContain(hash);
    expect(logged).not.toContain('https://rpc.example');
    spy.mockRestore();
  });

  it('does not log client errors', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    jsonFail(new AppError('no_desk'));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('maps a receipt timeout with a hash to 202 still confirming', async () => {
    const hash = `0x${'cd'.repeat(32)}` as Hex;
    const err = new EntityMutationError('Transaction failed: Timed out while waiting for transaction', {
      txHash: hash,
    });
    const r = jsonFail(err);
    expect(r.status).toBe(202);
    const j = await r.json();
    expect(j.ok).toBe(true);
    expect(j.txHash).toBe(hash);
    expect(j.confirming).toBe(true);
    expect(j.message).toBe('still confirming');
  });

  it('keeps a reverted write with a hash as 500 without leaking the hash', async () => {
    const hash = `0x${'22'.repeat(32)}` as Hex;
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new EntityMutationError(`Transaction ${hash} reverted. Reason: no entity`, { txHash: hash });
    const r = jsonFail(err);
    expect(r.status).toBe(500);
    const j = await r.json();
    expect(j.message).toMatch(/explorer/i);
    expect(j.message).not.toContain(hash.slice(2, 10));
    const logged = spy.mock.calls.map((c) => c.map(String).join(' ')).join('\n');
    expect(logged).toMatch(/server error/);
    expect(logged).not.toContain(hash);
    spy.mockRestore();
  });
});
