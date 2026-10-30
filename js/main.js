import { StratcomGlobe3D } from './globe-3d.js';
// ============================================================================
// LAYER 4B: MAIN APPLICATION CONTROLLER, KEYLESS BASEMAPS, 3D GLOBE & KINEMATICS (v4.4)
// ============================================================================

import {
  CHOKEPOINTS, GRAPH_NODES, NATIONS, REGIONS, SITES, CONFLICTS, BLOCS, BLOC_GROUPS, PRESET_PAIRS, GRAPH_EDGES,
  VESSEL_MANIFEST, SEVERITY_LABELS, DATA_VINTAGE
} from '../data/intel-store.js';
import { splitAntimeridian, bearingDeg, computeShortestRoute, haversineNM, edgeGeometry, registerSovereignSiteInMesh } from './math-geodesic.js';
import { evaluateCorridorChemistry } from './chemistry-engine.js';
import { fetchWorldBankTelemetry, buildSparklineSVG } from './api-worldbank.js';
import {
  fetchLiveOsintEvents, fetchPersistedGates, persistGateState, resetPersistedGates,
  fetchSovereignSites, saveSovereignSite, subscribeCustomRssFeed
} from './api-osint.js';
import { loadNationMacro, fmt } from './nation-macro.js';
import { fetchSolGeo, isSolGeo, renderSolLayer, renderSolPanel, splitLayers, solRouting, solSiteKey, globeSites,
  SOL_MODULE_ORIGIN, KWP_PER_FEU } from './sol-layer.js';
import { initLiveFeeds, ago } from './live-layers.js';

import * as M_STORE from '../data/intel-store.js';
import * as M_GEO from './math-geodesic.js';
import * as M_CHEM from './chemistry-engine.js';
import * as M_WB from './api-worldbank.js';
import * as M_OSINT from './api-osint.js';
import * as M_MACRO from './nation-macro.js';

const APP_BUILD = '4.3.0';
let macroStatus = { loaded: false, generated: null, covered: 0 };

const LABELS_BY_ZOOM = { 2: 12, 3: 22 };
const SIM_HOURS_PER_SEC = 3;
const FEED_CONTEST_THRESHOLD = 3;
// Real-world gate states as curated in intel-store.js, captured once at module
// load, before saved war-game states are applied, so ◉ LIVE can always return here.
const LIVE_GATE_BASELINE = Object.fromEntries(CHOKEPOINTS.map(c => [c.id, c.state]));
const TOOLTIP_REFRESH_MS = 250;

const state = {
  originId: 'CHN',
  destId: 'NLD',
  dossierId: 'USA',
  activeBloc: null,
  simSpeed: 1,
  vesselKts: 18,
  basemapMode: 'dark', // 'dark' | 'sat'
  globe3dActive: false,
  osintEvents: [],
  layers: {
    graticule: L.layerGroup(),
    corridors: L.layerGroup(),
    conflicts: L.layerGroup(),
    vessels: L.layerGroup(),
    chokepoints: L.layerGroup(),
    activeRoute: L.layerGroup(),
    nations: L.layerGroup(),
    sol: L.layerGroup(),
    gdelt: L.layerGroup(),
    ais: L.layerGroup()
  },
  solNowcast: {},
  solNowcastMeta: null,
  solGeo: null,
  solError: null,
  autonomousVessels: []
};

let map;
let tileLayers = {};
let globe3d = null;
let globe3dMarkers = [];

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function safeUrl(u) {
  try {
    const url = new URL(u);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '#';
  } catch (_) {
    return '#';
  }
}
const signed = (n, unit = '') => `${n > 0 ? '+' : ''}${n.toLocaleString()}${unit}`;

function checkModuleBuilds() {
  const builds = {
    'intel-store.js': M_STORE.MODULE_BUILD,
    'math-geodesic.js': M_GEO.MODULE_BUILD,
    'chemistry-engine.js': M_CHEM.MODULE_BUILD,
    'api-worldbank.js': M_WB.MODULE_BUILD,
    'api-osint.js': M_OSINT.MODULE_BUILD,
    'nation-macro.js': M_MACRO.MODULE_BUILD
  };
  const stale = Object.entries(builds).filter(([, b]) => b !== APP_BUILD).map(([f]) => f);
  const tag = document.getElementById('brandVer');
  if (stale.length) {
    console.warn(`[STRATCOM] Stale cached modules (expected build ${APP_BUILD}):`, stale);
    if (tag) {
      tag.textContent = '// STALE CACHE: HARD-REFRESH (Ctrl+Shift+R)';
      tag.style.color = '#ef4444';
      tag.title = `Old cached files: ${stale.join(', ')}`;
    }
  } else if (tag) {
    tag.textContent = '// GEO-OSINT v4.5';
  }
}

function flagImg(iso2) {
  return `<img class="flag-ico" src="https://flagcdn.com/w20/${iso2}.png" alt="${iso2}" />`;
}

