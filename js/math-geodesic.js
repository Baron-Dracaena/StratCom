// ============================================================================
// LAYER 3A: SPHERICAL GEODESICS, ANTIMERIDIAN SPLITTER & DIJKSTRA ROUTER
// ============================================================================

import { GRAPH_NODES, GRAPH_EDGES, SITES, NATIONS } from '../data/intel-store.js';
import { SEA_LANES } from '../data/sea-lanes.js';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const EARTH_RADIUS_NM = 3440.065; // Mean Earth radius in Nautical Miles
export const MODULE_BUILD = '4.3.0';

// Router tuning constants (exported so the chemistry engine and UI can cite them)
export const CONTESTED_COST_MULT = 1.28;   // contested gate: edge costs 28% more to traverse

// 0. GENERALIZED FREIGHT COST MODEL (v4.1 + v4.4 $/Metric Tonne Extension)
export const MODE_RATE = { maritime: 1, river: 2, pipeline: 1.5, land: 5, road: 15 }; // land = rail
export const MODE_SPEED_KTS = { land: 13, road: 8, river: 5, pipeline: 3 };        // maritime = vessel speed
export const TRANSFER_DAYS = { land: 2, road: 5, river: 2, pipeline: 2 };          // dwell per handoff (road incl. clearance)
export const TRANSFER_PENALTY_NM = 1200;   // handling at a mode change (~$240/FEU)
export const PORT_HANDLING_NM = 1200;      // terminal handling where a sea leg starts or ends
export const TIME_VALUE_NM_PER_DAY = 100;  // inventory & capital cost of a day in transit (~$20/FEU)
export const USD_PER_COST_NM = 0.2;        // converts cost units to an approximate $/FEU freight figure
export const TONNES_PER_FEU_EQUIV = 24.0;  // standard 40ft container / modal payload reference in Metric Tonnes (MT)

const dwellDays = (a, b) => (a === 'road' || b === 'road' ? TRANSFER_DAYS.road : TRANSFER_DAYS[a === 'maritime' ? b : a] || 2);
export const MODE_CIRCUITY = { land: 1.15, road: 1.3, river: 1.35, pipeline: 1.1 };

// ----------------------------------------------------------------------------
// 1. GREAT-CIRCLE HAVERSINE DISTANCE (NM)
// ----------------------------------------------------------------------------
export function haversineNM(lat1, lng1, lat2, lng2) {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLng = (lng2 - lng1) * DEG_TO_RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.min(1, Math.sqrt(a)));
}

// ----------------------------------------------------------------------------
// 2. INITIAL FORWARD BEARING (0-360° TRUE)
// ----------------------------------------------------------------------------
export function bearingDeg(lat1, lng1, lat2, lng2) {
  const p1 = lat1 * DEG_TO_RAD;
  const p2 = lat2 * DEG_TO_RAD;
  const dL = (lng2 - lng1) * DEG_TO_RAD;
  const y = Math.sin(dL) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dL);
  return (Math.atan2(y, x) * RAD_TO_DEG + 360) % 360;
}

// ----------------------------------------------------------------------------
// 3A. SPHERICAL LINEAR INTERPOLATION (SLERP) ALONG A GREAT CIRCLE
// ----------------------------------------------------------------------------
export function interpolateGreatCircle(lat1, lng1, lat2, lng2, segments = 24) {
  const p1 = lat1 * DEG_TO_RAD, l1 = lng1 * DEG_TO_RAD;
  const p2 = lat2 * DEG_TO_RAD, l2 = lng2 * DEG_TO_RAD;

  const x1 = Math.cos(p1) * Math.cos(l1), y1 = Math.cos(p1) * Math.sin(l1), z1 = Math.sin(p1);
  const x2 = Math.cos(p2) * Math.cos(l2), y2 = Math.cos(p2) * Math.sin(l2), z2 = Math.sin(p2);

  const dot = Math.max(-1, Math.min(1, x1 * x2 + y1 * y2 + z1 * z2));
  const omega = Math.acos(dot);

  if (omega < 1e-6) return [[lat1, lng1], [lat2, lng2]];

  const pts = [];
  const sinOmega = Math.sin(omega);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = Math.sin((1 - t) * omega) / sinOmega;
    const b = Math.sin(t * omega) / sinOmega;
    const x = a * x1 + b * x2;
    const y = a * y1 + b * y2;
    const z = a * z1 + b * z2;
    const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) * RAD_TO_DEG;
    const lng = Math.atan2(y, x) * RAD_TO_DEG;
    pts.push([lat, lng]);
  }
  return pts;
}

