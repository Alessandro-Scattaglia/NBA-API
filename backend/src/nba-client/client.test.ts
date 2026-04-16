import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

describe("nba client", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("aborts even when response body parsing stalls", async () => {
    process.env.NBA_REQUEST_TIMEOUT_MS = "20";
    process.env.NBA_REQUEST_RETRIES = "0";

    vi.useFakeTimers();

    vi.resetModules();
    const { createNbaApiClient } = await import("./client.js");

    const fetchImpl: typeof fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const signal = init?.signal;
      return {
        ok: true,
        json: () =>
          new Promise((_resolve, reject) => {
            signal?.addEventListener(
              "abort",
              () => reject(new DOMException("The operation was aborted.", "AbortError")),
              { once: true }
            );
          })
      } as Response;
    });

    const promise = createNbaApiClient(fetchImpl).getLiveScoreboard();
    const caughtErrorPromise = promise.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(25);

    await expect(caughtErrorPromise).resolves.toMatchObject({ name: "AbortError" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