// ----------------------------------------------------------------------------
// 1. INITIALIZE FULL-BLEED MAP WITH KEYLESS BASEMAPS & ZOOM-19 SATELLITE
// ----------------------------------------------------------------------------
function initMap() {
  map = L.map('map', {
    center: [22, 25],
    zoom: window.innerWidth < 768 ? 2 : 3,
    minZoom: 2,
    maxZoom: 19, // Raised from 8 to 19 so satellite & street views zoom down to property roofs
    zoomControl: false,
    worldCopyJump: true,
    attributionControl: true
  });
  map.attributionControl.setPrefix(false);

  tileLayers.dark = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    className: 'tactical-osm-tiles',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
  });

  // Hybrid Satellite + Boundaries/Transportation overlay for Google-Earth fidelity
  const satImagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    className: 'tactical-sat-tiles',
    attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics'
  });
  const satLabels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    opacity: 0.75
  });
  tileLayers.sat = L.layerGroup([satImagery, satLabels]);

  tileLayers.dark.addTo(map);
  Object.values(state.layers).forEach(lg => lg.addTo(map));

  renderTacticalGraticule();

  const updateZoomLOD = () => {
    document.getElementById('map').classList.toggle('zoom-low', map.getZoom() <= 3);
    renderTacticalGraticule();
    renderChokepointMarkers();   /* gates first: nation pills then avoid their labels */
    if (Object.keys(GRAPH_NODES).length && state.layers.nations) renderNationNodes();
  };
  map.on('zoomend', updateZoomLOD);
  updateZoomLOD();

  // Live geodesic cursor readout in bottom kinematic bar
  map.on('mousemove', e => {
    const { lat, lng } = e.latlng;
    const normLng = ((((lng + 180) % 360) + 360) % 360) - 180;
    const latS = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}`;
    const lngS = `${Math.abs(normLng).toFixed(2)}°${normLng >= 0 ? 'E' : 'W'}`;
    const el = document.getElementById('cursorCoords');
    if (el) el.textContent = `${latS}, ${lngS}`;
  });

  window.addEventListener('resize', () => map.invalidateSize());
}

// ----------------------------------------------------------------------------
// 1B. MULTI-LOD GEODESIC GRATICULE (LATITUDE / LONGITUDE + EQUATOR / TROPICS)
// ----------------------------------------------------------------------------
function renderTacticalGraticule() {
  state.layers.graticule.clearLayers();
  if (!map) return;
  const z = map.getZoom();
  const step = z >= 8 ? 1 : z >= 6 ? 5 : z >= 4 ? 15 : 30;

  const minorStyle = { color: 'rgba(56, 189, 248, 0.11)', weight: 0.75, interactive: false };
  const majorStyle = { color: 'rgba(56, 189, 248, 0.25)', weight: 1.1, interactive: false };
  const primeStyle = { color: 'rgba(245, 158, 11, 0.42)', weight: 1.3, dashArray: '5 5', interactive: false };
  const tropicStyle = { color: 'rgba(16, 185, 129, 0.28)', weight: 0.9, dashArray: '3 6', interactive: false };

  // Parallels (Latitude)
  for (let lat = -80; lat <= 80; lat += step) {
    const isEq = lat === 0;
    const isMaj = lat % 30 === 0;
    const style = isEq ? primeStyle : isMaj ? majorStyle : minorStyle;
    L.polyline([[lat, -360], [lat, 360]], style).addTo(state.layers.graticule);

    if (isEq || isMaj || z >= 5) {
      const lbl = lat === 0 ? 'EQ 0°' : `${Math.abs(lat)}°${lat > 0 ? 'N' : 'S'}`;
      L.marker([lat, -175], {
        interactive: false,
        icon: L.divIcon({
          className: '',
          html: `<span class="grat-label${isEq ? ' major' : ''}">${lbl}</span>`,
          iconSize: [44, 14],
          iconAnchor: [0, 7]
        })
      }).addTo(state.layers.graticule);
    }
  }

  // Meridians (Longitude)
  for (let lng = -180; lng <= 180; lng += step) {
    const isPM = lng === 0 || Math.abs(lng) === 180;
    const isMaj = lng % 30 === 0;
    const style = isPM ? primeStyle : isMaj ? majorStyle : minorStyle;
    L.polyline([[-85, lng], [85, lng]], style).addTo(state.layers.graticule);

    if (isPM || isMaj || z >= 5) {
      const lbl = lng === 0 ? 'PM 0°' : Math.abs(lng) === 180 ? '180°' : `${Math.abs(lng)}°${lng > 0 ? 'E' : 'W'}`;
      L.marker([78, lng], {
        interactive: false,
        icon: L.divIcon({
          className: '',
          html: `<span class="grat-label${isPM ? ' major' : ''}">${lbl}</span>`,
          iconSize: [44, 14],
          iconAnchor: [22, 0]
        })
      }).addTo(state.layers.graticule);
    }
  }

  // Tropics of Cancer/Capricorn (±23.436°) & Polar Circles (±66.563°)
  [
    [23.436, 'TROPIC OF CANCER 23.4°N'],
    [-23.436, 'TROPIC OF CAPRICORN 23.4°S'],
    [66.563, 'ARCTIC CIRCLE 66.6°N'],
    [-66.563, 'ANTARCTIC CIRCLE 66.6°S']
  ].forEach(([lat, name]) => {
    L.polyline([[lat, -360], [lat, 360]], tropicStyle).addTo(state.layers.graticule);
  });
}

// ----------------------------------------------------------------------------
// 1C. KEYLESS 3D "GOOGLE EARTH" GLOBE VIEW (MapLibre GL v4 Globe Projection)
//     Synced with your Leaflet camera, Dijkstra route, graticules & nodes!
// ----------------------------------------------------------------------------
function toggleGlobe3D(btnEl) {
  state.globe3dActive = !state.globe3dActive;
  const mapEl = document.getElementById('map');
  const globeEl = document.getElementById('globe3d');
  btnEl.classList.toggle('active', state.globe3dActive);

  if (state.globe3dActive) {
    const c = map.getCenter();
    const z = map.getZoom();
    globeEl.hidden = false;
    mapEl.style.visibility = 'hidden';
    initOrSyncGlobe3D(c.lat, c.lng, z);
  } else {
    if (globe3d) {
      map.setView([globe3d.camLat, globe3d.camLng], map.getZoom(), { animate: false });
    }
    globeEl.hidden = true;
    mapEl.style.visibility = 'visible';
    map.invalidateSize();
  }
}

function initOrSyncGlobe3D(lat, lng, leafletZoom) {
  if (!globe3d) {
    globe3d = new StratcomGlobe3D(
      'globe3d',
      (gLat, gLng) => {
        const el = document.getElementById('cursorCoords');
        if (el) el.textContent = `${Math.abs(gLat).toFixed(2)}°${gLat >= 0 ? 'N' : 'S'}, ${Math.abs(gLng).toFixed(2)}°${gLng >= 0 ? 'E' : 'W'}`;
      },
      (pickedId, isShift) => {
        if (isShift) {
          state.originId = pickedId;
          document.getElementById('selOrigin').value = pickedId;
        } else {
          state.destId = pickedId;
          document.getElementById('selDest').value = pickedId;
        }
        syncAllViews();
      },
      (gateId) => {
        const cp = CHOKEPOINTS.find(c => c.id === gateId);
        if (!cp) return;
        const order = ['open', 'contested', 'blockaded'];
        setGateState(cp.id, order[(order.indexOf(cp.state) + 1) % 3]);
      }
    );
  }
  globe3d.flyTo(lat, lng, leafletZoom);
  syncGlobe3DOverlays();
}

function syncGlobe3DOverlays() {
  if (!globe3d) return;
  let routeRes = null;
  try {
    routeRes = evaluateCorridorChemistry(state.originId, state.destId, CHOKEPOINTS, state.vesselKts);
  } catch (_) {}

  const gateMap = Object.fromEntries(CHOKEPOINTS.map(c => [c.id, c.state]));
  const corridors = [];
  for (const [u, v, mode, gateId] of GRAPH_EDGES) {
    if (!GRAPH_NODES[u] || !GRAPH_NODES[v]) continue;
    corridors.push({
      mode,
      blockaded: gateId && gateMap[gateId] === 'blockaded',
      pts: edgeGeometry(u, v, mode, 10).pts
    });
  }

  const sitesWithCoords = {};
  Object.values(SITES).forEach(s => {
    sitesWithCoords[s.id] = { ...s, _coords: GRAPH_NODES[s.node] };
  });

  globe3d.syncScene({
    routeRes,
    corridors,
    chokepoints: CHOKEPOINTS,
    sites: sitesWithCoords,
    nations: NATIONS,
    conflicts: CONFLICTS,
    osintEvents: state.osintEvents,
    originId: state.originId,
    destId: state.destId,
    activeBloc: state.activeBloc,
    fmtTrillions: fmt.trillions,
    solSites: globeSites(state.solGeo, CONFLICTS, state.solLogistics || {})
  });
  globe3d.setLayerVisible('sol', map.hasLayer(state.layers.sol));
}

// ----------------------------------------------------------------------------
// 2. RENDER GLOBAL STATIC & DYNAMIC MAP LAYERS
// ----------------------------------------------------------------------------
function renderBackgroundCorridors() {
  state.layers.corridors.clearLayers();
  const gateMap = Object.fromEntries(CHOKEPOINTS.map(c => [c.id, c.state]));

  for (const [u, v, mode, gateId] of GRAPH_EDGES) {
    const nU = GRAPH_NODES[u];
    const nV = GRAPH_NODES[v];
    if (!nU || !nV) continue;

    const gState = gateId ? gateMap[gateId] : 'open';
    const pts = edgeGeometry(u, v, mode, 12).pts;
    const segments = splitAntimeridian(pts);

    const MODE_STYLE = {
      land: ['rgba(245, 158, 11, 0.26)', '4 6'],
      road: ['rgba(74, 222, 128, 0.35)', '2 5'],
      river: ['rgba(167, 139, 250, 0.55)', '8 4'],
      pipeline: ['rgba(244, 114, 182, 0.55)', '1 4'],
      maritime: ['rgba(56, 189, 248, 0.20)', null]
    };
    let [color, dashArray] = MODE_STYLE[mode] || MODE_STYLE.maritime;
    if (gState === 'blockaded') {
      color = 'rgba(239, 68, 68, 0.42)';
      dashArray = '3 6';
    }

    segments.forEach(seg => {
      L.polyline(seg, { color, weight: 1.4, dashArray, interactive: false }).addTo(state.layers.corridors);
    });
  }
}

function renderConflicts() {
  state.layers.conflicts.clearLayers();
  CONFLICTS.forEach(c => {
    L.circle([c.lat, c.lng], {
      radius: c.radiusKm * 1000,
      color: '#ef4444',
      weight: 1,
      fillColor: '#ef4444',
      fillOpacity: 0.12,
      dashArray: '4 4'
    }).addTo(state.layers.conflicts);

    const icon = L.divIcon({
      className: '',
      html: `<div class="conflict-pulse" title="${c.name}"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });

    L.marker([c.lat, c.lng], { icon })
      .bindPopup(`<b>${c.name}</b><br/><span style="color:#f87171;font-size:11px;">SEV ${c.severity} ${SEVERITY_LABELS[c.severity]} // ${c.intensity}</span><br/><span style="font-size:11px;color:#cbd5e1;">${c.summary}</span>`)
      .addTo(state.layers.conflicts);
  });

  // Render live OSINT / Domepolitical markers onto the conflicts layer
  state.osintEvents.forEach(ev => {
    const icon = L.divIcon({
      className: '',
      html: `<div style="width:9px;height:9px;border-radius:50%;background:#f59e0b;border:1.5px solid #fff;box-shadow:0 0 10px #f59e0b;"></div>`,
      iconSize: [9, 9],
      iconAnchor: [4.5, 4.5]
    });

    L.marker([ev.lat, ev.lng], { icon })
      .bindPopup(`
        <div style="font-family:JetBrains Mono;font-size:9.5px;color:#f59e0b;">${escapeHtml(ev.source)} // ${escapeHtml(ev.theater)}</div>
        <div style="font-weight:600;font-size:11.5px;margin:4px 0;">${escapeHtml(ev.title)}</div>
        ${ev.link ? `<a href="${escapeHtml(safeUrl(ev.link))}" target="_blank" rel="noopener noreferrer" style="color:#38bdf8;font-size:10.5px;">Open Dispatch →</a>` : ''}
      `)
      .addTo(state.layers.conflicts);
  });

  const badge = document.getElementById('theaterCount');
  if (badge) badge.textContent = `${CONFLICTS.length} THEATERS`;
}

async function syncLiveOsintWire(force = false) {
  const data = await fetchLiveOsintEvents(force);
  if (!data.events || !data.events.length) return null;
  state.osintEvents = data.events;
  renderConflicts();
  renderLeftBladeLists();
  return Math.max(...data.events.map(e => +e.fetched_at || 0)) || null;   // when the backend fetched the wire
}

// Sol solar-resource overlay (read-only GeoJSON from Sol; see js/sol-layer.js)
// Each Sol site is also registered in the Dijkstra mesh (SITES key SOL_<id>, linked to its
// logistics hub), so module freight from China is costed per site under the live gate states.
function registerSolSites(fc) {
  splitLayers(fc).site.forEach(f => {
    const p = f.properties;
    const [lng, lat] = f.geometry.coordinates;
    const { hub, host } = solRouting(p);
    const id = solSiteKey(p.id);
    registerSovereignSiteInMesh({ id, name: `${p.name} (Sol ${p.id})`, host: host || 'USA', lat, lng, hub,
                                  notes: `Sol site, corridor ${p.corridor_id}` });
    Object.assign(SITES[id], { sovereign: false, sol: true, solId: p.id });
  });
}

function solLogistics() {
  const out = {};
  Object.values(SITES).filter(s => s.sol).forEach(s => {
    try {
      const r = evaluateCorridorChemistry(SOL_MODULE_ORIGIN, s.id, CHOKEPOINTS, state.vesselKts);
      const ar = r.activeRoute, t = r.telemetry;
      const lastSea = [...(ar.legs || [])].reverse().find(l => l.mode === 'maritime');
      out[s.solId] = {
        origin: SOL_MODULE_ORIGIN, reachable: !!ar.reachable,
        usdPerFEU: t.freightUSD, usdPerKwp: t.freightUSD / KWP_PER_FEU, usdPerTonne: t.freightPerTonneUSD,
        days: t.activeDays, roadNM: (t.roadNM || 0) + (t.landNM || 0), warRiskBps: t.warRiskBps,
        port: lastSea ? GRAPH_NODES[lastSea.to]?.name : null,
        gates: (ar.transitedGates || []).map(g => CHOKEPOINTS.find(c => c.id === g)?.shortName || g)
      };
    } catch (_) { /* unknown endpoint: leave the site without logistics */ }
  });
  return out;
}

function renderSol() {
  const lg = state.solGeo ? solLogistics() : {};
  state.solLogistics = lg;
  renderSolLayer(state.layers.sol, state.solGeo, CONFLICTS, lg, state.solNowcast);
  renderSolPanel(document.getElementById('solPanel'), state.solGeo, CONFLICTS, state.solError, lg,
                 state.solNowcast, state.solNowcastMeta);
}

async function loadSol() {
  const { fc, error } = await fetchSolGeo();
  if (fc) { state.solGeo = fc; state.solError = null; registerSolSites(fc); }
  else if (!state.solGeo) state.solError = error;
  syncAllViews();
}

function feedHitsForGate(gateId) {
  return state.osintEvents.filter(ev => ev.gate === gateId).length;
}

/* Screen boxes of the gate labels that got a full label this zoom; nation
   pills avoid them too. Recomputed on every zoom (pans don't change overlap). */
let gateBoxes = [];
const GATE_RANK = { blockaded: 0, contested: 1, open: 2 };

