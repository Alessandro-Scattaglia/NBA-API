import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlayoffsPage } from "./PlayoffsPage";

describe("PlayoffsPage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("loads the playoff snapshot and renders a dedicated playoff calendar with the shared calendar layout", async () => {
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

    await screen.findByText("Calendario Playoff");

    expect(fetchMock).toHaveBeenCalledWith("/api/playoffs");
    expect(screen.getByText("Classifica playoff Est")).toBeInTheDocument();
    expect(screen.getByText("Partite schedulate")).toBeInTheDocument();
    expect(screen.getByText("Partite playoff del giorno")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getAllByRole("link").some((link) => link.getAttribute("href") === "/games/0042600118")).toBe(true);

    expect(screen.queryByText("Date chiave")).not.toBeInTheDocument();
    expect(screen.queryByText("Fonti ufficiali")).not.toBeInTheDocument();
  });

  it("shows a first-round winner in the next slot even if the opposing series is still in progress", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            season: "2025-26",
            overview: {
              directQualifiedTeams: 12,
              playInTeams: 8,
              confirmedFirstRoundSeries: 8,
              playInGamesScheduled: 0,
              playoffGamesScheduled: 8
            },
            keyDates: [
              {
                key: "playoffs-begin",
                label: "Inizio playoff NBA",
                startDate: "2026-04-18",
                endDate: null,
                note: "Parte il primo turno."
              }
            ],
            finalsDates: [],
            formatNotes: [],
            east: {
              conference: "East",
              directSeeds: [],
              playInSeeds: [],
              outsidePicture: [],
              playInSeries: [],
              firstRoundSeries: []
            },
            west: {
              conference: "West",
              directSeeds: [
                {
                  teamId: 1610612760,
                  city: "Oklahoma City",
                  name: "Thunder",
                  nickname: "Thunder",
                  code: "OKC",
                  slug: "oklahoma-city-thunder",
                  conference: "West",
                  division: "Northwest",
                  logo: "https://example.com/okc.svg",
                  wins: 68,
                  losses: 14,
                  winPct: 0.829,
                  gamesBehind: 0,
                  conferenceRank: 1,
                  homeRecord: "34-7",
                  awayRecord: "34-7",
                  lastTen: "8-2",
                  streak: "W4",
                  playoffStatus: "playoff",
                  clinchedPlayoff: true,
                  clinchedDivision: true,
                  clinchedConference: true,
                  seed: 1,
                  gamesPlayed: 82,
                  remainingGames: 0
                },
                {
                  teamId: 1610612747,
                  city: "Los Angeles",
                  name: "Lakers",
                  nickname: "Lakers",
                  code: "LAL",
                  slug: "los-angeles-lakers",
                  conference: "West",
                  division: "Pacific",
                  logo: "https://example.com/lal.svg",
                  wins: 52,
                  losses: 30,
                  winPct: 0.634,
                  gamesBehind: 16,
                  conferenceRank: 4,
                  homeRecord: "28-13",
                  awayRecord: "24-17",
                  lastTen: "7-3",
                  streak: "W1",
                  playoffStatus: "playoff",
                  clinchedPlayoff: true,
                  clinchedDivision: false,
                  clinchedConference: false,
                  seed: 4,
                  gamesPlayed: 82,
                  remainingGames: 0
                },
                {
                  teamId: 1610612745,
                  city: "Houston",
                  name: "Rockets",
                  nickname: "Rockets",
                  code: "HOU",
                  slug: "houston-rockets",
                  conference: "West",
                  division: "Southwest",
                  logo: "https://example.com/hou.svg",
                  wins: 50,
                  losses: 32,
                  winPct: 0.61,
                  gamesBehind: 18,
                  conferenceRank: 5,
                  homeRecord: "27-14",
                  awayRecord: "23-18",
                  lastTen: "6-4",
                  streak: "L1",
                  playoffStatus: "playoff",
                  clinchedPlayoff: true,
                  clinchedDivision: false,
                  clinchedConference: false,
                  seed: 5,
                  gamesPlayed: 82,
                  remainingGames: 0
                }
              ],
              playInSeeds: [
                {
                  teamId: 1610612756,
                  city: "Phoenix",
                  name: "Suns",
                  nickname: "Suns",
                  code: "PHX",
                  slug: "phoenix-suns",
                  conference: "West",
                  division: "Pacific",
                  logo: "https://example.com/phx.svg",
                  wins: 44,
                  losses: 38,
                  winPct: 0.537,
                  gamesBehind: 24,
                  conferenceRank: 8,
                  homeRecord: "24-17",
                  awayRecord: "20-21",
                  lastTen: "5-5",
                  streak: "L4",
                  playoffStatus: "playoff",
                  clinchedPlayoff: true,
                  clinchedDivision: false,
                  clinchedConference: false,
                  seed: 8,
                  gamesPlayed: 82,
                  remainingGames: 0
                }
              ],
              outsidePicture: [],
              playInSeries: [],
              firstRoundSeries: [
                {
                  conference: "West",
                  round: "first-round",
                  status: "confirmed",
                  label: "(1) Thunder vs. (8) Suns",
                  seedHigh: 1,
                  seedLow: 8,
                  highSeedTeam: {
                    teamId: 1610612760,
                    city: "Oklahoma City",
                    name: "Thunder",
                    nickname: "Thunder",
                    code: "OKC",
                    slug: "oklahoma-city-thunder",
                    conference: "West",
                    division: "Northwest",
                    logo: "https://example.com/okc.svg",
                    wins: 68,
                    losses: 14,
                    winPct: 0.829,
                    gamesBehind: 0,
                    conferenceRank: 1,
                    homeRecord: "34-7",
                    awayRecord: "34-7",
                    lastTen: "8-2",
                    streak: "W4",
                    playoffStatus: "playoff",
                    clinchedPlayoff: true,
                    clinchedDivision: true,
                    clinchedConference: true,
                    seed: 1,
                    gamesPlayed: 82,
                    remainingGames: 0
                  },
                  lowSeedTeam: {
                    teamId: 1610612756,
                    city: "Phoenix",
                    name: "Suns",
                    nickname: "Suns",
                    code: "PHX",
                    slug: "phoenix-suns",
                    conference: "West",
                    division: "Pacific",
                    logo: "https://example.com/phx.svg",
                    wins: 44,
                    losses: 38,
                    winPct: 0.537,
                    gamesBehind: 24,
                    conferenceRank: 8,
                    homeRecord: "24-17",
                    awayRecord: "20-21",
                    lastTen: "5-5",
                    streak: "L4",
                    playoffStatus: "playoff",
                    clinchedPlayoff: true,
                    clinchedDivision: false,
                    clinchedConference: false,
                    seed: 8,
                    gamesPlayed: 82,
                    remainingGames: 0
                  },
                  note: "Serie del primo turno confermata.",
                  games: [
                    {
                      gameId: "1",
                      gameCode: "G1",
                      dateTimeUtc: "2026-04-18T20:00:00Z",
                      dateLabel: "18 apr 2026, 20:00",
                      status: "final",
                      statusText: "Final",
                      phase: "playoffs",
                      arena: "Paycom Center",
                      nationalTv: [],
                      clock: null,
                      period: 4,
                      homeTeam: { teamId: 1610612760, name: "Thunder", code: "OKC", logo: "https://example.com/okc.svg", score: 120, record: "68-14" },
                      awayTeam: { teamId: 1610612756, name: "Suns", code: "PHX", logo: "https://example.com/phx.svg", score: 101, record: "44-38" }
                    },
                    {
                      gameId: "2",
                      gameCode: "G2",
                      dateTimeUtc: "2026-04-20T20:00:00Z",
                      dateLabel: "20 apr 2026, 20:00",
                      status: "final",
                      statusText: "Final",
                      phase: "playoffs",
                      arena: "Paycom Center",
                      nationalTv: [],
                      clock: null,
                      period: 4,
                      homeTeam: { teamId: 1610612760, name: "Thunder", code: "OKC", logo: "https://example.com/okc.svg", score: 118, record: "68-14" },
                      awayTeam: { teamId: 1610612756, name: "Suns", code: "PHX", logo: "https://example.com/phx.svg", score: 98, record: "44-38" }
                    },
                    {
                      gameId: "3",
                      gameCode: "G3",
                      dateTimeUtc: "2026-04-22T20:00:00Z",
                      dateLabel: "22 apr 2026, 20:00",
                      status: "final",
                      statusText: "Final",
                      phase: "playoffs",
                      arena: "Footprint Center",
                      nationalTv: [],
                      clock: null,
                      period: 4,
                      homeTeam: { teamId: 1610612756, name: "Suns", code: "PHX", logo: "https://example.com/phx.svg", score: 99, record: "44-38" },
                      awayTeam: { teamId: 1610612760, name: "Thunder", code: "OKC", logo: "https://example.com/okc.svg", score: 110, record: "68-14" }
                    },
                    {
                      gameId: "4",
                      gameCode: "G4",
                      dateTimeUtc: "2026-04-24T20:00:00Z",
                      dateLabel: "24 apr 2026, 20:00",
                      status: "final",
                      statusText: "Final",
                      phase: "playoffs",
                      arena: "Footprint Center",
                      nationalTv: [],
                      clock: null,
                      period: 4,
                      homeTeam: { teamId: 1610612756, name: "Suns", code: "PHX", logo: "https://example.com/phx.svg", score: 97, record: "44-38" },
                      awayTeam: { teamId: 1610612760, name: "Thunder", code: "OKC", logo: "https://example.com/okc.svg", score: 114, record: "68-14" }
                    }
                  ]
                },
                {
                  conference: "West",
                  round: "first-round",
                  status: "confirmed",
                  label: "(4) Lakers vs. (5) Rockets",
                  seedHigh: 4,
                  seedLow: 5,
                  highSeedTeam: {
                    teamId: 1610612747,
                    city: "Los Angeles",
                    name: "Lakers",
                    nickname: "Lakers",
                    code: "LAL",
                    slug: "los-angeles-lakers",
                    conference: "West",
                    division: "Pacific",
                    logo: "https://example.com/lal.svg",
                    wins: 52,
                    losses: 30,
                    winPct: 0.634,
                    gamesBehind: 16,
                    conferenceRank: 4,
                    homeRecord: "28-13",
                    awayRecord: "24-17",
                    lastTen: "7-3",
                    streak: "W1",
                    playoffStatus: "playoff",
                    clinchedPlayoff: true,
                    clinchedDivision: false,
                    clinchedConference: false,
                    seed: 4,
                    gamesPlayed: 82,
                    remainingGames: 0
                  },
                  lowSeedTeam: {
                    teamId: 1610612745,
                    city: "Houston",
                    name: "Rockets",
                    nickname: "Rockets",
                    code: "HOU",
                    slug: "houston-rockets",
                    conference: "West",
                    division: "Southwest",
                    logo: "https://example.com/hou.svg",
                    wins: 50,
                    losses: 32,
                    winPct: 0.61,
                    gamesBehind: 18,
                    conferenceRank: 5,
                    homeRecord: "27-14",
                    awayRecord: "23-18",
                    lastTen: "6-4",
                    streak: "L1",
                    playoffStatus: "playoff",
                    clinchedPlayoff: true,
                    clinchedDivision: false,
                    clinchedConference: false,
                    seed: 5,
                    gamesPlayed: 82,
                    remainingGames: 0
                  },
                  note: "Serie del primo turno confermata.",
                  games: [
                    {
                      gameId: "5",
                      gameCode: "G5",
                      dateTimeUtc: "2026-04-18T22:00:00Z",
                      dateLabel: "18 apr 2026, 22:00",
                      status: "final",
                      statusText: "Final",
                      phase: "playoffs",
                      arena: "Crypto.com Arena",
                      nationalTv: [],
                      clock: null,
                      period: 4,
                      homeTeam: { teamId: 1610612747, name: "Lakers", code: "LAL", logo: "https://example.com/lal.svg", score: 112, record: "52-30" },
                      awayTeam: { teamId: 1610612745, name: "Rockets", code: "HOU", logo: "https://example.com/hou.svg", score: 105, record: "50-32" }
                    },
                    {
                      gameId: "6",
                      gameCode: "G6",
                      dateTimeUtc: "2026-04-20T22:00:00Z",
                      dateLabel: "20 apr 2026, 22:00",
                      status: "final",
                      statusText: "Final",
                      phase: "playoffs",
                      arena: "Crypto.com Arena",
                      nationalTv: [],
                      clock: null,
                      period: 4,
                      homeTeam: { teamId: 1610612747, name: "Lakers", code: "LAL", logo: "https://example.com/lal.svg", score: 104, record: "52-30" },
                      awayTeam: { teamId: 1610612745, name: "Rockets", code: "HOU", logo: "https://example.com/hou.svg", score: 108, record: "50-32" }
                    },
                    {
                      gameId: "7",
                      gameCode: "G7",
                      dateTimeUtc: "2026-04-22T22:00:00Z",
                      dateLabel: "22 apr 2026, 22:00",
                      status: "final",
                      statusText: "Final",
                      phase: "playoffs",
                      arena: "Toyota Center",
                      nationalTv: [],
                      clock: null,
                      period: 4,
                      homeTeam: { teamId: 1610612745, name: "Rockets", code: "HOU", logo: "https://example.com/hou.svg", score: 99, record: "50-32" },
                      awayTeam: { teamId: 1610612747, name: "Lakers", code: "LAL", logo: "https://example.com/lal.svg", score: 115, record: "52-30" }
                    }
                  ]
                }
              ]
            },
            playInGames: [],
            playoffGames: []
          },
          meta: {
            updatedAt: "2026-04-28T10:00:00.000Z",
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

    await screen.findByText("Tabellone Playoff NBA 2026");

    expect(fetchMock).toHaveBeenCalledWith("/api/playoffs");
    expect(screen.getAllByText("OKC").length).toBeGreaterThan(1);
  });
});
