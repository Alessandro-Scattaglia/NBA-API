import type { ApiEnvelope } from "../../types/dto/index.js";

export function toEnvelope<T>(
  data: T,
  updatedAt: string,
  stale: boolean,
  source: string[],
  metadata: Partial<ApiEnvelope<T>["meta"]> = {}
): ApiEnvelope<T> {
  return {
    data,
    meta: {
      updatedAt,
      lastSuccessfulSync: stale ? undefined : updatedAt,
      stale,
      source,
      dataStatus: stale ? "stale" : "updated",
      ...metadata
    }
  };
}