function renderChokepointMarkers() {
  state.layers.chokepoints.clearLayers();
  gateBoxes = [];
  const z = map ? map.getZoom() : 4;
  /* blockaded and contested gates claim their label space first */
  const ordered = [...CHOKEPOINTS].sort((a, b) => (GATE_RANK[a.state] ?? 3) - (GATE_RANK[b.state] ?? 3));
  ordered.forEach(cp => {
    let full = true;
    if (map) {
      const pt = map.latLngToContainerPoint([cp.lat, cp.lng]);
      const w = Math.max(90, 30 + cp.shortName.length * 6.5 + (z <= 3 ? 0 : 10 + cp.state.length * 6.5));   /* the label box is never narrower than its 90px icon */
      const box = { x1: pt.x - w / 2, x2: pt.x + w / 2, y1: pt.y - 10, y2: pt.y + 10 };
      full = !gateBoxes.some(p => box.x1 < p.x2 + 2 && box.x2 > p.x1 - 2 && box.y1 < p.y2 + 1 && box.y2 > p.y1 - 1);
      if (full) gateBoxes.push(box);
    }
    const cls = `gate-marker ${cp.state}${cp.kind === 'border' ? ' border-gate' : ''}${full ? '' : ' gate-compact'}`;
    const icon = L.divIcon({
      className: '',
      html: full
        ? `<div class="${cls}" title="${cp.name}: Click to cycle state">
        ⚓ <span>${cp.shortName}</span> <span class="gate-label-text">[${cp.state.toUpperCase()}]</span>
      </div>`
        : `<div class="${cls}" title="${cp.name} [${cp.state.toUpperCase()}]: Click to cycle state">⚓</div>`,
      iconSize: full ? [90, 20] : [20, 20],
      iconAnchor: full ? [45, 10] : [10, 10]
    });

    const m = L.marker([cp.lat, cp.lng], { icon }).addTo(state.layers.chokepoints);
    m.on('click', () => {
      const order = ['open', 'contested', 'blockaded'];
      setGateState(cp.id, order[(order.indexOf(cp.state) + 1) % 3]);
    });
  });
}

const PILL_H = 22;
const pillWidth = n => 36 + n.id.length * 7 + (map && map.getZoom() <= 3 ? 0 : fmt.trillions(n.gdpNominal).length * 6.5 + 4);

function getSiteHosts() {
  // Host nations of YOUR sites always get a label. Sol sites don't force one: 21 of them would
  // force 12 West African labels past the overlap check and stack them (19 Oct 2026).
  return new Set(Object.values(SITES).filter(s => !s.sol).map(s => s.host));
}

function placementOrder() {
  const forced = new Set([state.originId, state.destId, state.dossierId, ...getSiteHosts()]);
  const inBloc = n => !!(state.activeBloc && n.blocs.includes(state.activeBloc));
  return Object.values(NATIONS).sort((a, b) =>
    (forced.has(b.id) - forced.has(a.id)) ||
    (inBloc(b) - inBloc(a)) ||
    ((b.gdpNominal ?? -1) - (a.gdpNominal ?? -1)));
}

function openDossierFor(n) {
  state.dossierId = n.id;
  document.getElementById('selDossierNation').value = n.id;
  renderDossier();
  renderNationNodes();
  if (window.innerWidth < 1024) {
    openMobilePanel('dossier', 'split');
  } else {
    switchBladeTab('right', 'dossier');
  }
}

function renderNationNodes() {
  state.layers.nations.clearLayers();
  if (!map) return;
  const z = map.getZoom();
  const budget = z >= 4 ? Infinity : (LABELS_BY_ZOOM[z] ?? LABELS_BY_ZOOM[2]);
  const forced = new Set([state.originId, state.destId, state.dossierId, ...getSiteHosts()]);
  const placed = [];
  const overlaps = b => [...placed, ...gateBoxes].some(p => b.x1 < p.x2 + 3 && b.x2 > p.x1 - 3 && b.y1 < p.y2 + 2 && b.y2 > p.y1 - 2);

  placementOrder().forEach((n, rank) => {
    const inActiveBloc = !!(state.activeBloc && n.blocs.includes(state.activeBloc));
    const isEndpoint = n.id === state.originId || n.id === state.destId;
    const pt = map.latLngToContainerPoint([n.lat, n.lng]);
    const w = pillWidth(n);
    const box = { x1: pt.x - w / 2, x2: pt.x + w / 2, y1: pt.y - PILL_H / 2, y2: pt.y + PILL_H / 2 };
    const asPill = forced.has(n.id) || (rank < budget && !overlaps(box));
    if (asPill) placed.push(box);

    const col = isEndpoint ? '#38bdf8' : inActiveBloc ? '#10b981' : 'rgba(148,163,184,0.45)';
    let marker;
    if (asPill) {
      const scale = isEndpoint || inActiveBloc ? 'transform:scale(1.1);' : '';
      marker = L.marker([n.lat, n.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div class="nation-pill" style="${scale}border:1.5px solid ${col};">
            ${flagImg(n.iso2)} <b>${n.id}</b> <span class="nation-gdp-sub" style="color:#38bdf8;">${fmt.trillions(n.gdpNominal)}</span>
          </div>`,
          iconSize: [74, 22],
          iconAnchor: [37, 11]
        }),
        zIndexOffset: forced.has(n.id) ? 1000 : 0
      });
    } else {
      marker = L.marker([n.lat, n.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div class="nation-dot" style="border-color:${col};${inActiveBloc ? 'background:#10b981;' : ''}"></div>`,
          iconSize: [8, 8],
          iconAnchor: [4, 4]
        })
      }).bindTooltip(`<b>${n.id}</b> ${n.name} · ${fmt.trillions(n.gdpNominal)}`, { direction: 'top', offset: [0, -4] });
    }
    marker.addTo(state.layers.nations);
    marker.on('click', () => openDossierFor(n));
  });

  // Project Sites & Sovereign Properties (Home HQ, Living Quarters, Operational Sites)
  Object.values(SITES).forEach(site => {
    const node = GRAPH_NODES[site.node];
    if (!node || site.sol) return;                     // Sol sites are drawn by the SOLAR layer
    const active = site.id === state.originId || site.id === state.destId;
    const cls = site.sovereign ? `sovereign-marker${active ? ' active' : ''}` : `site-marker${active ? ' active' : ''}`;
    const streamLink = site.streamUrl
      ? `<br/><a href="${escapeHtml(safeUrl(site.streamUrl))}" target="_blank" rel="noopener" style="color:#38bdf8;">[Open Live Stream / Feed ↗]</a>`
      : '';
    const notesLine = site.notes ? `<br/><span style="color:#cbd5e1;font-size:10.5px;">${escapeHtml(site.notes)}</span>` : '';

    const m = L.marker([node.lat, node.lng], {
      icon: L.divIcon({ className: '', html: `<div class="${cls}"></div>`, iconSize: [13, 13], iconAnchor: [6.5, 6.5] }),
      zIndexOffset: site.sovereign ? 1100 : 900
    }).bindTooltip(`<b>${escapeHtml(site.name)}</b> (${node.lat.toFixed(3)}°, ${node.lng.toFixed(3)}°)${notesLine}<br/><span style="color:#fcd34d;">Click: Set Destination // Shift+Click: Set Origin</span>`, { direction: 'top', offset: [0, -6] });

    if (site.streamUrl || site.notes) {
      m.bindPopup(`<b>${escapeHtml(site.name)}</b><br/>Coords: ${node.lat.toFixed(4)}°, ${node.lng.toFixed(4)}°${notesLine}${streamLink}`);
    }

    m.on('click', (ev) => {
      if (ev.originalEvent && ev.originalEvent.shiftKey) {
        state.originId = site.id;
        document.getElementById('selOrigin').value = site.id;
      } else {
        state.destId = site.id;
        document.getElementById('selDest').value = site.id;
      }
      syncAllViews();
    });
    m.addTo(state.layers.nations);
  });
}

// ----------------------------------------------------------------------------
// 3. RENDER ACTIVE DIJKSTRA ROUTE & CHEMISTRY HUD (WITH $/TONNE & $/FEU)
// ----------------------------------------------------------------------------
function renderChemistryAndRoute() {
  try {
    renderChemistryAndRouteInner();
  } catch (err) {
    console.error('[STRATCOM] Chemistry panel failed:', err);
    document.getElementById('chemistryOutput').innerHTML = `
      <div class="intel-card" style="border-color:#ef4444;background:rgba(127,29,29,0.28);">
        <div class="card-title" style="color:#fca5a5;">⛔ CHEMISTRY ENGINE ERROR</div>
        <div style="font-family:JetBrains Mono;font-size:10.5px;color:#fecaca;margin-top:4px;">${escapeHtml(err.message)}</div>
        <div style="font-size:11px;color:#fecaca;margin-top:6px;">If the header says STALE CACHE, hard-refresh with Ctrl+Shift+R.</div>
      </div>`;
    syncMobileMirrorIfActive('chemistry');
  }
}

function usd(v, withSign = false) {
  const sign = !withSign ? '' : v >= 0 ? '+' : '−';
  return `${sign}$${Math.abs(Math.round(v)).toLocaleString()}`;
}

const LEG_TAG = {
  land: '<span class="leg-tag">RAIL</span>',
  road: '<span class="leg-tag road">ROAD</span>',
  river: '<span class="leg-tag river">RIVER</span>',
  pipeline: '<span class="leg-tag pipe">PIPELINE</span>'
};

function inlandText(res, overland) {
  const legs = res.activeRoute.legs;
  const isSea = l => l.mode === 'maritime';
  const name = id => `<b>${GRAPH_NODES[id].name}</b>`;
  const firstSea = legs.findIndex(isSea);
  const lastSea = legs.length - 1 - [...legs].reverse().findIndex(isSea);
  const handoffs = legs.filter((l, i) => i > 0 && legs[i - 1].mode !== l.mode);
  const touches = m => handoffs.some(l => l.mode === m || legs[legs.indexOf(l) - 1].mode === m);

  let lead;
  if (firstSea === -1) {
    lead = `Overland from ${name(legs[0].from)}: <b>${overland}</b>.`;
  } else {
    const inStart = firstSea > 0, inEnd = lastSea < legs.length - 1;
    const loadPort = name(legs[firstSea].from), unloadPort = name(legs[lastSea].to);
    lead = inStart && inEnd ? `Inland to ${loadPort}, sea to ${unloadPort}, then inland again (<b>${overland}</b> in total).`
      : inStart ? `<b>${overland}</b> from ${name(legs[0].from)} to ${loadPort}, then sea.`
      : `Sea to ${unloadPort}, then <b>${overland}</b>.`;
  }
  const n = handoffs.length;
  const dwell = !n ? ''
    : touches('road') ? ` Transit days include ~5 days port clearance at each road handoff (${n} handoff${n === 1 ? '' : 's'}).`
    : touches('river') ? ` Transit days include ~2 days per barge↔ship/rail transshipment (${n} handoff${n === 1 ? '' : 's'}).`
    : ` Transit days include ~2 days transshipment at the port→rail handoff.`;
  return lead + dwell;
}

