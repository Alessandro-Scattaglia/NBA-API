import type { KVNamespace } from "./kv.js";

export interface CacheState<T> {
  value: T;
  updatedAt: string;
  stale: boolean;
}

function isUsableValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

interface CacheEntry<T> {
  value: T;
  freshUntil?: number;
  expiresAt?: number;
  updatedAt: string;
}

const DEFAULT_RETENTION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class MemoryCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly refreshInFlight = new Map<string, Promise<void>>();

  constructor(private readonly kv?: KVNamespace) {}

  getStats() {
    return {
      entries: this.store.size,
      refreshInFlight: this.refreshInFlight.size,
      keys: Array.from(this.store.keys())
    };
  }

  private async loadFreshValue<T>(
    key: string,
    freshTtlMs: number,
    loader: () => Promise<T>,
    validate: (value: T) => boolean,
    retentionTtlMs: number
  ) {
    const value = await loader();
    if (!validate(value)) {
      throw new Error(`Invalid or empty cache value for ${key}`);
    }
    const entry: CacheEntry<T> = {
      value,
      freshUntil: Date.now() + freshTtlMs,
      updatedAt: new Date().toISOString()
    };

    this.store.set(key, entry);
    if (this.kv) {
      try {
        await this.kv.put(key, JSON.stringify(entry), {
          expirationTtl: Math.max(1, Math.ceil(retentionTtlMs / 1000))
        });
      } catch (error) {
        console.warn(`[cache] KV write failed for ${key}`, error instanceof Error ? error.message : error);
      }
    }
    return entry;
  }

  private async loadFromKv<T>(key: string) {
    if (!this.kv) return null;
    const entry = await this.kv.get<CacheEntry<T>>(key, "json");
    if (!entry || !entry.updatedAt || entry.value === undefined) return null;
    this.store.set(key, entry);
    return entry;
  }

  private startBackgroundRefresh<T>(
    key: string,
    freshTtlMs: number,
    loader: () => Promise<T>,
    validate: (value: T) => boolean,
    retentionTtlMs: number
  ) {
    const running = this.refreshInFlight.get(key);

    if (running) {
      return running;
    }

    const refreshPromise = this.loadFreshValue(key, freshTtlMs, loader, validate, retentionTtlMs)
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
    freshTtlMs: number,
    loader: () => Promise<T>,
    allowStaleOnError = true,
    validate: (value: T) => boolean = isUsableValue,
    retentionTtlMs = DEFAULT_RETENTION_TTL_MS
  ): Promise<CacheState<T>> {
    const now = Date.now();
    let cached = this.store.get(key) as CacheEntry<T> | undefined;

    if (!cached) {
      try {
        cached = (await this.loadFromKv<T>(key)) ?? undefined;
      } catch (error) {
        console.warn(`[cache] KV read failed for ${key}`, error instanceof Error ? error.message : error);
        cached = undefined;
      }
    }

    const freshUntil = cached?.freshUntil ?? cached?.expiresAt ?? 0;
    if (cached && freshUntil > now) {
      return {
        value: cached.value,
        updatedAt: cached.updatedAt,
        stale: false
      };
    }

    if (cached && allowStaleOnError) {
      void this.startBackgroundRefresh(key, freshTtlMs, loader, validate, retentionTtlMs);

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
          stale: (refreshed.freshUntil ?? refreshed.expiresAt ?? 0) <= Date.now()
        };
      }
    }

    try {
      const entry = await this.loadFreshValue(key, freshTtlMs, loader, validate, retentionTtlMs);

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
