// ============================================================================
// LAYER 4D: SOL SOLAR-RESOURCE OVERLAY (read-only consumer of Sol's GeoJSON)
// ============================================================================
// Sol is the calculation authority; StratCom never reads sol.db. This module loads
// the versioned FeatureCollection Sol exports (schema "sol-geo-1": corridor, site and
// wapp_station layers), draws it on a Leaflet layer group, and cross-references each
// Sol site against StratCom's baseline kinetic theaters (CONFLICTS).
//
// Sources, in order:
//   1. GET /api/sol/geo   (launch.py serves the newest Sol\reports\geo\sol_geo_*.geojson)
//   2. a sol_geo_*.geojson dropped into the + LIVE FEED > GEOJSON uploader
//
// The theater overlap is a distance test against StratCom's hand-set theater radii.
// It is a flag for further reading, not a security assessment.
// ============================================================================
export const SOL_LAYER_BUILD = 'sol-layer-1';

// ----------------------------------------------------------------------------
// 1. HELPERS
// ----------------------------------------------------------------------------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const num = (v, nd = 0) => (v == null || Number.isNaN(+v) ? '—' : (+v).toLocaleString(undefined,
  { minimumFractionDigits: nd, maximumFractionDigits: nd }));

const range = (a, nd = 0) => (Array.isArray(a) && a[0] != null && a[1] != null
  ? `${num(a[0], nd)}–${num(a[1], nd)}` : '—');

function km(aLat, aLng, bLat, bLng) {
  const r = Math.PI / 180;
  const dp = (bLat - aLat) * r, dl = (bLng - aLng) * r;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dl / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.sqrt(h));
}

// P90 colour ramp (kWh/kWp/yr): slate below 1300, amber at 1400, bright gold at 1500+
export function p90Color(p90) {
  if (p90 == null) return '#64748b';
  const t = Math.max(0, Math.min(1, (p90 - 1300) / 200));
  const lerp = (a, b) => Math.round(a + (b - a) * t);
  return `rgb(${lerp(100, 253)}, ${lerp(116, 224)}, ${lerp(139, 71)})`;
}

// Where each Sol site's equipment leaves the port network (StratCom node ids), and its host
// nation. Per-site entries win over per-corridor ones. A logistics judgement, not geometry:
// Korhogo's nearest hub is Bamako, but its freight comes up the A3 from Abidjan.
export const SOL_ROUTING = {
  'GH-N': { hub: 'N_GH_TAMALE', host: 'GHA' },
  'CI-N': { hub: 'N_CI_ABIDJAN', host: 'CIV' },
  'SAH-DOR': { hub: 'N_BF_OUAGA', host: 'BFA' },
  'SAH-ESK': { hub: 'N_BF_OUAGA', host: 'BFA' },
  'SAH-KAY': { hub: 'N_BF_OUAGA', host: 'BFA' },
  'SAH-NIA': { hub: 'N_NE_NIAMEY', host: 'NER' },
  'SAH-BKO': { hub: 'N_ML_BAMAKO', host: 'MLI' },
  'SAH-KAN': { hub: 'N_NIGERIA', host: 'NGA' },
  'WEC-TAM': { hub: 'N_SN_DAKAR', host: 'SEN' },        // Dakar-Tambacounda N1
  'WEC-FAR': { hub: 'N_GM_BANJUL', host: 'GMB' },
  'WEC-BIS': { hub: 'N_GW_BISSAU', host: 'GNB' },
  'WEC-BOK': { hub: 'N_GN_CONAKRY', host: 'GIN' },      // Kamsar is a bauxite terminal, not a container port
  'WEC-KNK': { hub: 'N_GN_CONAKRY', host: 'GIN' },
  'WEC-BUM': { hub: 'N_SL_FREETOWN', host: 'SLE' },
  'WEC-YEK': { hub: 'N_LR_MONROVIA', host: 'LBR' }      // ore leaves by rail to Buchanan; equipment comes via Monrovia
};
export const SOL_MODULE_ORIGIN = 'CHN';     // modules shipped from China (Shanghai / Ningbo)
export const KWP_PER_FEU = 360;             // ~620 modules of ~580 W in a 40' HC: ASSUMPTION, set from a packing list

