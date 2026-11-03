import { describe, expect, it } from "vitest";
import { createNbaApiClient } from "./client.js";
import { createRuntimeEnv } from "../config/env.js";

function response(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload
  } as Response;
}

describe("ESPN calendar client", () => {
  it("loads an interval with ESPN pagination without an API key", async () => {
    const urls: string[] = [];
    const client = createNbaApiClient(async (input) => {
      urls.push(String(input));
      return response({
        pageCount: 2,
        events: [{ id: "1" }]
      });
    }, createRuntimeEnv({ NBA_REQUEST_RETRIES: "0" }));

    const result = await client.getGamesSchedule("2026-10-01", "2026-10-03");

    expect(result).toEqual({
      data: [{ id: "1" }, { id: "1" }, { id: "1" }, { id: "1" }, { id: "1" }, { id: "1" }],
      provider: "ESPN"
    });
    expect(urls).toHaveLength(6);
    expect(urls[0]).toContain("site.api.espn.com");
    expect(urls[0]).toContain("dates=20261001");
    expect(urls[2]).toContain("dates=20261002");
    expect(urls[0]).not.toContain("Authorization");
  });

  it("preserves upstream status for retry and fallback handling", async () => {
    const client = createNbaApiClient(
      async () => response({}, 429),
      createRuntimeEnv({ NBA_REQUEST_RETRIES: "0" })
    );

    await expect(client.getEspnScoreboardByDate?.("2026-10-01")).rejects.toMatchObject({ status: 429 });
  });

  it("does not retry non-recoverable 404 responses", async () => {
    let attempts = 0;
    const client = createNbaApiClient(
      async () => {
        attempts += 1;
        return response({}, 404);
      },
      createRuntimeEnv({ NBA_REQUEST_RETRIES: "2" })
    );

    await expect(client.getEspnScoreboardByDate?.("2026-10-01")).rejects.toMatchObject({ status: 404 });
    expect(attempts).toBe(1);
  });

  it("retries a 5xx response with the configured retry count", async () => {
    let attempts = 0;
    const client = createNbaApiClient(
      async () => {
        attempts += 1;
        return response({}, 503);
      },
      createRuntimeEnv({ NBA_REQUEST_RETRIES: "1" })
    );

    await expect(client.getEspnScoreboardByDate?.("2026-10-01")).rejects.toMatchObject({ status: 503 });
    expect(attempts).toBe(2);
  });

  it("retries an aborted request as a timeout", async () => {
    let attempts = 0;
    const client = createNbaApiClient(
      async () => {
        attempts += 1;
        const error = new Error("aborted");
        error.name = "AbortError";
        throw error;
      },
      createRuntimeEnv({ NBA_REQUEST_RETRIES: "1" })
    );

    await expect(client.getEspnScoreboardByDate?.("2026-10-01")).rejects.toThrow("aborted");
    expect(attempts).toBe(2);
  });
});
