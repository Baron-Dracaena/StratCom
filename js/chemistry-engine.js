// ============================================================================
// LAYER 3B: TRADING CORRIDOR CHEMISTRY & WAR-GAME TELEMETRY ENGINE
// ============================================================================

import { NATIONS, SITES, VESSEL_CLASSES, BLOCS } from '../data/intel-store.js';
import { computeShortestRoute, MODE_SPEED_KTS, TRANSFER_DAYS } from './math-geodesic.js';

export const MODULE_BUILD = '4.3.0';
export const PILLAR_WEIGHTS = { econ: 0.30, geo: 0.25, security: 0.25, logistics: 0.20 };

const RIVALRIES = {
  severe:   { penalty: 28, pairs: ['CHN_USA', 'CHN_TWN', 'IND_PAK', 'IRN_USA', 'IRN_ISR', 'RUS_UKR'] },
  moderate: { penalty: 14, pairs: ['CHN_JPN', 'CHN_PHL', 'CHN_IND', 'GBR_IRN', 'IRN_SAU', 'BOL_CHL', 'ISR_TUR', 'DZA_MAR', 'COD_RWA', 'EGY_ETH', 'CUB_USA'] }
};

const SANCTIONED_PORTS = [
  { ports: new Set([...(NATIONS.RUS || { nodes: [] }).nodes, 'N_RU_CPC']),
    exempt: new Set((BLOCS.find(b => b.id === 'EAEU') || { members: ['RUS'] }).members) },
  { ports: new Set([...(NATIONS.IRN || { nodes: [] }).nodes, 'N_BANDAR', 'N_CHABAHAR']),
    exempt: new Set(['IRN']) }
];
const NATO = new Set((BLOCS.find(b => b.id === 'NATO') || { members: [] }).members);

function rivalryPenalty(a, b) {
  const key = [a, b].sort().join('_');
  if (RIVALRIES.severe.pairs.includes(key)) return RIVALRIES.severe.penalty;
  if ((a === 'RUS' && NATO.has(b)) || (b === 'RUS' && NATO.has(a))) return RIVALRIES.severe.penalty;
  if (RIVALRIES.moderate.pairs.includes(key)) return RIVALRIES.moderate.penalty;
  return 0;
}

const FAMILY_RULES = [
  ['refined',     /refined (petroleum|fuels|diesel)|\bdiesel\b|\bfuels\b|gasoline|shale oil products|naphtha|diluent/i],
  ['crude',       /\bcrude\b|\bpetroleum\b|(?<!palm |coconut |vegetable |soy |olive |shale |sunflower )\boil\b/i],
  ['gas',         /\blng\b|\bgas\b/i],
  ['chemicals',   /chemical|plastics|polymer|petrochemical|polyethylene|helium|methanol|essential oil|sulfur|soft-drink concentrate/i],
  ['semis',       /semiconductor|\bwafer|lithograph|\beuv\b|\bfabs?\b|\bsilicon\b/i],
  ['electronics', /electronic|telecom|\bserver|\bcompute|smartphone|integrated circuit|hard drive/i],
  ['machinery',   /desalination|machiner|\belectrical\b|machine tools|\bcnc\b|robotic|mining equipment|rolling stock|\btrucks\b|jet engine|turbine/i],
  ['autos',       /automobile|vehicle|\bevs?\b|auto parts/i],
  ['ships',       /\bships\b|shipbuilding/i],
  ['iron',        /iron ore/i],
  ['coal',        /\bcoal\b/i],
  ['minerals',    /mineral|cobalt|copper|lithium|spodumene|rare earth|titanium|diamond|alumin|\bgold\b|\bmetals?\b|steel|nickel|manganese|chrome|platinum|precious|bauxite|phosphat|uranium|rutile|zinc|clinker|cement|graphite|emerald|coltan|\btin\b|manganese|soda ash|antimony|ferrosilicon|ferronickel|chromium|molybdenum/i],
  ['agri',        /\bsoy|\bwheat\b|\bfood|\bagri|palm oil|coconut oil|\brice\b|coffee|cocoa|\btea\b|fruit|citrus|produce|seafood|shrimp|flowers|corn|grain|cotton|oilseed|pistachio|wine|spirits|banana|sugar|rubber|\bjute\b|\bfish|cashew|groundnut|sesame|onion|tuna|livestock|dairy|meat|beef|lamb|kiwifruit|cassava|beans|pork|poultry|sunflower|vegetable|olive|dates|rapeseed|\btea\b|tobacco|vanilla|clove|wool|mohair|legume|maize|gum arabic/i],
  ['textiles',    /textile|garment|apparel|footwear|leather|fabric|travel goods/i],
  ['consumer',    /luxury|cosmetic|furniture/i],
  ['forestry',    /lumber|timber|\bwood|\bpulp\b|\bpaper\b|\bcork\b/i],
  ['fertilizer',  /fertili|potash|\burea\b/i],
  ['pharma',      /pharma|medical|surgical/i],
  ['solar',       /\bsolar\b/i],
  ['power',       /electricity|hydropower/i],
  ['aerodefense', /aerospace|aircraft|defense/i],
  ['optics',      /optic|\blens/i],
  ['services',    /software|re-export|capital|logistics|registry|tourism|transit|financial|gaming|shipping|ship management|port & logistics|cybersecurity/i]
];
export const COMMODITY_FAMILIES = FAMILY_RULES.map(([f]) => f);

