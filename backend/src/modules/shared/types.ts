import type { MemoryCache } from "../../cache/memoryCache.js";
import type { NbaApiClient } from "../../nba-client/client.js";

export interface ServiceDeps {
  client: NbaApiClient;
  cache?: MemoryCache;
}
