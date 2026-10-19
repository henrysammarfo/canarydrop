import { describe, expect, it } from 'vitest';
import { AppError } from '@/lib/errors';
import { jsonFail, jsonOk } from '@/lib/http';

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
});
