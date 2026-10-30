# ============================================================================
# STRATCOM // SEA-LANE GEOMETRY BUILDER
#    Routes every maritime edge in data/intel-store.js through a real
#    maritime network (searoute, built on the Eurostat MARNET shipping-lane
#    graph) and writes data/sea-lanes.js: true sailing distance + a
#    coast-following polyline for each edge.
#
#    Run after adding or moving nodes/edges:
#        pip install searoute
#        python tools/build_sea_lanes.py
# ============================================================================

# ----------------------------------------------------------------------------
# 1. IMPORTS & PATHS
# ----------------------------------------------------------------------------
import datetime
import math
import re
import sys
from pathlib import Path

try:
    import searoute as sr
except ImportError:
    sys.exit("searoute is not installed. Run:  pip install searoute")

ROOT = Path(__file__).resolve().parent.parent
STORE = ROOT / "data" / "intel-store.js"
OUT = ROOT / "data" / "sea-lanes.js"

# ----------------------------------------------------------------------------
# 2. GATE -> SEAROUTE PASSAGE MAP
#    A sea lane may only pass through the chokepoint it is tagged with.
#    Every other gated passage is forbidden for it, so e.g. the Colombo ->
#    Sunda lane can never quietly cut through Malacca. Arctic routes are
#    always forbidden. The Taiwan Strait and the Danish Straits have no
#    searoute passage, so they are checked geometrically (GEO_GATES, §4).
# ----------------------------------------------------------------------------
GATE_PASSAGES = {
    "bab_el_mandeb": ["babalmandab", "suez"],
    "hormuz": ["ormuz"],
    "malacca": ["malacca"],
    "turkish_straits": ["bosporus"],
    "panama": ["panama"],
    "taiwan_strait": [],
    "danish_straits": [],
    "black_sea_war": [],    # zone gates: no single passage to test
    "odesa_corridor": [],
}
ALWAYS_FORBIDDEN = ["northwest", "bering"]
ALL_GATED = sorted({p for ps in GATE_PASSAGES.values() for p in ps})

# Per-edge extra allowances: searoute files the Dardanelles under
# 'bosporus', but in STRATCOM only the Bosphorus itself is gated.
EDGE_ALLOW = {
    ("N_GREECE", "N_TR_IST"): ["bosporus"],
    ("N_GR_THESS", "N_TR_IST"): ["bosporus"],
}

# Gated legs that lie INSIDE a threatened zone rather than crossing
# searoute's passage marker (the Red Sea leg, the inner Gulf leg).
GATED_ZONE_LEGS = {("N_SAUDI", "N_BAB"), ("N_IL_EILAT", "N_BAB"), ("N_SD_PORTSUDAN", "N_BAB"), ("N_SD_PORTSUDAN", "N_SAUDI"), ("N_MY_KLANG", "N_MALACCA"), ("N_MALACCA_NW", "N_MY_KLANG")}

# Short open-water coastal hops where MARNET has no inshore lane and
# searoute zig-zags out to the offshore trunk and back (Ilo -> Arica came
# out 238 NM for a ~85 NM run). Drawn straight at 1.05x great-circle.
DIRECT_LEGS = {("N_PE_ILO", "N_CL_ARICA")}

# Geometric gates: lat_min, lat_max, lng_min, lng_max. A lane gated X must
# pass through X's box; every other lane must stay out of it.
GEO_GATES = {
    "taiwan_strait": (23.4, 25.4, 118.4, 120.2),   # strait core, north of Kaohsiung's approaches
    "danish_straits": (54.3, 55.95, 9.5, 13.0),    # Øresund, Great & Little Belt, Fehmarn
}


# ----------------------------------------------------------------------------
# 3. PARSE NODES & EDGES FROM intel-store.js
# ----------------------------------------------------------------------------
def parse_store(text):
    nodes, offshore = {}, {}
    for m in re.finditer(r"(N_[A-Z0-9_]+):\s*\{\s*lat:\s*(-?[\d.]+),\s*lng:\s*(-?[\d.]+)([^\n]*)", text):
        nodes[m.group(1)] = (float(m.group(2)), float(m.group(3)))
        off = re.search(r"offshore:\s*\[\s*(-?[\d.]+),\s*(-?[\d.]+)\s*\]", m.group(4))
        if off:
            offshore[m.group(1)] = (float(off.group(1)), float(off.group(2)))
    raw = []
    for m in re.finditer(
        r"\[\s*'(N_[A-Z0-9_]+)',\s*'(N_[A-Z0-9_]+)',\s*'(maritime|land)',\s*(null|'[a-z_]+'),\s*([\d.]+)\s*\]", text
    ):
        gate = None if m.group(4) == "null" else m.group(4).strip("'")
        raw.append((m.group(1), m.group(2), m.group(3), gate))

    # Mirror of intel-store.js §3K: harbours with `offshore` get an <ID>_WP
    # node; sea edges attach to it; one approach edge links harbour and WP.
    for hid, (lat, lng) in offshore.items():
        nodes[f"{hid}_WP"] = (lat, lng)
    wp = lambda n: f"{n}_WP" if n in offshore else n
    edges = [(wp(a), wp(b), mode, gate) if mode == "maritime" else (a, b, mode, gate) for a, b, mode, gate in raw]
    edges += [(hid, f"{hid}_WP", "maritime", None) for hid in offshore]
    return nodes, edges


