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


ssl._create_default_https_context = ssl._create_unverified_context
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

import requests
from datetime import datetime
from zoneinfo import ZoneInfo
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from typing import Any

from nba_api.library.http import NBAHTTP

_session = requests.Session()
_session.verify = False
_session.headers.update({
    "Host": "stats.nba.com",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "it-IT,it;q=0.9,en;q=0.4",
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

_public_session = requests.Session()
_public_session.verify = False
_public_session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "it-IT,it;q=0.9,en;q=0.4",
})
_public_session.mount("https://", _adapter)
_public_session.mount("http://", _adapter)

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


NBA_API_TIMEOUT = 20
PLAYER_API_TIMEOUT = 25

from nba_api.stats.endpoints import (
    commonallplayers,
    commonplayerinfo,
    commonteamyears,
    playercareerstats,
    playergamelog,
    playerprofilev2,
    commonteamroster,
    teamgamelog,
    teaminfocommon,
    teamyearbyyearstats,
    franchisehistory,
    leaguestandings,
    leagueleaders,
    leaguedashlineups,
    leaguedashplayerstats,
    leaguedashteamstats,
    scoreboardv2,
    boxscoreadvancedv2,
    boxscorefourfactorsv2,
    boxscorehustlev2,
    boxscoremiscv2,
    boxscorescoringv2,
    boxscoresummaryv2,
    boxscoretraditionalv2,
    playbyplayv2,
    shotchartdetail,
)

app = Flask(__name__)
CORS(app)

