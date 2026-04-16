import type { ApiEnvelope } from "./types";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

export async function apiGet<T>(path: string): Promise<ApiEnvelope<T>> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const response = await fetch(`${API_BASE_URL}${normalizedPath}`);

  if (!response.ok) {
    const fallbackMessage = `Errore API ${response.status}`;

    try {
      const payload = (await response.json()) as { error?: string };
      throw new Error(payload.error ?? fallbackMessage);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }

      throw new Error(fallbackMessage);
    }
  }

  return response.json() as Promise<ApiEnvelope<T>>;
}
