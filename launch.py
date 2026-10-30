# ============================================================================
# STRATCOM v4.5 // FASTAPI + SQLITE OSINT & SOVEREIGN TELEMETRY CORE (+ live feeds: live_feeds.py)
# ============================================================================

import hashlib
import json
import os
import re
import socket
import sqlite3
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, List, Literal, Optional

import uvicorn
from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

PORT = 8080
BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "stratcom.db"
OSINT_TTL_SECONDS = 600  # 10-minute SQLite cache TTL
# Sol's GeoJSON exports (read-only). Default assumes C:\Users\<you>\stratcom\stratcom and
# C:\Users\<you>\Santiago\Sol side by side; override with the SOL_GEO_DIR environment variable.
SOL_ROOT = Path(os.environ.get("SOL_ROOT") or BASE_DIR.parents[1] / "Santiago" / "Sol")
SOL_GEO_DIR = Path(os.environ.get("SOL_GEO_DIR") or SOL_ROOT / "reports" / "geo")

GateId = Literal["bab_el_mandeb", "hormuz", "malacca", "taiwan_strait", "turkish_straits", "panama",
                 "benin_niger", "kamba", "jnim_bamako", "hidrovia",
                 "danish_straits", "danube", "black_sea_war", "odesa_corridor", "russia_rail", "sudan_war"]
GateState = Literal["open", "contested", "blockaded"]

app = FastAPI(title="STRATCOM v4.4 // FastAPI & SQLite OSINT Core")

