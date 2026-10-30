// ============================================================================
// LAYER 4A: KEYLESS WORLD BANK OPEN DATA CLIENT & SVG SPARKLINE ENGINE
// ============================================================================

// ----------------------------------------------------------------------------
// 1. CACHE, INDICATORS & COVERAGE GAPS
// ----------------------------------------------------------------------------
export const MODULE_BUILD = '4.3.0';
const wbCache = new Map();

const INDICATORS = {
  gdp: 'NY.GDP.MKTP.CD',      // GDP (current US$)
  growth: 'NY.GDP.MKTP.KD.ZG',// GDP growth (annual %)
  trade: 'NE.TRD.GNFS.ZS'     // Trade (% of GDP)
};

// Economies the World Bank does not publish. Callers get a structured
// "no coverage" result instead of another country's data.
export const NO_WB_COVERAGE = new Set(['TWN']);

// ----------------------------------------------------------------------------
// 2. FETCH MULTI-YEAR GDP SERIES
//    Returns { source, series, lastYear } on success,
//    { unavailable: 'no-coverage' | 'offline' } otherwise. Failures are cached
//    too so an offline session doesn't refetch on every dossier click.
// ----------------------------------------------------------------------------
export async function fetchWorldBankTelemetry(iso3) {
  if (NO_WB_COVERAGE.has(iso3)) return { unavailable: 'no-coverage' };
  const hit = wbCache.get(iso3);
  if (hit && !(hit.unavailable && Date.now() - hit.at > 60_000)) return hit; // retry failures after 60 s

  try {
    const thisYear = new Date().getFullYear();
    const url = `https://api.worldbank.org/v2/country/${iso3}/indicator/${INDICATORS.gdp}?date=2015:${thisYear}&format=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    const rows = (json[1] || [])
      .filter(r => r.value !== null)
      .map(r => ({ year: r.date, val: +(r.value / 1e12).toFixed(2) }))
      .reverse();

    if (rows.length >= 3) {
      const lastYear = rows[rows.length - 1].year;
      const payload = { source: `WORLD BANK (REPORTED, TO ${lastYear})`, series: rows, lastYear };
      wbCache.set(iso3, payload);
      return payload;
    }
  } catch (_) {
    // fall through to the offline result
  }

  const failed = { unavailable: 'offline', at: Date.now() };
  wbCache.set(iso3, failed);
  return failed;
}

// ----------------------------------------------------------------------------
// 3. INLINE SVG SPARKLINE
// ----------------------------------------------------------------------------
export function buildSparklineSVG(series, strokeColor = '#38bdf8') {
  if (!series || series.length < 2) return '';

  const w = 310;
  const h = 68;
  const pad = 10;

  const vals = series.map(d => d.val);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const span = Math.max(0.01, maxV - minV);

  const pts = series.map((d, i) => {
    const x = pad + (i / (series.length - 1)) * (w - pad * 2);
    const y = h - pad - ((d.val - minV) / span) * (h - pad * 2);
    return [x, y];
  });

  const polylinePts = pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const areaPts = `${pts[0][0].toFixed(1)},${h - pad} ${polylinePts} ${pts[pts.length - 1][0].toFixed(1)},${h - pad}`;

  const first = series[0];
  const last = series[series.length - 1];

  return `
    <svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" style="overflow:visible; display:block;">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${strokeColor}" stop-opacity="0.32" />
          <stop offset="100%" stop-color="${strokeColor}" stop-opacity="0.0" />
        </linearGradient>
      </defs>
      <polygon points="${areaPts}" fill="url(#sparkGrad)" />
      <polyline fill="none" stroke="${strokeColor}" stroke-width="2" points="${polylinePts}" />
      <circle cx="${pts[pts.length - 1][0]}" cy="${pts[pts.length - 1][1]}" r="3.5" fill="${strokeColor}" />
      <text x="${pad}" y="${h - 1}" fill="#64748b" font-size="9" font-family="JetBrains Mono">${first.year}: $${first.val}T</text>
      <text x="${w - pad}" y="${h - 1}" text-anchor="end" fill="#f1f5f9" font-size="9" font-family="JetBrains Mono">${last.year}: $${last.val}T</text>
    </svg>
  `;
}