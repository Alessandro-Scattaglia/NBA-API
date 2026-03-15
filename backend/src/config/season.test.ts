import { describe, expect, it } from "vitest";
import { NBA_SEASON, PLAYOFF_PICTURE_SEASON_ID, SEASON_START_YEAR, getSeasonBounds } from "./season.js";

describe("season config", () => {
  it("derives the expected season identifiers", () => {
    expect(NBA_SEASON).toBe("2025-26");
    expect(SEASON_START_YEAR).toBe(2025);
    expect(PLAYOFF_PICTURE_SEASON_ID).toBe("22025");
  });

  it("builds a season date window in the expected year span", () => {
    const bounds = getSeasonBounds();

    expect(bounds.start.toISOString().slice(0, 10)).toBe("2025-10-01");
    expect(bounds.end.toISOString().slice(0, 10)).toBe("2026-07-31");
  });
});
