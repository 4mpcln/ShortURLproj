import { z } from 'zod';

export const STATISTICS_CACHE_SECONDS = 300;
const dailySchema = z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), clicks: z.number().int().nonnegative() }));
const entrySchema = z.object({ daily: dailySchema, expiresAt: z.number() });
type Daily = z.infer<typeof dailySchema>;
type Store = {
  readonly isReady: boolean;
  get(key: string): Promise<string | null>;
  setEx(key: string, seconds: number, value: string): Promise<unknown>;
  del(keys: string[]): Promise<unknown>;
};

export function statisticsCacheKey(owner: string, id: string, days: number, now = Date.now()) {
  const date = new Date(now).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  return `qlean:statistics:v1:${owner}:${id}:${date}:${days}`;
}

// A cache outage must not stall an otherwise healthy database request.
async function bounded<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Cache timeout')), 200);
    })]);
  } finally { clearTimeout(timer!); }
}

export function createStatisticsCache(store: Store, now = Date.now) {
  return {
    async read(owner: string, id: string, days: number, load: () => Promise<Daily>) {
      const key = statisticsCacheKey(owner, id, days, now());
      if (store.isReady) {
        try {
          const value = await bounded(store.get(key));
          const parsed = value ? entrySchema.safeParse(JSON.parse(value)) : null;
          if (parsed?.success && parsed.data.expiresAt > now()) return parsed.data;
        } catch { /* Query the database when Redis is unavailable or the entry is invalid. */ }
      }
      const entry = { daily: await load(), expiresAt: now() + STATISTICS_CACHE_SECONDS * 1000 };
      if (store.isReady) {
        try { await bounded(store.setEx(key, STATISTICS_CACHE_SECONDS, JSON.stringify(entry))); }
        catch { /* Successful database results remain usable without Redis. */ }
      }
      return entry;
    },
    async invalidate(owner: string, id: string) {
      if (!store.isReady) return;
      try {
        await bounded(store.del(Array.from({ length: 90 }, (_, index) => statisticsCacheKey(owner, id, index + 1, now()))));
      } catch { /* Cached daily aggregates expire even if invalidation is unavailable. */ }
    },
  };
}
