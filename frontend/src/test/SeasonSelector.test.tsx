import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SeasonSelector } from "../components/common/SeasonSelector";

describe("SeasonSelector", () => {
  it("renders the selected season and the reset action", () => {
    render(
      <SeasonSelector
        seasons={["2024-25", "2025-26", "2026-27"]}
        value="2025-26"
        currentSeason="2026-27"
        onChange={() => undefined}
      />
    );

    expect(screen.getByText("2025-26")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /torna alla stagione corrente/i })).toBeInTheDocument();
  });
});
