import { describe, expect, it } from 'vitest';
import { csrfFromDocument, readCookie } from '@/lib/client-fetch';

describe('client fetch helpers in node', () => {
  it('readCookie is null without a document', () => {
    expect(readCookie('cd_csrf')).toBeNull();
  });

  it('csrfFromDocument is empty without a document', () => {
    expect(csrfFromDocument()).toBe('');
  });
});
