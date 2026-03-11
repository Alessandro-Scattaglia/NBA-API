import React, { useEffect, useState } from 'react';
import { api, playerImageUrl, teamLogoUrl } from '../../api';
import { NBA_TIMEZONE, todayInTimeZone } from '../../timezone';
import { formatGameStatusIt, formatIsoDateIt } from '../../formatting';
import './HomeView.css';

interface Props {
  season: string;
  onOpenScoreboard: () => void;
  onOpenLeaders: () => void;
  onOpenStandings: () => void;
  onOpenTeamStats: () => void;
  onOpenGame: (gameId: string) => void;
}

export default function HomeView({
  season,
  onOpenScoreboard,
  onOpenLeaders,
  onOpenStandings,
  onOpenTeamStats,
  onOpenGame,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scoreboard, setScoreboard] = useState<any>(null);
  const [leaders, setLeaders] = useState<any>(null);
  const [standings, setStandings] = useState<any>(null);
  const nbaToday = todayInTimeZone(NBA_TIMEZONE);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.allSettled([
      api.getScoreboard(nbaToday),
      api.getLeaders('PTS', season),
      api.getStandings(season),
    ])
      .then(([gamesRes, leadersRes, standingsRes]) => {
        if (gamesRes.status === 'fulfilled') setScoreboard(gamesRes.value);
        if (leadersRes.status === 'fulfilled') setLeaders(leadersRes.value);
        if (standingsRes.status === 'fulfilled') setStandings(standingsRes.value);

        if (
          gamesRes.status === 'rejected' &&
          leadersRes.status === 'rejected' &&
          standingsRes.status === 'rejected'
        ) {
          setError('Impossibile caricare i dati principali');
        }
      })
      .finally(() => setLoading(false));
  }, [season, nbaToday]);

  const games = scoreboard?.GameHeader || [];
  const lines = scoreboard?.LineScore || [];
  const leader = leaders?.LeagueLeaders?.[0];
  const ranking: any[] = standings?.Standings || [];
  const eastFirst = ranking
    .filter(t => t.Conference === 'East')
    .sort((a, b) => a.PlayoffRank - b.PlayoffRank)[0];
  const westFirst = ranking
    .filter(t => t.Conference === 'West')
    .sort((a, b) => a.PlayoffRank - b.PlayoffRank)[0];

  return (
    <>
      <div className="main-header">
        <h2>Home</h2>
        <p>Panoramica rapida NBA · stagione {season}</p>
      </div>
      <div className="main-content">
        {loading && <div className="loading"><div className="spinner" /> Caricamento home...</div>}
        {error && <div className="error-msg">{error}</div>}

        {!loading && (
          <>
            <div className="home-actions">
              <button className="home-action-btn" onClick={onOpenScoreboard}>Apri Calendario</button>
              <button className="home-action-btn" onClick={onOpenLeaders}>Apri Leader</button>
              <button className="home-action-btn" onClick={onOpenStandings}>Apri Classifica</button>
              <button className="home-action-btn" onClick={onOpenTeamStats}>Statistiche Squadre</button>
            </div>

            <div className="home-cards-grid">
              <div className="home-card">
                <div className="home-card-label">Partite oggi</div>
                <div className="home-card-value">{games.length}</div>
                <div className="home-card-sub">{formatIsoDateIt(nbaToday)} (ora di New York)</div>
              </div>

              <div className="home-card">
                <div className="home-card-label">Top realizzatore</div>
                {leader ? (
                  <div className="home-mini-row">
                    <img src={playerImageUrl(leader.PLAYER_ID)} alt={leader.PLAYER} className="home-mini-img" />
                    <div>
                      <div className="home-mini-title">{leader.PLAYER}</div>
                      <div className="home-card-sub">{leader.PTS} punti</div>
                    </div>
                  </div>
                ) : <div className="home-card-sub">Dato non disponibile</div>}
              </div>

              <div className="home-card">
                <div className="home-card-label">Prime in classifica</div>
                <div className="home-standings-mini">
                  {eastFirst && (
                    <div className="home-mini-row">
                      <img src={teamLogoUrl(eastFirst.TeamID)} alt={eastFirst.TeamName} className="home-mini-img" />
                      <div className="home-card-sub">Est: {eastFirst.TeamCity} {eastFirst.TeamName}</div>
                    </div>
                  )}
                  {westFirst && (
                    <div className="home-mini-row">
                      <img src={teamLogoUrl(westFirst.TeamID)} alt={westFirst.TeamName} className="home-mini-img" />
                      <div className="home-card-sub">Ovest: {westFirst.TeamCity} {westFirst.TeamName}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="home-section-header">
              <h3>Partite in evidenza</h3>
              <button className="home-link-btn" onClick={onOpenScoreboard}>Vedi tutte</button>
            </div>
            <div className="home-games-list">
              {games.slice(0, 6).map((g: any) => {
                const teamRows = lines.filter((ls: any) => ls.GAME_ID === g.GAME_ID);
                const t1 = teamRows[0];
                const t2 = teamRows[1];
                return (
                  <button key={g.GAME_ID} className="home-game-row" onClick={() => onOpenGame(g.GAME_ID)}>
                    <span>{t1?.TEAM_ABBREVIATION || '—'} vs {t2?.TEAM_ABBREVIATION || '—'}</span>
                    <span>{formatGameStatusIt(g.GAME_STATUS_TEXT, nbaToday)}</span>
                  </button>
                );
              })}
              {!games.length && <div className="empty-state">Nessuna partita oggi</div>}
            </div>
          </>
        )}
      </div>
    </>
  );
}