export const solSiteKey = id => `SOL_${id}`;
export function solRouting(p) {
  return SOL_ROUTING[p.id] || SOL_ROUTING[p.corridor_id] || {};
}

export function isSolGeo(fc) {
  return !!fc && fc.type === 'FeatureCollection' && String(fc.schema || '').startsWith('sol-geo-');
}

// ----------------------------------------------------------------------------
// 2. LOAD
// ----------------------------------------------------------------------------
export async function fetchSolGeo() {
  try {
    const res = await fetch('/api/sol/geo');
    const body = await res.json();
    if (!res.ok) return { fc: null, error: body.error || `HTTP ${res.status}`, hint: body.fix, lookedIn: body.looked_in };
    if (!isSolGeo(body)) return { fc: null, error: 'response is not a Sol GeoJSON export (schema sol-geo-*)' };
    return { fc: body, error: null };
  } catch (e) {
    return { fc: null, error: `StratCom backend unreachable (${e.message})` };
  }
}

// ----------------------------------------------------------------------------
// 3. SPLIT + CROSS-REFERENCE
// ----------------------------------------------------------------------------
export function splitLayers(fc) {
  const by = { corridor: [], site: [], wapp_station: [] };
  (fc?.features || []).forEach(f => { (by[f.properties?.layer] || []).push(f); });
  return by;
}

/** StratCom theaters whose radius contains the site, nearest first. */
export function theaterOverlap(siteFeature, conflicts) {
  const [lng, lat] = siteFeature.geometry.coordinates;
  return (conflicts || [])
    .map(c => ({ c, d: km(lat, lng, c.lat, c.lng) }))
    .filter(x => x.d <= x.c.radiusKm)
    .sort((a, b) => a.d - b.d)
    .map(x => ({ id: x.c.id, name: x.c.name, severity: x.c.severity, km: Math.round(x.d) }));
}

// ----------------------------------------------------------------------------
// 4. MAP LAYER
// ----------------------------------------------------------------------------
export function renderSolLayer(layerGroup, fc, conflicts, logistics = {}, nowcast = {}) {
  layerGroup.clearLayers();
  if (!isSolGeo(fc)) return;
  const { corridor, site, wapp_station } = splitLayers(fc);

  corridor.forEach(f => {
    const p = f.properties;
    const ring = f.geometry.coordinates[0].map(([lng, lat]) => [lat, lng]);
    const qualified = p.stage === 'qualified';
    L.polygon(ring, {
      color: qualified ? '#10b981' : '#f59e0b', weight: 1.2, dashArray: qualified ? null : '6 5',
      fillColor: qualified ? '#10b981' : '#f59e0b', fillOpacity: 0.04
    }).bindPopup(`
      <div style="font-family:JetBrains Mono;font-size:9.5px;color:#fcd34d;">SOL CORRIDOR // ${esc(p.id)} // ${esc(String(p.stage || 'unknown').toUpperCase())}</div>
      <div style="font-weight:600;font-size:12px;margin:3px 0;">${esc(p.name)} (${esc(p.country)})</div>
      <div style="font-size:10.5px;color:#cbd5e1;">${(p.sites || []).length} sites · box is Sol's coordinate check, not a boundary</div>
    `).addTo(layerGroup);
  });

  wapp_station.forEach(f => {
    const p = f.properties;
    const [lng, lat] = f.geometry.coordinates;
    L.circleMarker([lat, lng], { radius: 3, color: '#94a3b8', weight: 1, fillColor: '#0f172a', fillOpacity: 0.9 })
      .bindPopup(`
        <div style="font-family:JetBrains Mono;font-size:9.5px;color:#94a3b8;">WAPP GROUND STATION // MEASURED // ${esc(p.licence)}</div>
        <div style="font-weight:600;font-size:12px;margin:3px 0;">${esc(p.name)} (${esc(p.country)})</div>
        <div style="font-size:10.5px;color:#cbd5e1;">PVGIS bias (panel): ${num(p.pvgis_poa_bias_pct, 1)} % · dry-season soiling ${num(p.soiling_dry_pct_day, 3)} %/day<br/>
        Rain gauge ${num(p.rain_gauge_mm_yr)} mm/yr vs Open-Meteo ${num(p.rain_openmeteo_mm_yr)} mm/yr · ${num(p.full_days)} full days</div>
      `).addTo(layerGroup);
  });

  site.forEach(f => {
    const p = f.properties;
    const [lng, lat] = f.geometry.coordinates;
    const threats = theaterOverlap(f, conflicts);
    L.circleMarker([lat, lng], {
      radius: 7, color: threats.length ? '#ef4444' : '#fff', weight: threats.length ? 2 : 1.2,
      fillColor: p90Color(p.p90_kwh_kwp_yr), fillOpacity: 0.95
    }).bindPopup(sitePopup(p, threats, logistics[p.id], nowcast[p.id])).addTo(layerGroup);
  });
}

