import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LeadersPage } from "./LeadersPage";

function renderLeadersPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/leaders"]}>
        <Routes>
          <Route path="/leaders" element={<LeadersPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("LeadersPage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("loads the top 10 leaders and renders the extended categories", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            season: "2025-26",
            categories: [
              {
                key: "points",
                label: "Punti a partita",
                leaders: [
                  {
                    playerId: 1,
                    fullName: "Luka Doncic",
                    headshot: "https://example.com/luka.png",
                    team: { teamId: 1610612747, name: "Los Angeles Lakers", code: "LAL", logo: "https://example.com/lal.svg" },
                    value: 32.8,
                    gamesPlayed: 55
                  }
                ]
              },
              {
                key: "rebounds",
                label: "Rimbalzi a partita",
                leaders: []
              },
              {
                key: "assists",
                label: "Assist a partita",
                leaders: []
              },
              {
                key: "steals",
                label: "Rubate a partita",
                leaders: []
              },
              {
                key: "blocks",
                label: "Stoppate a partita",
                leaders: []
              },
              {
                key: "threesMade",
                label: "Triple a partita",
                leaders: []
              }
            ]
          },
          meta: {
            updatedAt: "2026-03-15T15:32:46.000Z",
            stale: false,
            source: ["test"]
          }
        }),
        { status: 200 }
      )
    );

    renderLeadersPage();

    expect(await screen.findByRole("heading", { name: "Leader statistici" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/leaders?limit=10");
    expect(screen.getByText("Stoppate a partita")).toBeInTheDocument();
    expect(screen.getByText("Triple a partita")).toBeInTheDocument();
  });
});