// ----------------------------------------------------------------------------
// 3B. ANTIMERIDIAN (±180°) SPLITTER
// ----------------------------------------------------------------------------
export function splitAntimeridian(points) {
  const multiLine = [];
  let currentStroke = [];

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    if (i === 0) {
      currentStroke.push(pt);
      continue;
    }
    const prev = points[i - 1];
    const dLng = pt[1] - prev[1];

    if (Math.abs(dLng) > 180) {
      const sign = prev[1] > 0 ? 180 : -180;
      const wrappedNextLng = pt[1] + (prev[1] > 0 ? 360 : -360);
      const frac = (sign - prev[1]) / (wrappedNextLng - prev[1]);
      const midLat = prev[0] + frac * (pt[0] - prev[0]);

      currentStroke.push([midLat, sign]);
      multiLine.push(currentStroke);
      currentStroke = [[midLat, -sign], pt];
    } else {
      currentStroke.push(pt);
    }
  }
  if (currentStroke.length > 0) multiLine.push(currentStroke);
  return multiLine;
}

// ----------------------------------------------------------------------------
// 3C. EDGE GEOMETRY & DISTANCE
// ----------------------------------------------------------------------------
export function laneFor(u, v) {
  const fwd = SEA_LANES[`${u}|${v}`];
  if (fwd) return { nm: fwd.nm, pts: fwd.pts };
  const rev = SEA_LANES[`${v}|${u}`];
  if (rev) return { nm: rev.nm, pts: rev.pts.slice().reverse() };
  return null;
}

export function edgeGeometry(u, v, mode = 'maritime', segments = 18, factor = 1) {
  const a = GRAPH_NODES[u], b = GRAPH_NODES[v];
  const lane = mode === 'maritime' ? laneFor(u, v) : null;
  if (lane) return { nm: lane.nm, pts: lane.pts };
  return {
    nm: haversineNM(a.lat, a.lng, b.lat, b.lng) * (MODE_CIRCUITY[mode] || 1) * (factor || 1),
    pts: interpolateGreatCircle(a.lat, a.lng, b.lat, b.lng, segments)
  };
}

// ----------------------------------------------------------------------------
// 3D. DYNAMICALLY WIRE A SOVEREIGN SITE / PROPERTY NODE INTO DIJKSTRA MESH
//     Finds the nearest existing non-waypoint graph node and links the new
//     property via road/rail so Dijkstra can route between your Home HQ / sites
//     and any global port or country!
// ----------------------------------------------------------------------------
export function registerSovereignSiteInMesh(siteSpec) {
  const siteId = siteSpec.id || `SOV_${Date.now()}`;
  const nodeId = `N_${siteId}`;
  const lat = +siteSpec.lat;
  const lng = +siteSpec.lng;
  const host = (siteSpec.host || 'USA').toUpperCase();

  // Connect the overland/feeder leg to siteSpec.hub when given (a known logistics hub, e.g.
  // Sol sites: Korhogo -> Abidjan, not the geometrically nearest Bamako), else the nearest hub
  let nearestId = null;
  let nearestNM = Infinity;
  const hub = siteSpec.hub && GRAPH_NODES[siteSpec.hub] ? siteSpec.hub : null;
  if (hub) {
    nearestId = hub;
    nearestNM = haversineNM(lat, lng, GRAPH_NODES[hub].lat, GRAPH_NODES[hub].lng);
  } else {
    for (const [k, n] of Object.entries(GRAPH_NODES)) {
      if (n.waypoint || k === nodeId) continue;
      const d = haversineNM(lat, lng, n.lat, n.lng);
      if (d < nearestNM) {
        nearestNM = d;
        nearestId = k;
      }
    }
  }

  GRAPH_NODES[nodeId] = { name: siteSpec.name, lat, lng };
  if (nearestId) {
    const linkMode = nearestNM <= 450 ? 'road' : 'land';
    const exists = GRAPH_EDGES.some(e => (e[0] === nodeId && e[1] === nearestId) || (e[0] === nearestId && e[1] === nodeId));
    if (!exists) {
      GRAPH_EDGES.push([nodeId, nearestId, linkMode, null, 1.0]);
    }
  }

  SITES[siteId] = {
    id: siteId,
    name: siteSpec.name,
    host: NATIONS[host] ? host : 'USA',
    node: nodeId,
    sovereign: true,
    streamUrl: siteSpec.streamUrl || '',
    notes: siteSpec.notes || ''
  };
  return SITES[siteId];
}