const ACTION_COLOR = { clean_now: '#ef4444', clean_by: '#f59e0b', hold: '#38bdf8', none: '#10b981' };

/** One-line soiling nowcast for a site (Sol's nowcast row), or ''. */
function nowcastLine(nc, mono = true) {
  if (!nc) return '';
  if (nc.error) return `<div style="${mono ? 'font-family:JetBrains Mono;font-size:9.5px;' : 'font-size:10.5px;margin-top:4px;'}color:#64748b;">today: ${esc(nc.error)}</div>`;
  const col = ACTION_COLOR[nc.advice?.action] || '#94a3b8';
  const dry = nc.days_since_rain == null ? '>92' : nc.days_since_rain;
  const style = mono ? 'font-family:JetBrains Mono;font-size:9.5px;' : 'font-size:10.5px;margin-top:4px;';
  return `<div style="${style}color:${col};">today ${num(nc.soiling_now_pct, 1)}% soiling · L${esc(nc.yomi_now?.level)} ${esc(nc.yomi_now?.label)} · dry ${esc(dry)} d · ${esc(nc.advice?.text)}</div>`;
}

function logisticsLine(lg) {
  if (!lg) return '';
  if (!lg.reachable) return `<div style="font-size:10.5px;color:#f87171;margin-top:4px;">No route from ${esc(lg.origin)} with the current gate states.</div>`;
  const gates = lg.gates.length ? ` · gates: ${lg.gates.map(esc).join(', ')}` : '';
  return `<div style="font-size:10.5px;color:#cbd5e1;margin-top:4px;line-height:1.45;">
      Modules from ${esc(lg.origin)} via ${esc(lg.port || '—')}: <b>$${num(lg.usdPerFEU)}/FEU</b> ≈ <b>$${num(lg.usdPerKwp, 1)}/kWp</b><br/>
      ${num(lg.days, 1)} days · ${num(lg.roadNM)} NM inland · war risk +${num(lg.warRiskBps)} bps${gates}
    </div>`;
}

function sitePopup(p, threats, lg, nc) {
  const t = threats.length
    ? `<div style="font-size:10.5px;color:#f87171;margin-top:4px;">⚠ Inside StratCom theater: ${threats.map(x => `${esc(x.name)} (SEV ${x.severity}, ${x.km} km from centre)`).join('; ')}</div>`
    : '';
  return `
    <div style="font-family:JetBrains Mono;font-size:9.5px;color:#fcd34d;">SOL SITE // ${esc(p.id)} // MODEL OUTPUT</div>
    <div style="font-weight:600;font-size:12px;margin:3px 0;">${esc(p.name)}</div>
    <div style="font-size:10.5px;color:#cbd5e1;line-height:1.45;">
      P90 <b>${num(p.p90_kwh_kwp_yr, 1)}</b> kWh/kWp/yr · P50 ${num(p.p50_kwh_kwp_yr, 1)}<br/>
      With correction uncertainty: ${range(p.p90_ci_with_correction)}<br/>
      Soiling band: ${range(p.p90_soiling_band)} · cleaned monthly: ${num(p.p90_cleaned_monthly, 1)}<br/>
      PVGIS bias removed ${num(p.pvgis_bias_removed_pct, 1)} % · mean soiling ${num(p.mean_soiling_pct, 1)} %<br/>
      Nearest WAPP: ${esc(p.nearest_wapp_station || '—')} (${num(p.nearest_wapp_km)} km) · tier <b>${esc(p.yield_tier)}</b>
    </div>${nowcastLine(nc, false)}${logisticsLine(lg)}${t}
    <button class="btn-reset" style="margin-top:6px;" data-sol-route="${esc(solSiteKey(p.id))}">ROUTE MODULES HERE →</button>`;
}

