import { describe, expect, it } from 'vitest';
import { renewNotice } from '@/lib/renew-ui';

describe('renew notice', () => {
  it('tells the truth when the receipt is still confirming', () => {
    const hash = `0x${'ab'.repeat(32)}`;
    const notice = renewNotice(202, { ok: true, confirming: true, txHash: hash, message: 'still confirming' });
    expect(notice.kind).toBe('confirming');
    expect(notice.text).toBe('The renew was sent and is still confirming.');
    expect(notice.txHash).toBe(hash);
    expect(notice.text).not.toMatch(/[\u2013\u2014]/);
  });

  it('keeps success, dry run, and error distinct', () => {
    expect(renewNotice(200, { ok: true }).kind).toBe('ok');
    expect(renewNotice(200, { ok: true, dryRun: true }).kind).toBe('dry');
    expect(renewNotice(500, { error: 'server_error', message: 'Something went wrong. Please try again.' }).kind).toBe(
      'error',
    );
  });
});
