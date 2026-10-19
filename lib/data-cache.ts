import { LIVE_CACHE_S } from './constants';

/**
 * Next.js data cache across Fluid Compute isolates. Skipped in unit tests.
 * Failures are never stored. Callers keep an in-memory last-good copy.
 */
export async function rememberRead<T>(cacheKey: string, fn: () => Promise<T>, revalidate = LIVE_CACHE_S): Promise<T> {
  if (process.env.VITEST) return fn();
  let unstable_cache: typeof import('next/cache').unstable_cache;
  try {
    ({ unstable_cache } = await import('next/cache'));
  } catch {
    return fn();
  }
  // Do not catch loader failures here. A 429 must surface so the in-memory
  // cache can serve the last good snapshot instead of hitting the RPC again.
  return unstable_cache(fn, [cacheKey], {
    revalidate,
    tags: ['arkiv-live', cacheKey],
  })();
}
