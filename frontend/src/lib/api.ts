import type { ApiEnvelope } from "./types";

async function readJsonSafely<T>(response: Response): Promise<T | null> {
  const raw = await response.text();

  if (!raw) {
    return null;
  }

  return JSON.parse(raw) as T;
}

function appendSeasonQuery(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (typeof window === "undefined") {
    return normalizedPath;
  }

  const selectedSeason = window.localStorage.getItem("nba-selected-season");

  if (!selectedSeason) {
    return normalizedPath;
  }

  const separator = normalizedPath.includes("?") ? "&" : "?";
  return `${normalizedPath}${separator}season=${encodeURIComponent(selectedSeason)}`;
}

export async function apiGet<T>(path: string): Promise<ApiEnvelope<T>> {
  const finalPath = appendSeasonQuery(path);
  let response: Response;

  try {
    response = await fetch(finalPath);
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
