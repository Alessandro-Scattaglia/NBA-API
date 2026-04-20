import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlayoffsPage } from "./PlayoffsPage";

describe("PlayoffsPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the playoff snapshot and renders an expandable postseason schedule", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            season: "2025-26",
            overview: {
              directQualifiedTeams: 12,
              playInTeams: 8,
              confirmedFirstRoundSeries: 4,
              playInGamesScheduled: 2,
              playoffGamesScheduled: 3
            },
            keyDates: [
              {
                key: "play-in-window",
                label: "SoFi NBA Play-In Tournament",
                startDate: "2026-04-14",
                endDate: "2026-04-17",
                note: "Le squadre dal 7 al 10 si giocano le ultime due seed."
              }
            ],
            finalsDates: [
              {
                key: "finals-game-1",
                label: "Finals 2026 - Gara 1",
                startDate: "2026-06-03",
                endDate: null,
                note: "ABC, 20:30 ET"
              }
            ],
            formatNotes: ["Le seed 1-6 accedono direttamente ai playoff."],
            east: {
              conference: "East",
              directSeeds: [
                {
                  teamId: 1610612765,
                  city: "Detroit",
                  name: "Pistons",
                  nickname: "Pistons",
                  code: "DET",
                  slug: "detroit-pistons",
                  conference: "East",
                  division: "Central",
                  logo: "https://example.com/det.svg",
                  wins: 58,
                  losses: 24,
                  winPct: 0.707,
                  gamesBehind: 0,
                  conferenceRank: 1,
                  homeRecord: "30-11",
                  awayRecord: "28-13",
                  lastTen: "7-3",
                  streak: "W2",
                  playoffStatus: "playoff",
                  clinchedPlayoff: true,
                  clinchedDivision: true,
                  clinchedConference: true,
                  seed: 1,
                  gamesPlayed: 82,
                  remainingGames: 0
                }
              ],
              playInSeeds: [
                {
                  teamId: 1610612755,
                  city: "Philadelphia",
                  name: "76ers",
                  nickname: "76ers",
                  code: "PHI",
                  slug: "philadelphia-76ers",
                  conference: "East",
                  division: "Atlantic",
                  logo: "https://example.com/phi.svg",
                  wins: 45,
                  losses: 37,
                  winPct: 0.549,
                  gamesBehind: 9,
                  conferenceRank: 7,
                  homeRecord: "25-16",
                  awayRecord: "20-21",
                  lastTen: "6-4",
                  streak: "W1",
                  playoffStatus: "play-in",
                  clinchedPlayoff: false,
                  clinchedDivision: false,
                  clinchedConference: false,
                  seed: 7,
                  gamesPlayed: 82,
                  remainingGames: 0
                }
              ],
              outsidePicture: [],
              playInSeries: [
                {
                  conference: "East",
                  round: "play-in",
                  status: "scheduled",
                  label: "(7) 76ers vs. (8) TBD",
                  seedHigh: 7,
                  seedLow: 8,
                  highSeedTeam: {
                    teamId: 1610612755,
                    city: "Philadelphia",
                    name: "76ers",
                    nickname: "76ers",
                    code: "PHI",
                    slug: "philadelphia-76ers",
                    conference: "East",
                    division: "Atlantic",
                    logo: "https://example.com/phi.svg",
                    wins: 45,
                    losses: 37,
                    winPct: 0.549,
                    gamesBehind: 9,
                    conferenceRank: 7,
                    homeRecord: "25-16",
                    awayRecord: "20-21",
                    lastTen: "6-4",
                    streak: "W1",
                    playoffStatus: "play-in",
                    clinchedPlayoff: false,
                    clinchedDivision: false,
                    clinchedConference: false,
                    seed: 7,
                    gamesPlayed: 82,
                    remainingGames: 0
                  },
                  lowSeedTeam: null,
                  note: "La vincente entra nei playoff come seed n. 7.",
                  games: []
                }
              ],
              firstRoundSeries: [
                {
                  conference: "East",
                  round: "first-round",
                  status: "awaiting-play-in",
                  label: "(1) Pistons vs. (8) TBD",
                  seedHigh: 1,
                  seedLow: 8,
                  highSeedTeam: {
                    teamId: 1610612765,
                    city: "Detroit",
                    name: "Pistons",
                    nickname: "Pistons",
                    code: "DET",
                    slug: "detroit-pistons",
                    conference: "East",
                    division: "Central",
                    logo: "https://example.com/det.svg",
                    wins: 58,
                    losses: 24,
                    winPct: 0.707,
                    gamesBehind: 0,
                    conferenceRank: 1,
                    homeRecord: "30-11",
                    awayRecord: "28-13",
                    lastTen: "7-3",
                    streak: "W2",
                    playoffStatus: "playoff",
                    clinchedPlayoff: true,
                    clinchedDivision: true,
                    clinchedConference: true,
                    seed: 1,
                    gamesPlayed: 82,
                    remainingGames: 0
                  },
                  lowSeedTeam: null,
                  note: "La seed n. 8 verra decisa dal Play-In Tournament.",
                  games: []
                }
              ]
            },
            west: {
              conference: "West",
              directSeeds: [],
              playInSeeds: [],
              outsidePicture: [],
              playInSeries: [],
              firstRoundSeries: []
            },
            playInGames: [
              {
                gameId: "0042600102",
                gameCode: "20260415/PHIORL",
                dateTimeUtc: "2026-04-15T23:30:00Z",
                dateLabel: "15 apr 2026, 23:30",
                status: "scheduled",
                statusText: "7:30 pm ET",
                phase: "play-in",
                arena: "Kia Center",
                nationalTv: ["PRIME"],
                clock: null,
                period: null,
                homeTeam: {
                  teamId: 1610612753,
                  name: "Orlando Magic",
                  code: "ORL",
                  logo: "https://example.com/orl.svg",
                  score: null,
                  record: "44-38"
                },
                awayTeam: {
                  teamId: 1610612755,
                  name: "Philadelphia 76ers",
                  code: "PHI",
                  logo: "https://example.com/phi.svg",
                  score: null,
                  record: "45-37"
                }
              }
            ],
            playoffGames: [
              {
                gameId: "0042600110",
                gameCode: "20260418/ATLNYK",
                dateTimeUtc: "2026-04-18T22:00:00Z",
                dateLabel: "18 apr 2026, 22:00",
                status: "scheduled",
                statusText: "6:00 pm ET",
                phase: "playoffs",
                arena: "Madison Square Garden",
                nationalTv: ["PRIME"],
                clock: null,
                period: null,
                homeTeam: {
                  teamId: 1610612752,
                  name: "New York Knicks",
                  code: "NYK",
                  logo: "https://example.com/nyk.svg",
                  score: null,
                  record: "53-29"
                },
                awayTeam: {
                  teamId: 1610612737,
                  name: "Atlanta Hawks",
                  code: "ATL",
                  logo: "https://example.com/atl.svg",
                  score: null,
                  record: "47-35"
                }
              },
              {
                gameId: "0042600103",
                gameCode: "20260416/GSWLAC",
                dateTimeUtc: "2026-04-16T02:00:00Z",
                dateLabel: "16 apr 2026, 02:00",
                status: "scheduled",
                statusText: "10:00 pm ET",
                phase: "playoffs",
                arena: "Intuit Dome",
                nationalTv: ["PRIME"],
                clock: null,
                period: null,
                homeTeam: {
                  teamId: 1610612746,
                  name: "Los Angeles Clippers",
                  code: "LAC",
                  logo: "https://example.com/lac.svg",
                  score: null,
                  record: "51-31"
                },
                awayTeam: {
                  teamId: 1610612744,
                  name: "Golden State Warriors",
                  code: "GSW",
                  logo: "https://example.com/gsw.svg",
                  score: null,
                  record: "49-33"
                }
              },
              {
                gameId: "0042600118",
                gameCode: "20260425/BOSMIA",
                dateTimeUtc: "2026-04-25T23:30:00Z",
                dateLabel: "25 apr 2026, 23:30",
                status: "scheduled",
                statusText: "7:30 pm ET",
                phase: "playoffs",
                arena: "Kaseya Center",
                nationalTv: ["ESPN"],
                clock: null,
                period: null,
                homeTeam: {
                  teamId: 1610612748,
                  name: "Miami Heat",
                  code: "MIA",
                  logo: "https://example.com/mia.svg",
                  score: null,
                  record: "48-34"
                },
                awayTeam: {
                  teamId: 1610612738,
                  name: "Boston Celtics",
                  code: "BOS",
                  logo: "https://example.com/bos.svg",
                  score: null,
                  record: "57-25"
                }
              }
            ]
          },
          meta: {
            updatedAt: "2026-04-13T10:00:00.000Z",
            stale: false,
            source: ["https://www.nba.com/playoffs/2026"]
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
        <MemoryRouter initialEntries={["/playoffs"]}>
          <Routes>
            <Route path="/playoffs" element={<PlayoffsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await screen.findByText("Calendario Postseason");

    expect(fetchMock).toHaveBeenCalledWith("/api/playoffs");
    expect(screen.getByText("Classifica playoff Est")).toBeInTheDocument();
    expect(screen.getByText("Partite schedulate")).toBeInTheDocument();

    const expandButton = screen.getByRole("button", { name: /Mostra altre/i });
    expect(expandButton).toBeInTheDocument();

    fireEvent.click(expandButton);
    expect(screen.getByRole("button", { name: "Mostra meno partite" })).toBeInTheDocument();

    expect(screen.queryByText("Date chiave")).not.toBeInTheDocument();
    expect(screen.queryByText("Fonti ufficiali")).not.toBeInTheDocument();
  });
});
