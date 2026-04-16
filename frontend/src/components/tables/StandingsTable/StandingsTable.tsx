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

function getStatusTone(status: TeamSummary["playoffStatus"]) {
  if (status === "playoff") {
    return "success" as const;
  }

  if (status === "play-in") {
    return "warning" as const;
  }

  if (status === "eliminated") {
    return "danger" as const;
  }

  return "neutral" as const;
}

export function StandingsTable({ teams, showStatus = true }: { teams: TeamSummary[]; showStatus?: boolean }) {
  return (
    <div className={`table-wrap standings-table-wrap ${showStatus ? "" : "standings-table-wrap-no-status"}`}>
      <table className={`standings-table standings-table-rich ${showStatus ? "" : "standings-table-no-status"}`}>
        <thead>
          <tr>
            <th>Pos</th>
            <th>Squadra</th>
            <th>W</th>
            <th>L</th>
            <th>%</th>
            <th>Ult. 10</th>
            <th>Serie</th>
            {showStatus ? <th>Stato</th> : null}
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
                  <img src={team.logo} alt="" className="mini-logo standings-team-logo" />
                  <strong className="standings-team-name">{team.name}</strong>
                  <strong className="standings-team-code">{team.code}</strong>
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
              {showStatus ? (
                <td>
                  <Badge tone={getStatusTone(team.playoffStatus)}>{formatPlayoffStatus(team.playoffStatus)}</Badge>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
