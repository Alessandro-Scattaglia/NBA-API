import { Link } from "react-router-dom";
import type { LeaderCategory } from "../../../lib/types";
import { SurfaceCard } from "../SurfaceCard";
import "./LeaderPanel.css";

export function LeaderPanel({ category }: { category: LeaderCategory }) {
  return (
    <SurfaceCard title={category.label}>
      <div className="leader-list">
        {category.leaders.map((leader, index) => (
          <Link key={leader.playerId} to={`/players/${leader.playerId}`} className="leader-row">
            <div className="leader-rank">{index + 1}</div>
            <img src={leader.headshot} alt="" className="leader-headshot" />
            <div>
              <strong>{leader.fullName}</strong>
              <p>{leader.team?.code ?? "Svincolato"} · {leader.gamesPlayed} presenze</p>
            </div>
            <span className="leader-value">{leader.value.toFixed(1)}</span>
          </Link>
        ))}
      </div>
    </SurfaceCard>
  );
}
