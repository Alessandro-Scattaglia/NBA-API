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
  private readonly refreshInFlight = new Map<string, Promise<void>>();

  private async loadFreshValue<T>(key: string, ttlMs: number, loader: () => Promise<T>) {
    const value = await loader();
    const entry: CacheEntry<T> = {
      value,
      expiresAt: Date.now() + ttlMs,
      updatedAt: new Date().toISOString()
    };

    this.store.set(key, entry);
    return entry;
  }

  private startBackgroundRefresh<T>(key: string, ttlMs: number, loader: () => Promise<T>) {
    const running = this.refreshInFlight.get(key);

    if (running) {
      return running;
    }

    const refreshPromise = this.loadFreshValue(key, ttlMs, loader)
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => {
        this.refreshInFlight.delete(key);
      });

    this.refreshInFlight.set(key, refreshPromise);
    return refreshPromise;
  }

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

    if (cached && allowStaleOnError) {
      void this.startBackgroundRefresh(key, ttlMs, loader);

      return {
        value: cached.value,
        updatedAt: cached.updatedAt,
        stale: true
      };
    }

    const activeRefresh = this.refreshInFlight.get(key);
    if (activeRefresh) {
      await activeRefresh;
      const refreshed = this.store.get(key) as CacheEntry<T> | undefined;

      if (refreshed) {
        return {
          value: refreshed.value,
          updatedAt: refreshed.updatedAt,
          stale: refreshed.expiresAt <= Date.now()
        };
      }
    }

    try {
      const entry = await this.loadFreshValue(key, ttlMs, loader);

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
