from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_caching import Cache
import os
import ssl
import urllib3
import logging

os.environ["FLASK_SKIP_DOTENV"] = "1"

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

# Disable SSL verification (corporate proxy/firewall)
ssl._create_default_https_context = ssl._create_unverified_context
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

import requests
from datetime import datetime
from zoneinfo import ZoneInfo
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Patch nba_api per usare una sessione con verify=False e headers corretti.
# La classe NBAHTTP usa requests.get() direttamente nel metodo send_api_request,
# quindi sovrascriviamo quel metodo per usare la nostra sessione persistente.
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
_adapter = HTTPAdapter(
    max_retries=Retry(
        total=2,
        read=1,
        connect=1,
        backoff_factor=0.3,
        status_forcelist=[408, 429, 500, 502, 503, 504],
        allowed_methods=["GET"],
        raise_on_status=False,
    )
)
_session.mount("https://", _adapter)
_session.mount("http://", _adapter)

# Monkey-patch del metodo send_api_request per usare _session invece di requests.get()
_original_send = NBAHTTP.send_api_request

def _patched_send(self, endpoint, parameters, referer=None, proxy=None, headers=None, timeout=None, raise_exception_on_error=False):
    import random
    from urllib.parse import quote_plus

    base_url = self.base_url.format(endpoint=endpoint)
    request_headers = dict(headers if headers is not None else self.headers)
    if referer:
        request_headers["Referer"] = referer

    parameters = sorted(parameters.items(), key=lambda kv: kv[0])

    response = _session.get(
        url=base_url,
        params=parameters,
        headers=request_headers,
        timeout=timeout,
    )
    contents = self.clean_contents(response.text)
    data = self.nba_response(response=contents, status_code=response.status_code, url=response.url)
    if raise_exception_on_error and not data.valid_json():
        raise Exception("InvalidResponse: Response is not in a valid JSON format.")
    return data

NBAHTTP.send_api_request = _patched_send

# Per-request timeout for every nba_api endpoint call (seconds)
NBA_API_TIMEOUT = 20
PLAYER_API_TIMEOUT = 25

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

app = Flask(__name__)
CORS(app)

cache = Cache(app, config={
    "CACHE_TYPE": "FileSystemCache",
    "CACHE_DIR": os.path.join(os.path.dirname(__file__), ".cache"),
    "CACHE_DEFAULT_TIMEOUT": 300,  # 5 minutes default
})

def current_season(now: datetime | None = None) -> str:
    today = now or datetime.now(ZoneInfo("America/New_York"))
    start_year = today.year if today.month >= 10 else today.year - 1
    return f"{start_year}-{str(start_year + 1)[2:]}"


CURRENT_SEASON = current_season()


def safe_call(fn):
    try:
        result = fn()
        return jsonify(result.get_normalized_dict())
    except Exception as e:
        logger.error("NBA API call failed: %s", e, exc_info=True)
        return jsonify({"error": str(e)}), 500


# ── Players ──────────────────────────────────────────────────────────────────

@app.route("/api/players")
@cache.cached(timeout=3600)
def get_all_players():
    return safe_call(
        lambda: commonallplayers.CommonAllPlayers(is_only_current_season=1, timeout=PLAYER_API_TIMEOUT)
    )


@app.route("/api/players/<int:player_id>")
@cache.cached(timeout=1800)
def get_player_info(player_id):
    return safe_call(
        lambda: commonplayerinfo.CommonPlayerInfo(player_id=player_id, timeout=PLAYER_API_TIMEOUT)
    )


@app.route("/api/players/<int:player_id>/career")
@cache.cached(timeout=1800)
def get_player_career(player_id):
    return safe_call(
        lambda: playercareerstats.PlayerCareerStats(player_id=player_id, timeout=PLAYER_API_TIMEOUT)
    )


@app.route("/api/players/<int:player_id>/gamelog")
@cache.cached(timeout=300, query_string=True)
def get_player_gamelog(player_id):
    season = request.args.get("season", CURRENT_SEASON)
    return safe_call(
        lambda: playergamelog.PlayerGameLog(player_id=player_id, season=season, timeout=PLAYER_API_TIMEOUT)
    )


@app.route("/api/players/<int:player_id>/profile")
@cache.cached(timeout=1800)
def get_player_profile(player_id):
    return safe_call(
        lambda: playerprofilev2.PlayerProfileV2(player_id=player_id, timeout=PLAYER_API_TIMEOUT)
    )