function renderChemistryAndRouteInner() {
  state.layers.activeRoute.clearLayers();
  const res = evaluateCorridorChemistry(state.originId, state.destId, CHOKEPOINTS, state.vesselKts);

  if (res.isDiverted || !res.activeRoute.reachable) {
    res.baselineRoute.multiPolyline.forEach(seg => {
      L.polyline(seg, { color: '#ef4444', weight: 2.2, dashArray: '6 8', opacity: 0.75 }).addTo(state.layers.activeRoute);
    });
  }

  if (res.activeRoute.reachable) {
    const routeCol = res.isDiverted ? '#f59e0b' : '#38bdf8';
    res.activeRoute.multiPolyline.forEach(seg => {
      L.polyline(seg, { color: routeCol, weight: 5, opacity: 0.25 }).addTo(state.layers.activeRoute);
      L.polyline(seg, { color: routeCol, weight: 2.6, dashArray: '10 6', opacity: 0.95 }).addTo(state.layers.activeRoute);
    });
  }

  const t = res.telemetry;
  const overland = [t.pipeNM ? `${t.pipeNM.toLocaleString()} NM pipeline (oil/gas only)` : '',
    t.riverNM ? `${t.riverNM.toLocaleString()} NM river barge` : '',
    t.roadNM ? `${t.roadNM.toLocaleString()} NM road` : '', t.landNM ? `${t.landNM.toLocaleString()} NM rail` : '']
    .filter(Boolean).join(' + ');
  const landNote = overland && !res.inlandCorridor
    ? `<div style="font-size:10.5px;color:#fde68a;margin-top:3px;">Includes <b>${overland}</b> and ${t.modeTransfers} port↔land transshipment${t.modeTransfers === 1 ? '' : 's'} (capacity-limited; not viable for bulk/ULCV volumes).</div>`
    : '';
  const costNote = res.isDiverted && t.deltaNM < 0 && t.deltaFreightUSD > 0
    ? `<div style="font-size:10.5px;color:#fde68a;margin-top:3px;">Shorter on the map, but <b>${usd(t.deltaFreightPerTonneUSD, true)}/tonne (${usd(t.deltaFreightUSD, true)}/FEU)</b> dearer: overland rates run ~5x (rail) to ~15x (truck) a ship's per mile.</div>`
    : '';
  const inlandNote = res.inlandCorridor && res.activeRoute.reachable
    ? `<div class="intel-card" style="border-color:rgba(74,222,128,0.45);margin-bottom:10px;">
         <div class="card-title" style="color:#86efac;">🛣️ INLAND CORRIDOR</div>
         <div style="font-size:11px;color:#bbf7d0;margin-top:3px;">${inlandText(res, overland)}</div>
       </div>`
    : '';

  const portName = id => GRAPH_NODES[id].name;
  const switchNote = res.portSwitch
    ? `<div style="font-size:10.5px;color:#fde68a;margin-top:3px;">Port switch: ${[0, 1]
        .filter(i => res.portSwitch.from[i] !== res.portSwitch.to[i])
        .map(i => `<b>${portName(res.portSwitch.from[i])}</b> → <b>${portName(res.portSwitch.to[i])}</b>`)
        .join(', ')}. Secondary ports carry only part of national volumes.</div>`
    : '';

  const statusBanner = !res.activeRoute.reachable
    ? `<div class="intel-card" style="border-color:#ef4444;background:rgba(127,29,29,0.28);margin-bottom:10px;">
         <div class="card-title" style="color:#fca5a5;">⛔ CORRIDOR SEVERED BY BLOCKADE</div>
         <div style="font-size:11px;color:#fecaca;margin-top:3px;">All modeled maritime & overland paths between ${res.origin.name} and ${res.dest.name} are interdicted.</div>
       </div>`
    : res.isDiverted
    ? `<div class="intel-card" style="border-color:${res.overlandFallback ? '#ef4444' : '#f59e0b'};background:rgba(120,53,15,0.28);margin-bottom:10px;">
         <div class="card-title" style="color:#fcd34d;">${res.overlandFallback
           ? '⛔ SEA ROUTE SEVERED: OVERLAND FALLBACK'
           : res.modeShift ? '🔀 MODE SHIFT: OVERLAND NOW CHEAPER THAN THE DIVERTED SEA ROUTE'
           : '⚠️ DIJKSTRA EMERGENCY REROUTE ACTIVE'}</div>
         <div style="font-size:11px;color:#fde68a;margin-top:3px;">
           Diversion: <b>${signed(t.deltaNM, ' NM')}</b>, <b>${signed(t.deltaDays, ' days')}</b> at ${state.vesselKts} kts,
           <b>${usd(t.deltaFreightPerTonneUSD, true)}/tonne</b> (<b>${usd(t.deltaFreightUSD, true)}/FEU</b>),
           <b>${signed(t.extraFuelMT, ' MT')}</b> VLSFO <span class="prov-tag">(~${t.burnMTd} MT/day, approx.)</span>
         </div>
         ${switchNote}
         ${landNote}
         ${costNote}
       </div>`
    : '';

  const macroNote = res.missingMacro.length
    ? `<div class="helper-copy prov-warn" style="margin:0 0 10px;">Missing macro figures for ${res.missingMacro.join(', ')}: run <b>tools/build_nations.py</b> to pull World Bank data. Economic pillar understated.</div>`
    : '';

  const chainHtml = res.activeRoute.reachable
    ? [
        res.activeRoute.nodeNames[0],
        ...res.activeRoute.legs
          .filter(l => !GRAPH_NODES[l.to].waypoint)
          .map(l => `${LEG_TAG[l.mode] || ''}${GRAPH_NODES[l.to].name}`)
      ].join(' → ')
    : 'Route interdicted';

  const flowsHtml = res.complementarity.flows.length
    ? res.complementarity.flows.map(f => `${f.from} → ${f.to}: <b>${f.family}</b>`).join(' &nbsp;•&nbsp; ')
    : 'No matching export→import families in the dossier data.';

  const analystShared = res.sharedBlocs.filter(b => !res.tieBlocs.includes(b));
  const html = `
    ${statusBanner}
    ${inlandNote}
    ${macroNote}
    <div class="chem-hero">
      <div>
        <div class="kpi-label">${flagImg(res.origin.iso2)} ${res.origin.name} ↔ ${flagImg(res.dest.iso2)} ${res.dest.name}</div>
        <div class="chem-score-val" style="color:${res.gradeColor};">${res.composite}<span style="font-size:14px;color:#94a3b8;">/100</span></div>
        <div style="font-size:11px;color:#94a3b8;margin-top:3px;">
          Shared Blocs: <b style="color:#f1f5f9;">${res.tieBlocs.length ? res.tieBlocs.join(', ') : 'None (Bilateral)'}</b>
          ${analystShared.length ? `<span class="prov-tag">also: ${analystShared.join(', ')}</span>` : ''}
        </div>
        ${res.rivalry ? `<div style="font-size:10.5px;color:#fca5a5;margin-top:2px;">Strategic rivalry: −${res.rivalry} on alignment</div>` : ''}
      </div>
      <div class="chem-grade-badge" style="color:${res.gradeColor};">TIER ${res.grade}</div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-box">
        <div class="kpi-label">ROUTE DISTANCE &amp; FREIGHT</div>
        <div class="kpi-val" style="color:#38bdf8;">
          ${res.activeRoute.reachable ? t.activeNM.toLocaleString() + ' NM' : 'SEVERED'}
        </div>
        ${res.activeRoute.reachable ? `<div class="kpi-sub" title="Freight model: $/Metric Tonne (24 MT/FEU reference scaled by vessel class) & $/FEU linehaul + terminal handling">≈ <b style="color:#fcd34d;">${usd(t.freightPerTonneUSD)}/tonne</b> · ${usd(t.freightUSD)}/FEU</div>` : ''}
      </div>
      <div class="kpi-box">
        <div class="kpi-label">EST. TRANSIT (${state.vesselKts} KTS)</div>
        <div class="kpi-val" style="color:#10b981;">
          ${res.activeRoute.reachable ? t.activeDays + ' Days' : 'N/A'}
        </div>
        ${res.activeRoute.reachable ? `<div class="kpi-sub">${Math.round(t.activeNM * 1.852).toLocaleString()} km orthodromic/lane</div>` : ''}
      </div>
      <div class="kpi-box">
        <div class="kpi-label">WAR / SECURITY RISK</div>
        <div class="kpi-val" style="color:${t.warRiskBps > 50 ? '#f59e0b' : '#f1f5f9'};">+${t.warRiskBps} bps</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">COMBINED PPP GDP</div>
        <div class="kpi-val">$${((res.origin.gdpPPP || 0) + (res.dest.gdpPPP || 0)).toFixed(1)}T</div>
      </div>
    </div>

    <div class="intel-card" style="margin-bottom:10px;">
      <div class="kpi-label" style="margin-bottom:8px;">4-PILLAR CHEMISTRY DECOMPOSITION</div>
      ${res.pillars.map(p => `
        <div class="bar-row">
          <div class="bar-meta">
            <span>${p.label}</span>
            <b style="font-family:JetBrains Mono;color:${p.color};">${p.val}/100</b>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${p.val}%;background:${p.color};"></div>
          </div>
        </div>
      `).join('')}
      <div style="font-size:10.5px;color:#94a3b8;margin-top:6px;line-height:1.45;">
        <span class="kpi-label">COMPLEMENTARY FLOWS:</span> ${flowsHtml}
      </div>
    </div>

    <div class="intel-card">
      <div class="kpi-label" style="margin-bottom:5px;">ACTIVE DIJKSTRA WAYPOINT CHAIN</div>
      <div style="font-family:JetBrains Mono;font-size:10.5px;color:#cbd5e1;line-height:1.5;">${chainHtml}</div>
    </div>
  `;

  document.getElementById('chemistryOutput').innerHTML = html;
  syncMobileMirrorIfActive('chemistry');
  if (state.globe3dActive) syncGlobe3DOverlays();
}

