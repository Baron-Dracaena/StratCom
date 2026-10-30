# STRATCOM // GEO-OSINT

**A maritime chokepoint war-game and open-source-intelligence console.** You close a strait and watch global shipping reroute. Each nation has its own dossier, and live open-source feeds run in a side strip.

> **Status: early prototype (v4.5).** This is a self-directed learning project and part of the TTech Energy tooling line. It is not an operational intelligence product. The scores are heuristic, and the constants they depend on are listed in the source.

## What it does

- **Chokepoint rerouting.** A Dijkstra router runs over a great-circle shipping graph (`js/math-geodesic.js`). If you mark a gate as contested or closed (Hormuz, Suez, Malacca and others), the router recomputes the cheapest sea route. A contested gate costs more to cross, and a closed one is removed from the graph.
- **Corridor chemistry score.** `js/chemistry-engine.js` compares the rerouted voyage with the baseline route: extra distance, extra days at a set vessel speed, and how exposed the route is to chokepoints. It condenses the comparison into a single corridor score.
- **Nation dossiers.** Each country has a profile with macro indicators pulled live from the World Bank API.
- **2D map and 3D globe.** It uses Leaflet for the flat map and a 3D globe view for routes and markers.
- **OSINT backend.** A FastAPI and SQLite server (`launch.py`) caches RSS feeds and GDELT event files. The feeds in `live_feeds.py` are optional: live AIS ship positions (aisstream.io) and a solar soiling nowcast fed from the Sol yield model.

## Run it

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows  (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
python launch.py                # then open http://localhost:8080
```

The SQLite database is created automatically on the first run.

### Optional: live AIS

Get a free key from aisstream.io. Then set it as an environment variable before launching:

```powershell
$env:AISSTREAM_API_KEY = "your-key"
```

You can also save it in a file named `aisstream.key` next to `launch.py`. That file is gitignored, so **never commit it**.

## Layout

```
launch.py            FastAPI server, SQLite cache, RSS/OSINT endpoints
live_feeds.py        GDELT events, AIS websocket, Sol soiling layer
index.html, css/     HUD shell
js/                  router, chemistry engine, globe, live layers, Sol layer
data/                nations, blocs, sea lanes, chokepoint graph
tools/               scripts that rebuild the nation and sea-lane datasets
```

## Data sources

World Bank Open Data; GDELT; public RSS feeds (only headlines and links are cached); aisstream.io; sea lanes derived with `searoute` (Eurostat MARNET).