# ----------------------------------------------------------------------------
# 2. THEATER LEXICON (whole-word keyword matching + Domepolitical/Economic)
# ----------------------------------------------------------------------------
THEATER_LEXICON = [
    {
        "theater": "Bab el-Mandeb & Red Sea",
        "gate": "bab_el_mandeb",
        "lat": 13.8, "lng": 43.1,
        "keywords": ["red sea", "houthi", "bab el-mandeb", "suez", "gulf of aden", "aden", "yemen"]
    },
    {
        "theater": "Strait of Hormuz & Persian Gulf",
        "gate": "hormuz",
        "lat": 26.4, "lng": 56.3,
        "keywords": ["hormuz", "persian gulf", "irgc", "gulf of oman", "tanker seized", "tanker seizure",
                     "iranian navy", "fujairah", "bandar abbas"]
    },
    {
        "theater": "Taiwan Strait & First Island Chain",
        "gate": "taiwan_strait",
        "lat": 24.2, "lng": 119.6,
        "keywords": ["taiwan", "taipei", "pla", "adiz", "median line", "kinmen", "okinawa"]
    },
    {
        "theater": "South China Sea & Malacca Approach",
        "gate": "malacca",
        "lat": 9.8, "lng": 114.2,
        "keywords": ["south china sea", "spratly", "scarborough", "paracel", "malacca", "philippine",
                     "china coast guard", "sabina", "second thomas", "luzon"]
    },
    {
        "theater": "Turkish Straits",
        "gate": "turkish_straits",
        "lat": 41.1, "lng": 29.1,
        "keywords": ["bosphorus", "bosporus", "dardanelles", "montreux", "turkish straits"]
    },
    {
        "theater": "Black Sea & Eastern Europe",
        "gate": "black_sea_war",
        "lat": 45.3, "lng": 34.1,
        "keywords": ["black sea", "crimea", "novorossiysk", "sevastopol", "kerch", "caspian pipeline",
                     "cpc terminal", "naval drone"]
    },
    {
        "theater": "Ukrainian Grain Corridor",
        "gate": "odesa_corridor",
        "lat": 46.3, "lng": 30.7,
        "keywords": ["odesa", "odessa", "chornomorsk", "pivdennyi", "izmail", "reni", "grain corridor",
                     "ukraine grain"]
    },
    {
        "theater": "Middle Corridor & Caspian",
        "gate": None,
        "lat": 42.0, "lng": 50.0,
        "keywords": ["middle corridor", "trans-caspian", "aktau", "baku", "kazakhstan", "poti", "kars"]
    },
    {
        "theater": "Eastern Med & Levant",
        "gate": None,
        "lat": 33.2, "lng": 35.1,
        "keywords": ["levant", "israel", "lebanon", "gaza", "syria", "eastern mediterranean", "hezbollah"]
    },
    {
        "theater": "Panama & Caribbean Basin",
        "gate": "panama",
        "lat": 9.1, "lng": -79.7,
        "keywords": ["panama canal", "gatun", "neopanamax", "draft limit"]
    },
    {
        "theater": "Niger–Benin Corridor",
        "gate": "benin_niger",
        "lat": 11.9, "lng": 3.4,
        "keywords": ["benin", "cotonou", "malanville", "kamba", "niamey"]
    },
    {
        "theater": "Mali / Bamako Supply Routes",
        "gate": "jnim_bamako",
        "lat": 13.1, "lng": -8.9,
        "keywords": ["bamako", "jnim", "kayes", "mali fuel", "fuel blockade"]
    },
    {
        "theater": "Baltic Sea & Danish Straits",
        "gate": "danish_straits",
        "lat": 57.6, "lng": 19.5,
        "keywords": ["baltic", "shadow fleet", "danish straits", "oresund", "øresund", "skagen",
                     "gulf of finland", "subsea cable", "undersea cable", "baltic sentry"]
    },
    {
        "theater": "Danube Corridor",
        "gate": "danube",
        "lat": 43.65, "lng": 25.2,
        "keywords": ["danube", "constanta", "constanța", "iron gates"]
    },
    {
        "theater": "Sudan War",
        "gate": "sudan_war",
        "lat": 15.5, "lng": 32.5,
        "keywords": ["sudan", "port sudan", "rsf", "rapid support forces", "el fasher", "kordofan", "south sudan oil"]
    },
    {
        "theater": "Southern & East African Corridors",
        "gate": None,
        "lat": -12.0, "lng": 32.0,
        "keywords": ["tazara", "dar es salaam", "beira", "nacala", "maputo", "walvis bay", "copperbelt", "katanga",
                     "kolwezi", "zambia", "mozambique", "cabo delgado", "mombasa", "northern corridor", "zimbabwe", "harare"]
    },
    {
        "theater": "Paraná–Paraguay Hidrovía",
        "gate": "hidrovia",
        "lat": -27.4, "lng": -58.8,
        "keywords": ["hidrovia", "hidrovía", "paraguay river", "parana river", "paraná river",
                     "asuncion", "asunción", "rosario"]
    },
    {
        "theater": "Andes & Southern Cone",
        "gate": None,
        "lat": -20.0, "lng": -68.0,
        "keywords": ["chancay", "callao", "guayaquil", "ecuador", "peru", "chile", "bolivia", "argentina",
                     "uruguay", "montevideo", "antofagasta", "lithium triangle", "vaca muerta", "mercosur"]
    },
    {
        "theater": "Sahel & Atlantic Africa Corridor",
        "gate": None,
        "lat": 14.5, "lng": -1.2,
        "keywords": ["sahel", "niger", "mali", "burkina faso", "lobito", "angola", "drc", "congo",
                     "cobalt", "gulf of guinea", "ghana", "tema", "lomé", "lome", "abidjan", "ouagadougou", "ecowas"]
    },
    {
        "theater": "Suez Canal & Eastern Med Approaches",
        "gate": "bab_el_mandeb",
        "lat": 30.58, "lng": 32.34,
        "keywords": ["suez canal", "port said", "sca", "evergreen", "trans-mediterranean", "alexandria port"]
    },
    {
        "theater": "Cape of Good Hope & Lobito Corridor",
        "gate": None,
        "lat": -34.35, "lng": 18.47,
        "keywords": ["cape of good hope", "good hope", "durban", "richards bay", "transnet", "lobito corridor", "benguela"]
    },
    {
        "theater": "Arctic & Northern Sea Route",
        "gate": None,
        "lat": 69.0, "lng": 33.1,
        "keywords": ["northern sea route", "arctic", "murmansk", "icebreaker", "svalbard", "barents", "yamal"]
    },
    {
        "theater": "Global Central Banks, Sovereign Debt & FX",
        "gate": None,
        "lat": 40.71, "lng": -74.01,
        "keywords": ["imf", "world bank", "sovereign debt", "bond yield", "treasury", "rate cut", "rate hike",
                     "inflation", "brics", "de-dollarization", "swift", "sanction", "export control", "tariff"]
    },
    {
        "theater": "Strategic Energy, LNG & Critical Minerals",
        "gate": None,
        "lat": 25.3, "lng": 51.5,
        "keywords": ["opec", "brent crude", "wti", "lng terminal", "vlsfo", "bunker fuel", "rare earth",
                     "lithium", "copper", "uranium", "cobalt", "bauxite", "smelter", "refinery"]
    },
    {
        "theater": "Indo-Pacific Semiconductor & Fab Supply Chain",
        "gate": "taiwan_strait",
        "lat": 24.8, "lng": 121.0,
        "keywords": ["tsmc", "semiconductor", "asml", "wafer", "foundry", "hbm", "chip export", "fab"]
    },
    {
        "theater": "North America Domepolitical & Grid",
        "gate": None,
        "lat": 39.85, "lng": -76.76,
        "keywords": ["pjm", "ferc", "power grid", "substation", "tariff", "port of baltimore", "norfolk",
                     "pennsylvania", "microgrid", "solar", "transformer", "freight rail", "federal reserve"]
    }
]

