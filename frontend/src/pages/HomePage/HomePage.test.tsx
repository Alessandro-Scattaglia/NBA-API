import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomePage } from "./HomePage";

describe("HomePage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prioritizes the playoff entry point at the top of the home page", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            season: "2025-26",
            todayGames: [],
            upcomingGames: [],
            featuredGame: null,
            conferenceLeaders: {
              east: null,
              west: null
            },
            playerLeaders: []
          },
          meta: {
            updatedAt: "2026-04-21T08:00:00Z",
            stale: false,
            source: ["test"]
          }
        })
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
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route path="/" element={<HomePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(fetchMock).toHaveBeenCalledWith("/api/home");
    expect(await screen.findByRole("heading", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Playoff subito in primo piano" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Vai alla pagina Playoff" })).toHaveAttribute("href", "/playoffs");
  });
});