// ----------------------------------------------------------------------------
// 4. RENDER NATION DOSSIER + ASYNC WORLD BANK SPARKLINE
// ----------------------------------------------------------------------------
async function renderDossier() {
  const n = NATIONS[state.dossierId];
  const container = document.getElementById('dossierOutput');

  const trajectorySlot = (wb) => {
    if (!wb) {
      return `<div class="helper-copy" style="margin:6px 0 0;">Fetching World Bank series…</div>`;
    }
    if (wb.unavailable === 'no-coverage') {
      return `<div class="helper-copy prov-warn" style="margin:6px 0 0;">The World Bank does not publish data for this economy. No series shown.</div>`;
    }
    if (wb.unavailable) {
      return `<div class="helper-copy prov-warn" style="margin:6px 0 0;">World Bank API unreachable. No series shown.</div>`;
    }
    return buildSparklineSVG(wb.series, '#38bdf8') +
      `<div class="prov-tag" style="margin:4px 0 0;">Reported series to ${wb.lastYear}.</div>`;
  };

  const prov = f => {
    const p = n.prov && n.prov[f];
    if (!p) return `<span class="prov-tag prov-warn">no data</span>`;
    return `<span class="prov-tag${p === 'est.' ? ' prov-warn' : ''}">${p}</span>`;
  };
  const ports = n.ports.map(p => `${GRAPH_NODES[p.id].name}${p.penaltyNM ? ' <span class="prov-tag">(secondary)</span>' : ''}`).join(' • ');
  const macroLine = macroStatus.loaded
    ? `World Bank data built ${macroStatus.generated}`
    : 'World Bank data not built yet: run tools/build_nations.py';

  const renderCard = (wb) => `
    <div class="intel-card" style="margin-bottom:10px;">
      <div class="card-head">
        <div style="font-size:16px;font-weight:700;">${flagImg(n.iso2)} ${n.name}</div>
        <span style="font-family:JetBrains Mono;font-size:10px;color:#38bdf8;">${n.nuclear ? '☢️ NUCLEAR STATE' : 'CONVENTIONAL'}</span>
      </div>
      <div style="font-size:11px;color:#94a3b8;">${n.region}</div>
      <div style="font-size:11px;color:#94a3b8;margin-top:3px;">Blocs: <b style="color:#f1f5f9;">${n.blocs.length ? n.blocs.join(' • ') : 'Non-Aligned / Bilateral'}</b></div>
      <div style="font-size:11px;color:#94a3b8;margin-top:3px;">Ports: <span style="color:#e2e8f0;">${ports}</span>${n.gateway ? ` <span class="prov-tag">${n.gateway}</span>` : ''}</div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-box">
        <div class="kpi-label">NOMINAL GDP ${prov('gdpNominal')}</div>
        <div class="kpi-val" style="color:#38bdf8;">${fmt.trillions(n.gdpNominal)}</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">GDP (PPP) ${prov('gdpPPP')}</div>
        <div class="kpi-val" style="color:#10b981;">${fmt.trillions(n.gdpPPP)}</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">REAL GDP GROWTH ${prov('growth')}</div>
        <div class="kpi-val">${fmt.pct(n.growth)}</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">POPULATION ${prov('population')}</div>
        <div class="kpi-val">${fmt.millions(n.population)}</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">MILITARY SPEND ${prov('milBudget')}</div>
        <div class="kpi-val" style="color:#f59e0b;">${fmt.billions(n.milBudget)}</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">ARMED FORCES ${prov('activeForces')}</div>
        <div class="kpi-val" style="color:#f59e0b;">${fmt.people(n.activeForces)}</div>
      </div>
    </div>
    <div class="prov-tag" style="margin:-4px 0 10px;">${macroLine}</div>

    <div class="intel-card" style="margin-bottom:10px;">
      <div class="card-head">
        <span class="kpi-label">MULTI-YEAR GDP TRAJECTORY</span>
        <span style="font-family:JetBrains Mono;font-size:9px;color:#10b981;">${wb && wb.source ? wb.source : ''}</span>
      </div>
      ${trajectorySlot(wb)}
    </div>

    <div class="intel-card">
      <div class="kpi-label" style="margin-bottom:4px;">CRITICAL EXPORT VECTORS</div>
      <div style="font-size:11.5px;color:#e2e8f0;margin-bottom:8px;">${n.exports.join(' • ')}</div>
      <div class="kpi-label" style="margin-bottom:4px;">STRATEGIC IMPORT DEPENDENCIES</div>
      <div style="font-size:11.5px;color:#94a3b8;">${n.imports.join(' • ')}</div>
    </div>
  `;

  container.innerHTML = renderCard(null);
  syncMobileMirrorIfActive('dossier');

  const wb = await fetchWorldBankTelemetry(n.iso3);
  if (state.dossierId === n.id) {
    container.innerHTML = renderCard(wb);
    syncMobileMirrorIfActive('dossier');
  }
}

// ----------------------------------------------------------------------------
// 5. RENDER LEFT BLADE LISTS (WAR-GAME GATES, SOVEREIGN NODES, LIVE WIRE, BLOCS)
// ----------------------------------------------------------------------------
function renderLeftBladeLists() {
  const gateCard = cp => {
    const hits = feedHitsForGate(cp.id);
    const suggest = hits >= FEED_CONTEST_THRESHOLD && cp.state === 'open';
    const signal = hits === 0 ? '' : `
      <div class="feed-signal ${suggest ? '' : 'quiet'}">
        <span>📡 ${hits} feed hit${hits === 1 ? '' : 's'}${suggest ? ' → suggests CONTESTED' : ''}</span>
        ${suggest ? `<button class="btn-apply-signal" data-gate="${cp.id}" data-state="contested">APPLY</button>` : ''}
      </div>`;

    return `
    <div class="intel-card">
      <div class="card-head">
        <span class="card-title">${cp.name}</span>
      </div>
      <div style="font-family:JetBrains Mono;font-size:10px;color:#38bdf8;margin-bottom:4px;">${cp.dailyFlow}</div>
      <div style="font-size:11px;color:#94a3b8;">${cp.desc}</div>
      <div class="gate-controls">
        ${['open', 'contested', 'blockaded'].map(st => `
          <button class="gate-btn state-${st}${cp.state === st ? ' active' : ''}" data-gate="${cp.id}" data-state="${st}">
            ${st.toUpperCase()}
          </button>
        `).join('')}
      </div>
      ${signal}
    </div>`;
  };

  const sea = CHOKEPOINTS.filter(cp => cp.kind !== 'border');
  const land = CHOKEPOINTS.filter(cp => cp.kind === 'border');
  const regions = [...new Set(land.map(cp => cp.region || 'Other'))];
  document.getElementById('chokepointList').innerHTML =
    sea.map(gateCard).join('') +
    regions.map(r => `<div class="bloc-group-label" style="margin:6px 0 0;">INLAND CORRIDOR GATES (${r.toUpperCase()})</div>` +
      land.filter(cp => (cp.region || 'Other') === r).map(gateCard).join('')).join('');

  // 5B-0. Sovereign Nodes & Operational Sites section at top of Flashpoints/Intel blade
  const sovSites = Object.values(SITES).filter(s => !s.sol);
  const sovHtml = sovSites.length ? `
    <div class="section-banner" style="margin-top:2px;color:#38bdf8;">
      <span>SOVEREIGN NODES &amp; PROJECT SITES</span>
      <span>${sovSites.length} SITES</span>
    </div>
    ${sovSites.map(s => {
      const gn = GRAPH_NODES[s.node] || { lat: 0, lng: 0 };
      return `
        <div class="intel-card" style="border-color:rgba(56,189,248,0.38);cursor:pointer;" data-c-lat="${gn.lat}" data-c-lng="${gn.lng}" data-site-id="${s.id}">
          <div class="card-head">
            <span style="font-family:JetBrains Mono;font-size:9.5px;color:#fcd34d;">◆ ${s.sovereign ? 'SOVEREIGN HQ / NODE' : 'PROJECT SITE'}</span>
            <span style="font-family:JetBrains Mono;font-size:9px;color:#38bdf8;">${gn.lat.toFixed(2)}°, ${gn.lng.toFixed(2)}°</span>
          </div>
          <div style="font-size:12px;font-weight:600;color:#f1f5f9;">${escapeHtml(s.name)}</div>
          ${s.notes ? `<div style="font-size:10.5px;color:#94a3b8;margin-top:2px;">${escapeHtml(s.notes)}</div>` : ''}
          ${s.streamUrl ? `<div style="margin-top:4px;"><a href="${escapeHtml(safeUrl(s.streamUrl))}" target="_blank" rel="noopener" style="font-family:JetBrains Mono;font-size:9.5px;color:#10b981;">▶ OPEN LIVE FEED / CAMERA STREAM ↗</a></div>` : ''}
        </div>
      `;
    }).join('')}
  ` : '';

  // 5B. Flashpoints: live wire above the baseline theaters
  const wireHtml = state.osintEvents.length ? `
      <div class="section-banner" style="margin-top:8px;color:#f59e0b;">
        <span>LIVE RSS / OSINT &amp; DOMEPOLITICAL WIRE</span>
        <span>${state.osintEvents.length} HITS</span>
      </div>
      ${state.osintEvents.slice(0, 12).map(ev => `
        <div class="intel-card" style="border-color:rgba(245,158,11,0.35);cursor:pointer;" data-c-lat="${+ev.lat}" data-c-lng="${+ev.lng}">
          <div class="card-head">
            <span style="font-family:JetBrains Mono;font-size:9px;color:#f59e0b;">${escapeHtml(ev.source)}</span>
            <span style="font-family:JetBrains Mono;font-size:9px;color:#38bdf8;">${escapeHtml(ev.theater)}</span>
          </div>
          <div style="font-size:11.5px;font-weight:500;color:#f1f5f9;line-height:1.35;">${escapeHtml(ev.title)}</div>
        </div>
      `).join('')}
      <div class="section-banner" style="margin-top:10px;">
        <span>BASELINE KINETIC THEATERS</span>
        <span class="prov-tag">${DATA_VINTAGE.conflicts}</span>
      </div>` : '';

  document.getElementById('conflictList').innerHTML = sovHtml + wireHtml + CONFLICTS.map(c => `
    <div class="intel-card" style="cursor:pointer;" data-c-lat="${c.lat}" data-c-lng="${c.lng}">
      <div class="card-head">
        <span class="card-title">${c.name}</span>
        <span style="font-family:JetBrains Mono;font-size:9.5px;color:#ef4444;">SEV ${c.severity} · ${SEVERITY_LABELS[c.severity]}</span>
      </div>
      <div style="font-family:JetBrains Mono;font-size:9.5px;color:#f59e0b;margin-bottom:4px;">${c.intensity}</div>
      <div style="font-size:11px;color:#94a3b8;">${c.summary}</div>
    </div>
  `).join('');

  // 5C. Blocs
  document.getElementById('blocGrid').innerHTML = BLOC_GROUPS.map(g => `
    <div class="bloc-group-label">${g.label}</div>
    ${BLOCS.filter(b => b.group === g.id).map(b => {
      const modelled = b.members.filter(iso => NATIONS[iso]).length;
      return `
      <button class="bloc-btn ${state.activeBloc === b.id ? 'active' : ''}" data-bloc="${b.id}">
        <div style="font-family:JetBrains Mono;font-weight:700;font-size:11.5px;color:${b.color};">${b.id}</div>
        <div style="font-size:10px;color:#94a3b8;">${b.type}</div>
        <div class="prov-tag" style="margin:2px 0 0;">${modelled}/${b.members.length} modelled</div>
      </button>`;
    }).join('')}
  `).join('');

  const activeBlocObj = BLOCS.find(b => b.id === state.activeBloc);
  if (activeBlocObj) {
    const members = activeBlocObj.members.map(iso => NATIONS[iso]).filter(Boolean);
    const withGdp = members.filter(n => n.gdpNominal != null);
    const gdpSum = withGdp.reduce((s, n) => s + n.gdpNominal, 0);
    const chips = activeBlocObj.members.map(iso => NATIONS[iso]
      ? `<span class="member-chip">${iso}</span>`
      : `<span class="member-chip off" title="Not modelled yet">${iso}</span>`).join('');
    document.getElementById('blocTelemetry').innerHTML = `
      <div class="intel-card" style="border-color:${activeBlocObj.color};margin-bottom:10px;">
        <div class="card-title">${activeBlocObj.name}</div>
        <div style="font-family:JetBrains Mono;font-size:11px;color:${activeBlocObj.color};margin-top:3px;">
          Combined GDP (modelled members): ${withGdp.length ? fmt.trillions(gdpSum) : '—'}
          <span class="prov-tag">${withGdp.length}/${activeBlocObj.members.length} members with data</span>
        </div>
        ${activeBlocObj.note ? `<div class="helper-copy" style="margin:5px 0 0;">${activeBlocObj.note}</div>` : ''}
        <div class="member-chips">${chips}</div>
      </div>`;
  } else {
    document.getElementById('blocTelemetry').innerHTML =
      `<div class="helper-copy">Tap any alliance or economic community below to highlight member nodes on the globe.</div>`;
  }

  syncMobileMirrorIfActive('wargame');
  syncMobileMirrorIfActive('conflicts');
}

