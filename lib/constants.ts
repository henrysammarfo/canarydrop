import type { Hex } from 'viem';

/** Unique project attribute on every entity and every query. */
export const PROJECT = 'canarydrop-gts26-hm';

export const SEALED_OWNER = '0x000000000000000000000000000000000000dEaD' as Hex;

export const DEFAULT_RELAY = '0xa6Aa6a1409eb54028550466169A29EAfd8f7a442' as Hex;
export const DEFAULT_DESK = '0x1da3c22c079c264536D831F6F1fCe638aB0b20B0' as Hex;
export const DEFAULT_IMPOSTOR = '0x97250dcDbE5fB229Fb532AAC0d62be44e028b7Af' as Hex;

export const PRODUCTION_HOST = 'canarydrop.vercel.app';
export const PAGES_HOST = 'henrysammarfo.github.io';

/** Ciphertext plus envelope must stay under this. Matches the relay write cap. */
export const MAX_WIRE_BYTES = 8192;
/** Base64 of MAX_WIRE_BYTES, with a little slack for padding. */
export const MAX_WIRE_B64_CHARS = Math.ceil(MAX_WIRE_BYTES / 3) * 4 + 8;
export const MAX_PLAINTEXT_CHARS = 4000;
export const MAX_DESK_NAME = 60;
export const MAX_PUB_B64 = 200;

export const RELAY_DAILY_TIP_CAP = 120;
export const DESK_DAILY_WRITE_CAP = 40;
export const DESK_DAILY_CREATE_CAP = 10;
/** Refuse writes if the sponsor wallet holds less than 0.02 GLM. */
export const MIN_WALLET_WEI = 20n * 10n ** 15n;

export const IP_RATE_WINDOW_MS = 60_000;
export const IP_RATE_MAX_RELAY = 8;
export const IP_RATE_MAX_DESK = 8;
/** Same-origin chain snapshots. Higher than writes so Overview, Explorer, and Inbox can retry. */
export const IP_RATE_MAX_READ = 40;

/** Fresh window for server chain snapshots. Shared by memory and Next data cache. */
export const LIVE_CACHE_MS = 45_000;
export const LIVE_CACHE_S = Math.round(LIVE_CACHE_MS / 1000);
/** Serve the last good snapshot this long when Tiramisu rate limits or fails. */
export const LIVE_STALE_MS = 15 * 60 * 1000;

/** Shared Redis key prefixes. Rest tokens never go in these names. */
export const REDIS_RL_PREFIX = 'cd:rl';
export const REDIS_LOCK_PREFIX = 'cd:lock';
/** Hold a wallet lock long enough for predict, sign, and one backoff. */
export const WALLET_LOCK_TTL_MS = 12_000;
/** How long a second isolate waits for the lock before returning try_later. */
export const WALLET_LOCK_WAIT_MS = 2_000;
export const WALLET_LOCK_RETRY_MS = 50;

export const CHAIN_RETRY_ATTEMPTS = 4;
export const CHAIN_RETRY_BASE_MS = 50;
/** Reads retry once with a slower, jittered pause so 429s are not amplified. */
export const CHAIN_READ_RETRY_ATTEMPTS = 2;
export const CHAIN_READ_RETRY_BASE_MS = 700;

export const CSRF_COOKIE = 'cd_csrf';
export const CSRF_HEADER = 'x-csrf-token';

export const LIFETIME_KEYS = ['1h', '24h', '72h', '7d'] as const;
export type Lifetime = (typeof LIFETIME_KEYS)[number];

/** Floor so new tips stay live through judging. After this instant, the picker lifetime stands alone. */
export const DEMO_TIP_LIVE_UNTIL = new Date('2026-10-27T23:59:59.000Z');

export const SEALED_TIPS_EMPTY =
  'No live sealed tips right now. Earlier demo tips have expired. Send a new tip from Submit. New tips last at least until 27 Oct 2026.';

export const CHAIN_READ_FAILED = 'Could not read Tiramisu right now. This page will try again on its own.';

export const PROOF_CACHE_MS = LIVE_CACHE_MS;
export const PROOF_STALE_MS = LIVE_STALE_MS;

export const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
export const ENTITY_KEY_RE = /^0x[0-9a-fA-F]{64}$/;
export const PRIVATE_KEY_RE = /^0x[0-9a-fA-F]{64}$/;
