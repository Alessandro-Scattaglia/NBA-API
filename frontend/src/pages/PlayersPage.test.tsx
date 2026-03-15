import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlayersPage } from "./PlayersPage";

describe("PlayersPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads the search param and renders fetched players", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            season: "2025-26",
            total: 1,
            page: 1,
            pageSize: 30,
            items: [
              {
                playerId: 1,
                firstName: "Jayson",
                lastName: "Tatum",
                fullName: "Jayson Tatum",
                headshot: "https://example.com/player.png",
                team: {
                  teamId: 1610612738,
                  name: "Boston Celtics",
                  code: "BOS",
                  logo: "https://example.com/logo.svg"
                },
                jersey: "0",
                position: "F",
                height: "6-8",
                weight: "210",
                averages: {
                  gamesPlayed: 70,
                  minutes: 36.1,
                  points: 27.4,
                  rebounds: 8.7,
                  assists: 4.9,
                  steals: 1.1,
                  blocks: 0.7,
                  fgPct: 47.1,
                  threePct: 38.3,
                  ftPct: 85.2
                }
              }
            ]
          },
          meta: {
            updatedAt: "2026-03-14T00:00:00.000Z",
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
        <MemoryRouter initialEntries={["/players?search=tatum"]}>
          <Routes>
            <Route path="/players" element={<PlayersPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue("tatum")).toBeInTheDocument();
    });

    expect(await screen.findByText("Jayson Tatum")).toBeInTheDocument();
    expect(screen.getByText("Giocatori trovati: 1")).toBeInTheDocument();
  });
});
