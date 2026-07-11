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

  it("sends browser-like headers to CDN endpoints", async () => {
    vi.resetModules();
    const { createNbaApiClient } = await import("./client.js");

    const fetchImpl: typeof fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        Origin: "https://www.nba.com",
        Pragma: "no-cache",
        Referer: "https://www.nba.com/"
      });

      return {
        ok: true,
        json: async () => ({})
      } as Response;
    });

    await createNbaApiClient(fetchImpl).getScheduleSnapshot();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries once with insecure TLS after a certificate verification error", async () => {
    process.env.NBA_REQUEST_RETRIES = "0";

    vi.resetModules();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { createNbaApiClient } = await import("./client.js");

    const certError = Object.assign(new Error("fetch failed"), {
      cause: { code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE" }
    });
    const fetchImpl: typeof fetch = vi
      .fn()
      .mockRejectedValueOnce(certError)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true })
      } as Response);

    await expect(createNbaApiClient(fetchImpl).getScheduleSnapshot()).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBe("0");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Retrying once with certificate verification disabled for this local session.")
    );
  });
});
