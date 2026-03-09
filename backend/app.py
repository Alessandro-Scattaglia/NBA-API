from flask import Flask, jsonify, request
from flask_cors import CORS
import os
import ssl
import urllib3

os.environ["FLASK_SKIP_DOTENV"] = "1"

# Disable SSL verification (corporate proxy/firewall)
ssl._create_default_https_context = ssl._create_unverified_context
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Inject a no-verify session directly into nba_api's HTTP class
from nba_api.library.http import NBAHTTP

_session = requests.Session()
_session.verify = False
_session.headers.update({
    "Host": "stats.nba.com",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "x-nba-stats-origin": "stats",
    "x-nba-stats-token": "true",
    "Referer": "https://www.nba.com/",
    "Origin": "https://www.nba.com",
    "Connection": "keep-alive",
})
_adapter = HTTPAdapter(max_retries=Retry(total=3, backoff_factor=1))
_session.mount("https://", _adapter)
_session.mount("http://", _adapter)
NBAHTTP.set_session(_session)

from nba_api.stats.endpoints import (
    commonallplayers,
    commonplayerinfo,
    playercareerstats,
    playergamelog,
    playerprofilev2,
    commonteamroster,
    teamgamelog,
    teaminfocommon,
    teamyearbyyearstats,
    leaguestandings,
    leagueleaders,
    leaguedashplayerstats,
    leaguedashteamstats,
    scoreboardv2,
    boxscoresummaryv2,
    boxscoretraditionalv2,
    shotchartdetail,
)
from nba_api.stats.static import players, teams

app = Flask(__name__)
CORS(app)

CURRENT_SEASON = "2024-25"


def safe_call(fn):
    try:
        result = fn()
        return jsonify(result.get_normalized_dict())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Players ──────────────────────────────────────────────────────────────────

@app.route("/api/players")
def get_all_players():
    return safe_call(
        lambda: commonallplayers.CommonAllPlayers(is_only_current_season=1)
    )


@app.route("/api/players/<int:player_id>")
def get_player_info(player_id):
    return safe_call(
        lambda: commonplayerinfo.CommonPlayerInfo(player_id=player_id)
    )


@app.route("/api/players/<int:player_id>/career")
def get_player_career(player_id):
    return safe_call(
        lambda: playercareerstats.PlayerCareerStats(player_id=player_id)
    )


@app.route("/api/players/<int:player_id>/gamelog")
def get_player_gamelog(player_id):
    season = request.args.get("season", CURRENT_SEASON)
    return safe_call(
        lambda: playergamelog.PlayerGameLog(player_id=player_id, season=season)
    )


@app.route("/api/players/<int:player_id>/profile")
def get_player_profile(player_id):
    return safe_call(
        lambda: playerprofilev2.PlayerProfileV2(player_id=player_id)
    )


# ── Teams ─────────────────────────────────────────────────────────────────────

@app.route("/api/teams")
def get_all_teams():
    all_teams = teams.get_teams()
    return jsonify(all_teams)


@app.route("/api/teams/<int:team_id>")
def get_team_info(team_id):
    return safe_call(
        lambda: teaminfocommon.TeamInfoCommon(team_id=team_id, season=CURRENT_SEASON)
    )


@app.route("/api/teams/<int:team_id>/roster")
def get_team_roster(team_id):
    return safe_call(
        lambda: commonteamroster.CommonTeamRoster(team_id=team_id, season=CURRENT_SEASON)
    )


@app.route("/api/teams/<int:team_id>/gamelog")
def get_team_gamelog(team_id):
    season = request.args.get("season", CURRENT_SEASON)
    return safe_call(
        lambda: teamgamelog.TeamGameLog(team_id=team_id, season=season)
    )


@app.route("/api/teams/<int:team_id>/history")
def get_team_history(team_id):
    return safe_call(
        lambda: teamyearbyyearstats.TeamYearByYearStats(team_id=team_id)
    )


# ── League ────────────────────────────────────────────────────────────────────

@app.route("/api/league/standings")
def get_standings():
    season = request.args.get("season", CURRENT_SEASON)
    return safe_call(
        lambda: leaguestandings.LeagueStandings(season=season)
    )


@app.route("/api/league/leaders")
def get_leaders():
    season = request.args.get("season", CURRENT_SEASON)
    stat = request.args.get("stat", "PTS")
    return safe_call(
        lambda: leagueleaders.LeagueLeaders(season=season, stat_category_abbreviation=stat)
    )


@app.route("/api/league/playerstats")
def get_player_stats():
    season = request.args.get("season", CURRENT_SEASON)
    return safe_call(
        lambda: leaguedashplayerstats.LeagueDashPlayerStats(season=season)
    )


@app.route("/api/league/teamstats")
def get_team_stats():
    season = request.args.get("season", CURRENT_SEASON)
    return safe_call(
        lambda: leaguedashteamstats.LeagueDashTeamStats(season=season)
    )


# ── Games ─────────────────────────────────────────────────────────────────────

@app.route("/api/games/scoreboard")
def get_scoreboard():
    date = request.args.get("date", "2025-03-09")
    return safe_call(
        lambda: scoreboardv2.ScoreboardV2(game_date=date)
    )


@app.route("/api/games/<game_id>/summary")
def get_game_summary(game_id):
    return safe_call(
        lambda: boxscoresummaryv2.BoxScoreSummaryV2(game_id=game_id)
    )


@app.route("/api/games/<game_id>/boxscore")
def get_game_boxscore(game_id):
    return safe_call(
        lambda: boxscoretraditionalv2.BoxScoreTraditionalV2(game_id=game_id)
    )


# ── Shot Chart ────────────────────────────────────────────────────────────────

@app.route("/api/players/<int:player_id>/shotchart")
def get_shot_chart(player_id):
    season = request.args.get("season", CURRENT_SEASON)
    return safe_call(
        lambda: shotchartdetail.ShotChartDetail(
            player_id=player_id,
            team_id=0,
            season_nullable=season,
            context_measure_simple="FGA",
        )
    )


if __name__ == "__main__":
    app.run(debug=True, port=5000, use_reloader=False)