// ----------------------------------------------------------------------------
// 6. AUTONOMOUS KINEMATIC AIS & NAVAL TRANSPONDER LOOP
// ----------------------------------------------------------------------------
function initAutonomousVessels() {
  state.autonomousVessels = VESSEL_MANIFEST.map(spec => {
    const v = { ...spec, waypoints: [], cumNM: [0], totalNM: 0, distNM: 0, lastTip: 0 };
    v.marker = L.marker([GRAPH_NODES[v.orig].lat, GRAPH_NODES[v.orig].lng], {
      icon: L.divIcon({
        className: '',
        html: `<div style="width:10px;height:10px;border-radius:50%;background:${v.type === 'naval' ? '#a855f7' : '#10b981'};border:1.5px solid #fff;box-shadow:0 0 8px currentColor;"></div>`,
        iconSize: [10, 10],
        iconAnchor: [5, 5]
      })
    }).addTo(state.layers.vessels);
    v.marker.bindTooltip(`<b>${v.name}</b>`, { direction: 'top' });
    return v;
  });

  recomputeVesselRoutes();
}

function recomputeVesselRoutes() {
  const gateMap = Object.fromEntries(CHOKEPOINTS.map(c => [c.id, c.state]));
  state.autonomousVessels.forEach(v => {
    const frac = v.totalNM > 0 ? v.distNM / v.totalNM : v.progress;
    const route = computeShortestRoute(v.orig, v.dest, gateMap, {
      modes: ['maritime'],
      excludeGates: v.panama ? [] : ['panama']
    });
    v.severed = !(route.reachable && route.flatWaypoints.length > 1);
    v.waypoints = v.severed ? [[GRAPH_NODES[v.orig].lat, GRAPH_NODES[v.orig].lng]] : route.flatWaypoints;

    v.cumNM = [0];
    for (let i = 1; i < v.waypoints.length; i++) {
      const [a, b] = [v.waypoints[i - 1], v.waypoints[i]];
      v.cumNM.push(v.cumNM[i - 1] + haversineNM(a[0], a[1], b[0], b[1]));
    }
    v.totalNM = v.cumNM[v.cumNM.length - 1];
    v.distNM = frac * v.totalNM;
    if (v.severed) v.marker.setLatLng(v.waypoints[0]);
  });
}

function positionAt(v) {
  let i = 1;
  while (i < v.cumNM.length - 1 && v.cumNM[i] < v.distNM) i++;
  const segLen = Math.max(1e-9, v.cumNM[i] - v.cumNM[i - 1]);
  const t = Math.min(1, Math.max(0, (v.distNM - v.cumNM[i - 1]) / segLen));
  const a = v.waypoints[i - 1], b = v.waypoints[i];
  if (Math.abs(b[1] - a[1]) > 180) return { lat: b[0], lng: b[1], a, b };
  return { lat: a[0] + (b[0] - a[0]) * t, lng: a[1] + (b[1] - a[1]) * t, a, b };
}

