import { describe, expect, it } from 'vitest';
import { DEFAULT_DESK, DEFAULT_IMPOSTOR, PROJECT } from '@/lib/constants';
import {
  canonicalDemoRecord,
  declaredWellKnownUrl,
  deskFromDnsTxt,
  deskFromTxtRecords,
  dnsTxtForDesk,
  fakeDeskSignal,
  parseDeskRecord,
  parseDohTxtAnswers,
  recordMatchesDesk,
  wellKnownUrl,
} from '@/lib/domain-verify';

describe('verified domain', () => {
  it('parses a valid well known record', () => {
    const rec = parseDeskRecord({
      v: 1,
      desk: DEFAULT_DESK,
      name: 'CanaryDrop demo desk',
      project: PROJECT,
    });
    expect(rec?.desk).toBe(DEFAULT_DESK);
    expect(recordMatchesDesk(rec!, DEFAULT_DESK)).toBe(true);
    expect(recordMatchesDesk(rec!, DEFAULT_IMPOSTOR)).toBe(false);
  });

  it('rejects bad versions and bad addresses', () => {
    expect(parseDeskRecord({ v: 2, desk: DEFAULT_DESK })).toBeNull();
    expect(parseDeskRecord({ v: 1, desk: 'nope' })).toBeNull();
    expect(parseDeskRecord(null)).toBeNull();
  });

  it('round trips the DNS TXT claim', () => {
    const txt = dnsTxtForDesk(DEFAULT_DESK);
    expect(txt).toBe(`canarydrop-desk=${DEFAULT_DESK}`);
    expect(deskFromDnsTxt(txt)).toBe(DEFAULT_DESK);
    expect(deskFromDnsTxt('other=0x1')).toBeNull();
  });

  it('flags a fake desk against the listed address', () => {
    expect(fakeDeskSignal(DEFAULT_DESK, DEFAULT_DESK)).toBe('listed');
    expect(fakeDeskSignal(DEFAULT_DESK, DEFAULT_IMPOSTOR)).toBe('mismatch');
    expect(fakeDeskSignal(null, DEFAULT_DESK)).toBe('unknown');
  });

  it('parses DoH TXT answers and prefers a listed desk', () => {
    const txts = parseDohTxtAnswers([
      { type: 16, data: '"canarydrop-desk=0x1da3c22c079c264536D831F6F1fCe638aB0b20B0"' },
      { type: 1, data: '1.2.3.4' },
    ]);
    expect(deskFromTxtRecords(txts)).toBe(DEFAULT_DESK);
    expect(declaredWellKnownUrl('newsroom.example')).toBe('https://newsroom.example/.well-known/canarydrop.json');
    expect(fakeDeskSignal(null, DEFAULT_IMPOSTOR)).toBe('unknown');
  });

  it('builds the well known path', () => {
    expect(wellKnownUrl('https://canarydrop.vercel.app')).toBe(
      'https://canarydrop.vercel.app/.well-known/canarydrop.json',
    );
    expect(canonicalDemoRecord().desk).toBe(DEFAULT_DESK);
  });
});
