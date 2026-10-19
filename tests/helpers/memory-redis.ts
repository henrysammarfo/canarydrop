import type { IpLimiter } from '@/lib/rate-limit';
import type { RedisSetOpts, SharedStore } from '@/lib/store';

type Row = { value: string; exp: number };

/** In memory Redis stand in for SET NX PX, GET, DEL, and the unlock script. */
export class FakeRedis implements SharedStore {
  private readonly data = new Map<string, Row>();
  setCalls = 0;
  evalCalls = 0;
  failSet = false;
  failEval = false;

  private live(key: string, now = Date.now()): Row | undefined {
    const row = this.data.get(key);
    if (!row) return undefined;
    if (row.exp <= now) {
      this.data.delete(key);
      return undefined;
    }
    return row;
  }

  async set(key: string, value: string, opts?: RedisSetOpts): Promise<'OK' | null> {
    this.setCalls += 1;
    if (this.failSet) throw new Error('redis set failed');
    const now = Date.now();
    const current = this.live(key, now);
    if (opts?.nx && current) return null;
    const px = opts?.px ?? 60_000;
    this.data.set(key, { value, exp: now + px });
    return 'OK';
  }

  async get(key: string): Promise<string | null> {
    return this.live(key)?.value ?? null;
  }

  async del(...keys: string[]): Promise<number> {
    let n = 0;
    for (const key of keys) {
      if (this.live(key)) {
        this.data.delete(key);
        n += 1;
      } else {
        this.data.delete(key);
      }
    }
    return n;
  }

  async eval<T = unknown>(script: string, keys: string[], args: string[]): Promise<T> {
    this.evalCalls += 1;
    if (this.failEval) throw new Error('redis eval failed');
    const key = keys[0] ?? '';
    const token = args[0] ?? '';
    if (script.includes('redis.call("get"') && script.includes('redis.call("del"')) {
      const row = this.live(key);
      if (row && row.value === token) {
        this.data.delete(key);
        return 1 as T;
      }
      return 0 as T;
    }
    throw new Error('unsupported eval script in FakeRedis');
  }

  size(): number {
    return this.data.size;
  }
}

/** Shared counter used in tests to mimic two isolates hitting the same window. */
export function createStoreIpGate(store: SharedStore, max: number, windowMs = 60_000): IpLimiter {
  return {
    async limit(identifier: string) {
      const key = `cd:rl:test:${identifier}`;
      const raw = await store.get(key);
      const n = raw ? Number.parseInt(raw, 10) : 0;
      if (!Number.isFinite(n) || n >= max) return { success: false };
      await store.set(key, String(n + 1), { px: windowMs });
      return { success: true };
    },
  };
}
