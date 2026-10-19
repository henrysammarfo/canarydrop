import { describe, expect, it } from 'vitest';
import { uiError } from '@/lib/ui-error';

describe('uiError', () => {
  it('passes through a short public message', () => {
    expect(uiError(new Error('That desk does not exist.'))).toBe('That desk does not exist.');
  });

  it('hides urls', () => {
    expect(uiError(new Error('fetch https://rpc.example failed'))).toBe('Something went wrong. Please try again.');
  });

  it('hides private key wording', () => {
    expect(uiError(new Error('private key missing'))).toBe('Something went wrong. Please try again.');
  });

  it('handles non errors', () => {
    expect(uiError(12)).toBe('Something went wrong. Please try again.');
  });

  it('hides seed and mnemonic wording', () => {
    expect(uiError(new Error('seed phrase leaked'))).toBe('Something went wrong. Please try again.');
    expect(uiError(new Error('mnemonic was written to disk'))).toBe('Something went wrong. Please try again.');
  });

  it('hides a long message', () => {
    expect(uiError(new Error('x'.repeat(400)))).toBe('Something went wrong. Please try again.');
  });
});
