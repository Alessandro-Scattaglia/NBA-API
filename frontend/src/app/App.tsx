import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { CalendarPage } from "../pages/CalendarPage";
import { GameDetailPage } from "../pages/GameDetailPage";
import { HomePage } from "../pages/HomePage";
import { LeadersPage } from "../pages/LeadersPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { PlayerDetailPage } from "../pages/PlayerDetailPage";
import { PlayersPage } from "../pages/PlayersPage";
import { PlayoffsPage } from "../pages/PlayoffsPage";
import { StandingsPage } from "../pages/StandingsPage";
import { TeamDetailPage } from "../pages/TeamDetailPage";
import { TeamsPage } from "../pages/TeamsPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60_000
    }
  }
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/teams" element={<TeamsPage />} />
            <Route path="/teams/:teamId" element={<TeamDetailPage />} />
            <Route path="/players" element={<PlayersPage />} />
            <Route path="/players/:playerId" element={<PlayerDetailPage />} />
            <Route path="/standings" element={<StandingsPage />} />
            <Route path="/playoffs" element={<PlayoffsPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/games/:gameId" element={<GameDetailPage />} />
            <Route path="/leaders" element={<LeadersPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
