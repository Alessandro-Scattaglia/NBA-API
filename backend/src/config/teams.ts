import type { Conference, TeamIdentity } from "../types/dto.js";
import { buildTeamLogoUrl } from "../utils/assets.js";

interface TeamSeed {
  teamId: number;
  city: string;
  nickname: string;
  code: string;
  conference: Conference;
  division: string;
}

const TEAM_SEEDS: TeamSeed[] = [
  { teamId: 1610612737, city: "Atlanta", nickname: "Hawks", code: "ATL", conference: "East", division: "Southeast" },
  { teamId: 1610612738, city: "Boston", nickname: "Celtics", code: "BOS", conference: "East", division: "Atlantic" },
  { teamId: 1610612751, city: "Brooklyn", nickname: "Nets", code: "BKN", conference: "East", division: "Atlantic" },
  { teamId: 1610612766, city: "Charlotte", nickname: "Hornets", code: "CHA", conference: "East", division: "Southeast" },
  { teamId: 1610612741, city: "Chicago", nickname: "Bulls", code: "CHI", conference: "East", division: "Central" },
  { teamId: 1610612739, city: "Cleveland", nickname: "Cavaliers", code: "CLE", conference: "East", division: "Central" },
  { teamId: 1610612765, city: "Detroit", nickname: "Pistons", code: "DET", conference: "East", division: "Central" },
  { teamId: 1610612754, city: "Indiana", nickname: "Pacers", code: "IND", conference: "East", division: "Central" },
  { teamId: 1610612748, city: "Miami", nickname: "Heat", code: "MIA", conference: "East", division: "Southeast" },
  { teamId: 1610612749, city: "Milwaukee", nickname: "Bucks", code: "MIL", conference: "East", division: "Central" },
  { teamId: 1610612752, city: "New York", nickname: "Knicks", code: "NYK", conference: "East", division: "Atlantic" },
  { teamId: 1610612753, city: "Orlando", nickname: "Magic", code: "ORL", conference: "East", division: "Southeast" },
  { teamId: 1610612755, city: "Philadelphia", nickname: "76ers", code: "PHI", conference: "East", division: "Atlantic" },
  { teamId: 1610612761, city: "Toronto", nickname: "Raptors", code: "TOR", conference: "East", division: "Atlantic" },
  { teamId: 1610612764, city: "Washington", nickname: "Wizards", code: "WAS", conference: "East", division: "Southeast" },
  { teamId: 1610612742, city: "Dallas", nickname: "Mavericks", code: "DAL", conference: "West", division: "Southwest" },
  { teamId: 1610612743, city: "Denver", nickname: "Nuggets", code: "DEN", conference: "West", division: "Northwest" },
  { teamId: 1610612744, city: "Golden State", nickname: "Warriors", code: "GSW", conference: "West", division: "Pacific" },
  { teamId: 1610612745, city: "Houston", nickname: "Rockets", code: "HOU", conference: "West", division: "Southwest" },
  { teamId: 1610612746, city: "LA", nickname: "Clippers", code: "LAC", conference: "West", division: "Pacific" },
  { teamId: 1610612747, city: "Los Angeles", nickname: "Lakers", code: "LAL", conference: "West", division: "Pacific" },
  { teamId: 1610612763, city: "Memphis", nickname: "Grizzlies", code: "MEM", conference: "West", division: "Southwest" },
  { teamId: 1610612750, city: "Minnesota", nickname: "Timberwolves", code: "MIN", conference: "West", division: "Northwest" },
  { teamId: 1610612740, city: "New Orleans", nickname: "Pelicans", code: "NOP", conference: "West", division: "Southwest" },
  { teamId: 1610612760, city: "Oklahoma City", nickname: "Thunder", code: "OKC", conference: "West", division: "Northwest" },
  { teamId: 1610612756, city: "Phoenix", nickname: "Suns", code: "PHX", conference: "West", division: "Pacific" },
  { teamId: 1610612757, city: "Portland", nickname: "Trail Blazers", code: "POR", conference: "West", division: "Northwest" },
  { teamId: 1610612758, city: "Sacramento", nickname: "Kings", code: "SAC", conference: "West", division: "Pacific" },
  { teamId: 1610612759, city: "San Antonio", nickname: "Spurs", code: "SAS", conference: "West", division: "Southwest" },
  { teamId: 1610612762, city: "Utah", nickname: "Jazz", code: "UTA", conference: "West", division: "Northwest" }
];

export const TEAM_DIRECTORY: TeamIdentity[] = TEAM_SEEDS.map((team) => ({
  ...team,
  name: `${team.city} ${team.nickname}`,
  slug: `${team.city}-${team.nickname}`.toLowerCase().replaceAll(" ", "-"),
  logo: buildTeamLogoUrl(team.teamId)
}));

export function getTeamIdentity(teamId: number) {
  return TEAM_DIRECTORY.find((team) => team.teamId === teamId) ?? null;
}

export function getTeamIdentityByCode(code: string) {
  return TEAM_DIRECTORY.find((team) => team.code === code) ?? null;
}