export function familiesOf(products) {
  const fams = new Set();
  for (const p of products) {
    const hits = FAMILY_RULES.filter(([, re]) => re.test(p)).map(([f]) => f);
    if (hits.includes('refined') && hits.includes('crude')) hits.splice(hits.indexOf('crude'), 1);
    hits.forEach(f => fams.add(f));
  }
  return fams;
}

function computeComplementarity(nA, nB) {
  const aExp = familiesOf(nA.exports), aImp = familiesOf(nA.imports);
  const bExp = familiesOf(nB.exports), bImp = familiesOf(nB.imports);
  const flows = [];
  aExp.forEach(f => { if (bImp.has(f)) flows.push({ from: nA.id, to: nB.id, family: f }); });
  bExp.forEach(f => { if (aImp.has(f)) flows.push({ from: nB.id, to: nA.id, family: f }); });
  const importNeeds = Math.max(1, aImp.size + bImp.size);
  const coverage = flows.length / importNeeds;
  return { score: Math.round(100 * Math.min(1, coverage * 1.6)), flows };
}

export function fuelBurnMTd(kts) {
  if (VESSEL_CLASSES[kts]) return VESSEL_CLASSES[kts].burnMTd;
  return Math.round(120 * (kts / 18) ** 3);
}

function routeDays(route, kts) {
  if (!route.reachable) return { seaDays: 0, landDays: 0, transferDays: 0, total: 0 };
  const seaDays = route.seaNM / (kts * 24);
  const S = MODE_SPEED_KTS;
  const landDays = route.landNM / (S.land * 24) + (route.roadNM || 0) / (S.road * 24) +
    (route.riverNM || 0) / (S.river * 24) + (route.pipeNM || 0) / (S.pipeline * 24);
  let transferDays = 0;
  route.legs.forEach((l, i) => {
    const prev = route.legs[i - 1];
    if (prev && prev.mode !== l.mode) {
      const inland = prev.mode === 'maritime' ? l.mode : prev.mode;
      transferDays += (prev.mode === 'road' || l.mode === 'road') ? TRANSFER_DAYS.road : TRANSFER_DAYS[inland] || 2;
    }
  });
  return { seaDays, landDays, transferDays, total: seaDays + landDays + transferDays };
}

export function resolveEndpoint(id) {
  if (NATIONS[id]) return NATIONS[id];
  const site = SITES[id];
  if (!site) throw new Error(`Unknown nation or site: ${id}`);
  const host = NATIONS[site.host] || NATIONS.USA;
  return Object.assign(Object.create(host), {
    id: site.id, host: site.host, name: site.name, site: true,
    nodes: [site.node], ports: [{ id: site.node, penaltyNM: 0 }], node: site.node
  });
}

