// ============================================================================
// LAYER 4D: NATION MACRO MERGE
//    Loads data/nations-macro.json (built by tools/build_nations.py from the
//    World Bank) and writes the figures onto NATIONS, recording where each
//    one came from so the dossier can label it.
//      n.<field>       value used by the app (or null)
//      n.prov.<field>  'WB 2024' | 'est.' (hand-entered fallback) | null
// ============================================================================

export const MODULE_BUILD = '4.3.0';

export const MACRO_FIELDS = ['gdpNominal', 'gdpPPP', 'growth', 'milBudget', 'activeForces', 'population'];

// ----------------------------------------------------------------------------
// 1. APPLY (pure; also used by tests with macro = null)
// ----------------------------------------------------------------------------
export function applyNationMacro(NATIONS, macro) {
  const src = macro && macro.nations ? macro.nations : {};
  for (const n of Object.values(NATIONS)) {
    n.prov = {};
    const wb = src[n.iso3] || {};
    for (const f of MACRO_FIELDS) {
      if (wb[f] && wb[f].value != null) {
        n[f] = wb[f].value;
        n.prov[f] = `WB ${wb[f].year}`;
      } else if (n.fallback && n.fallback[f] != null) {
        n[f] = n.fallback[f];
        n.prov[f] = 'est.';
      } else {
        n[f] = null;
        n.prov[f] = null;
      }
    }
  }
  return {
    loaded: !!(macro && macro.nations),
    generated: macro ? macro.generated : null,
    covered: Object.keys(src).length
  };
}

// ----------------------------------------------------------------------------
// 2. LOAD (browser) — a missing file is fine: fallbacks apply
// ----------------------------------------------------------------------------
export async function loadNationMacro(NATIONS) {
  let macro = null;
  try {
    const res = await fetch('./data/nations-macro.json');
    if (res.ok) macro = await res.json();
  } catch (_) {
    // offline or file not built yet
  }
  return applyNationMacro(NATIONS, macro);
}

// ----------------------------------------------------------------------------
// 3. DISPLAY FORMATTERS
// ----------------------------------------------------------------------------
export const fmt = {
  // Small economies read in billions: $2.6B, not $0.00T
  trillions: v => (v == null ? '—' : v >= 0.1 ? `$${v.toFixed(2)}T` : `$${(v * 1000).toFixed(v < 0.01 ? 1 : 0)}B`),
  billions: v => (v == null ? '—' : `$${v >= 100 ? Math.round(v) : v.toFixed(1)}B`),
  pct: v => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`),
  people: v => (v == null ? '—' : v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : `${Math.round(v / 1e3)}K`),
  millions: v => (v == null ? '—' : v >= 10 ? `${v.toFixed(1)}M` : `${v.toFixed(2)}M`)
};
