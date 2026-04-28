import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CalendarPage } from "./CalendarPage";

describe("CalendarPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the selected day and lets the user navigate by day", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);

      if (url === "/api/teams") {
        return new Response(
          JSON.stringify({
            data: {
              season: "2025-26",
              east: [
                {
                  teamId: 1610612738,
                  city: "Boston",
                  name: "Boston Celtics",
                  nickname: "Celtics",
                  code: "BOS",
                  slug: "boston-celtics",
                  conference: "East",
                  division: "Atlantic",
                  logo: "https://example.com/bos.svg",
                  wins: 44,
                  losses: 23,
                  winPct: 0.657,
                  gamesBehind: 0,
                  conferenceRank: 1,
                  homeRecord: "22-11",
                  awayRecord: "22-12",
                  lastTen: "7-3",
                  streak: "W2",
                  playoffStatus: "playoff",
                  clinchedPlayoff: true,
                  clinchedDivision: false,
                  clinchedConference: false,
                  seed: 1,
                  gamesPlayed: 67,
                  remainingGames: 15
                }
              ],
              west: [
                {
                  teamId: 1610612748,
                  city: "Miami",
                  name: "Miami Heat",
                  nickname: "Heat",
                  code: "MIA",
                  slug: "miami-heat",
                  conference: "East",
                  division: "Southeast",
                  logo: "https://example.com/mia.svg",
                  wins: 35,
                  losses: 31,
                  winPct: 0.53,
                  gamesBehind: 0,
                  conferenceRank: 8,
                  homeRecord: "18-15",
                  awayRecord: "17-16",
                  lastTen: "5-5",
                  streak: "L1",
                  playoffStatus: "play-in",
                  clinchedPlayoff: false,
                  clinchedDivision: false,
                  clinchedConference: false,
                  seed: 8,
                  gamesPlayed: 66,
                  remainingGames: 16
                }
              ]
            },
            meta: {
              updatedAt: "2026-03-15T11:00:00.000Z",
              stale: false,
              source: ["test"]
            }
          }),
          { status: 200 }
        );
      }

      return new Response(
        JSON.stringify({
          data: {
            season: "2025-26",
            from: "2026-03-15",
            to: "2026-03-15",
            total: 1,
            items: [
              {
                gameId: "0022500001",
                gameCode: "20260315/BOSNYK",
                dateTimeUtc: "2026-03-15T19:30:00Z",
                dateLabel: "15 mar 2026, 20:30",
                status: "scheduled",
                statusText: "3:30 pm ET",
                phase: "regular-season",
                arena: "Madison Square Garden",
                nationalTv: [],
                clock: null,
                period: null,
                homeTeam: {
                  teamId: 1610612752,
                  name: "New York Knicks",
                  code: "NYK",
                  logo: "https://example.com/nyk.svg",
                  score: null,
                  record: "43-25"
                },
                awayTeam: {
                  teamId: 1610612738,
                  name: "Boston Celtics",
                  code: "BOS",
                  logo: "https://example.com/bos.svg",
                  score: null,
                  record: "44-23"
                }
              }
            ]
          },
          meta: {
            updatedAt: "2026-03-15T11:00:00.000Z",
            stale: false,
            source: ["test"]
          }
        }),
        { status: 200 }
      );
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false
        }
      }
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/calendar?date=2026-03-15"]}>
          <Routes>
            <Route path="/calendar" element={<CalendarPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await screen.findByText("Programma giornaliero");

    expect(fetchMock).toHaveBeenCalledWith("/api/calendar?from=2026-03-15&to=2026-03-15");
    expect(screen.getByText("BOS")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: ">" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/calendar?from=2026-03-16&to=2026-03-16");
    });

    fireEvent.change(screen.getByDisplayValue("Tutte le squadre"), {
      target: { value: "1610612748" }
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/calendar?from=2026-03-16&to=2026-03-16&teamId=1610612748");
    });
  });
});
