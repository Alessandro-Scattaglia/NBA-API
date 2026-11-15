import { Link } from "react-router-dom";
import type { GameSummary } from "../../../lib/types";
import { formatGameDateLabel, formatGameStatusText, formatStatusLabel } from "../../../lib/format";
import { Badge } from "../../common/States";
import "./GameList.css";

export function GameList({ games, teamId }: { games: GameSummary[]; teamId?: number }) {
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
            <span>{formatGameStatusText(game)}</span>
            {teamId && game.status === "final" && game.homeTeam.score !== null && game.awayTeam.score !== null ? (
              <span className={teamId === (game.homeTeam.score > game.awayTeam.score ? game.homeTeam.teamId : game.awayTeam.teamId) ? "result-pill result-pill-win" : "result-pill result-pill-loss"}>
                {teamId === (game.homeTeam.score > game.awayTeam.score ? game.homeTeam.teamId : game.awayTeam.teamId) ? "W" : "L"}
              </span>
            ) : null}
          </div>
        </Link>
      ))}
    </div>
  );
}
