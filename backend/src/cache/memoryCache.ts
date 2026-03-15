export interface CacheState<T> {
  value: T;
  updatedAt: string;
  stale: boolean;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  updatedAt: string;
}

export class MemoryCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  async getOrLoad<T>(
    key: string,
    ttlMs: number,
    loader: () => Promise<T>,
    allowStaleOnError = true
  ): Promise<CacheState<T>> {
    const now = Date.now();
    const cached = this.store.get(key) as CacheEntry<T> | undefined;

    if (cached && cached.expiresAt > now) {
      return {
        value: cached.value,
        updatedAt: cached.updatedAt,
        stale: false
      };
    }

    try {
      const value = await loader();
      const entry: CacheEntry<T> = {
        value,
        expiresAt: now + ttlMs,
        updatedAt: new Date().toISOString()
      };
      this.store.set(key, entry);
      return {
        value: entry.value,
        updatedAt: entry.updatedAt,
        stale: false
      };
    } catch (error) {
      if (cached && allowStaleOnError) {
        return {
          value: cached.value,
          updatedAt: cached.updatedAt,
          stale: true
        };
      }

      throw error;
    }
  }
}

export const cache = new MemoryCache();