function startKinematicLoop() {
  let lastTime = performance.now();

  function tick(now) {
    const dt = Math.min(0.25, (now - lastTime) / 1000);
    lastTime = now;

    if (state.simSpeed > 0) {
      state.autonomousVessels.forEach(v => {
        if (v.severed || v.totalNM <= 0) return;
        v.distNM = (v.distNM + v.kts * SIM_HOURS_PER_SEC * state.simSpeed * dt) % v.totalNM;
        const p = positionAt(v);
        v.marker.setLatLng([p.lat, p.lng]);
      });
    }

    state.autonomousVessels.forEach(v => {
      if (!v.marker.isTooltipOpen() || now - v.lastTip < TOOLTIP_REFRESH_MS) return;
      v.lastTip = now;
      if (v.severed) {
        v.marker.setTooltipContent(`<b>${v.name}</b><br/>HOLDING — route severed`);
        return;
      }
      const p = positionAt(v);
      const hdg = Math.round(bearingDeg(p.a[0], p.a[1], p.b[0], p.b[1]));
      v.marker.setTooltipContent(`<b>${v.name}</b><br/>HDG ${hdg}°T // ${v.kts} kts`);
    });

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ----------------------------------------------------------------------------
// 7. MOBILE SHEET, DESKTOP TABS & DELEGATED EVENT WIRING
// ----------------------------------------------------------------------------
let currentMobilePanel = 'map';

function setGateState(gateId, newState) {
  const gate = CHOKEPOINTS.find(c => c.id === gateId);
  if (!gate || !['open', 'contested', 'blockaded'].includes(newState)) return;
  gate.state = newState;
  persistGateState(gate.id, gate.state);
  syncAllViews();
}

function flyToCard(el) {
  const lat = +el.dataset.cLat, lng = +el.dataset.cLng;
  if (state.globe3dActive && globe3d) {
    globe3d.flyTo(lat, lng, 6);
  } else {
    map.flyTo([lat, lng], 6, { duration: 1.1 });
  }
  if (el.dataset.siteId && SITES[el.dataset.siteId]) {
    state.destId = el.dataset.siteId;
    document.getElementById('selDest').value = el.dataset.siteId;
    syncAllViews();
  }
  if (window.innerWidth < 1024) setMobileSnap('split');
}

function initDelegatedClicks() {
  document.addEventListener('click', e => {
    const solRoute = e.target.closest('[data-sol-route]');
    if (solRoute && SITES[solRoute.dataset.solRoute]) {
      state.originId = SOL_MODULE_ORIGIN;
      state.destId = solRoute.dataset.solRoute;
      switchBladeTab('right', 'chemistry');
      syncAllViews();
      return;
    }

    const gateBtn = e.target.closest('.gate-btn, .btn-apply-signal');
    if (gateBtn) { setGateState(gateBtn.dataset.gate, gateBtn.dataset.state); return; }

    const card = e.target.closest('[data-c-lat]');
    if (card && !e.target.closest('a')) { flyToCard(card); return; }

    const bloc = e.target.closest('.bloc-btn');
    if (bloc) {
      state.activeBloc = state.activeBloc === bloc.dataset.bloc ? null : bloc.dataset.bloc;
      renderLeftBladeLists();
      renderNationNodes();
      if (state.globe3dActive) syncGlobe3DOverlays();
    }
  });
}

function setMobileSnap(snapState) {
  document.getElementById('mobileSheet').setAttribute('data-snap', snapState);
  setTimeout(() => map.invalidateSize(), 300);
}

function openMobilePanel(panelKey, snap = 'split') {
  currentMobilePanel = panelKey;
  document.querySelectorAll('.dock-btn').forEach(b => b.classList.toggle('active', b.dataset.mobPanel === panelKey));

  if (panelKey === 'map') {
    setMobileSnap('collapsed');
    return;
  }

  const titles = {
    chemistry: 'CORRIDOR CHEMISTRY ENGINE',
    wargame: 'CHOKEPOINT WAR-GAME SIMULATOR',
    dossier: 'NATION MACRO & MILITARY DOSSIER',
    conflicts: 'ACTIVE KINETIC & LIVE FEEDS',
    blocs: 'ALLIANCES & ECONOMIC BLOCS',
    solar: 'SOLAR RESOURCE // SOL CORRIDORS'
  };
  document.getElementById('mobileSheetTitle').textContent = titles[panelKey] || 'STRATCOM';
  hostPanelInSheet(panelKey);
  setMobileSnap(snap);
}

const MOBILE_PANELS = {
  chemistry: 'view-chemistry', wargame: 'view-wargame', dossier: 'view-dossier',
  conflicts: 'view-conflicts', blocs: 'view-blocs', solar: 'view-solar'
};
const panelHome = {};
let hostedPanel = null;

function returnHostedPanel() {
  if (!hostedPanel) return;
  const el = document.getElementById(hostedPanel);
  const home = panelHome[hostedPanel];
  home.parent.insertBefore(el, home.next);
  hostedPanel = null;
}

function hostPanelInSheet(panelKey) {
  const id = MOBILE_PANELS[panelKey];
  if (!id || hostedPanel === id) return;
  returnHostedPanel();
  const el = document.getElementById(id);
  if (!panelHome[id]) panelHome[id] = { parent: el.parentNode, next: el.nextSibling };
  document.getElementById('mobileSheetContent').appendChild(el);
  hostedPanel = id;
}

function syncMobileMirrorIfActive() {}

window.addEventListener('resize', () => {
  if (window.innerWidth >= 1024) returnHostedPanel();
});

function switchBladeTab(side, tabId) {
  const blade = document.getElementById(side === 'left' ? 'bladeLeft' : 'bladeRight');
  blade.querySelectorAll('.blade-tab').forEach(t => t.classList.toggle('active', t.dataset[`${side}Tab`] === tabId));
  blade.querySelectorAll('.blade-body').forEach(b => b.classList.toggle('active', b.id === `view-${tabId}`));
}

function populateEndpointSelectors() {
  const nationOptions = REGIONS.map(region => {
    const list = Object.values(NATIONS)
      .filter(n => n.region === region)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!list.length) return '';
    return `<optgroup label="${region}">${list
      .map(n => `<option value="${n.id}">[${n.id}] ${n.name} (${fmt.trillions(n.gdpNominal)})</option>`)
      .join('')}</optgroup>`;
  }).join('');

  const selOrig = document.getElementById('selOrigin');
  const selDest = document.getElementById('selDest');
  const selDos = document.getElementById('selDossierNation');

  const own = Object.values(SITES).filter(s => !s.sol);
  const sol = Object.values(SITES).filter(s => s.sol);
  const siteOptions = (own.length
    ? `<optgroup label="Sovereign Nodes & Project Sites">${own.map(s => `<option value="${s.id}">◆ ${escapeHtml(s.name)}</option>`).join('')}</optgroup>`
    : '') + (sol.length
    ? `<optgroup label="Sol Solar Sites">${sol.map(s => `<option value="${s.id}">☀ ${escapeHtml(s.name)}</option>`).join('')}</optgroup>`
    : '');
  selOrig.innerHTML = siteOptions + nationOptions;
  selDest.innerHTML = siteOptions + nationOptions;
  if (!selDos.innerHTML) selDos.innerHTML = nationOptions;

  selOrig.value = state.originId;
  selDest.value = state.destId;
  selDos.value = state.dossierId;
}

function syncAllViews() {
  populateEndpointSelectors();
  renderSol();
  renderBackgroundCorridors();
  renderChokepointMarkers();
  renderNationNodes();
  renderLeftBladeLists();
  renderChemistryAndRoute();
  recomputeVesselRoutes();
}

// ----------------------------------------------------------------------------
// 8. BOOTSTRAP APPLICATION & LIVE FEED / SOVEREIGN MODAL WIRING
// ----------------------------------------------------------------------------
function initUIControls() {
  populateEndpointSelectors();

  const selOrig = document.getElementById('selOrigin');
  const selDest = document.getElementById('selDest');
  const selDos = document.getElementById('selDossierNation');

  selOrig.addEventListener('change', e => { state.originId = e.target.value; syncAllViews(); });
  selDest.addEventListener('change', e => { state.destId = e.target.value; syncAllViews(); });
  selDos.addEventListener('change', e => { state.dossierId = e.target.value; renderDossier(); renderNationNodes(); });

  document.getElementById('btnSwapPair').addEventListener('click', () => {
    [state.originId, state.destId] = [state.destId, state.originId];
    selOrig.value = state.originId;
    selDest.value = state.destId;
    syncAllViews();
  });

  document.getElementById('btnRandomPair').addEventListener('click', () => {
    const ids = [...Object.keys(NATIONS), ...Object.keys(SITES)];
    const pick = () => ids[Math.floor(Math.random() * ids.length)];
    let o = pick(), d = pick();
    while (d === o) d = pick();
    state.originId = o;
    state.destId = d;
    selOrig.value = o;
    selDest.value = d;
    syncAllViews();
  });

  const fold = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const searchEl = document.getElementById('dossierSearch');
  const resultsEl = document.getElementById('dossierResults');
  const pickDossier = id => {
    state.dossierId = id;
    selDos.value = id;
    searchEl.value = '';
    resultsEl.hidden = true;
    renderDossier();
    renderNationNodes();
  };
  searchEl.placeholder = `Search ${Object.keys(NATIONS).length} nations (name or code)`;
  searchEl.addEventListener('input', () => {
    const q = fold(searchEl.value.trim());
    if (!q) { resultsEl.hidden = true; resultsEl.innerHTML = ''; return; }
    const hits = Object.values(NATIONS)
      .map(n => {
        const name = fold(n.name);
        const rank = n.id.toLowerCase() === q || n.iso2 === q ? 0 : name.startsWith(q) ? 1 : name.includes(q) ? 2 : -1;
        return { n, rank };
      })
      .filter(h => h.rank >= 0)
      .sort((a, b) => a.rank - b.rank || a.n.name.localeCompare(b.n.name))
      .slice(0, 8);
    resultsEl.innerHTML = hits.length
      ? hits.map(({ n }) => `<button type="button" class="search-hit" data-id="${n.id}">${flagImg(n.iso2)} <b>${n.id}</b> ${escapeHtml(n.name)} <span>${escapeHtml(n.region)}</span></button>`).join('')
      : '<div class="search-empty">No nation matches.</div>';
    resultsEl.hidden = false;
  });
  searchEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const first = resultsEl.querySelector('.search-hit');
      if (first) pickDossier(first.dataset.id);
    } else if (e.key === 'Escape') {
      searchEl.value = '';
      resultsEl.hidden = true;
    }
  });
  resultsEl.addEventListener('click', e => {
    const hit = e.target.closest('.search-hit');
    if (hit) pickDossier(hit.dataset.id);
  });

  const PRESETS_SHOWN = 6;
  const presetBar = document.getElementById('presetBar');
  let presetsOpen = false;
  try { presetsOpen = localStorage.getItem('stratcom.presetsOpen') === '1'; } catch (e) {}
  const renderPresets = () => {
    const list = presetsOpen ? PRESET_PAIRS : PRESET_PAIRS.slice(0, PRESETS_SHOWN);
    const hidden = PRESET_PAIRS.length - PRESETS_SHOWN;
    presetBar.innerHTML =
      `<div class="preset-head"><span>QUICK SCENARIOS · ${PRESET_PAIRS.length}</span>` +
      (hidden > 0 ? `<button class="preset-toggle" type="button">${presetsOpen ? 'COLLAPSE ▴' : `+${hidden} MORE ▾`}</button>` : '') +
      `</div>` +
      list.map(p => `<button class="preset-chip" data-o="${p.orig}" data-d="${p.dest}">${p.label}</button>`).join('');
  };
  renderPresets();
  presetBar.addEventListener('click', e => {
    if (e.target.closest('.preset-toggle')) {
      presetsOpen = !presetsOpen;
      try { localStorage.setItem('stratcom.presetsOpen', presetsOpen ? '1' : '0'); } catch (err) {}
      renderPresets();
      return;
    }
    const chip = e.target.closest('.preset-chip');
    if (!chip) return;
    state.originId = chip.dataset.o;
    state.destId = chip.dataset.d;
    selOrig.value = state.originId;
    selDest.value = state.destId;
    syncAllViews();
  });

  // 7A. ALL OPEN: peacetime counterfactual. Persisted explicitly so a reload
  //     shows the same thing instead of silently falling back to the baseline.
  document.getElementById('btnResetGates').addEventListener('click', () => {
    CHOKEPOINTS.forEach(c => { c.state = 'open'; persistGateState(c.id, 'open'); });
    document.getElementById('gateRandomNote').hidden = true;
    syncAllViews();
  });

  // 7B. LIVE: restore the real-world baseline, then escalate any gate still
  //     OPEN that the live RSS/GDELT wire has flagged past the threshold.
  document.getElementById('btnLiveGates').addEventListener('click', async () => {
    await resetPersistedGates();
    const escalated = [];
    CHOKEPOINTS.forEach(c => {
      c.state = LIVE_GATE_BASELINE[c.id] || 'open';
      if (c.state === 'open' && feedHitsForGate(c.id) >= FEED_CONTEST_THRESHOLD) {
        c.state = 'contested';
        escalated.push(c.shortName);
        persistGateState(c.id, 'contested');
      }
    });
    const count = st => CHOKEPOINTS.filter(c => c.state === st).length;
    const note = document.getElementById('gateRandomNote');
    note.classList.add('live');
    note.innerHTML = `◉ Live conditions: <b>${count('blockaded')}</b> blockaded, <b>${count('contested')}</b> contested, ${count('open')} open` +
      (escalated.length ? `. Feed-escalated: <b>${escalated.join(', ')}</b>.` : '.') +
      `<br/><span style="opacity:.7;">Baseline: ${DATA_VINTAGE.conflicts}${escalated.length ? ` + live wire (≥${FEED_CONTEST_THRESHOLD} hits)` : ''}</span>`;
    note.hidden = false;
    syncAllViews();
  });

  document.getElementById('btnRandomGates').addEventListener('click', () => {
    const roll = () => { const r = Math.random(); return r < 0.55 ? 'open' : r < 0.85 ? 'contested' : 'blockaded'; };
    let states;
    do { states = CHOKEPOINTS.map(roll); } while (states.every(st => st === 'open'));
    CHOKEPOINTS.forEach((c, i) => { c.state = states[i]; persistGateState(c.id, c.state); });
    const count = st => states.filter(x => x === st).length;
    const blocked = CHOKEPOINTS.filter(c => c.state === 'blockaded').map(c => c.shortName);
    const note = document.getElementById('gateRandomNote');
    note.classList.remove('live');
    note.innerHTML = `🎲 Random crisis: <b>${count('blockaded')}</b> blockaded, <b>${count('contested')}</b> contested, ${count('open')} open` +
      (blocked.length ? `. Closed: <b>${blocked.join(', ')}</b>.` : '.');
    note.hidden = false;
    syncAllViews();
  });

  document.querySelectorAll('[data-left-tab]').forEach(btn =>
    btn.addEventListener('click', () => switchBladeTab('left', btn.dataset.leftTab))
  );
  document.querySelectorAll('[data-right-tab]').forEach(btn =>
    btn.addEventListener('click', () => switchBladeTab('right', btn.dataset.rightTab))
  );

  document.querySelectorAll('.theater-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.theater-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const lat = +btn.dataset.lat, lng = +btn.dataset.lng, z = +btn.dataset.z;
      if (state.globe3dActive && globe3d) {
        globe3d.flyTo(lat, lng, z);
      } else {
        map.flyTo([lat, lng], z, { duration: 1.2 });
      }
    });
  });

  document.querySelectorAll('.layer-chip[data-layer]').forEach(chip => {
    chip.addEventListener('click', () => {
      const key = chip.dataset.layer;
      const lg = state.layers[key];
      if (globe3d) globe3d.setLayerVisible(key, !map.hasLayer(lg));
      if (map.hasLayer(lg)) {
        map.removeLayer(lg);
        chip.classList.remove('active');
      } else {
        map.addLayer(lg);
        chip.classList.add('active');
      }
    });
  });

  // 8B. Basemap & 3D Google-Earth Switchers (SAT MAP + 3D EARTH)
  const hudBtn = document.getElementById('btnToggleHUD');
  const satBtn = document.createElement('button');
  satBtn.className = 'layer-chip';
  satBtn.textContent = 'SAT MAP';
  satBtn.title = 'Switch between Dark Tactical Chart and High-Res Satellite Imagery (down to Zoom 19)';
  hudBtn.parentNode.insertBefore(satBtn, hudBtn);

  const globeBtn = document.createElement('button');
  globeBtn.className = 'layer-chip';
  globeBtn.textContent = '3D EARTH';
  globeBtn.title = 'Toggle Interactive 3D WebGL Satellite Globe (Google Earth View)';
  hudBtn.parentNode.insertBefore(globeBtn, hudBtn);

  satBtn.addEventListener('click', () => {
    if (state.basemapMode === 'dark') {
      map.removeLayer(tileLayers.dark);
      tileLayers.sat.addTo(map);
      state.basemapMode = 'sat';
      satBtn.classList.add('active');
    } else {
      map.removeLayer(tileLayers.sat);
      tileLayers.dark.addTo(map);
      state.basemapMode = 'dark';
      satBtn.classList.remove('active');
    }
  });

  globeBtn.addEventListener('click', () => toggleGlobe3D(globeBtn));

  hudBtn.addEventListener('click', e => {
    document.body.classList.toggle('hud-hidden');
    e.currentTarget.classList.toggle('active');
  });

  // 8B-2. Live Feed & Sovereign Node Uploader Modal Wiring
  const modalBackdrop = document.getElementById('feedModalBackdrop');
  const openModal = () => { modalBackdrop.hidden = false; };
  const closeModal = () => { modalBackdrop.hidden = true; };

  document.getElementById('btnOpenFeedModal').addEventListener('click', openModal);
  document.getElementById('btnAddFeedInline').addEventListener('click', openModal);
  document.getElementById('btnCloseFeedModal').addEventListener('click', closeModal);
  document.getElementById('btnForceSyncOsint').addEventListener('click', () => syncLiveOsintWire(true));
  document.getElementById('btnReloadSol').addEventListener('click', () => loadSol());

  document.querySelectorAll('[data-mod-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-mod-tab]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const key = tab.dataset.modTab;
      ['sovereign', 'rss', 'file'].forEach(k => {
        document.getElementById(`mod-pane-${k}`).hidden = k !== key;
      });
    });
  });

  document.getElementById('btnSaveSovereignSite').addEventListener('click', async () => {
    const name = document.getElementById('sovName').value.trim() || 'Sovereign Command Node';
    const host = (document.getElementById('sovHost').value.trim() || 'USA').toUpperCase();
    const lat = parseFloat(document.getElementById('sovLat').value);
    const lng = parseFloat(document.getElementById('sovLng').value);
    const streamUrl = document.getElementById('sovStream').value.trim();
    const notes = document.getElementById('sovNotes').value.trim();
    if (isNaN(lat) || isNaN(lng)) return;

    const siteSpec = { id: `SOV_${Date.now()}`, name, host, lat, lng, streamUrl, notes };
    const created = registerSovereignSiteInMesh(siteSpec);
    await saveSovereignSite(siteSpec);

    state.originId = created.id;
    syncAllViews();
    closeModal();
    map.flyTo([lat, lng], 7, { duration: 1.2 });
  });

  document.getElementById('btnSaveRssFeed').addEventListener('click', async () => {
    const name = document.getElementById('rssName').value.trim() || 'CUSTOM OSINT WIRE';
    const category = document.getElementById('rssCategory').value;
    const url = document.getElementById('rssUrl').value.trim();
    const lat = parseFloat(document.getElementById('rssLat').value) || 39.85;
    const lng = parseFloat(document.getElementById('rssLng').value) || -76.76;
    if (!url) return;

    await subscribeCustomRssFeed({ source_name: `[${category}] ${name}`, url, default_lat: lat, default_lng: lng });
    await syncLiveOsintWire(true);
    closeModal();
  });

  document.getElementById('btnUploadFeedFile').addEventListener('click', async () => {
    const fi = document.getElementById('feedFileInput');
    if (!fi.files || !fi.files.length) return;
    const file = fi.files[0];
    const text = await file.text();
    const injected = [];

    if (file.name.endsWith('.json') || file.name.endsWith('.geojson')) {
      const data = JSON.parse(text);
      if (isSolGeo(data)) {
        // A Sol export goes to the SOLAR layer, not the OSINT wire
        state.solGeo = data;
        state.solError = null;
        renderSol();
        if (!map.hasLayer(state.layers.sol)) map.addLayer(state.layers.sol);
        switchBladeTab('left', 'solar');
        map.flyTo([11.8, -1.5], 5, { duration: 1.1 });
        fi.value = '';
        closeModal();
        return;
      }
      (data.features || []).forEach(f => {
        if (f.geometry && f.geometry.coordinates) {
          injected.push({
            source: f.properties?.category || 'GEOJSON UPLOAD',
            title: f.properties?.name || f.properties?.title || 'Uploaded Telemetry Point',
            link: f.properties?.link || '#',
            theater: f.properties?.theater || 'Custom Feed',
            gate: f.properties?.gate || null,
            lat: +f.geometry.coordinates[1],
            lng: +f.geometry.coordinates[0]
          });
        }
      });
    } else if (file.name.endsWith('.csv')) {
      const lines = text.trim().split('\n');
      const hdr = lines[0].split(',').map(h => h.trim().toLowerCase());
      const iLat = hdr.findIndex(h => h.includes('lat'));
      const iLng = hdr.findIndex(h => h.includes('lon') || h.includes('lng'));
      const iTit = hdr.findIndex(h => h.includes('title') || h.includes('name'));
      const iCat = hdr.findIndex(h => h.includes('cat') || h.includes('source'));
      lines.slice(1).forEach(line => {
        const cols = line.split(',');
        const lat = parseFloat(cols[iLat]), lng = parseFloat(cols[iLng]);
        if (!isNaN(lat) && !isNaN(lng)) {
          injected.push({
            source: cols[iCat] || 'CSV TELEMETRY',
            title: cols[iTit] || 'Custom Telemetry Point',
            link: '#',
            theater: 'Operator Upload',
            gate: null,
            lat,
            lng
          });
        }
      });
    }

    if (injected.length) {
      state.osintEvents = [...injected, ...state.osintEvents];
      renderConflicts();
      renderLeftBladeLists();
      switchBladeTab('left', 'conflicts');
      map.flyTo([injected[0].lat, injected[0].lng], 5, { duration: 1.1 });
    }
    fi.value = '';
    closeModal();
  });

  // 8C. Kinematic bar
  document.querySelectorAll('.kin-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.kin-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.simSpeed = +btn.dataset.speed;
    });
  });

  document.getElementById('selVesselKts').addEventListener('change', e => {
    state.vesselKts = +e.target.value;
    renderChemistryAndRoute();
  });

  // 8D. Mobile dock & snap controls
  document.querySelectorAll('.dock-btn').forEach(btn => {
    btn.addEventListener('click', () => openMobilePanel(btn.dataset.mobPanel, 'split'));
  });
  document.querySelectorAll('.snap-btn').forEach(btn => {
    btn.addEventListener('click', () => setMobileSnap(btn.dataset.targetSnap));
  });

  setInterval(() => {
    const now = new Date().toISOString().slice(11, 19);
    document.getElementById('sysClock').textContent = `UTC ${now} // DIJKSTRA MESH ACTIVE`;
  }, 1000);
}

