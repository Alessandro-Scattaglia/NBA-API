import os
import requests
from flask import Flask, jsonify
from flask_cors import CORS
from nba_api.stats.endpoints import (
    commonallplayers,
    commonplayerinfo,
    leaguestandings,
    scoreboardv2,
)
from nba_api.stats.static import players, teams
from nba_api.library.http import NBAHTTP

app = Flask(__name__)
CORS(app)

# SSL verification can be disabled when running behind corporate proxies that
# intercept HTTPS traffic and present their own certificate.
#
# WARNING: disabling SSL verification removes protection against
# man-in-the-middle attacks. Enable only when strictly necessary and never
# in production environments that handle sensitive data.
#
# Set NBA_API_VERIFY_SSL=true in the environment to keep verification enabled.
_verify_ssl = os.environ.get("NBA_API_VERIFY_SSL", "false").lower() == "true"
_session = requests.Session()
_session.verify = _verify_ssl
if not _verify_ssl:
    requests.packages.urllib3.disable_warnings(
        requests.packages.urllib3.exceptions.InsecureRequestWarning
    )
NBAHTTP.set_session(_session)


@app.route("/api/players", methods=["GET"])
def get_all_players():
    """Return all current NBA players."""
    try:
        all_players = players.get_active_players()
        return jsonify(all_players)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/players/<int:player_id>", methods=["GET"])
def get_player_info(player_id):
    """Return detailed info for a single player."""
    try:
        info = commonplayerinfo.CommonPlayerInfo(player_id=player_id, timeout=10)
        data = info.get_normalized_dict()
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/teams", methods=["GET"])
def get_all_teams():
    """Return all NBA teams."""
    try:
        all_teams = teams.get_teams()
        return jsonify(all_teams)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/standings", methods=["GET"])
def get_standings():
    """Return current league standings."""
    try:
        standings = leaguestandings.LeagueStandings(timeout=10)
        data = standings.get_normalized_dict()
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/scoreboard", methods=["GET"])
def get_scoreboard():
    """Return today's scoreboard."""
    try:
        scoreboard = scoreboardv2.ScoreboardV2(timeout=10)
        data = scoreboard.get_normalized_dict()
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    app.run(debug=debug, port=5000)