# ----------------------------------------------------------------------------
# 4. ROUTE ONE EDGE + VALIDATE
# ----------------------------------------------------------------------------
def in_box(coords, box):
    la0, la1, lo0, lo1 = box
    return any(la0 <= lat <= la1 and lo0 <= lng <= lo1 for lng, lat in coords)


def straight_nm(p, q):
    (la1, lo1), (la2, lo2) = [(math.radians(x), math.radians(y)) for x, y in (p, q)]
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 3440.065 * math.asin(min(1, math.sqrt(h)))


def route_edge(a, b, nodes, gate):
    # Harbour approach (port -> its own offshore point): ships steam straight
    # out. Where MARNET is sparse (Pacific South America) searoute snaps both
    # ends to distant network nodes and detours, so if its path is clearly
    # longer than the direct run-out, use the direct line instead.
    if b == f"{a}_WP":
        direct = straight_nm(nodes[a], nodes[b])
        feat = sr.searoute(nodes[a][::-1], nodes[b][::-1], units="naut", append_orig_dest=True)
        nm = feat.properties.get("length", float("inf"))
        if nm > 1.5 * direct + 10 or nm < 0.5 * direct:   # detour, or both ends snapped to one node (0 NM)
            (la1, lo1), (la2, lo2) = nodes[a], nodes[b]
            return direct, [[lo1, la1], [lo2, la2]], ["direct approach"], []
        return nm, feat.geometry["coordinates"], [], []

    base = lambda n: n[:-3] if n.endswith("_WP") else n
    if (base(a), base(b)) in DIRECT_LEGS or (base(b), base(a)) in DIRECT_LEGS:
        (la1, lo1), (la2, lo2) = nodes[a], nodes[b]
        return straight_nm(nodes[a], nodes[b]) * 1.05, [[lo1, la1], [lo2, la2]], ["direct coastal"], []

    own = GATE_PASSAGES.get(gate, []) if gate else []
    allow = set(own) | set(EDGE_ALLOW.get((a, b), []) + EDGE_ALLOW.get((b, a), []))
    restrictions = ALWAYS_FORBIDDEN + [p for p in ALL_GATED if p not in allow]

    (lat1, lng1), (lat2, lng2) = nodes[a], nodes[b]
    feat = sr.searoute([lng1, lat1], [lng2, lat2], units="naut",
                       append_orig_dest=True, restrictions=restrictions, return_passages=True)
    nm = feat.properties.get("length", float("inf"))
    coords = feat.geometry["coordinates"]
    passages = set(feat.properties.get("traversed_passages") or [])

    problems = []
    if not coords or nm == float("inf") or len(coords) <= 2:
        # searoute falls back to a bare straight line when a node snaps onto
        # a forbidden passage; move the node a few NM off the passage
        problems.append("NO PATH with these restrictions (straight-line fallback)")
    zone_leg = (base(a), base(b)) in GATED_ZONE_LEGS or (base(b), base(a)) in GATED_ZONE_LEGS
    if gate and own and not zone_leg and not (passages & set(own)):
        problems.append(f"gated '{gate}' but does not traverse {own}")
    for g, box in GEO_GATES.items():
        if gate == g and not in_box(coords, box):
            problems.append(f"gated {g} but path misses it")
        if gate != g and in_box(coords, box):
            problems.append(f"passes through {g} without the gate")
    return nm, coords, sorted(passages), problems


# ----------------------------------------------------------------------------
# 5. BUILD, REPORT & WRITE data/sea-lanes.js
# ----------------------------------------------------------------------------
def main():
    nodes, edges = parse_store(STORE.read_text(encoding="utf-8"))
    sea = [e for e in edges if e[2] == "maritime"]
    print(f"Parsed {len(nodes)} nodes, {len(edges)} edges ({len(sea)} maritime)")

    lanes, failures = {}, 0
    for a, b, _, gate in sea:
        nm, coords, passages, problems = route_edge(a, b, nodes, gate)
        tag = f" [{gate}]" if gate else ""
        print(f"  {a:>14} -> {b:<14} {nm:8.0f} NM{tag}  {','.join(passages)}")
        for p in problems:
            failures += 1
            print(f"      !! {p}")
        pts, last = [], None
        for lng, lat in coords:
            lng = ((lng + 180) % 360 + 360) % 360 - 180  # searoute emits lng > 180 on Pacific crossings
            pt = [round(lat, 2), round(lng, 2)]
            if pt != last:
                pts.append(pt)
                last = pt
        lanes[f"{a}|{b}"] = {"nm": round(nm), "pts": pts}

    stamp = datetime.date.today().isoformat()
    def fmt_pts(pts):
        return "[" + ",".join(f"[{lat},{lng}]" for lat, lng in pts) + "]"

    body = ",\n".join(f"  '{k}': {{ nm: {v['nm']}, pts: {fmt_pts(v['pts'])} }}" for k, v in lanes.items())
    OUT.write_text(
        "// ============================================================================\n"
        "// GENERATED by tools/build_sea_lanes.py — do not edit by hand.\n"
        f"// {stamp} · {len(lanes)} sea lanes · geometry: searoute (Eurostat MARNET)\n"
        "// Key 'A|B' matches the edge order in intel-store.js; pts are [lat, lng].\n"
        "// ============================================================================\n"
        f"export const SEA_LANES_META = {{ generated: '{stamp}', source: 'searoute / Eurostat MARNET', count: {len(lanes)} }};\n\n"
        "export const SEA_LANES = {\n" + body + "\n};\n",
        encoding="utf-8",
    )
    print(f"\nWrote {OUT.relative_to(ROOT)} ({len(lanes)} lanes, {failures} problem(s))")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