/** Sol sites for the 3D globe: position, P90 colour, threat flag and a short tooltip. */
export function globeSites(fc, conflicts, logistics = {}) {
  if (!isSolGeo(fc)) return [];
  return splitLayers(fc).site.map(f => {
    const p = f.properties;
    const [lng, lat] = f.geometry.coordinates;
    const th = theaterOverlap(f, conflicts);
    const lg = logistics[p.id];
    const freight = lg && lg.reachable ? `<br/><span style="color:#38bdf8;">freight $${num(lg.usdPerKwp, 1)}/kWp · ${num(lg.days)} d via ${esc(lg.port || '—')}</span>` : '';
    const warn = th.length ? `<br/><span style="color:#f87171;">⚠ ${th.map(x => esc(x.name)).join('; ')}</span>` : '';
    return {
      key: solSiteKey(p.id), lat, lng, color: p90Color(p.p90_kwh_kwp_yr), threat: th.length > 0,
      html: `<b style="color:#fcd34d;">☀ ${esc(p.name)}</b> <span style="color:#94a3b8;">${esc(p.id)}</span><br/>` +
            `P90 <b>${num(p.p90_kwh_kwp_yr)}</b> kWh/kWp/yr · range ${range(p.p90_ci_with_correction)}${freight}${warn}` +
            `<br/><span style="color:#94a3b8;">Click: route here · Shift+Click: origin</span>`
    };
  });
}

