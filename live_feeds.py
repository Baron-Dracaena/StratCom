# ============================================================================
# STRATCOM v4.5 // LIVE FEEDS: GDELT EVENTS, AIS SHIPS, SOL SOILING NOWCAST
# ============================================================================
# Everything here runs on YOUR machine (the browser never talks to these services):
#   GDELT 2.0      geocoded conflict/protest events from the 15-min event exports
#   aisstream.io   live AIS positions over websocket; needs a free key in the
#                  AISSTREAM_API_KEY environment variable or in a file aisstream.key
#                  next to launch.py (keep it out of any repo)
#   Sol nowcast    serves Sol's newest reports/nowcast/*.json and asks Sol to
#                  recompute it when it is older than 6 h. Sol does the physics;
#                  StratCom only runs Sol's own script.
# Each feed reports its own status, so a feed that is down shows as down and the
# rest keep working.
# ============================================================================

# ----------------------------------------------------------------------------
# 1. IMPORTS & SETTINGS
# ----------------------------------------------------------------------------
import asyncio
import json
import os
import re
import sqlite3
import subprocess
import sys
import threading
import time
import urllib.parse
import urllib.request
from pathlib import Path

GDELT_TTL_S = 15 * 60

AIS_URL = "wss://stream.aisstream.io/v0/stream"
AIS_MAX_AGE_S = 30 * 60
AIS_MAX_VESSELS = 6000
AIS_BOXES = {       # [[lat, lon], [lat, lon]] corners, aisstream order
    "Suez / Red Sea / Bab el-Mandeb": [[10.0, 32.0], [31.5, 45.0]],
    "Gulf of Aden": [[10.0, 43.0], [16.0, 52.0]],
    "Hormuz / Gulf": [[23.0, 50.0], [28.0, 59.0]],
    "Malacca / Singapore": [[-1.5, 95.0], [7.5, 105.0]],
    "Taiwan Strait": [[21.5, 117.0], [26.5, 122.0]],
    "Gibraltar": [[34.5, -7.5], [37.5, -4.0]],
    "Bosphorus / Dardanelles": [[39.8, 25.8], [41.6, 29.8]],
    "Danish Straits": [[54.3, 9.5], [58.0, 13.0]],
    "Panama": [[7.5, -81.0], [10.0, -78.5]],
    "Gulf of Guinea / West Africa": [[-2.0, -18.5], [15.5, 10.0]],
}
NOWCAST_MAX_AGE_S = 6 * 3600
NOWCAST_TIMEOUT_S = 15 * 60


# ----------------------------------------------------------------------------
# 2. GDELT 2.0 EVENT FILES (geocoded events, every 15 min)
#    19 Oct 2026: the GEO 2.0 API returns 404 (retired), so this reads GDELT's raw
#    event exports instead: one zipped TSV per 15 min, 61 columns, each event with
#    a CAMEO code and an ActionGeo latitude/longitude. Kept: CAMEO roots 14 (protest),
#    17 (coerce), 18 (assault), 19 (fight), 20 (mass violence), geocoded to a city/ADM1
#    (not a country centroid), reported by >= 2 sources. Rolling 24 h in stratcom.db.
# ----------------------------------------------------------------------------
GDELT_ROOT_LABEL = {"14": "PROTEST", "17": "COERCION", "18": "ASSAULT", "19": "FIGHT", "20": "MASS VIOLENCE"}
GDELT_MIN_SOURCES = 2
GDELT_BACKFILL = 96          # 15-min files on first start (24 h)
GDELT_KEEP_S = 24 * 3600


def gdelt_rows(tsv_text):
    """Event TSV -> [event dict] for the kept categories. Skips malformed rows."""
    out = []
    for line in tsv_text.splitlines():
        c = line.split("\t")
        if len(c) != 61:
            continue
        label = GDELT_ROOT_LABEL.get(c[28])
        if not label or c[51] not in ("3", "4", "5"):
            continue
        try:
            lat, lng, nsrc = float(c[56]), float(c[57]), int(c[32] or 0)
        except ValueError:
            continue
        if nsrc < GDELT_MIN_SOURCES or not (-90 <= lat <= 90 and -180 <= lng <= 180):
            continue
        out.append({"id": c[0], "label": label, "code": c[26], "lat": lat, "lng": lng,
                    "name": c[52][:120], "cc": c[53], "mentions": int(c[31] or 0), "sources": nsrc,
                    "tone": float(c[34] or 0), "added": c[59], "url": c[60][:400]})
    return out