// ----------------------------------------------------------------------------
// 4. MODE-AWARE DIJKSTRA SHORTEST-PATH ROUTER
// ----------------------------------------------------------------------------
export function computeShortestRoute(startNode, endNode, gateStateMap = {}, opts = {}) {
  const allowedModes = opts.modes ? new Set(opts.modes) : null;
  if (opts.excludeGates && opts.excludeGates.length) {
    gateStateMap = { ...gateStateMap };
    opts.excludeGates.forEach(g => { gateStateMap[g] = 'blockaded'; });
  }

  // Vessel-speed bulk/economy factor for per-tonne calculation
  const kts = opts.kts || 18;
  const hullTonneFactor = kts <= 14 ? 0.68 : kts >= 22 ? 1.25 : 1.0;

  // 4A. Build adjacency list for the current gate states
  const adj = {};
  for (const k of Object.keys(GRAPH_NODES)) adj[k] = [];

  for (const [u, v, mode, gateId, baseMult, factor, owner] of GRAPH_EDGES) {
    const nU = GRAPH_NODES[u];
    const nV = GRAPH_NODES[v];
    if (!nU || !nV) continue;
    if (allowedModes && !allowedModes.has(mode)) continue;
    if (owner) {
      const eps = opts.endpoints || new Set();
      if (owner[0] === '!') { if (owner.slice(1).split(',').some(iso => eps.has(iso))) continue; }
      else if (!eps.has(owner)) continue;
    }

    const gateStatus = gateId ? (gateStateMap[gateId] || 'open') : 'open';
    if (gateStatus === 'blockaded') continue;

    const rawNM = edgeGeometry(u, v, mode, 18, factor).nm;
    const contestedPenalty = gateStatus === 'contested' ? CONTESTED_COST_MULT : 1.0;
    const freight = rawNM * (MODE_RATE[mode] || 1) * (baseMult || 1.0);
    const days = rawNM / ((mode === 'maritime' ? kts : MODE_SPEED_KTS[mode]) * 24);
    const effectiveCost = (freight + days * TIME_VALUE_NM_PER_DAY) * contestedPenalty;

    adj[u].push({ to: v, rawNM, freight, effectiveCost, mode, gateId, gateStatus });
    adj[v].push({ to: u, rawNM, freight, effectiveCost, mode, gateId, gateStatus });
  }

  // 4B. Normalize ports
  const norm = p => (typeof p === 'string' ? { id: p, pen: 0 } : { id: p.id, pen: p.penaltyNM || 0 });
  const starts = [].concat(startNode).map(norm);
  const endPen = new Map([].concat(endNode).map(norm).map(e => [e.id, e.pen]));
  const sharedPort = starts.find(s => endPen.has(s.id));
  if (sharedPort) {
    const shared = sharedPort.id;
    const n = GRAPH_NODES[shared];
    return {
      reachable: true, pathNodes: [shared], nodeNames: [n.name], legs: [], cost: 0,
      totalNM: 0, seaNM: 0, landNM: 0, roadNM: 0, riverNM: 0, pipeNM: 0, modeTransfers: 0,
      freightUSD: 0, freightPerTonneUSD: 0,
      transitedGates: [], modesUsed: [], flatWaypoints: [[n.lat, n.lng]], multiPolyline: []
    };
  }

  // 4C. Multi-source Dijkstra over (node|mode) states
  const key = (node, mode) => `${node}|${mode}`;
  const dist = {};
  const prev = {};
  const open = new Set();
  for (const s of starts) {
    const k = key(s.id, 'start');
    dist[k] = s.pen;
    open.add(k);
  }
  const done = new Set();
  let bestEndKey = null;
  let bestTotal = Infinity;

  while (open.size > 0) {
    let uKey = null;
    let bestD = Infinity;
    for (const k of open) {
      if (dist[k] < bestD) { bestD = dist[k]; uKey = k; }
    }
    if (uKey === null || bestD >= bestTotal) break;
    open.delete(uKey);
    done.add(uKey);

    const [uNode, uMode] = uKey.split('|');
    if (endPen.has(uNode)) {
      const seaEnd = uMode === 'maritime' || uMode === 'tanker' ? PORT_HANDLING_NM : 0;
      const total = bestD + endPen.get(uNode) + seaEnd;
      if (total < bestTotal) { bestTotal = total; bestEndKey = uKey; }
    }

    for (const edge of adj[uNode]) {
      const crude = uMode === 'pipeline' || uMode === 'tanker';
      if (edge.mode === 'pipeline' && !['start', 'pipeline', 'maritime', 'tanker'].includes(uMode)) continue;
      if (crude && edge.mode !== 'pipeline' && edge.mode !== 'maritime') continue;
      const nextMode = crude && edge.mode === 'maritime' ? 'tanker' : edge.mode;
      const vKey = key(edge.to, nextMode);
      if (done.has(vKey)) continue;
      const physical = uMode === 'tanker' ? 'maritime' : uMode;
      const switching = uMode !== 'start' && physical !== edge.mode;
      if (switching && opts.noTransfer && opts.noTransfer.has(uNode)) continue;
      const transfer = switching ? TRANSFER_PENALTY_NM + dwellDays(physical, edge.mode) * TIME_VALUE_NM_PER_DAY
        : uMode === 'start' && edge.mode === 'maritime' ? PORT_HANDLING_NM : 0;
      const alt = bestD + edge.effectiveCost + transfer;
      if (alt < (dist[vKey] ?? Infinity)) {
        dist[vKey] = alt;
        prev[vKey] = { stateKey: uKey, edge };
        open.add(vKey);
      }
    }
  }

  if (!bestEndKey) {
    return {
      reachable: false, pathNodes: [], nodeNames: [], legs: [], totalNM: 0, seaNM: 0, landNM: 0, roadNM: 0, riverNM: 0, pipeNM: 0,
      modeTransfers: 0, freightUSD: 0, freightPerTonneUSD: 0, multiPolyline: [], flatWaypoints: [], transitedGates: [], modesUsed: []
    };
  }

  // 4D. Reconstruct the leg sequence
  const legs = [];
  let cur = bestEndKey;
  while (prev[cur]) {
    const { stateKey, edge } = prev[cur];
    legs.unshift({ from: stateKey.split('|')[0], to: cur.split('|')[0], ...edge });
    cur = stateKey;
  }

  const pathNodes = [cur.split('|')[0], ...legs.map(l => l.to)];
  const transitedGates = [...new Set(legs.filter(l => l.gateId).map(l => l.gateId))];
  const modesUsed = [...new Set(legs.map(l => l.mode))];
  let seaNM = 0, landNM = 0, roadNM = 0, riverNM = 0, pipeNM = 0, modeTransfers = 0, freightNM = 0;
  legs.forEach((l, i) => {
    freightNM += l.freight;
    if (l.mode === 'land') landNM += l.rawNM;
    else if (l.mode === 'road') roadNM += l.rawNM;
    else if (l.mode === 'river') riverNM += l.rawNM;
    else if (l.mode === 'pipeline') pipeNM += l.rawNM;
    else seaNM += l.rawNM;
    if (i > 0 && legs[i - 1].mode !== l.mode) modeTransfers++;
  });
  if (legs.length) {
    freightNM += modeTransfers * TRANSFER_PENALTY_NM;
    if (legs[0].mode === 'maritime') freightNM += PORT_HANDLING_NM;
    if (legs[legs.length - 1].mode === 'maritime') freightNM += PORT_HANDLING_NM;
  }

  const denseCoords = [];
  legs.forEach((l, i) => {
    const segs = edgeGeometry(l.from, l.to, l.mode).pts.slice();
    if (i > 0) segs.shift();
    denseCoords.push(...segs);
  });

  const freightUSD = Math.round(freightNM * USD_PER_COST_NM);
  const freightPerTonneUSD = Math.max(1, Math.round((freightUSD / TONNES_PER_FEU_EQUIV) * hullTonneFactor));

  return {
    reachable: true,
    cost: bestTotal,
    startPort: pathNodes[0],
    endPort: pathNodes[pathNodes.length - 1],
    pathNodes,
    nodeNames: pathNodes.map(id => GRAPH_NODES[id].name),
    legs: legs.map(l => ({ from: l.from, to: l.to, mode: l.mode, nm: Math.round(l.rawNM), gateId: l.gateId })),
    totalNM: Math.round(seaNM + landNM + roadNM + riverNM + pipeNM),
    seaNM: Math.round(seaNM),
    landNM: Math.round(landNM),
    roadNM: Math.round(roadNM),
    riverNM: Math.round(riverNM),
    pipeNM: Math.round(pipeNM),
    freightUSD,          // $/FEU
    freightPerTonneUSD,  // $/Metric Tonne ($/MT)
    modeTransfers,
    transitedGates,
    modesUsed,
    flatWaypoints: denseCoords,
    multiPolyline: splitAntimeridian(denseCoords)
  };
}
