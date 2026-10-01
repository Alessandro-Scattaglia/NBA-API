import { describe, expect, it } from "vitest";
import { getSeasonPhase, resolveSeason, validateSeason } from "./season.js";

describe("season detection", () => {
  it("validates a season in the expected format", () => {
    expect(validateSeason("2026-27")).toBe("2026-27");
    expect(() => validateSeason("2026")).toThrow();
  });

  it("detects a season from a date using the NBA calendar", () => {
    expect(resolveSeason(new Date("2026-10-01T00:00:00Z"))).toBe("2026-27");
  });

  it("reports the season phase from the date", () => {
    expect(getSeasonPhase(new Date("2026-10-02T00:00:00Z"))).toBe("regular-season");
    expect(getSeasonPhase(new Date("2026-08-15T00:00:00Z"))).toBe("offseason");
  });
});
