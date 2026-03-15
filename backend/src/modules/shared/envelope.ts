import type { ApiEnvelope } from "../../types/dto.js";

export function toEnvelope<T>(data: T, updatedAt: string, stale: boolean, source: string[]): ApiEnvelope<T> {
  return {
    data,
    meta: {
      updatedAt,
      stale,
      source
    }
  };
}
