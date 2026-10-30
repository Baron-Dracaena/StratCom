# ============================================================================
# STRATCOM // NATION MACRO BUILDER (World Bank WDI)
#    Pulls the latest available value + year for each indicator, for every
#    nation in data/nations.js, and writes data/nations-macro.json.
#    The app merges that file at startup; every figure shows its source year.
#
#    No API key, standard library only:
#        python tools/build_nations.py
#    Re-run whenever you add nations or want fresher numbers.
# ============================================================================

# ----------------------------------------------------------------------------
# 1. IMPORTS, PATHS & INDICATORS
# ----------------------------------------------------------------------------
import datetime
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NATIONS_JS = ROOT / "data" / "nations.js"
OUT = ROOT / "data" / "nations-macro.json"
API = "https://api.worldbank.org/v2/country/{codes}/indicator/{ind}?format=json&mrnev=1&per_page=500"

# field name in the app : (WDI indicator code, divisor, decimals, label)
# Decimals are generous on purpose: Cabo Verde's GDP is ~0.003 trillion, so
# 2 decimals rounded small economies to zero (fixed in v3.6.1).
INDICATORS = {
    "gdpNominal":   ("NY.GDP.MKTP.CD",    1e12, 5, "GDP, current US$ (trillions)"),
    "gdpPPP":       ("NY.GDP.MKTP.PP.CD", 1e12, 5, "GDP, PPP current intl $ (trillions)"),
    "growth":       ("NY.GDP.MKTP.KD.ZG", 1,    1, "Real GDP growth (annual %)"),
    "milBudget":    ("MS.MIL.XPND.CD",    1e9,  3, "Military expenditure, current US$ (billions)"),
    "activeForces": ("MS.MIL.TOTL.P1",    1,    0, "Armed forces personnel, total"),
    "population":   ("SP.POP.TOTL",       1e6,  3, "Population (millions)"),
}

# Economies the World Bank does not publish (the app keeps hand-entered figures)
NO_WB_COVERAGE = {"TWN"}


# ----------------------------------------------------------------------------
# 2. READ ISO3 CODES FROM data/nations.js
# ----------------------------------------------------------------------------
def read_iso3():
    text = NATIONS_JS.read_text(encoding="utf-8")
    codes = re.findall(r"iso3:\s*'([A-Z]{3})'", text)
    if not codes:
        sys.exit("No iso3 codes found in data/nations.js")
    return sorted(set(codes))


# ----------------------------------------------------------------------------
# 3. FETCH ONE INDICATOR FOR ALL COUNTRIES (handles paging + retries)
# ----------------------------------------------------------------------------
def fetch_json(url, tries=3):
    req = urllib.request.Request(url, headers={"User-Agent": "STRATCOM-GeoOSINT/3.5 (nation builder)"})
    for attempt in range(1, tries + 1):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as exc:
            if attempt == tries:
                raise
            print(f"    retry {attempt}/{tries - 1} after error: {exc}")
            time.sleep(2 * attempt)


def fetch_indicator(indicator, codes):
    """Returns {ISO3: (value, year)} for the most recent non-empty value."""
    out, page, pages = {}, 1, 1
    while page <= pages:
        url = API.format(codes=";".join(codes), ind=indicator) + f"&page={page}"
        data = fetch_json(url)
        if not isinstance(data, list) or len(data) < 2 or data[1] is None:
            msg = data[0].get("message") if isinstance(data, list) and data and isinstance(data[0], dict) else data
            raise RuntimeError(f"World Bank returned no data for {indicator}: {msg}")
        pages = int(data[0].get("pages", 1))
        for row in data[1]:
            iso3, value = row.get("countryiso3code"), row.get("value")
            if iso3 and value is not None:
                out[iso3] = (value, int(row["date"]))
        page += 1
    return out


# ----------------------------------------------------------------------------
# 4. BUILD, REPORT & WRITE data/nations-macro.json
# ----------------------------------------------------------------------------
def main():
    codes = [c for c in read_iso3() if c not in NO_WB_COVERAGE]
    print(f"Fetching {len(INDICATORS)} indicators for {len(codes)} nations from the World Bank...")

    nations = {c: {} for c in codes}
    for field, (ind, div, dec, label) in INDICATORS.items():
        print(f"  {ind:<20} {label}")
        for iso3, (value, year) in fetch_indicator(ind, codes).items():
            if iso3 in nations:
                v = round(value / div, dec)
                nations[iso3][field] = {"value": int(v) if dec == 0 else v, "year": year}

    missing = {c: [f for f in INDICATORS if f not in nations[c]] for c in codes}
    missing = {c: m for c, m in missing.items() if m}
    payload = {
        "generated": datetime.date.today().isoformat(),
        "source": "World Bank World Development Indicators (api.worldbank.org/v2)",
        "indicators": {f: {"code": i[0], "label": i[3]} for f, i in INDICATORS.items()},
        "notCovered": sorted(NO_WB_COVERAGE),
        "nations": nations,
    }
    OUT.write_text(json.dumps(payload, indent=1), encoding="utf-8")

    print(f"\nWrote {OUT.relative_to(ROOT)} for {len(nations)} nations.")
    if missing:
        print("Gaps (the app falls back to hand-entered figures or shows '—'):")
        for c, m in sorted(missing.items()):
            print(f"  {c}: {', '.join(m)}")


if __name__ == "__main__":
    main()
