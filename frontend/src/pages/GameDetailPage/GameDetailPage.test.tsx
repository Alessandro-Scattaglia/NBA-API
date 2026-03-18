import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameDetailPage } from "./GameDetailPage";

function renderGameDetailPage(route = "/games/0022500977") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/games/:gameId" element={<GameDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("GameDetailPage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows a clear message when detailed game data is not available yet", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            game: {
              gameId: "0022500977",
              gameCode: "20260320/NYKBOS",
              dateTimeUtc: "2026-03-20T23:00:00.000Z",
              dateLabel: "20 mar 2026, 23:00",
              status: "scheduled",
              statusText: "7:00 PM ET",
              phase: "regular-season",
              arena: "TD Garden",
              nationalTv: ["ESPN"],
              clock: null,
              period: null,
              homeTeam: {
                teamId: 1610612738,
                name: "Boston Celtics",
                code: "BOS",
                logo: "https://example.com/bos.svg",
                score: null,
                record: "50-20"
              },
              awayTeam: {
                teamId: 1610612752,
                name: "New York Knicks",
                code: "NYK",
                logo: "https://example.com/nyk.svg",
                score: null,
                record: "45-25"
              }
            },
            dataAvailability: {
              status: "scheduled",
              message:
                "La partita deve ancora iniziare. Il boxscore e le statistiche saranno disponibili quando l'NBA pubblichera i dati."
            },
            homeLeaders: [],
            awayLeaders: [],
            homePlayers: [],
            awayPlayers: []
          },
          meta: {
            updatedAt: "2026-03-15T00:00:00.000Z",
            stale: false,
            source: ["test"]
          }
        }),
        { status: 200 }
      )
    );

    renderGameDetailPage();

    expect(
      await screen.findByText(
        "La partita deve ancora iniziare. Il boxscore e le statistiche saranno disponibili quando l'NBA pubblichera i dati."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "New York Knicks VS Boston Celtics" })).toBeInTheDocument();
    expect(screen.getAllByText("La partita deve ancora iniziare.").length).toBeGreaterThan(0);
  });

  it("renders a richer completed game layout with formatted minutes", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            game: {
              gameId: "0022500101",
              gameCode: "20260315/ORLMIA",
              dateTimeUtc: "2026-03-15T23:00:00.000Z",
              dateLabel: "15 mar 2026, 23:00",
              status: "final",
              statusText: "Final",
              phase: "regular-season",
              arena: "Kaseya Center",
              nationalTv: ["ESPN"],
              clock: null,
              period: 4,
              homeTeam: {
                teamId: 1610612748,
                name: "Miami Heat",
                code: "MIA",
                logo: "https://example.com/mia.svg",
                score: 117,
                record: "35-31"
              },
              awayTeam: {
                teamId: 1610612753,
                name: "Orlando Magic",
                code: "ORL",
                logo: "https://example.com/orl.svg",
                score: 121,
                record: "39-28"
              }
            },
            dataAvailability: {
              status: "available",
              message: null
            },
            homeLeaders: [
              {
                playerId: 1,
                fullName: "Bam Adebayo",
                teamId: 1610612748,
                points: 20,
                rebounds: 7,
                assists: 1
              }
            ],
            awayLeaders: [
              {
                playerId: 2,
                fullName: "Paolo Banchero",
                teamId: 1610612753,
                points: 27,
                rebounds: 8,
                assists: 7
              }
            ],
            homePlayers: [
              {
                playerId: 1,
                fullName: "Bam Adebayo",
                position: "C",
                starter: true,
                minutes: "PT38M29.00S",
                points: 20,
                rebounds: 7,
                assists: 1,
                steals: 4,
                blocks: 2,
                plusMinus: 5
              }
            ],
            awayPlayers: [
              {
                playerId: 2,
                fullName: "Paolo Banchero",
                position: "F",
                starter: true,
                minutes: "PT37M19.00S",
                points: 27,
                rebounds: 8,
                assists: 7,
                steals: 0,
                blocks: 0,
                plusMinus: 9
              },
              {
                playerId: 3,
                fullName: "Cole Anthony",
                position: "G",
                starter: false,
                minutes: "PT18M10.00S",
                points: 9,
                rebounds: 2,
                assists: 3,
                steals: 1,
                blocks: 0,
                plusMinus: 2
              }
            ]
          },
          meta: {
            updatedAt: "2026-03-15T12:33:23.000Z",
            stale: false,
            source: ["test"]
          }
        }),
        { status: 200 }
      )
    );

    renderGameDetailPage("/games/0022500101");

    expect(await screen.findByRole("heading", { name: "Orlando Magic VS Miami Heat" })).toBeInTheDocument();
    expect(screen.getByText("Kaseya Center")).toBeInTheDocument();
    expect(screen.getByText("121")).toBeInTheDocument();
    expect(screen.getByText("117")).toBeInTheDocument();
    expect(screen.getByText("37 min")).toBeInTheDocument();
    expect(screen.getByText("TV: ESPN")).toBeInTheDocument();
    expect(screen.getByAltText("Headshot di Paolo Banchero")).toHaveAttribute(
      "src",
      "https://cdn.nba.com/headshots/nba/latest/1040x760/2.png"
    );
    expect(screen.getAllByText("Rec").length).toBeGreaterThan(0);
    expect(screen.queryByText("Stoppate")).not.toBeInTheDocument();

    const paolo = screen.getAllByText("Paolo Banchero").at(-1)!;
    const cole = screen.getByText("Cole Anthony");
    expect(paolo.compareDocumentPosition(cole) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