// 8E. Startup sequence
window.addEventListener('DOMContentLoaded', async () => {
  checkModuleBuilds();
  macroStatus = await loadNationMacro(NATIONS);

  // Load any saved Sovereign Nodes (or seed Primary Home Command HQ by default)
  const savedSites = await fetchSovereignSites();
  if (savedSites.length === 0) {
    registerSovereignSiteInMesh({
      id: 'SOV_HOME_HQ',
      name: 'Seven Valleys Home HQ (Primary Residence)',
      host: 'USA',
      lat: 39.8534,
      lng: -76.7686,
      streamUrl: '',
      notes: 'Primary Sovereign Residence & Command Node'
    });
  } else {
    savedSites.forEach(s => registerSovereignSiteInMesh(s));
  }

  initMap();
  initUIControls();
  initDelegatedClicks();

  const savedGates = await fetchPersistedGates();
  CHOKEPOINTS.forEach(cp => {
    if (['open', 'contested', 'blockaded'].includes(savedGates[cp.id])) cp.state = savedGates[cp.id];
  });

  renderConflicts();
  initAutonomousVessels();
  syncAllViews();
  renderDossier();
  startKinematicLoop();
  await loadSol();
  initLiveFeeds({
    map,
    layers: { gdelt: state.layers.gdelt, ais: state.layers.ais },
    syncOsint: force => syncLiveOsintWire(force),
    stripEl: document.getElementById('liveStrip'),
    onNowcast: d => {
      state.solNowcast = Object.fromEntries((d.sites || []).map(r => [r.site, r]));
      state.solNowcastMeta = d.generated_at_utc
        ? `${ago(Date.parse(d.generated_at_utc) / 1000)} old${d.status === 'refreshing' ? ', refreshing' : ''}`
        : (d.status === 'refreshing' ? 'first run in progress' : null);
      renderSol();
    }
  });
});
