import { Link } from "react-router-dom";
import type { TeamSummary } from "../../../lib/types";
import { formatPercentage, formatPlayoffStatus } from "../../../lib/format";
import { Badge } from "../../common/States";
import "./StandingsTable.css";

function getSeedTone(team: TeamSummary) {
  if (team.conferenceRank <= 6) {
    return "seed-playoff";
  }

  if (team.conferenceRank <= 10) {
    return "seed-playin";
  }

  return "seed-hunt";
}

function getStreakTone(streak: string) {
  return streak.startsWith("W") ? "result-pill-win" : streak.startsWith("L") ? "result-pill-loss" : "";
}

export function StandingsTable({ teams }: { teams: TeamSummary[] }) {
  return (
    <div className="table-wrap standings-table-wrap">
      <table className="standings-table standings-table-rich">
        <thead>
          <tr>
            <th>Pos</th>
            <th>Squadra</th>
            <th>W</th>
            <th>L</th>
            <th>%</th>
            <th>Ult. 10</th>
            <th>Serie</th>
            <th>Stato</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team) => (
            <tr key={team.teamId} className={`standings-row standings-row-${team.playoffStatus}`}>
              <td>
                <span className={`seed-pill ${getSeedTone(team)}`}>{team.conferenceRank}</span>
              </td>
              <td className="standings-team-cell">
                <Link to={`/teams/${team.teamId}`} className="entity-link">
                  <img src={team.logo} alt="" className="mini-logo" />
                  <strong>{team.name}</strong>
                </Link>
              </td>
              <td className="cell-win">{team.wins}</td>
              <td className="cell-loss">{team.losses}</td>
              <td>{formatPercentage(team.winPct)}</td>
              <td>
                <span className="mini-record">{team.lastTen}</span>
              </td>
              <td>
                <span className={`result-pill ${getStreakTone(team.streak)}`}>{team.streak}</span>
              </td>
              <td>
                <Badge
                  tone={
                    team.playoffStatus === "playoff"
                      ? "success"
                      : team.playoffStatus === "play-in"
                        ? "warning"
                        : team.playoffStatus === "eliminated"
                          ? "danger"
                          : "neutral"
                  }
                >
                  {formatPlayoffStatus(team.playoffStatus)}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