# ── Teams ─────────────────────────────────────────────────────────────────────

TEAMS = [
    {"id": 1610612737, "full_name": "Atlanta Hawks", "abbreviation": "ATL", "nickname": "Hawks", "city": "Atlanta", "state": "Georgia", "year_founded": 1949, "conference": "East", "division": "Southeast"},
    {"id": 1610612738, "full_name": "Boston Celtics", "abbreviation": "BOS", "nickname": "Celtics", "city": "Boston", "state": "Massachusetts", "year_founded": 1946, "conference": "East", "division": "Atlantic"},
    {"id": 1610612751, "full_name": "Brooklyn Nets", "abbreviation": "BKN", "nickname": "Nets", "city": "Brooklyn", "state": "New York", "year_founded": 1976, "conference": "East", "division": "Atlantic"},
    {"id": 1610612766, "full_name": "Charlotte Hornets", "abbreviation": "CHA", "nickname": "Hornets", "city": "Charlotte", "state": "North Carolina", "year_founded": 1988, "conference": "East", "division": "Southeast"},
    {"id": 1610612741, "full_name": "Chicago Bulls", "abbreviation": "CHI", "nickname": "Bulls", "city": "Chicago", "state": "Illinois", "year_founded": 1966, "conference": "East", "division": "Central"},
    {"id": 1610612739, "full_name": "Cleveland Cavaliers", "abbreviation": "CLE", "nickname": "Cavaliers", "city": "Cleveland", "state": "Ohio", "year_founded": 1970, "conference": "East", "division": "Central"},
    {"id": 1610612742, "full_name": "Dallas Mavericks", "abbreviation": "DAL", "nickname": "Mavericks", "city": "Dallas", "state": "Texas", "year_founded": 1980, "conference": "West", "division": "Southwest"},
    {"id": 1610612743, "full_name": "Denver Nuggets", "abbreviation": "DEN", "nickname": "Nuggets", "city": "Denver", "state": "Colorado", "year_founded": 1976, "conference": "West", "division": "Northwest"},
    {"id": 1610612765, "full_name": "Detroit Pistons", "abbreviation": "DET", "nickname": "Pistons", "city": "Detroit", "state": "Michigan", "year_founded": 1948, "conference": "East", "division": "Central"},
    {"id": 1610612744, "full_name": "Golden State Warriors", "abbreviation": "GSW", "nickname": "Warriors", "city": "Golden State", "state": "California", "year_founded": 1946, "conference": "West", "division": "Pacific"},
    {"id": 1610612745, "full_name": "Houston Rockets", "abbreviation": "HOU", "nickname": "Rockets", "city": "Houston", "state": "Texas", "year_founded": 1967, "conference": "West", "division": "Southwest"},
    {"id": 1610612754, "full_name": "Indiana Pacers", "abbreviation": "IND", "nickname": "Pacers", "city": "Indiana", "state": "Indiana", "year_founded": 1967, "conference": "East", "division": "Central"},
    {"id": 1610612746, "full_name": "Los Angeles Clippers", "abbreviation": "LAC", "nickname": "Clippers", "city": "Los Angeles", "state": "California", "year_founded": 1970, "conference": "West", "division": "Pacific"},
    {"id": 1610612747, "full_name": "Los Angeles Lakers", "abbreviation": "LAL", "nickname": "Lakers", "city": "Los Angeles", "state": "California", "year_founded": 1947, "conference": "West", "division": "Pacific"},
    {"id": 1610612763, "full_name": "Memphis Grizzlies", "abbreviation": "MEM", "nickname": "Grizzlies", "city": "Memphis", "state": "Tennessee", "year_founded": 1995, "conference": "West", "division": "Southwest"},
    {"id": 1610612748, "full_name": "Miami Heat", "abbreviation": "MIA", "nickname": "Heat", "city": "Miami", "state": "Florida", "year_founded": 1988, "conference": "East", "division": "Southeast"},
    {"id": 1610612749, "full_name": "Milwaukee Bucks", "abbreviation": "MIL", "nickname": "Bucks", "city": "Milwaukee", "state": "Wisconsin", "year_founded": 1968, "conference": "East", "division": "Central"},
    {"id": 1610612750, "full_name": "Minnesota Timberwolves", "abbreviation": "MIN", "nickname": "Timberwolves", "city": "Minnesota", "state": "Minnesota", "year_founded": 1989, "conference": "West", "division": "Northwest"},
    {"id": 1610612740, "full_name": "New Orleans Pelicans", "abbreviation": "NOP", "nickname": "Pelicans", "city": "New Orleans", "state": "Louisiana", "year_founded": 2002, "conference": "West", "division": "Southwest"},
    {"id": 1610612752, "full_name": "New York Knicks", "abbreviation": "NYK", "nickname": "Knicks", "city": "New York", "state": "New York", "year_founded": 1946, "conference": "East", "division": "Atlantic"},
    {"id": 1610612760, "full_name": "Oklahoma City Thunder", "abbreviation": "OKC", "nickname": "Thunder", "city": "Oklahoma City", "state": "Oklahoma", "year_founded": 1967, "conference": "West", "division": "Northwest"},
    {"id": 1610612753, "full_name": "Orlando Magic", "abbreviation": "ORL", "nickname": "Magic", "city": "Orlando", "state": "Florida", "year_founded": 1989, "conference": "East", "division": "Southeast"},
    {"id": 1610612755, "full_name": "Philadelphia 76ers", "abbreviation": "PHI", "nickname": "76ers", "city": "Philadelphia", "state": "Pennsylvania", "year_founded": 1949, "conference": "East", "division": "Atlantic"},
    {"id": 1610612756, "full_name": "Phoenix Suns", "abbreviation": "PHX", "nickname": "Suns", "city": "Phoenix", "state": "Arizona", "year_founded": 1968, "conference": "West", "division": "Pacific"},
    {"id": 1610612757, "full_name": "Portland Trail Blazers", "abbreviation": "POR", "nickname": "Trail Blazers", "city": "Portland", "state": "Oregon", "year_founded": 1970, "conference": "West", "division": "Northwest"},
    {"id": 1610612758, "full_name": "Sacramento Kings", "abbreviation": "SAC", "nickname": "Kings", "city": "Sacramento", "state": "California", "year_founded": 1948, "conference": "West", "division": "Pacific"},
    {"id": 1610612759, "full_name": "San Antonio Spurs", "abbreviation": "SAS", "nickname": "Spurs", "city": "San Antonio", "state": "Texas", "year_founded": 1976, "conference": "West", "division": "Southwest"},
    {"id": 1610612761, "full_name": "Toronto Raptors", "abbreviation": "TOR", "nickname": "Raptors", "city": "Toronto", "state": "Ontario", "year_founded": 1995, "conference": "East", "division": "Atlantic"},
    {"id": 1610612762, "full_name": "Utah Jazz", "abbreviation": "UTA", "nickname": "Jazz", "city": "Utah", "state": "Utah", "year_founded": 1974, "conference": "West", "division": "Northwest"},
    {"id": 1610612764, "full_name": "Washington Wizards", "abbreviation": "WAS", "nickname": "Wizards", "city": "Washington", "state": "District of Columbia", "year_founded": 1961, "conference": "East", "division": "Southeast"},
]