def gdelt_points(events):
    """Group events by place and category -> map points (same shape the frontend draws)."""
    groups = {}
    for e in events:
        k = (round(e["lat"], 2), round(e["lng"], 2), e["label"])
        g = groups.setdefault(k, {"lat": k[0], "lng": k[1], "label": e["label"], "name": e["name"],
                                  "count": 0, "mentions": 0, "articles": [], "_urls": set()})
        g["count"] += 1
        g["mentions"] += e["mentions"]
        if e["url"].startswith("http") and e["url"] not in g["_urls"] and len(g["articles"]) < 5:
            g["_urls"].add(e["url"])
            host = urllib.parse.urlparse(e["url"]).netloc.replace("www.", "")
            g["articles"].append({"title": f"{host} ({e['added'][:4]}-{e['added'][4:6]}-{e['added'][6:8]} "
                                           f"{e['added'][8:10]}:{e['added'][10:12]} UTC)", "url": e["url"]})
    pts = sorted(groups.values(), key=lambda g: -g["mentions"])[:1200]
    for g in pts:
        g.pop("_urls")
    return pts


class Gdelt:
    INDEX = "http://data.gdeltproject.org/gdeltv2/lastupdate.txt"
    FILE = "http://data.gdeltproject.org/gdeltv2/{stamp}.export.CSV.zip"

    def __init__(self, db_path):
        self.db_path = db_path
        self.lock = threading.Lock()
        self.busy = False
        self.error = None
        self.last_poll = 0
        with sqlite3.connect(db_path) as c:
            c.execute("CREATE TABLE IF NOT EXISTS gdelt_files (stamp TEXT PRIMARY KEY, fetched_at REAL, n INTEGER)")
            c.execute("CREATE TABLE IF NOT EXISTS gdelt_events (id TEXT PRIMARY KEY, stamp TEXT, payload TEXT)")

    @staticmethod
    def _get(url, timeout=40):
        req = urllib.request.Request(url, headers={"User-Agent": "STRATCOM-GeoOSINT/4.5"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read()

    def _ingest(self, stamp):
        import io
        import zipfile
        raw = self._get(self.FILE.format(stamp=stamp))
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            text = z.read(z.namelist()[0]).decode("utf-8", "replace")
        rows = gdelt_rows(text)
        with sqlite3.connect(self.db_path) as c:
            c.executemany("INSERT OR REPLACE INTO gdelt_events VALUES (?,?,?)",
                          [(r["id"], stamp, json.dumps(r)) for r in rows])
            c.execute("INSERT OR REPLACE INTO gdelt_files VALUES (?,?,?)", (stamp, time.time(), len(rows)))

    def _refresh(self):
        from datetime import datetime, timedelta, timezone
        try:
            idx = self._get(self.INDEX, timeout=20).decode("utf-8", "replace")
            m = re.search(r"/(\d{14})\.export\.CSV\.zip", idx)
            if not m:
                raise RuntimeError(f"unexpected lastupdate.txt: {idx[:120]!r}")
            latest = datetime.strptime(m.group(1), "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)
            with sqlite3.connect(self.db_path) as c:
                have = {r[0] for r in c.execute("SELECT stamp FROM gdelt_files")}
            want = [(latest - timedelta(minutes=15 * k)).strftime("%Y%m%d%H%M%S") for k in range(GDELT_BACKFILL)]
            missing = [s for s in want if s not in have]
            errs = 0
            for stamp in missing:                  # newest first, so the map fills from now backwards
                try:
                    self._ingest(stamp)
                except Exception as e:             # noqa: BLE001 - an occasional file is missing upstream
                    errs += 1
                    last_err = e
                time.sleep(0.2)
            if missing and errs == len(missing):
                raise RuntimeError(f"all {errs} event files failed; last: {last_err}")
            cutoff = (latest - timedelta(seconds=GDELT_KEEP_S)).strftime("%Y%m%d%H%M%S")
            with sqlite3.connect(self.db_path) as c:
                c.execute("DELETE FROM gdelt_events WHERE stamp < ?", (cutoff,))
                c.execute("DELETE FROM gdelt_files WHERE stamp < ?", (cutoff,))
            self.error = f"{errs} of {len(missing)} event files unavailable" if errs else None
        except Exception as e:      # noqa: BLE001 - reported to the UI, never fatal
            self.error = f"{e.__class__.__name__}: {e}"[:300]
        finally:
            self.busy = False

    def snapshot(self, force=False):
        now = time.time()
        with self.lock:
            if (force or now - self.last_poll > GDELT_TTL_S) and not self.busy:
                self.busy, self.last_poll = True, now
                threading.Thread(target=self._refresh, daemon=True).start()
        with sqlite3.connect(self.db_path) as c:
            events = [json.loads(r[0]) for r in c.execute("SELECT payload FROM gdelt_events")]
            files = c.execute("SELECT COUNT(*), MAX(fetched_at), MAX(stamp) FROM gdelt_files").fetchone()
        pts = gdelt_points(events)
        status = "refreshing" if self.busy else ("error" if self.error and not events else "ok")
        return {"status": status, "error": self.error, "fetched_at": files[1], "latest_file": files[2],
                "files": files[0], "timespan": "24h", "events": len(events),
                "source": "GDELT 2.0 Event Database, 15-minute exports (machine-coded and geocoded "
                          "from news; expect mis-geocodes and duplicates)",
                "count": len(pts), "points": pts}


# ----------------------------------------------------------------------------
# 3. AISSTREAM (live AIS over websocket, background thread)
# ----------------------------------------------------------------------------
def ais_key(base_dir):
    k = os.environ.get("AISSTREAM_API_KEY", "").strip()
    f = Path(base_dir) / "aisstream.key"
    if not k and f.exists():
        k = f.read_text(encoding="utf-8").strip()
    return k or None


def parse_ais(msg):
    """aisstream PositionReport -> vessel dict, or None."""
    if msg.get("MessageType") != "PositionReport":
        return None
    md = msg.get("MetaData") or {}
    pr = (msg.get("Message") or {}).get("PositionReport") or {}
    lat = md.get("Latitude", md.get("latitude", pr.get("Latitude")))
    lng = md.get("Longitude", md.get("longitude", pr.get("Longitude")))
    mmsi = md.get("MMSI", pr.get("UserID"))
    if lat is None or lng is None or mmsi is None or not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return None
    hdg = pr.get("TrueHeading")
    return {"mmsi": int(mmsi), "name": (md.get("ShipName") or "").strip()[:40],
            "lat": round(lat, 4), "lng": round(lng, 4), "sog": pr.get("Sog"), "cog": pr.get("Cog"),
            "hdg": None if hdg in (None, 511) else hdg, "nav": pr.get("NavigationalStatus"),
            "t": time.time()}


class Ais:
    def __init__(self, base_dir):
        self.key = ais_key(base_dir)
        self.vessels = {}
        self.lock = threading.Lock()
        self.connected = False
        self.error = None
        self.msgs = 0
        self.since = None
        if not self.key:
            self.status = "no_key"
            return
        try:
            import websockets  # noqa: F401
        except ImportError:
            self.status = "missing_package"
            self.error = "pip install websockets"
            return
        self.status = "starting"
        threading.Thread(target=lambda: asyncio.run(self._run()), daemon=True).start()

    async def _run(self):
        import websockets
        backoff = 5
        while True:
            try:
                async with websockets.connect(AIS_URL, open_timeout=20, ping_interval=30,
                                              max_size=2 ** 20) as ws:
                    await ws.send(json.dumps({"APIKey": self.key, "BoundingBoxes": list(AIS_BOXES.values()),
                                              "FilterMessageTypes": ["PositionReport"]}))
                    self.connected, self.status, self.error, backoff = True, "live", None, 5
                    self.since = self.since or time.time()
                    async for raw in ws:
                        msg = json.loads(raw.decode("utf-8") if isinstance(raw, bytes) else raw)
                        if "error" in msg:
                            raise RuntimeError(msg["error"])
                        v = parse_ais(msg)
                        if v:
                            with self.lock:
                                self.vessels[v["mmsi"]] = v
                                self.msgs += 1
            except Exception as e:   # noqa: BLE001 - reconnect with backoff, report the reason
                self.connected, self.status = False, "reconnecting"
                self.error = f"{e.__class__.__name__}: {e}"[:300]
                if "api key" in str(e).lower() or "unauthor" in str(e).lower():
                    self.status = "bad_key"
                    return
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 300)

    def snapshot(self, bbox=None, limit=3000):
        now = time.time()
        with self.lock:
            for k in [k for k, v in self.vessels.items() if now - v["t"] > AIS_MAX_AGE_S]:
                del self.vessels[k]
            if len(self.vessels) > AIS_MAX_VESSELS:
                for k in sorted(self.vessels, key=lambda k: self.vessels[k]["t"])[:len(self.vessels) - AIS_MAX_VESSELS]:
                    del self.vessels[k]
            vs = list(self.vessels.values())
        if bbox:
            s, w, n, e = bbox
            vs = [v for v in vs if s <= v["lat"] <= n and (w <= v["lng"] <= e if w <= e else v["lng"] >= w or v["lng"] <= e)]
        vs.sort(key=lambda v: -v["t"])
        return {"status": self.status, "connected": self.connected, "error": self.error,
                "tracked": len(self.vessels), "returned": min(len(vs), limit), "messages": self.msgs,
                "since": self.since, "boxes": AIS_BOXES,
                "source": "aisstream.io (terrestrial AIS; coverage depends on shore receivers)",
                "vessels": [{**v, "age_s": round(now - v["t"])} for v in vs[:limit]]}


# ----------------------------------------------------------------------------
# 4. SOL SOILING NOWCAST (Sol computes; StratCom serves and refreshes)
# ----------------------------------------------------------------------------
class Nowcast:
    def __init__(self, sol_root):
        self.sol_root = Path(sol_root)
        self.dir = self.sol_root / "reports" / "nowcast"
        self.proc = None
        self.started = None
        self.error = None
        self.autorun = os.environ.get("SOL_NOWCAST_AUTORUN", "1") != "0"

    def _python(self):
        for p in (self.sol_root / ".venv" / "Scripts" / "python.exe", self.sol_root / ".venv" / "bin" / "python"):
            if p.exists():
                return str(p)
        return sys.executable

    def _kick(self):
        script = self.sol_root / "scripts" / "nowcast.py"
        if not script.exists():
            self.error = f"{script} not found"
            return
        log = open(self.dir / "nowcast_last_run.log", "w", encoding="utf-8")
        self.proc = subprocess.Popen([self._python(), str(script)], cwd=str(self.sol_root),
                                     stdout=log, stderr=subprocess.STDOUT)
        self.started = time.time()

    def snapshot(self, force=False):
        self.dir.mkdir(parents=True, exist_ok=True)
        running = self.proc is not None and self.proc.poll() is None
        if self.proc is not None and not running and self.proc.returncode not in (0, None):
            self.error = f"Sol nowcast exited {self.proc.returncode}; see {self.dir / 'nowcast_last_run.log'}"
        if running and time.time() - self.started > NOWCAST_TIMEOUT_S:
            self.proc.kill()
            self.error, running = "Sol nowcast timed out", False
        files = sorted(self.dir.glob("nowcast_2*.json"), key=lambda p: p.stat().st_mtime)
        age = time.time() - files[-1].stat().st_mtime if files else None
        if (force or (self.autorun and (age is None or age > NOWCAST_MAX_AGE_S))) and not running:
            self.error = None
            self._kick()
            running = True
        if not files:
            return {"status": "refreshing" if running else "none", "error": self.error,
                    "looked_in": str(self.dir), "sites": []}
        data = json.loads(files[-1].read_text(encoding="utf-8"))
        data.update({"status": "refreshing" if running else "ok", "error": self.error,
                     "served_from": files[-1].name, "age_s": round(age)})
        return data


# ----------------------------------------------------------------------------
# 5. ROUTES
# ----------------------------------------------------------------------------
def register(app, db_path, base_dir, sol_root):
    gdelt, ais, now = Gdelt(db_path), Ais(base_dir), Nowcast(sol_root)

    @app.get("/api/gdelt/live")
    def gdelt_live(force: bool = False):
        return gdelt.snapshot(force)

    @app.get("/api/ais/live")
    def ais_live(s: float = None, w: float = None, n: float = None, e: float = None, limit: int = 3000):
        bbox = (s, w, n, e) if None not in (s, w, n, e) else None
        return ais.snapshot(bbox, max(1, min(limit, 6000)))

    @app.get("/api/sol/nowcast")
    def sol_nowcast(force: bool = False):
        return now.snapshot(force)

    @app.get("/api/live/status")
    def live_status():
        g = gdelt.snapshot()
        return {"gdelt": {k: g[k] for k in ("status", "error", "fetched_at", "count")},
                "ais": {k: v for k, v in ais.snapshot(limit=1).items() if k not in ("vessels", "boxes")},
                "nowcast": {k: v for k, v in now.snapshot().items() if k in ("status", "error", "served_from", "age_s")}}

    return gdelt, ais, now
