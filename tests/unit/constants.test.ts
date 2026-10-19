import { describe, expect, it } from 'vitest';
import {
  ADDRESS_RE,
  CSRF_COOKIE,
  CSRF_HEADER,
  DEFAULT_DESK,
  DEFAULT_IMPOSTOR,
  DEFAULT_RELAY,
  ENTITY_KEY_RE,
  IP_RATE_MAX_DESK,
  IP_RATE_MAX_READ,
  IP_RATE_MAX_RELAY,
  LIVE_CACHE_MS,
  LIVE_STALE_MS,
  REDIS_LOCK_PREFIX,
  REDIS_RL_PREFIX,
  WALLET_LOCK_TTL_MS,
  LIFETIME_KEYS,
  MAX_PLAINTEXT_CHARS,
  MAX_WIRE_BYTES,
  PRIVATE_KEY_RE,
  PAGES_HOST,
  PRODUCTION_HOST,
  PROJECT,
  SEALED_OWNER,
} from '@/lib/constants';
import { isLifetime } from '@/lib/arkiv';
import { isSealedOwner } from '@/lib/chain';

describe('constants', () => {
  it('project id is stable', () => {
    expect(PROJECT).toBe('canarydrop-gts26-hm');
  });

  it('sealed owner is the burn address', () => {
    expect(SEALED_OWNER.toLowerCase()).toBe('0x000000000000000000000000000000000000dead');
    expect(isSealedOwner(SEALED_OWNER)).toBe(true);
    expect(isSealedOwner(DEFAULT_RELAY)).toBe(false);
  });

  it('default wallets are checksum addresses', () => {
    expect(ADDRESS_RE.test(DEFAULT_RELAY)).toBe(true);
    expect(ADDRESS_RE.test(DEFAULT_DESK)).toBe(true);
    expect(ADDRESS_RE.test(DEFAULT_IMPOSTOR)).toBe(true);
    expect(DEFAULT_RELAY).not.toBe(DEFAULT_DESK);
    expect(DEFAULT_DESK).not.toBe(DEFAULT_IMPOSTOR);
  });

  it('entity and private key regexes are 32 bytes', () => {
    expect(ENTITY_KEY_RE.test(`0x${'ab'.repeat(32)}`)).toBe(true);
    expect(PRIVATE_KEY_RE.test(`0x${'cd'.repeat(32)}`)).toBe(true);
    expect(ENTITY_KEY_RE.test(`0x${'ab'.repeat(20)}`)).toBe(false);
  });

  it('lifetimes are the four product choices', () => {
    expect([...LIFETIME_KEYS]).toEqual(['1h', '24h', '72h', '7d']);
    for (const life of LIFETIME_KEYS) expect(isLifetime(life)).toBe(true);
    expect(isLifetime('30d')).toBe(false);
    expect(isLifetime('')).toBe(false);
  });

  it('csrf names and ip windows', () => {
    expect(CSRF_COOKIE).toBe('cd_csrf');
    expect(CSRF_HEADER).toBe('x-csrf-token');
    expect(IP_RATE_MAX_RELAY).toBe(8);
    expect(IP_RATE_MAX_DESK).toBe(8);
    expect(IP_RATE_MAX_READ).toBe(40);
    expect(REDIS_RL_PREFIX).toBe('cd:rl');
    expect(REDIS_LOCK_PREFIX).toBe('cd:lock');
    expect(WALLET_LOCK_TTL_MS).toBe(12_000);
    expect(PRODUCTION_HOST).toBe('canarydrop.vercel.app');
    expect(PAGES_HOST).toBe('henrysammarfo.github.io');
    expect(MAX_WIRE_BYTES).toBe(8192);
    expect(MAX_PLAINTEXT_CHARS).toBe(4000);
    expect(LIVE_CACHE_MS).toBe(45_000);
    expect(LIVE_STALE_MS).toBe(15 * 60 * 1000);
  });
});
