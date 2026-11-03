import { describe, expect, it } from "vitest";
import { MemoryCache } from "./memoryCache.js";

describe("MemoryCache with KV", () => {
  it("writes L2 and serves the L2 snapshot in a new instance", async () => {
    const values = new Map<string, string>();
    let retentionTtl = 0;
    const kv = {
      async get<T>(key: string) {
        return values.has(key) ? JSON.parse(values.get(key) as string) as T : null;
      },
      async put(key: string, value: string) {
        values.set(key, value);
        retentionTtl = 123;
      }
    };

    await new MemoryCache(kv).getOrLoad("calendar", 60_000, async () => ["game"]);
    const state = await new MemoryCache(kv).getOrLoad("calendar", 60_000, async () => {
      throw new Error("network must not be used");
    });

    expect(state.value).toEqual(["game"]);
    expect(state.stale).toBe(false);
    expect(retentionTtl).toBe(123);
  });

  it("uses a retention TTL independent from the freshness TTL", async () => {
    let options: { expirationTtl?: number } | undefined;
    const kv = {
      async get() {
        return null;
      },
      async put(_key: string, _value: string, putOptions?: { expirationTtl?: number }) {
        options = putOptions;
      }
    };

    await new MemoryCache(kv).getOrLoad("live", 1_000, async () => ["game"], true, undefined, 86_400_000);

    expect(options?.expirationTtl).toBe(86_400);
  });

  it("keeps a valid snapshot when a refresh returns an empty value", async () => {
    const cache = new MemoryCache();
    await cache.getOrLoad("games", 0, async () => ["valid"], true, (value) => value.length > 0);
    const state = await cache.getOrLoad("games", 0, async () => [], true, (value) => value.length > 0);

    expect(state.value).toEqual(["valid"]);
    expect(state.stale).toBe(true);
  });
});