export function evaluateCorridorChemistry(originId, destId, chokepointList, vesselSpeedKts = 18) {
  const nA = resolveEndpoint(originId);
  const nB = resolveEndpoint(destId);

  const openMap = {};
  const liveMap = {};
  for (const cp of chokepointList) {
    openMap[cp.id] = 'open';
    liveMap[cp.id] = cp.state;
  }

  const hull = VESSEL_CLASSES[vesselSpeedKts];
  const excludeGates = hull && hull.panama === false ? ['panama'] : [];
  const endpoints = new Set([nA.host || nA.id, nB.host || nB.id]);
  const noTransfer = new Set();
  for (const { ports, exempt } of SANCTIONED_PORTS) {
    if (![...endpoints].some(iso => exempt.has(iso))) ports.forEach(p => noTransfer.add(p));
  }
  const ANY = { excludeGates, noTransfer, endpoints, kts: vesselSpeedKts };

  const baselineRoute = computeShortestRoute(nA.ports, nB.ports, openMap, ANY);
  const activeRoute = computeShortestRoute(nA.ports, nB.ports, liveMap, ANY);

  const overland = r => r.reachable && r.legs.some(l => l.mode !== 'maritime');
  const inlandCorridor = overland(baselineRoute);
  let overlandFallback = false;
  let modeShift = false;
  if (!inlandCorridor && overland(activeRoute)) {
    const seaOnly = computeShortestRoute(nA.ports, nB.ports, liveMap, { ...ANY, modes: ['maritime'] });
    overlandFallback = !seaOnly.reachable;
    modeShift = seaOnly.reachable;
  }

  const portSwitch = activeRoute.reachable && baselineRoute.reachable &&
    (activeRoute.startPort !== baselineRoute.startPort || activeRoute.endPort !== baselineRoute.endPort)
    ? { from: [baselineRoute.startPort, baselineRoute.endPort], to: [activeRoute.startPort, activeRoute.endPort] }
    : null;

  const isDiverted =
    activeRoute.reachable &&
    baselineRoute.reachable &&
    baselineRoute.pathNodes.join('>') !== activeRoute.pathNodes.join('>');

  const complementarity = computeComplementarity(nA, nB);
  const size = n => n.gdpPPP ?? n.gdpNominal ?? 0;
  const missingMacro = [nA, nB].filter(n => (n.gdpPPP ?? n.gdpNominal) == null || n.growth == null).map(n => n.host || n.id);
  const combined = size(nA) + size(nB);
  const scaleFactor = combined > 0 ? Math.min(100, Math.max(0, Math.round(Math.log10(combined * 10) * 38))) : 0;
  const growthSynergy = Math.max(0, Math.min(100, Math.round(((nA.growth ?? 0) + (nB.growth ?? 0)) * 10.5)));
  const econScore = Math.min(98, Math.round(
    complementarity.score * 0.60 + scaleFactor * 0.25 + growthSynergy * 0.15
  ));

  const sharedBlocs = nA.blocs.filter(b => nB.blocs.includes(b));
  const tieBlocs = sharedBlocs.filter(id => (BLOCS.find(b => b.id === id) || {}).group !== 'analyst');
  let geoScore = 58 + tieBlocs.length * 12;
  const rivalry = rivalryPenalty(nA.host || nA.id, nB.host || nB.id);
  geoScore -= rivalry;
  geoScore = Math.max(15, Math.min(98, geoScore));

  let securityScore = 92;
  let warRiskBps = 12;

  for (const gateId of activeRoute.transitedGates) {
    if (liveMap[gateId] === 'contested') {
      securityScore -= 22;
      warRiskBps += 65;
    }
  }
  const avoidedImpaired = baselineRoute.transitedGates.filter(
    g => liveMap[g] !== 'open' && !activeRoute.transitedGates.includes(g)
  );
  securityScore -= avoidedImpaired.length * 10;

  if (!activeRoute.reachable) {
    securityScore = 8;
    warRiskBps = 450;
  }
  securityScore = Math.max(8, Math.min(98, securityScore));

  const effectiveNM = activeRoute.reachable ? activeRoute.totalNM : baselineRoute.totalNM * 1.8;
  const deltaNM = activeRoute.reachable ? activeRoute.totalNM - baselineRoute.totalNM : 0;

  let logisticsScore = Math.max(25, Math.round(100 - effectiveNM / 210));
  if (isDiverted && deltaNM > 0) {
    const diversionRatio = deltaNM / Math.max(1, baselineRoute.totalNM);
    logisticsScore = Math.max(18, Math.round(logisticsScore - diversionRatio * 45));
  }

  const composite = Math.round(
    econScore * PILLAR_WEIGHTS.econ +
    geoScore * PILLAR_WEIGHTS.geo +
    securityScore * PILLAR_WEIGHTS.security +
    logisticsScore * PILLAR_WEIGHTS.logistics
  );

  let grade = 'C';
  let gradeColor = '#f59e0b';
  if (composite >= 84) { grade = 'S'; gradeColor = '#38bdf8'; }
  else if (composite >= 72) { grade = 'A'; gradeColor = '#10b981'; }
  else if (composite >= 58) { grade = 'B'; gradeColor = '#a3e635'; }
  else if (composite < 45) { grade = 'D'; gradeColor = '#ef4444'; }

  const baseT = routeDays(baselineRoute, vesselSpeedKts);
  const liveT = routeDays(activeRoute, vesselSpeedKts);
  const baseDays = +baseT.total.toFixed(1);
  const activeDays = +liveT.total.toFixed(1);
  const deltaDays = activeRoute.reachable ? +(liveT.total - baseT.total).toFixed(1) : 0;
  const burn = fuelBurnMTd(vesselSpeedKts);
  const extraFuelMT = activeRoute.reachable ? Math.round((liveT.seaDays - baseT.seaDays) * burn) : 0;

  return {
    origin: nA,
    dest: nB,
    composite,
    grade,
    gradeColor,
    sharedBlocs,
    tieBlocs,
    rivalry,
    missingMacro,
    complementarity,
    pillars: [
      { label: `Economic Complementarity (${PILLAR_WEIGHTS.econ * 100}%)`, val: econScore, color: '#38bdf8' },
      { label: `Geopolitical & Bloc Alignment (${PILLAR_WEIGHTS.geo * 100}%)`, val: geoScore, color: '#a855f7' },
      { label: `Chokepoint & Route Security (${PILLAR_WEIGHTS.security * 100}%)`, val: securityScore, color: '#10b981' },
      { label: `Route Logistics Efficiency (${PILLAR_WEIGHTS.logistics * 100}%)`, val: logisticsScore, color: '#f59e0b' }
    ],
    baselineRoute,
    activeRoute,
    isDiverted,
    overlandFallback,
    modeShift,
    inlandCorridor,
    portSwitch,
    telemetry: {
      baseNM: baselineRoute.totalNM,
      activeNM: activeRoute.totalNM,
      seaNM: activeRoute.seaNM,
      landNM: activeRoute.landNM,
      roadNM: activeRoute.roadNM,
      riverNM: activeRoute.riverNM,
      pipeNM: activeRoute.pipeNM,
      freightUSD: activeRoute.freightUSD,
      baseFreightUSD: baselineRoute.freightUSD,
      deltaFreightUSD: activeRoute.reachable ? activeRoute.freightUSD - baselineRoute.freightUSD : 0,
      freightPerTonneUSD: activeRoute.freightPerTonneUSD,
      baseFreightPerTonneUSD: baselineRoute.freightPerTonneUSD,
      deltaFreightPerTonneUSD: activeRoute.reachable ? activeRoute.freightPerTonneUSD - baselineRoute.freightPerTonneUSD : 0,
      modeTransfers: activeRoute.modeTransfers,
      deltaNM,
      baseDays,
      activeDays,
      deltaDays,
      burnMTd: burn,
      extraFuelMT,
      warRiskBps
    }
  };
}