cache = Cache(app, config={
    "CACHE_TYPE": "FileSystemCache",
    "CACHE_DIR": os.path.join(os.path.dirname(__file__), ".cache"),
    "CACHE_DEFAULT_TIMEOUT": 300,
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


def _fetch_public_json(url: str, timeout: int) -> Any:
    res = _public_session.get(url, timeout=timeout)
    res.raise_for_status()
    return res.json()


def _safe_int(value: Any) -> int | None:
    try:
        if value is None:
            return None
        return int(value)
    except Exception:
        return None


def _safe_float(value: Any) -> float | None:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except Exception:
        return None


def _normalize_pct(value: Any) -> float | None:
    num = _safe_float(value)
    if num is None:
        return None
    return num / 100 if num > 1.5 else num


def _compute_pct(made: Any, att: Any) -> float | None:
    m = _safe_float(made)
    a = _safe_float(att)
    if m is None or a in (None, 0):
        return None
    return m / a


def _safe_div(num: Any, den: Any) -> float | None:
    n = _safe_float(num)
    d = _safe_float(den)
    if n is None or d in (None, 0):
        return None
    return n / d


def _build_season_id(start_year: int) -> str:
    return f"{start_year}-{str(start_year + 1)[2:]}"


def _generate_season_ids(min_year: int, max_year: int) -> list[str]:
    if min_year > max_year:
        return []
    return [_build_season_id(year) for year in range(max_year, min_year - 1, -1)]


def _dataset_or_empty(payload: dict, *keys: str) -> list[dict]:
    for key in keys:
        value = payload.get(key)
        if isinstance(value, list):
            return value
    return []


def _safe_normalized_call(label: str, fn) -> dict:
    try:
        return fn().get_normalized_dict()
    except Exception as e:
        logger.warning("%s failed: %s", label, e)
        return {"_error": str(e)}


def _fill_team_pct_fields(team: dict) -> dict:
    if not isinstance(team, dict):
        return team
    if team.get("FG_PCT") is None:
        team["FG_PCT"] = _compute_pct(team.get("FGM"), team.get("FGA"))
    if team.get("FG3_PCT") is None:
        team["FG3_PCT"] = _compute_pct(team.get("FG3M"), team.get("FG3A"))
    if team.get("FT_PCT") is None:
        team["FT_PCT"] = _compute_pct(team.get("FTM"), team.get("FTA"))
    return team


def _derive_team_insight(team: dict, opponent: dict | None = None) -> dict:
    team = dict(team or {})
    opp = opponent or {}
    fgm = _safe_float(team.get("FGM"))
    fga = _safe_float(team.get("FGA"))
    fg3m = _safe_float(team.get("FG3M"))
    fg3a = _safe_float(team.get("FG3A"))
    ftm = _safe_float(team.get("FTM"))
    fta = _safe_float(team.get("FTA"))
    oreb = _safe_float(team.get("OREB"))
    dreb = _safe_float(team.get("DREB"))
    reb = _safe_float(team.get("REB"))
    ast = _safe_float(team.get("AST"))
    tov = _safe_float(team.get("TO"))
    pts = _safe_float(team.get("PTS"))
    stl = _safe_float(team.get("STL"))
    blk = _safe_float(team.get("BLK"))
    pf = _safe_float(team.get("PF"))
    opp_dreb = _safe_float(opp.get("DREB"))
    opp_oreb = _safe_float(opp.get("OREB"))
    opp_poss = None

    poss = None
    if fga is not None and oreb is not None and tov is not None and fta is not None:
        poss = fga - oreb + tov + (0.44 * fta)

    if opponent:
        opp_fga = _safe_float(opp.get("FGA"))
        opp_fta = _safe_float(opp.get("FTA"))
        opp_tov = _safe_float(opp.get("TO"))
        if opp_fga is not None and opp_oreb is not None and opp_tov is not None and opp_fta is not None:
            opp_poss = opp_fga - opp_oreb + opp_tov + (0.44 * opp_fta)

    return {
        "TEAM_ID": team.get("TEAM_ID"),
        "TEAM_NAME": team.get("TEAM_NAME"),
        "TEAM_ABBREVIATION": team.get("TEAM_ABBREVIATION"),
        "PTS": pts,
        "REB": reb,
        "AST": ast,
        "OREB": oreb,
        "DREB": dreb,
        "STL": stl,
        "BLK": blk,
        "TO": tov,
        "PF": pf,
        "PLUS_MINUS": _safe_float(team.get("PLUS_MINUS")),
        "FG_PCT": team.get("FG_PCT"),
        "FG3_PCT": team.get("FG3_PCT"),
        "FT_PCT": team.get("FT_PCT"),
        "EFG_PCT": _safe_div((fgm or 0) + 0.5 * (fg3m or 0), fga),
        "TS_PCT": _safe_div(pts, 2 * ((fga or 0) + 0.44 * (fta or 0))) if pts is not None and (fga is not None or fta is not None) else None,
        "FG3_RATE": _safe_div(fg3a, fga),
        "FTA_RATE": _safe_div(fta, fga),
        "AST_TOV": _safe_div(ast, tov),
        "OREB_PCT": _safe_div(oreb, (oreb or 0) + (opp_dreb or 0)),
        "DREB_PCT": _safe_div(dreb, (dreb or 0) + (opp_oreb or 0)),
        "POSS_EST": poss,
        "OFF_RATING_EST": _safe_div((pts or 0) * 100, poss) if poss is not None and pts is not None else None,
        "DEF_RATING_EST": _safe_div((_safe_float(opp.get("PTS")) or 0) * 100, opp_poss) if opp_poss is not None and opponent else None,
        "PACE_EST": ((poss or 0) + (opp_poss or 0)) / 2 if poss is not None and opp_poss is not None else None,
    }


def _team_stats_have_pct(team_stats: list[dict]) -> bool:
    if not team_stats:
        return False
    for team in team_stats:
        if any(team.get(field) is not None for field in ("FG_PCT", "FG3_PCT", "FT_PCT")):
            return True
    return False


def _merge_team_stats(base_stats: list[dict], extra_stats: list[dict]) -> list[dict]:
    if not base_stats:
        return [_fill_team_pct_fields(dict(team)) for team in extra_stats]

    merged = []
    extra_by_team_id = {team.get("TEAM_ID"): team for team in extra_stats if isinstance(team, dict)}
    extra_by_abbr = {
        str(team.get("TEAM_ABBREVIATION")).upper(): team
        for team in extra_stats
        if isinstance(team, dict) and team.get("TEAM_ABBREVIATION")
    }

    for team in base_stats:
        merged_team = dict(team)
        extra = extra_by_team_id.get(team.get("TEAM_ID"))
        if extra is None and team.get("TEAM_ABBREVIATION"):
            extra = extra_by_abbr.get(str(team.get("TEAM_ABBREVIATION")).upper())
        if extra:
            for field in ("FG_PCT", "FG3_PCT", "FT_PCT", "FGM", "FGA", "FG3M", "FG3A", "FTM", "FTA", "OREB", "DREB", "STL", "BLK", "TO", "PF", "PLUS_MINUS"):
                if merged_team.get(field) is None and extra.get(field) is not None:
                    merged_team[field] = extra.get(field)
        merged.append(_fill_team_pct_fields(merged_team))

    return merged


def _enrich_boxscore_with_traditional(game_id: str, normalized: dict) -> dict:
    team_stats = normalized.get("TeamStats") or []
    traditional = boxscoretraditionalv2.BoxScoreTraditionalV2(game_id=game_id, timeout=NBA_API_TIMEOUT).get_normalized_dict()
    traditional_team_stats = traditional.get("TeamStats") or []
    normalized["TeamStats"] = _merge_team_stats(team_stats, traditional_team_stats)
    if not normalized.get("PlayerStats") and traditional.get("PlayerStats"):
        normalized["PlayerStats"] = traditional.get("PlayerStats")
    return normalized


def _get_game_boxscore_payload(game_id: str) -> dict:
    cdn_url = f"https://cdn.nba.com/static/json/liveData/boxscore/boxscore_{game_id}.json"
    espn_url = f"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event={game_id}"

    try:
        data = _fetch_public_json(cdn_url, timeout=12)
        normalized = _normalize_cdn_boxscore(data)
        if normalized.get("TeamStats") or normalized.get("PlayerStats"):
            try:
                normalized = _enrich_boxscore_with_traditional(game_id, normalized)
            except Exception as enrich_error:
                logger.warning("Traditional enrich failed for CDN boxscore %s: %s", game_id, enrich_error)
            return normalized
        raise Exception("Empty CDN boxscore")
    except Exception as e:
        logger.warning("CDN boxscore failed for %s: %s", game_id, e)

    try:
        data = _fetch_public_json(espn_url, timeout=12)
        normalized = _normalize_espn_boxscore(data)
        if normalized.get("TeamStats") or normalized.get("PlayerStats"):
            try:
                normalized = _enrich_boxscore_with_traditional(game_id, normalized)
            except Exception as enrich_error:
                logger.warning("Traditional enrich failed for ESPN boxscore %s: %s", game_id, enrich_error)
            return normalized
        raise Exception("Empty ESPN boxscore")
    except Exception as e:
        logger.warning("ESPN boxscore failed for %s: %s", game_id, e)

    return boxscoretraditionalv2.BoxScoreTraditionalV2(game_id=game_id, timeout=NBA_API_TIMEOUT).get_normalized_dict()


def _game_insights_payload(game_id: str) -> dict:
    boxscore = _get_game_boxscore_payload(game_id)
    team_stats = [_fill_team_pct_fields(dict(team)) for team in (boxscore.get("TeamStats") or [])]
    derived_team_stats = []
    if len(team_stats) >= 2:
        derived_team_stats = [
            _derive_team_insight(team_stats[0], team_stats[1]),
            _derive_team_insight(team_stats[1], team_stats[0]),
        ]
    elif len(team_stats) == 1:
        derived_team_stats = [_derive_team_insight(team_stats[0])]

    advanced = _safe_normalized_call(
        f"BoxScoreAdvancedV2 {game_id}",
        lambda: boxscoreadvancedv2.BoxScoreAdvancedV2(game_id=game_id, timeout=NBA_API_TIMEOUT),
    )
    four_factors = _safe_normalized_call(
        f"BoxScoreFourFactorsV2 {game_id}",
        lambda: boxscorefourfactorsv2.BoxScoreFourFactorsV2(game_id=game_id, timeout=NBA_API_TIMEOUT),
    )
    misc = _safe_normalized_call(
        f"BoxScoreMiscV2 {game_id}",
        lambda: boxscoremiscv2.BoxScoreMiscV2(game_id=game_id, timeout=NBA_API_TIMEOUT),
    )
    scoring = _safe_normalized_call(
        f"BoxScoreScoringV2 {game_id}",
        lambda: boxscorescoringv2.BoxScoreScoringV2(game_id=game_id, timeout=NBA_API_TIMEOUT),
    )
    hustle = _safe_normalized_call(
        f"BoxScoreHustleV2 {game_id}",
        lambda: boxscorehustlev2.BoxScoreHustleV2(game_id=game_id, timeout=NBA_API_TIMEOUT),
    )

    payload = {
        "BaseTeamStats": team_stats,
        "DerivedTeamStats": derived_team_stats,
        "AdvancedTeamStats": _dataset_or_empty(advanced, "TeamStats"),
        "AdvancedPlayerStats": _dataset_or_empty(advanced, "PlayerStats"),
        "FourFactorsTeamStats": _dataset_or_empty(four_factors, "sqlTeamsFourFactors", "TeamStats"),
        "FourFactorsPlayerStats": _dataset_or_empty(four_factors, "sqlPlayersFourFactors", "PlayerStats"),
        "MiscTeamStats": _dataset_or_empty(misc, "sqlTeamsMisc", "TeamStats"),
        "MiscPlayerStats": _dataset_or_empty(misc, "sqlPlayersMisc", "PlayerStats"),
        "ScoringTeamStats": _dataset_or_empty(scoring, "sqlTeamsScoring", "TeamStats"),
        "ScoringPlayerStats": _dataset_or_empty(scoring, "sqlPlayersScoring", "PlayerStats"),
        "HustleTeamStats": _dataset_or_empty(hustle, "TeamStats"),
        "HustlePlayerStats": _dataset_or_empty(hustle, "PlayerStats"),
    }
    errors = {
        "advanced": advanced.get("_error"),
        "fourFactors": four_factors.get("_error"),
        "misc": misc.get("_error"),
        "scoring": scoring.get("_error"),
        "hustle": hustle.get("_error"),
    }
    payload["Errors"] = {key: value for key, value in errors.items() if value}
    payload["HasAnyData"] = bool(derived_team_stats) or any(
        isinstance(value, list) and len(value) > 0
        for key, value in payload.items()
        if key not in {"Errors", "HasAnyData"}
    )
    return payload


def _format_iso_minutes(value: Any) -> Any:
    if not value or not isinstance(value, str):
        return value
    if value.startswith("PT") and ("M" in value or "S" in value):
        try:
            minutes = 0
            seconds = 0
            chunk = value[2:]
            if "M" in chunk:
                m_part, rest = chunk.split("M", 1)
                minutes = int(float(m_part)) if m_part else 0
            else:
                rest = chunk
            if "S" in rest:
                s_part = rest.split("S", 1)[0]
                seconds = int(float(s_part)) if s_part else 0
            return f"{minutes}:{seconds:02d}"
        except Exception:
            return value
    return value


NBA_TEAM_TRICODE_TO_ID = {
    "ATL": 1610612737,
    "BOS": 1610612738,
    "BKN": 1610612751,
    "CHA": 1610612766,
    "CHI": 1610612741,
    "CLE": 1610612739,
    "DAL": 1610612742,
    "DEN": 1610612743,
    "DET": 1610612765,
    "GSW": 1610612744,
    "HOU": 1610612745,
    "IND": 1610612754,
    "LAC": 1610612746,
    "LAL": 1610612747,
    "MEM": 1610612763,
    "MIA": 1610612748,
    "MIL": 1610612749,
    "MIN": 1610612750,
    "NOP": 1610612740,
    "NYK": 1610612752,
    "OKC": 1610612760,
    "ORL": 1610612753,
    "PHI": 1610612755,
    "PHX": 1610612756,
    "POR": 1610612757,
    "SAC": 1610612758,
    "SAS": 1610612759,
    "TOR": 1610612761,
    "UTA": 1610612762,
    "WAS": 1610612764,
}


def _team_id_from_abbr(abbr: Any) -> int | None:
    if not abbr:
        return None
    return NBA_TEAM_TRICODE_TO_ID.get(str(abbr).upper())


def _normalize_cdn_boxscore(payload: dict) -> dict:
    game = payload.get("game") or {}
    team_stats = []
    player_stats = []

    for side in ("homeTeam", "awayTeam"):
        team = game.get(side) or {}
        team_id = _safe_int(team.get("teamId") or team.get("teamID"))
        if team_id is None:
            team_id = _team_id_from_abbr(team.get("teamTricode") or team.get("triCode"))
        stats = team.get("statistics") or {}
        fg_pct = _normalize_pct(stats.get("fgPct")) or _compute_pct(stats.get("fgm"), stats.get("fga"))
        fg3_pct = _normalize_pct(stats.get("fg3Pct")) or _compute_pct(stats.get("fg3m"), stats.get("fg3a"))
        ft_pct = _normalize_pct(stats.get("ftPct")) or _compute_pct(stats.get("ftm"), stats.get("fta"))

        if team_id is not None:
            team_stats.append({
                "TEAM_ID": team_id,
                "TEAM_NAME": team.get("teamName"),
                "TEAM_ABBREVIATION": team.get("teamTricode") or team.get("triCode"),
                "PTS": team.get("score") or stats.get("points"),
                "FGM": _safe_float(stats.get("fgm")),
                "FGA": _safe_float(stats.get("fga")),
                "FG3M": _safe_float(stats.get("fg3m")),
                "FG3A": _safe_float(stats.get("fg3a")),
                "FTM": _safe_float(stats.get("ftm")),
                "FTA": _safe_float(stats.get("fta")),
                "OREB": _safe_float(stats.get("reboundsOffensive") or stats.get("offReb")),
                "DREB": _safe_float(stats.get("reboundsDefensive") or stats.get("defReb")),
                "REB": stats.get("reboundsTotal") or stats.get("rebounds"),
                "AST": stats.get("assists"),
                "STL": _safe_float(stats.get("steals")),
                "BLK": _safe_float(stats.get("blocks")),
                "TO": _safe_float(stats.get("turnovers")),
                "PF": _safe_float(stats.get("foulsPersonal") or stats.get("fouls")),
                "FG_PCT": fg_pct,
                "FG3_PCT": fg3_pct,
                "FT_PCT": ft_pct,
            })

        for p in team.get("players", []) or []:
            p_stats = p.get("statistics") or {}
            player_stats.append({
                "PLAYER_ID": _safe_int(p.get("personId") or p.get("playerId")),
                "PLAYER_NAME": p.get("name") or p.get("displayName"),
                "TEAM_ID": team_id,
                "MIN": _format_iso_minutes(p_stats.get("minutes") or p_stats.get("min")),
                "PTS": p_stats.get("points"),
                "REB": p_stats.get("reboundsTotal") or p_stats.get("rebounds"),
                "AST": p_stats.get("assists"),
            })

    return {"TeamStats": team_stats, "PlayerStats": player_stats}


def _normalize_espn_boxscore(payload: dict) -> dict:
    box = payload.get("boxscore") or {}
    team_stats = []
    player_stats = []

    for t in box.get("teams", []) or []:
        team = t.get("team") or {}
        abbr = team.get("abbreviation")
        mapped_team_id = _team_id_from_abbr(abbr)
        stats_list = t.get("statistics") or []
        stats = {s.get("name"): s.get("displayValue") for s in stats_list if isinstance(s, dict)}

        team_stats.append({
            "TEAM_ID": mapped_team_id or _safe_int(team.get("id")),
            "TEAM_NAME": team.get("displayName") or team.get("name"),
            "TEAM_ABBREVIATION": abbr,
            "PTS": _safe_float(stats.get("points") or stats.get("pts")),
            "FGM": _safe_float(stats.get("fieldGoalsMade") or stats.get("fgm")),
            "FGA": _safe_float(stats.get("fieldGoalsAttempted") or stats.get("fga")),
            "FG3M": _safe_float(stats.get("threePointFieldGoalsMade") or stats.get("fg3m")),
            "FG3A": _safe_float(stats.get("threePointFieldGoalsAttempted") or stats.get("fg3a")),
            "FTM": _safe_float(stats.get("freeThrowsMade") or stats.get("ftm")),
            "FTA": _safe_float(stats.get("freeThrowsAttempted") or stats.get("fta")),
            "OREB": _safe_float(stats.get("offensiveRebounds") or stats.get("oreb")),
            "DREB": _safe_float(stats.get("defensiveRebounds") or stats.get("dreb")),
            "REB": _safe_float(stats.get("rebounds") or stats.get("reboundsTotal") or stats.get("totReb")),
            "AST": _safe_float(stats.get("assists")),
            "STL": _safe_float(stats.get("steals")),
            "BLK": _safe_float(stats.get("blocks")),
            "TO": _safe_float(stats.get("turnovers")),
            "PF": _safe_float(stats.get("fouls") or stats.get("personalFouls")),
            "FG_PCT": _normalize_pct(stats.get("fieldGoalPct") or stats.get("fgPct") or stats.get("fgPercent")),
            "FG3_PCT": _normalize_pct(stats.get("threePointPct") or stats.get("fg3Pct") or stats.get("threePointFieldGoalPct")),
            "FT_PCT": _normalize_pct(stats.get("freeThrowPct") or stats.get("ftPct") or stats.get("freeThrowPercent")),
        })

    for group in box.get("players", []) or []:
        team = group.get("team") or {}
        abbr = team.get("abbreviation")
        team_id = _team_id_from_abbr(abbr) or _safe_int(team.get("id"))
        for stat_group in group.get("statistics", []) or []:
            labels = stat_group.get("labels") or []
            label_index = {label: i for i, label in enumerate(labels)}
            for athlete_entry in stat_group.get("athletes", []) or []:
                athlete = athlete_entry.get("athlete") or {}
                stats = athlete_entry.get("stats") or []

                def pick(label: str):
                    idx = label_index.get(label)
                    return stats[idx] if idx is not None and idx < len(stats) else None

                player_stats.append({
                    "PLAYER_ID": _safe_int(athlete.get("id")),
                    "PLAYER_NAME": athlete.get("displayName") or athlete.get("fullName"),
                    "TEAM_ID": team_id,
                    "MIN": pick("MIN") or pick("MP"),
                    "PTS": _safe_float(pick("PTS")),
                    "REB": _safe_float(pick("REB") or pick("TRB")),
                    "AST": _safe_float(pick("AST")),
                })

    return {"TeamStats": team_stats, "PlayerStats": player_stats}


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


@app.route("/api/meta/seasons")
@cache.cached(timeout=3600)
def get_available_seasons():
    try:
        payload = commonteamyears.CommonTeamYears(timeout=NBA_API_TIMEOUT).get_normalized_dict()
        rows = payload.get("TeamYears") or []
        min_years = [_safe_int(row.get("MIN_YEAR")) for row in rows]
        max_years = [_safe_int(row.get("MAX_YEAR")) for row in rows]
        min_year = min((year for year in min_years if year is not None), default=None)
        max_year = max((year for year in max_years if year is not None), default=None)

        if min_year is None or max_year is None:
            raise ValueError("CommonTeamYears returned no season range")

        return jsonify({
            "current": _build_season_id(max_year),
            "seasons": _generate_season_ids(min_year, max_year),
        })
    except Exception as e:
        logger.warning("Season metadata failed: %s", e)
        return jsonify({
            "current": CURRENT_SEASON,
            "seasons": [CURRENT_SEASON],
        })


@app.route("/api/league/franchises/history")
@cache.cached(timeout=3600)
def get_franchise_history():
    return safe_call(
        lambda: franchisehistory.FranchiseHistory(timeout=NBA_API_TIMEOUT)
    )


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


@app.route("/api/league/lineups")
@cache.cached(timeout=300, query_string=True)
def get_lineups():
    season = request.args.get("season", CURRENT_SEASON)
    team_id = request.args.get("teamId", "")
    group_quantity = request.args.get("groupQuantity", "5")
    per_mode = request.args.get("perMode", "Totals")
    season_type = request.args.get("seasonType", "Regular Season")
    measure_type = request.args.get("measureType", "Base")
    return safe_call(
        lambda: leaguedashlineups.LeagueDashLineups(
            season=season,
            team_id_nullable=team_id,
            group_quantity=group_quantity,
            per_mode_detailed=per_mode,
            season_type_all_star=season_type,
            measure_type_detailed_defense=measure_type,
            timeout=NBA_API_TIMEOUT,
        )
    )

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
    try:
        return jsonify(_get_game_boxscore_payload(game_id))
    except Exception as e:
        logger.error("Boxscore payload failed for %s: %s", game_id, e, exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route("/api/games/<game_id>/playbyplay")
@cache.cached(timeout=15)
def get_game_playbyplay(game_id):
    try:
        data = playbyplayv2.PlayByPlayV2(game_id=game_id, timeout=NBA_API_TIMEOUT)
        return jsonify(data.get_normalized_dict())
    except KeyError:
       return jsonify({"PlayByPlay": []})
    except Exception as e:
        logger.error("NBA API call failed: %s", e, exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route("/api/games/<game_id>/advanced")
@cache.cached(timeout=60)
def get_game_advanced(game_id):
    return safe_call(
        lambda: boxscoreadvancedv2.BoxScoreAdvancedV2(game_id=game_id, timeout=NBA_API_TIMEOUT)
    )


@app.route("/api/games/<game_id>/fourfactors")
@cache.cached(timeout=60)
def get_game_four_factors(game_id):
    return safe_call(
        lambda: boxscorefourfactorsv2.BoxScoreFourFactorsV2(game_id=game_id, timeout=NBA_API_TIMEOUT)
    )


@app.route("/api/games/<game_id>/misc")
@cache.cached(timeout=60)
def get_game_misc(game_id):
    return safe_call(
        lambda: boxscoremiscv2.BoxScoreMiscV2(game_id=game_id, timeout=NBA_API_TIMEOUT)
    )


@app.route("/api/games/<game_id>/scoring")
@cache.cached(timeout=60)
def get_game_scoring(game_id):
    return safe_call(
        lambda: boxscorescoringv2.BoxScoreScoringV2(game_id=game_id, timeout=NBA_API_TIMEOUT)
    )


@app.route("/api/games/<game_id>/hustle")
@cache.cached(timeout=60)
def get_game_hustle(game_id):
    return safe_call(
        lambda: boxscorehustlev2.BoxScoreHustleV2(game_id=game_id, timeout=NBA_API_TIMEOUT)
    )


@app.route("/api/games/<game_id>/insights")
@cache.cached(timeout=60)
def get_game_insights(game_id):
    try:
        return jsonify(_game_insights_payload(game_id))
    except Exception as e:
        logger.error("Game insights failed for %s: %s", game_id, e, exc_info=True)
        return jsonify({"error": str(e)}), 500

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
        time.sleep(2) 
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
