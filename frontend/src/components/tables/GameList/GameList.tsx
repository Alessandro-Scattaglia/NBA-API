import { Link } from "react-router-dom";
import type { GameSummary } from "../../../lib/types";
import { formatGameDateLabel, formatGameStatusText, formatStatusLabel, formatVenue } from "../../../lib/format";
import { Badge } from "../../common/States";
import "./GameList.css";

export function GameList({ games }: { games: GameSummary[] }) {
  return (
    <div className="game-list">
      {games.map((game) => (
        <Link key={game.gameId} to={`/games/${game.gameId}`} className="game-card">
          <div className="game-card-head">
            <span>{formatGameDateLabel(game)}</span>
            <Badge tone={game.status === "live" ? "live" : game.status === "final" ? "neutral" : "warning"}>
              {formatStatusLabel(game.status)}
            </Badge>
          </div>

          <div className="game-matchup">
            <div className="game-team">
              <img src={game.awayTeam.logo} alt="" className="mini-logo" />
              <span>{game.awayTeam.code}</span>
            </div>
            <strong>
              {game.awayTeam.score ?? "--"} - {game.homeTeam.score ?? "--"}
            </strong>
            <div className="game-team game-team-right">
              <span>{game.homeTeam.code}</span>
              <img src={game.homeTeam.logo} alt="" className="mini-logo" />
            </div>
          </div>

          <div className="game-card-meta">
            <span>{formatVenue(game.arena)}</span>
            <span>{formatGameStatusText(game)}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
