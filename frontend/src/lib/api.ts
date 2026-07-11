import type { ApiEnvelope } from "./types";

async function readJsonSafely<T>(response: Response): Promise<T | null> {
  const raw = await response.text();

  if (!raw) {
    return null;
  }

  return JSON.parse(raw) as T;
}

export async function apiGet<T>(path: string): Promise<ApiEnvelope<T>> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  let response: Response;

  try {
    response = await fetch(normalizedPath);
  } catch {
    throw new Error("Backend locale non raggiungibile su http://127.0.0.1:4001");
  }

  if (!response.ok) {
    const fallbackMessage = `Errore API ${response.status}`;

    try {
      const payload = await readJsonSafely<{ error?: string }>(response);
      throw new Error(payload?.error ?? fallbackMessage);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }

      throw new Error(fallbackMessage);
    }
  }

  const payload = await readJsonSafely<ApiEnvelope<T>>(response);

  if (!payload) {
    throw new Error("Risposta API vuota dal backend locale");
  }

  return payload;
}
