export type ProviderName = "ESPN" | "NBA CDN" | "NBA Stats" | "cache";

export interface ProviderHealth {
  status: "healthy" | "degraded" | "down" | "unknown";
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  responseTimeMs: number | null;
  source: string | null;
}

const providers = new Map<ProviderName, ProviderHealth>();

function getOrCreate(provider: ProviderName) {
  const current = providers.get(provider);
  if (current) return current;
  const initial: ProviderHealth = {
    status: "unknown",
    lastSuccessAt: null,
    lastErrorAt: null,
    lastError: null,
    responseTimeMs: null,
    source: null
  };
  providers.set(provider, initial);
  return initial;
}

export function recordProviderSuccess(provider: ProviderName, responseTimeMs: number, source: string) {
  const state = getOrCreate(provider);
  state.status = "healthy";
  state.lastSuccessAt = new Date().toISOString();
  state.lastError = null;
  state.responseTimeMs = responseTimeMs;
  state.source = source;
}

export function recordProviderError(provider: ProviderName, error: unknown, responseTimeMs: number, source: string) {
  const state = getOrCreate(provider);
  state.status = "degraded";
  state.lastErrorAt = new Date().toISOString();
  state.lastError = error instanceof Error ? error.message : String(error);
  state.responseTimeMs = responseTimeMs;
  state.source = source;
}

export function getProviderHealth() {
  return Object.fromEntries([...providers.entries()].map(([provider, state]) => [provider, { ...state }]));
}
