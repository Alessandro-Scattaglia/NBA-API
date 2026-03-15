import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { StandingsTable } from "./StandingsTable";

describe("StandingsTable", () => {
  it("shows playoff state badges", () => {
    render(
      <MemoryRouter>
        <StandingsTable
          teams={[
            {
              teamId: 1610612751,
              city: "Brooklyn",
              name: "Brooklyn Nets",
              nickname: "Nets",
              code: "BKN",
              slug: "brooklyn-nets",
              conference: "East",
              division: "Atlantic",
              logo: "https://example.com/logo.svg",
              wins: 40,
              losses: 42,
              winPct: 0.488,
              gamesBehind: 12.5,
              conferenceRank: 8,
              homeRecord: "22-19",
              awayRecord: "18-23",
              lastTen: "4-6",
              streak: "L1",
              playoffStatus: "play-in",
              clinchedPlayoff: false,
              clinchedDivision: false,
              clinchedConference: false
            }
          ]}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Play-In")).toBeInTheDocument();
    expect(screen.getByText("Brooklyn Nets")).toBeInTheDocument();
  });
});
