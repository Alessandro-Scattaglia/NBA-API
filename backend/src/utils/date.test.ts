import { describe, expect, it } from "vitest";
import { getItalianDate } from "./date.js";

describe("Italian game-day conversion", () => {
  it("keeps a game before midnight on the previous Italian day", () => {
    expect(getItalianDate("2026-11-18T22:59:00Z")).toBe("2026-11-18");
  });

  it("moves a game at exactly midnight to the next Italian day", () => {
    expect(getItalianDate("2026-11-18T23:00:00Z")).toBe("2026-11-19");
  });

  it("handles daylight saving time without fixed offsets", () => {
    expect(getItalianDate("2026-07-01T21:59:00Z")).toBe("2026-07-01");
    expect(getItalianDate("2026-07-01T22:00:00Z")).toBe("2026-07-02");
    expect(getItalianDate("2026-01-01T23:00:00Z")).toBe("2026-01-02");
  });
});