// ----------------------------------------------------------------------------
// 5. LEFT-BLADE PANEL
// ----------------------------------------------------------------------------
export function renderSolPanel(el, fc, conflicts, loadError, logistics = {}, nowcast = {}, nowcastMeta = null) {
  if (!el) return;
  if (!isSolGeo(fc)) {
    el.innerHTML = `
      <div class="intel-card" style="border-color:rgba(245,158,11,0.4);">
        <div class="card-title">No Sol export loaded</div>
        <div class="helper-copy" style="margin-top:4px;">${esc(loadError || '')}</div>
        <div class="helper-copy">In PowerShell, run Sol's exporter, then press ↻ RELOAD:</div>
        <div style="font-family:JetBrains Mono;font-size:9.5px;color:#38bdf8;word-break:break-all;">&lt;Sol folder&gt;\\.venv\\Scripts\\python.exe &lt;Sol folder&gt;\\scripts\\export_geojson.py</div>
        <div class="helper-copy" style="margin-top:4px;">Or drop a <b>sol_geo_*.geojson</b> into + LIVE FEED → GEOJSON.</div>
      </div>`;
    return;
  }
  const { corridor, site, wapp_station } = splitLayers(fc);
  const sitesOf = cid => site.filter(f => f.properties.corridor_id === cid)
    .sort((a, b) => (b.properties.p90_kwh_kwp_yr ?? -1) - (a.properties.p90_kwh_kwp_yr ?? -1));

  const siteRow = f => {
    const p = f.properties;
    const [lng, lat] = f.geometry.coordinates;
    const th = theaterOverlap(f, conflicts);
    return `
      <div class="intel-card" style="cursor:pointer;padding:7px 9px;${th.length ? 'border-color:rgba(239,68,68,0.45);' : ''}" data-c-lat="${lat}" data-c-lng="${lng}">
        <div class="card-head">
          <span style="font-size:11.5px;font-weight:600;color:#f1f5f9;">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p90Color(p.p90_kwh_kwp_yr)};margin-right:5px;"></span>${esc(p.name)}
          </span>
          <span style="font-family:JetBrains Mono;font-size:10.5px;color:#fcd34d;">P90 ${num(p.p90_kwh_kwp_yr)}</span>
        </div>
        <div style="font-family:JetBrains Mono;font-size:9.5px;color:#94a3b8;">
          ${esc(p.id)} · range ${range(p.p90_ci_with_correction)} · soiling ${range(p.p90_soiling_band)}
        </div>
        ${nowcastLine(nowcast[p.id])}
        ${(() => {
          const lg = logistics[p.id];
          if (!lg) return '';
          if (!lg.reachable) return '<div style="font-family:JetBrains Mono;font-size:9.5px;color:#f87171;">freight: no route under current gates</div>';
          return `<div style="font-family:JetBrains Mono;font-size:9.5px;color:#38bdf8;">freight $${num(lg.usdPerKwp, 1)}/kWp · ${num(lg.days)} d via ${esc(lg.port || '—')}${lg.gates.length ? ` · ⚓ ${lg.gates.map(esc).join(', ')}` : ''}</div>`;
        })()}
        ${th.length ? `<div style="font-size:10px;color:#f87171;margin-top:3px;">⚠ ${th.map(x => `${esc(x.name)} · SEV ${x.severity}`).join('; ')}</div>` : ''}
      </div>`;
  };

  const corridorBlock = f => {
    const p = f.properties;
    const ring = f.geometry.coordinates[0];
    const cLat = (ring[0][1] + ring[2][1]) / 2, cLng = (ring[0][0] + ring[2][0]) / 2;
    const ss = sitesOf(p.id);
    const flagged = ss.filter(s => theaterOverlap(s, conflicts).length).length;
    return `
      <div class="section-banner" style="margin-top:8px;color:${p.stage === 'qualified' ? '#10b981' : '#f59e0b'};cursor:pointer;" data-c-lat="${cLat}" data-c-lng="${cLng}">
        <span>${esc(p.name)} · ${esc(p.country)}</span>
        <span>${esc(String(p.stage || 'unknown').toUpperCase())} · ${ss.length} SITES${flagged ? ` · ${flagged} ⚠` : ''}</span>
      </div>
      ${ss.map(siteRow).join('') || '<div class="helper-copy">No sites in this export.</div>'}`;
  };

  const p90s = site.map(f => f.properties.p90_kwh_kwp_yr).filter(v => v != null);
  const tiers = [...new Set(site.map(f => f.properties.yield_tier).filter(Boolean))];
  el.innerHTML = `
    <div class="intel-card" style="border-color:rgba(252,211,77,0.35);">
      <div class="card-head">
        <span style="font-family:JetBrains Mono;font-size:9.5px;color:#fcd34d;">SOL // ${esc(fc.build_version)}</span>
        <span style="font-family:JetBrains Mono;font-size:9px;color:#94a3b8;">${esc(String(fc.built_at_utc || '').slice(0, 16))}Z</span>
      </div>
      <div style="font-size:11px;color:#cbd5e1;">
        ${corridor.length} corridors · ${site.length} sites · ${wapp_station.length} WAPP stations<br/>
        P90 ${p90s.length ? `${num(Math.min(...p90s))}–${num(Math.max(...p90s))}` : '—'} kWh/kWp/yr · yield tier: ${esc(tiers.join(', ') || '—')}
      </div>
      ${nowcastMeta ? `<div class="helper-copy" style="margin:5px 0 0;">Soiling today: Sol's nowcast (${esc(nowcastMeta)}). Rain is Open-Meteo model weather, not gauges; clean / hold advice uses the placeholder break-even in Yomi.</div>` : ''}
      <div class="helper-copy" style="margin:5px 0 0;">Freight: modules from ${esc(SOL_MODULE_ORIGIN)} at an assumed ${KWP_PER_FEU} kWp per 40' container, StratCom's route model under the current gate states (toggle gates in WAR-GAME to see it move).</div>
      <div class="helper-copy" style="margin:5px 0 0;">Yields are Sol model outputs, not measurements. <b>CANDIDATE</b> means the resource is modelled; grid, demand and licence evidence are not attached yet. ⚠ means the site is inside one of StratCom's baseline theater radii. Use it as a prompt to read further, not as a security rating.</div>
    </div>
    ${corridor.map(corridorBlock).join('')}`;
}
