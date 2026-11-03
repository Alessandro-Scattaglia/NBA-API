import type { MemoryCache } from "../../cache/memoryCache.js";
import type { NbaApiClient } from "../../nba-client/client.js";
import type { RuntimeEnv } from "../../config/env.js";

export interface ServiceDeps {
  client: NbaApiClient;
  cache?: MemoryCache;
  runtimeEnv?: RuntimeEnv;
}
