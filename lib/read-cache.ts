export type StaleCacheOpts = {
  freshMs: number;
  staleMs: number;
  now?: () => number;
};

export type StaleResult<T> = {
  value: T;
  at: number;
  stale: boolean;
};

type Entry<T> = { at: number; value: T };

/**
 * In-memory cache that coalesces in-flight loads and can serve the last good
 * value after the fresh window when the loader fails.
 */
export class StaleCache {
  private readonly entries = new Map<string, Entry<unknown>>();
  private readonly inflight = new Map<string, Promise<StaleResult<unknown>>>();

  constructor(private readonly opts: StaleCacheOpts) {}

  private now(): number {
    return this.opts.now?.() ?? Date.now();
  }

  peek<T>(key: string): Entry<T> | undefined {
    return this.entries.get(key) as Entry<T> | undefined;
  }

  store<T>(key: string, value: T, at = this.now()): T {
    this.entries.set(key, { at, value });
    return value;
  }

  clear(): void {
    this.entries.clear();
    this.inflight.clear();
  }

  async get<T>(
    key: string,
    load: () => Promise<T>,
    opts?: { bypass?: boolean | undefined; fallback?: (() => T) | undefined },
  ): Promise<StaleResult<T>> {
    const now = this.now();
    if (!opts?.bypass) {
      const hit = this.peek<T>(key);
      if (hit && now - hit.at < this.opts.freshMs) {
        return { value: hit.value, at: hit.at, stale: false };
      }
    }

    const existing = this.inflight.get(key) as Promise<StaleResult<T>> | undefined;
    if (existing) return existing;

    const pending = (async (): Promise<StaleResult<T>> => {
      try {
        const value = await load();
        const at = this.now();
        this.store(key, value, at);
        return { value, at, stale: false };
      } catch (err) {
        const hit = this.peek<T>(key);
        if (hit && this.now() - hit.at < this.opts.staleMs) {
          return { value: hit.value, at: hit.at, stale: true };
        }
        if (opts?.fallback) {
          const value = opts.fallback();
          return { value, at: this.now(), stale: false };
        }
        throw err;
      } finally {
        this.inflight.delete(key);
      }
    })();

    this.inflight.set(key, pending as Promise<StaleResult<unknown>>);
    return pending;
  }
}