@app.route("/api/teams")
def get_all_teams():
    return jsonify(TEAMS)


@app.route("/api/teams/<int:team_id>")
@cache.cached(timeout=1800)
def get_team_info(team_id):
    return safe_call(
        lambda: teaminfocommon.TeamInfoCommon(team_id=team_id, season=CURRENT_SEASON, timeout=NBA_API_TIMEOUT)
    )


@app.route("/api/teams/<int:team_id>/roster")
@cache.cached(timeout=1800)
def get_team_roster(team_id):
    return safe_call(
        lambda: commonteamroster.CommonTeamRoster(team_id=team_id, season=CURRENT_SEASON, timeout=NBA_API_TIMEOUT)
    )


@app.route("/api/teams/<int:team_id>/gamelog")
@cache.cached(timeout=300, query_string=True)
def get_team_gamelog(team_id):
    season = request.args.get("season", CURRENT_SEASON)
    return safe_call(
        lambda: teamgamelog.TeamGameLog(team_id=team_id, season=season, timeout=NBA_API_TIMEOUT)
    )


@app.route("/api/teams/<int:team_id>/history")
@cache.cached(timeout=3600)
def get_team_history(team_id):
    return safe_call(
        lambda: teamyearbyyearstats.TeamYearByYearStats(team_id=team_id, timeout=NBA_API_TIMEOUT)
    )


# ── League ────────────────────────────────────────────────────────────────────

@app.route("/api/league/standings")
@cache.cached(timeout=300, query_string=True)
def get_standings():
    season = request.args.get("season", CURRENT_SEASON)
    return safe_call(
        lambda: leaguestandings.LeagueStandings(season=season, timeout=NBA_API_TIMEOUT)
    )


