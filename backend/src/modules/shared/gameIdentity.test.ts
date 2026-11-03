import { describe, expect, it } from "vitest";
import {
  canonicalGameId,
  parseCanonicalGameId,
  registerGameIdentity,
  resolveGameIdentity
} from "./gameIdentity.js";

describe("game identity", () => {
  it("recognizes raw ESPN event ids", () => {
    expect(resolveGameIdentity("401909917")).toEqual({
      nbaGameId: null,
      espnEventId: "401909917"
    });
  });
  it("never treats an ESPN event id as an NBA game id", () => {
    const id = canonicalGameId("2026-10-01T00:00:00Z", "BOS", "LAL");

    expect(id).not.toBe("401");
    expect(parseCanonicalGameId(id)).toEqual({ date: "2026-10-01", awayCode: "LAL", homeCode: "BOS" });
    expect(resolveGameIdentity(id)).toEqual({ nbaGameId: null, espnEventId: null });
    expect(resolveGameIdentity("0022600001")).toEqual({ nbaGameId: "0022600001", espnEventId: null });
  });

  it("resolves a registered ESPN event id separately from its NBA id", () => {
    const id = canonicalGameId("2026-10-02", "BOS", "LAL");
    registerGameIdentity({
      canonicalGameId: id,
      nbaGameId: "0022600002",
      espnEventId: "402",
      date: "2026-10-02",
      homeCode: "BOS",
      awayCode: "LAL"
    });

    expect(resolveGameIdentity("402")).toEqual({ nbaGameId: "0022600002", espnEventId: "402" });
    expect(resolveGameIdentity("0022600002")).toEqual({ nbaGameId: "0022600002", espnEventId: "402" });
  });
});