for _item in THEATER_LEXICON:
    _item["patterns"] = [re.compile(r"\b" + re.escape(kw) + r"(?:s|es)?\b", re.IGNORECASE)
                         for kw in _item["keywords"]]

RSS_FEEDS = [
    ("USNI NAVAL INTEL", "https://news.usni.org/feed", None, None),
    ("GCAPTAIN MARITIME", "https://gcaptain.com/feed/", None, None),
    ("DEFENSE ONE", "https://www.defenseone.com/rss/all/", None, None),
    ("CNBC WORLD ECONOMY", "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100727362", None, None),
    ("YAHOO FINANCE MACRO", "https://finance.yahoo.com/news/rssindex", None, None),
    ("AL JAZEERA GLOBAL", "https://www.aljazeera.com/xml/rss/all.xml", None, None),
    ("BBC WORLD SECURITY", "https://feeds.bbci.co.uk/news/world/rss.xml", None, None),
]


def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS gate_states (
                gate_id TEXT PRIMARY KEY,
                state TEXT NOT NULL,
                updated_at REAL NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS osint_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source TEXT,
                title TEXT,
                link TEXT,
                theater TEXT,
                gate TEXT,
                lat REAL,
                lng REAL,
                fetched_at REAL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sovereign_sites (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                host TEXT NOT NULL,
                lat REAL NOT NULL,
                lng REAL NOT NULL,
                stream_url TEXT,
                notes TEXT,
                created_at REAL NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS custom_rss_feeds (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_name TEXT NOT NULL,
                url TEXT NOT NULL,
                default_lat REAL,
                default_lng REAL
            )
        """)
        conn.commit()


init_db()

import live_feeds  # noqa: E402  GDELT events, AIS ships, Sol soiling nowcast
GDELT_FEED, AIS_FEED, NOWCAST_FEED = live_feeds.register(app, DB_PATH, BASE_DIR, SOL_ROOT)


def classify_headline(title: str) -> Optional[Dict]:
    best, best_hits = None, 0
    for item in THEATER_LEXICON:
        hits = sum(1 for p in item["patterns"] if p.search(title))
        if hits > best_hits:
            best, best_hits = item, hits
    return best


def stable_jitter(title: str):
    h = hashlib.sha1(title.encode("utf-8")).digest()
    return (h[0] - 128) / 128 * 0.9, (h[1] - 128) / 128 * 0.9


def fetch_live_rss_events() -> List[Dict]:
    events = []
    now = time.time()
    headers = {"User-Agent": "STRATCOM-GeoOSINT/4.4 (Local Research Terminal)"}

    all_feeds = list(RSS_FEEDS)
    with sqlite3.connect(DB_PATH) as conn:
        custom_rows = conn.execute("SELECT source_name, url, default_lat, default_lng FROM custom_rss_feeds").fetchall()
        for r in custom_rows:
            all_feeds.insert(0, (r[0], r[1], r[2], r[3]))

    for source_name, url, def_lat, def_lng in all_feeds:
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=4.5) as resp:
                xml_bytes = resp.read()
            root = ET.fromstring(xml_bytes)
            for item in root.findall(".//item")[:18]:
                title = (item.findtext("title") or "").strip()
                link = (item.findtext("link") or "").strip()
                if not title:
                    continue
                match = classify_headline(title)
                jitter_lat, jitter_lng = stable_jitter(title)
                if match:
                    events.append({
                        "source": source_name,
                        "title": title,
                        "link": link,
                        "theater": match["theater"],
                        "gate": match["gate"],
                        "lat": round(match["lat"] + jitter_lat, 3),
                        "lng": round(match["lng"] + jitter_lng, 3),
                        "fetched_at": now
                    })
                elif def_lat is not None and def_lng is not None:
                    events.append({
                        "source": source_name,
                        "title": title,
                        "link": link,
                        "theater": "Custom OSINT / Domepolitical Wire",
                        "gate": None,
                        "lat": round(def_lat + jitter_lat, 3),
                        "lng": round(def_lng + jitter_lng, 3),
                        "fetched_at": now
                    })
        except Exception:
            continue

    return events[:40]


class GateUpdatePayload(BaseModel):
    gate_id: GateId
    state: GateState


class SovereignSitePayload(BaseModel):
    id: str
    name: str
    host: str = "USA"
    lat: float
    lng: float
    streamUrl: Optional[str] = ""
    notes: Optional[str] = ""


class CustomFeedPayload(BaseModel):
    source_name: str
    url: str
    default_lat: Optional[float] = 39.85
    default_lng: Optional[float] = -76.76


@app.get("/api/health")
def health_check():
    return {"status": "ONLINE", "engine": "STRATCOM FastAPI + SQLite v4.4", "timestamp": time.time()}


@app.get("/api/wargame/gates")
def get_gate_states():
    with sqlite3.connect(DB_PATH) as conn:
        rows = conn.execute("SELECT gate_id, state FROM gate_states").fetchall()
    return {"gates": {r[0]: r[1] for r in rows}}


@app.post("/api/wargame/gates")
def set_gate_state(payload: GateUpdatePayload):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "INSERT INTO gate_states (gate_id, state, updated_at) VALUES (?, ?, ?) "
            "ON CONFLICT(gate_id) DO UPDATE SET state=excluded.state, updated_at=excluded.updated_at",
            (payload.gate_id, payload.state, time.time())
        )
        conn.commit()
    return {"ok": True, "gate_id": payload.gate_id, "state": payload.state}


@app.post("/api/wargame/reset")
def reset_gate_states():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("DELETE FROM gate_states")
        conn.commit()
    return {"ok": True}


@app.get("/api/sovereign/sites")
def get_sovereign_sites():
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM sovereign_sites ORDER BY created_at ASC").fetchall()
    return {
        "sites": [
            {
                "id": r["id"],
                "name": r["name"],
                "host": r["host"],
                "lat": r["lat"],
                "lng": r["lng"],
                "streamUrl": r["stream_url"] or "",
                "notes": r["notes"] or ""
            }
            for r in rows
        ]
    }


@app.post("/api/sovereign/sites")
def add_sovereign_site(payload: SovereignSitePayload):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "INSERT OR REPLACE INTO sovereign_sites (id, name, host, lat, lng, stream_url, notes, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (payload.id, payload.name, payload.host, payload.lat, payload.lng, payload.streamUrl, payload.notes, time.time())
        )
        conn.commit()
    return {"ok": True, "site": payload.dict()}


@app.post("/api/osint/feeds")
def add_custom_rss_feed(payload: CustomFeedPayload):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "INSERT INTO custom_rss_feeds (source_name, url, default_lat, default_lng) VALUES (?, ?, ?, ?)",
            (payload.source_name, payload.url, payload.default_lat, payload.default_lng)
        )
        conn.commit()
    return {"ok": True}


@app.get("/api/osint/live")
def get_live_osint(force: bool = False):
    now = time.time()
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM osint_cache ORDER BY id ASC").fetchall()

        if rows and not force and (now - rows[0]["fetched_at"] < OSINT_TTL_SECONDS):
            return {"cached": True, "count": len(rows), "events": [dict(r) for r in rows]}

        fresh_events = fetch_live_rss_events()
        if fresh_events:
            conn.execute("DELETE FROM osint_cache")
            for ev in fresh_events:
                conn.execute(
                    "INSERT INTO osint_cache (source, title, link, theater, gate, lat, lng, fetched_at) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    (ev["source"], ev["title"], ev["link"], ev["theater"], ev["gate"], ev["lat"], ev["lng"], ev["fetched_at"])
                )
            conn.commit()
            return {"cached": False, "count": len(fresh_events), "events": fresh_events}

        return {"cached": True, "count": len(rows), "events": [dict(r) for r in rows]}


@app.get("/api/sol/geo")
def get_sol_geo():
    """Newest Sol GeoJSON export (schema sol-geo-*), served as-is. StratCom never reads sol.db."""
    files = sorted(SOL_GEO_DIR.glob("sol_geo_*.geojson"), key=lambda p: p.stat().st_mtime) if SOL_GEO_DIR.is_dir() else []
    fix = "run Sol's scripts/export_geojson.py, or set SOL_GEO_DIR to the folder holding sol_geo_*.geojson"
    if not files:
        return JSONResponse(status_code=404, content={"error": "no Sol GeoJSON export found",
                                                      "looked_in": str(SOL_GEO_DIR), "fix": fix})
    try:
        data = json.loads(files[-1].read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        return JSONResponse(status_code=422, content={"error": f"{files[-1].name} is unreadable: {e}", "fix": fix})
    if not str(data.get("schema", "")).startswith("sol-geo-"):
        return JSONResponse(status_code=422, content={"error": f"{files[-1].name} is not a Sol export (schema sol-geo-*)",
                                                      "fix": fix})
    data["served_from"] = files[-1].name
    return data


@app.middleware("http")
async def no_stale_frontend(request, call_next):
    response = await call_next(request)
    if not request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-cache"
    return response


@app.get("/", include_in_schema=False)
def serve_index():
    return FileResponse(BASE_DIR / "index.html")


for _folder in ("css", "js", "data"):
    app.mount(f"/{_folder}", StaticFiles(directory=str(BASE_DIR / _folder)), name=_folder)


HOST = "0.0.0.0"


def get_lan_ip() -> str:
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        try:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
        except Exception:
            return "127.0.0.1"


if __name__ == "__main__":
    lan_ip = get_lan_ip()
    print("\n" + "=" * 66)
    print(" STRATCOM v4.5 // FASTAPI + SQLITE GEOPOLITICAL COMMAND ONLINE")
    print(f" -> Desktop Terminal : http://localhost:{PORT}")
    print(f" -> Mobile Wi-Fi HUD : http://{lan_ip}:{PORT}")
    print(f" -> Live OSINT JSON  : http://localhost:{PORT}/api/osint/live")
    print(f" -> Sol GeoJSON from : {SOL_GEO_DIR}")
    print(f" -> Sol nowcast      : {SOL_ROOT / 'reports' / 'nowcast'} (refreshed when > 6 h old)")
    print(f" -> Live AIS         : {AIS_FEED.status}" + (f" ({AIS_FEED.error})" if AIS_FEED.error else "")
          + ("  [set AISSTREAM_API_KEY or create aisstream.key to enable]" if AIS_FEED.status == "no_key" else ""))
    print("=" * 66 + "\n")
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        if probe.connect_ex(("127.0.0.1", PORT)) == 0:
            sys.exit(f"\nPort {PORT} is already in use (probably an earlier STRATCOM window).\n"
                     f"Close it with Ctrl+C, or in PowerShell run:\n"
                     f"  Stop-Process -Id (Get-NetTCPConnection -LocalPort {PORT} -State Listen).OwningProcess -Force\n")
    uvicorn.run(app, host=HOST, port=PORT, log_level="warning")