@app.route("/api/league/leaders")
@cache.cached(timeout=300, query_string=True)
def get_leaders():
    season = request.args.get("season", CURRENT_SEASON)
    stat = request.args.get("stat", "PTS")
    return safe_call(
        lambda: leagueleaders.LeagueLeaders(season=season, stat_category_abbreviation=stat, timeout=NBA_API_TIMEOUT)
    )


@app.route("/api/league/playerstats")
@cache.cached(timeout=300, query_string=True)
def get_player_stats():
    season = request.args.get("season", CURRENT_SEASON)
    return safe_call(
        lambda: leaguedashplayerstats.LeagueDashPlayerStats(season=season, timeout=NBA_API_TIMEOUT)
    )


@app.route("/api/league/teamstats")
@cache.cached(timeout=300, query_string=True)
def get_team_stats():
    season = request.args.get("season", CURRENT_SEASON)
    return safe_call(
        lambda: leaguedashteamstats.LeagueDashTeamStats(season=season, timeout=NBA_API_TIMEOUT)
    )


# ── Games ─────────────────────────────────────────────────────────────────────

def _fetch_scoreboard(date: str, timeout: int):
    return scoreboardv2.ScoreboardV2(game_date=date, timeout=timeout).get_normalized_dict()


@app.route("/api/games/scoreboard")
def get_scoreboard():
    date = request.args.get("date", datetime.now(ZoneInfo("America/New_York")).strftime("%Y-%m-%d"))
    try:
        date_obj = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"error": "Formato data non valido. Usa YYYY-MM-DD."}), 400

    today = datetime.now(ZoneInfo("America/New_York")).date()
    days_diff = (today - date_obj).days

    timeout = NBA_API_TIMEOUT
    cache_ttl = 60
    if days_diff >= 3:
        timeout = max(NBA_API_TIMEOUT, 60)
        cache_ttl = 3600
    elif days_diff >= 1:
        cache_ttl = 600

    cache_key = f"scoreboard:{date}"
    cached = cache.get(cache_key)
    if cached:
        return jsonify(cached)

    try:
        data = _fetch_scoreboard(date, timeout)
        cache.set(cache_key, data, timeout=cache_ttl)
        return jsonify(data)
    except Exception as e:
        logger.error("NBA API call failed: %s", e, exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route("/api/games/<game_id>/summary")
@cache.cached(timeout=60)
def get_game_summary(game_id):
    return safe_call(
        lambda: boxscoresummaryv2.BoxScoreSummaryV2(game_id=game_id, timeout=NBA_API_TIMEOUT)
    )


@app.route("/api/games/<game_id>/boxscore")
@cache.cached(timeout=60)
def get_game_boxscore(game_id):
    return safe_call(
        lambda: boxscoretraditionalv2.BoxScoreTraditionalV2(game_id=game_id, timeout=NBA_API_TIMEOUT)
    )


# ── Shot Chart ────────────────────────────────────────────────────────────────

@app.route("/api/players/<int:player_id>/shotchart")
@cache.cached(timeout=300, query_string=True)
def get_shot_chart(player_id):
    season = request.args.get("season", CURRENT_SEASON)
    return safe_call(
        lambda: shotchartdetail.ShotChartDetail(
            player_id=player_id,
            team_id=0,
            season_nullable=season,
            context_measure_simple="FGA",
            timeout=NBA_API_TIMEOUT,
        )
    )


def _warm_cache():
    """Pre-popola le route più visitate subito dopo il boot."""
    import time
    import threading

    def _run():
        time.sleep(2)  # aspetta che Flask sia pronto
        logger.info("[warm-up] Avvio pre-riscaldamento cache...")
        with app.test_client() as c:
            routes = [
                "/api/league/standings",
                "/api/league/leaders",
                "/api/league/playerstats",
                "/api/league/teamstats",
                "/api/players",
                f"/api/games/scoreboard",
            ]
            for route in routes:
                try:
                    logger.info("[warm-up] %s", route)
                    c.get(route)
                except Exception as e:
                    logger.warning("[warm-up] Errore su %s: %s", route, e)
        logger.info("[warm-up] Cache pre-riscaldata.")

    t = threading.Thread(target=_run, daemon=True)
    t.start()


if __name__ == "__main__":
    _warm_cache()
    app.run(debug=True, port=5000, use_reloader=False)
