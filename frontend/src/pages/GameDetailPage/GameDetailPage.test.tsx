import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameDetailPage } from "./GameDetailPage";

describe("GameDetailPage", () => {
  afterEach(() => {
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

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false
        }
      }
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/games/0022500977"]}>
          <Routes>
            <Route path="/games/:gameId" element={<GameDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(
      await screen.findByText(
        "La partita deve ancora iniziare. Il boxscore e le statistiche saranno disponibili quando l'NBA pubblichera i dati."
      )
    ).toBeInTheDocument();
    expect(screen.getAllByText("La partita deve ancora iniziare.").length).toBeGreaterThan(0);
  });
});
