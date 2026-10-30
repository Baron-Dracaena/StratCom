// ============================================================================
// LAYER 2: STATIC TOPOLOGY & GEOPOLITICAL OSINT STORE (v3.5)
//    Nations live in nations.js, blocs in blocs.js; both are re-exported here
//    so every other module keeps importing from one place.
// ============================================================================

// Build stamp: main.js checks every module carries the same value and warns
// in the header if the browser mixed cached old files with new ones.
export const MODULE_BUILD = '4.3.0';

export { NATIONS, REGIONS, SITES } from './nations.js';
export { BLOCS, BLOC_GROUPS } from './blocs.js';

// ----------------------------------------------------------------------------
// 0. DATA PROVENANCE — shown in the UI so estimates are never mistaken for live data
// ----------------------------------------------------------------------------
export const DATA_VINTAGE = {
  nations: 'hand-entered est.',
  chokepointFlows: 'EIA / industry figures, mixed years',
  conflicts: 'hand-curated baseline',
  vesselBurn: 'approximate, order-of-magnitude'
};

// ----------------------------------------------------------------------------
// 1. STRATEGIC CHOKEPOINT GATES
// ----------------------------------------------------------------------------
export const CHOKEPOINTS = [
  {
    id: 'bab_el_mandeb',
    name: 'Bab el-Mandeb / Suez',
    shortName: 'SUEZ / BAB',
    lat: 12.6, lng: 43.3,
    dailyFlow: '8.8M bbl/d + 12% Global Trade',
    state: 'contested',
    desc: 'Red Sea southern gate linking Indian Ocean to Mediterranean via Suez.'
  },
  {
    id: 'hormuz',
    name: 'Strait of Hormuz',
    shortName: 'HORMUZ',
    lat: 26.56, lng: 56.25,
    dailyFlow: '20.9M bbl/d Crude & 20% Global LNG',
    state: 'open',
    desc: 'Primary Persian Gulf hydrocarbon export artery.'
  },
  {
    id: 'malacca',
    name: 'Strait of Malacca',
    shortName: 'MALACCA',
    lat: 2.5, lng: 101.8,
    dailyFlow: '23.7M bbl/d + 30% Maritime Container Volume',
    state: 'open',
    desc: 'Primary Indo-Pacific maritime funnel between Indian Ocean and South China Sea.'
  },
  {
    id: 'taiwan_strait',
    name: 'Taiwan Strait',
    shortName: 'TAIWAN ST',
    lat: 24.3, lng: 119.5,
    dailyFlow: '48% Global Container Fleet Transit',
    state: 'contested',
    desc: 'High-tech semiconductor & Northeast Asian maritime lifeline.'
  },
  {
    id: 'turkish_straits',
    name: 'Turkish Straits (Bosphorus)',
    shortName: 'BOSPHORUS',
    lat: 41.12, lng: 29.08,
    dailyFlow: '3.4M bbl/d + Black Sea Grain Export',
    state: 'contested',
    desc: 'Montreux Convention regulated gate connecting Black Sea to Mediterranean.'
  },
  {
    // MARNET has no Kiel Canal, so every Baltic exit for ocean ships runs
    // through the Øresund or the Belts; build_sea_lanes.py checks this box.
    id: 'danish_straits',
    name: 'Danish Straits (Baltic exits)',
    shortName: 'DANISH ST',
    lat: 55.2, lng: 10.9,
    dailyFlow: '~1.5M bbl/d Russian Baltic crude & products + Baltic container trade',
    state: 'open',
    desc: 'Only deep-water exit from the Baltic. Denmark and Sweden now check insurance and papers on Russian shadow-fleet tankers; Sweden boarded several in Mar-Apr 2026.'
  },
  {
    // The open Black Sea, separate from the Bosphorus itself. Coastal legs in
    // non-belligerent territorial waters (Constanța / Varna -> Istanbul) are
    // outside it, matching the Lloyd's Joint War Committee carve-out.
    id: 'black_sea_war',
    name: 'Black Sea War-Risk Zone',
    shortName: 'BLACK SEA',
    lat: 43.4, lng: 34.6,
    dailyFlow: 'Novorossiysk, CPC (~80% of Kazakh crude), Poti & Odesa sea lanes',
    state: 'contested',
    desc: 'Two-way port war: Russia strikes Greater Odesa, Ukraine strikes Novorossiysk (all three grain terminals stopped by mid-Aug 2026). Lloyd\'s JWC extended the high-risk zone to almost the whole sea on 16 Sep 2026.'
  },
  {
    id: 'odesa_corridor',
    name: 'Ukrainian Corridor (Greater Odesa)',
    shortName: 'ODESA',
    lat: 45.9, lng: 30.6,
    dailyFlow: 'Normally 4-5 Mt/month of Ukrainian cargo; Aug 2026: 21 ship calls (-90%)',
    state: 'blockaded',
    desc: 'No ship entered Odesa\'s ports on 22 Jul 2026 after the Golden Leo sinking; the grain trade is planning for closure through winter. Bypass: Danube ports (Izmail, Reni) via the Sulina Canal, ~2.5-3 Mt/month.'
  },
  {
    kind: 'border', region: 'East Africa',
    id: 'sudan_war',
    name: 'Sudan War Zone (South Sudan oil pipeline)',
    shortName: 'SUDAN',
    lat: 15.6, lng: 32.5,
    dailyFlow: 'South Sudan crude (~90% of its revenue) to Port Sudan via Sudan',
    state: 'contested',
    desc: 'SAF–RSF war since Apr 2023, no ceasefire (RSF took El Fasher Oct 2025). The pipeline ran under force majeure in 2024 and flows resumed in early 2026, at constant risk of renewed damage.'
  },
  {
    kind: 'border', region: 'Eurasia',
    id: 'russia_rail',
    name: 'Russia / Belarus Rail Transit',
    shortName: 'RU RAIL',
    lat: 52.2, lng: 26.5,
    dailyFlow: 'China–Europe Northern Corridor block trains via Małaszewicze–Brest',
    state: 'contested',
    desc: 'Still running for most goods, but under sanctions screening, insurance limits and EU dual-use controls. BLOCKADE it to see the Middle Corridor (Aktau–Baku–Kars) take over.'
  },
  {
    id: 'panama',
    name: 'Panama Canal',
    shortName: 'PANAMA',
    lat: 9.08, lng: -79.68,
    dailyFlow: '6% Global Maritime Trade (US East-Asia)',
    state: 'open',
    desc: 'Inter-oceanic lock system linking Atlantic/Gulf of Mexico to Pacific.'
  },

  // 1B. Inland corridor gates (kind: 'border'). Same OPEN / CONTESTED /
  //     BLOCKADED mechanics, applied to road, rail and river edges. `region`
  //     groups them in the War-Game panel. Default states reflect reporting
  //     as of Sep-Oct 2026.
  {
    id: 'benin_niger',
    kind: 'border', region: 'West Africa',
    name: 'Benin–Niger Border (Malanville–Gaya)',
    shortName: 'BENIN–NIGER',
    lat: 11.87, lng: 3.39,
    dailyFlow: 'Historic main Niger route via Cotonou',
    state: 'blockaded',
    desc: 'Closed since the July 2023 coup in Niger. Reopening agreed in principle (Jun 2026) but not implemented as of late Sep 2026.'
  },
  {
    id: 'kamba',
    kind: 'border', region: 'West Africa',
    name: 'Kamba Detour (via Nigeria)',
    shortName: 'KAMBA',
    lat: 12.35, lng: 4.1,
    dailyFlow: 'Cotonou → Niger via Nigerian territory',
    state: 'open',
    desc: 'Reopened 9 Feb 2026 after a three-month closure stranded ~1,600 trucks. Adds 600–900 km to the Cotonou route.'
  },
  {
    id: 'jnim_bamako',
    kind: 'border', region: 'West Africa',
    name: 'Bamako Approaches (JNIM blockade)',
    shortName: 'BAMAKO RING',
    lat: 13.1, lng: -8.9,
    dailyFlow: 'Dakar & Abidjan highways into Bamako',
    state: 'contested',
    desc: 'JNIM fuel blockade on the main highways into Bamako since Sep 2025; fuel moves in military-escorted convoys (Sep 2026).'
  },
  {
    // A river, not a border: low water cuts barge drafts (and so payload)
    // rather than closing a crossing. CONTESTED = draft-restricted.
    id: 'hidrovia',
    kind: 'border', region: 'South America',
    name: 'Paraná–Paraguay Hidrovía (low water)',
    shortName: 'HIDROVÍA',
    lat: -27.4, lng: -58.8,
    dailyFlow: '~80% of Paraguay\'s foreign trade; Bolivian soy & ore via Puerto Aguirre',
    state: 'contested',
    desc: 'Paraguay River near zero at Asunción through Sep 2026 (0.43 m), forcing barge loads down to ~50-75%. Rains lifted it to 1.81 m by 12 Oct, still well below the ~4.5 m average.'
  },
  {
    id: 'danube',
    kind: 'border', region: 'Europe',
    name: 'Lower Danube (low water)',
    shortName: 'DANUBE',
    lat: 43.65, lng: 25.2,
    dailyFlow: 'Constanța ↔ Budapest / Bratislava / Vienna barge traffic',
    state: 'contested',
    desc: 'Record lows in summer 2026: Ruse at −94 cm and ~1.6 m depth at Belene in Aug, with loaded convoys waiting at anchor. Autumn recovery not yet confirmed; set OPEN once levels return.'
  }
];

// ----------------------------------------------------------------------------
// 2. NAVIGATION GRAPH — NODES
//    Ports sit on their harbour; sea waypoints sit in open water and only
//    act as junctions. Sea-leg geometry and distance come from
//    data/sea-lanes.js (generated by tools/build_sea_lanes.py), so a node
//    never needs to be placed just to steer a line around a coast.
//
//    offshore: [lat, lng] marks a HARBOUR. §3K moves every sea edge that
//    touches it onto that offshore point (on the main shipping lane) and
//    adds one short approach edge into the harbour, so ships passing by stay
//    on the lane and only ships calling at the port go in.
// ----------------------------------------------------------------------------
export const GRAPH_NODES = {
  // 2A. North America
  N_US_EAST:    { lat: 36.95, lng: -75.95, name: 'Norfolk / NY Hub', offshore: [37.081, -75.44] },
  N_US_GULF:    { lat: 29.3, lng: -94.7, name: 'Houston / Galveston', offshore: [28.877, -94.416] },
  N_US_WEST:    { lat: 33.7, lng: -118.25, name: 'Los Angeles / Long Beach', offshore: [33.706, -118.487] },
  N_CA_WEST:    { lat: 48.45, lng: -124.9, name: 'Vancouver / Juan de Fuca', offshore: [48.568, -125.502] },
  N_CA_EAST:    { lat: 44.55, lng: -63.5, name: 'Halifax', offshore: [44.535, -63.488] },

  // 2B. Latin America & Caribbean
  N_MX_PAC:     { lat: 19.05, lng: -104.35, name: 'Manzanillo (Pacific)', offshore: [18.8, -104.6] },
  N_MX_GULF:    { lat: 19.25, lng: -96.05, name: 'Veracruz (Gulf)', offshore: [19.5, -96] },
  N_FL_STRAITS: { lat: 24.513, lng: -80.797, name: 'Florida Straits' },
  N_YUCATAN:    { lat: 21.65, lng: -85.902, name: 'Yucatán Channel' },
  N_WINDWARD:   { lat: 20, lng: -73.9, name: 'Windward Passage' },
  // Canal ends sit just off the locks so lanes don't snap onto the canal itself
  N_PANAMA:     { lat: 9.6, lng: -79.9, name: 'Colón (Panama Canal, Atlantic)' },
  N_PANAMA_PAC: { lat: 7.2, lng: -79.8, name: 'Balboa (Panama Canal, Pacific)' },
  N_COL_CARIB:  { lat: 10.4, lng: -75.6, name: 'Cartagena', offshore: [10.89, -75.732] },
  N_COL_PAC:    { lat: 3.85, lng: -77.15, name: 'Buenaventura', offshore: [3.82, -77.629] },
  N_BRAZIL:     { lat: -24.0, lng: -46.3, name: 'Port of Santos', offshore: [-24.3, -46.3] },
  N_HORN_SA:    { lat: -55.891, lng: -66.396, name: 'Cape Horn' },
  N_VE_PCABELLO: { lat: 10.48, lng: -68.01, name: 'Puerto Cabello / La Guaira', offshore: [10.62, -68.0] },
  N_VE_JOSE:    { lat: 10.1, lng: -64.85, name: 'José (Orinoco crude terminal)', offshore: [10.45, -64.75] },
  N_CU_MARIEL:  { lat: 22.99, lng: -82.75, name: 'Mariel / Havana', offshore: [23.212, -82.381] },

  // 2B-2. South America: Pacific & Southern Cone (Batch 4)
  //       Pacific ports sit 30-80 NM off the MARNET trunk, so their offshore
  //       points stay close in and searoute joins the trunk from there.
  N_EC_GUAYAQUIL: { lat: -2.71, lng: -80.25, name: 'Guayaquil / Posorja', offshore: [-2.981, -80.475] },
  N_PE_CHANCAY: { lat: -11.58, lng: -77.27, name: 'Chancay (COSCO megaport)', offshore: [-11.65, -77.55] },
  N_PE_CALLAO:  { lat: -12.05, lng: -77.15, name: 'Callao', offshore: [-12.0, -77.7] },
  N_PE_ILO:     { lat: -17.64, lng: -71.35, name: 'Ilo / Matarani', offshore: [-17.8, -71.6] },
  N_CL_ARICA:   { lat: -18.47, lng: -70.33, name: 'Arica (Bolivian transit port)', offshore: [-18.6, -70.55] },
  N_CL_ANTOF:   { lat: -23.65, lng: -70.41, name: 'Antofagasta / Mejillones', offshore: [-23.7, -70.7] },
  N_CL_SANANT:  { lat: -33.59, lng: -71.62, name: 'San Antonio / Valparaíso', offshore: [-33.6, -71.85] },
  N_UY_MVD:     { lat: -34.9, lng: -56.21, name: 'Montevideo', offshore: [-35.1, -56.5] },
  N_AR_BSAS:    { lat: -34.6, lng: -58.37, name: 'Buenos Aires' },
  N_AR_ROSARIO: { lat: -32.95, lng: -60.63, name: 'Rosario / Up-River grain hub' },
  N_AR_BAHIA:   { lat: -38.79, lng: -62.27, name: 'Bahía Blanca', offshore: [-39.3, -61.25] },

  // 2C. Europe & Mediterranean
  N_USHANT:     { lat: 48.521, lng: -5.797, name: 'Ushant / Western Approaches' },
  N_FINISTERRE: { lat: 43.181, lng: -9.753, name: 'Cape Finisterre Offing' },
  N_UK_NL:      { lat: 51.95, lng: 4.0, name: 'Rotterdam / North Sea', offshore: [52.01, 3.348] },
  N_UK:         { lat: 51.85, lng: 1.45, name: 'Felixstowe / Thames', offshore: [51.701, 1.807] },
  N_FR_NORTH:   { lat: 49.5, lng: 0.05, name: 'Le Havre', offshore: [49.605, -0.391] },
  N_GERMANY:    { lat: 53.9, lng: 8.7, name: 'Hamburg / Bremerhaven', offshore: [53.9, 8.25] },
  N_MED_WEST:   { lat: 36.34, lng: -4.417, name: 'Strait of Gibraltar' },
  N_FR_MED:     { lat: 43.35, lng: 4.85, name: 'Marseille-Fos', offshore: [43.144, 5.039] },
  N_ITALY:      { lat: 40.8, lng: 14.25, name: 'Tyrrhenian (Naples / Genoa)', offshore: [40.376, 14.005] },
  N_GREECE:     { lat: 37.9, lng: 23.6, name: 'Piraeus / Aegean Hub', offshore: [37.768, 23.406] },
  N_TR_IST:     { lat: 40.95, lng: 28.7, name: 'Istanbul / Ambarlı (Marmara)', offshore: [40.787, 28.664] },
  N_TR_MED:     { lat: 36.75, lng: 34.65, name: 'Mersin', offshore: [36.541, 34.666] },
  N_BLACK_SEA:  { lat: 43, lng: 33, name: 'Black Sea Basin' },
  N_RUSSIA_W:   { lat: 44.7, lng: 37.8, name: 'Novorossiysk (Black Sea)' },
  N_UA_ODESA:   { lat: 46.5, lng: 30.75, name: 'Greater Odesa (Odesa / Chornomorsk / Pivdennyi)', offshore: [46.25, 30.9] },
  N_UA_IZMAIL:  { lat: 45.35, lng: 28.84, name: 'Izmail / Reni (Danube ports)' },
  N_RU_CPC:     { lat: 44.65, lng: 37.85, name: 'CPC Terminal (Kazakh crude)', offshore: [44.452, 37.471] },
  N_GE_POTI:    { lat: 42.15, lng: 41.65, name: 'Poti / Batumi (Georgia)', offshore: [41.8, 41.1] },
  N_NO_BERGEN:  { lat: 60.55, lng: 5.0, name: 'Bergen / Mongstad', offshore: [60.916, 4.16] },
  N_RU_BALTIC:  { lat: 59.95, lng: 28.6, name: 'Ust-Luga / St Petersburg (Baltic)', offshore: [60.18, 27.9] },

  // 2C-2. EU coastal states (Batch 5). Offshore points sit on MARNET trunk nodes.
  N_BE_ANTWERP: { lat: 51.27, lng: 4.33, name: 'Antwerp-Bruges', offshore: [51.5, 3.4] },
  N_IE_DUBLIN:  { lat: 53.35, lng: -6.2, name: 'Dublin', offshore: [53.4, -5.7] },
  N_PT_SINES:   { lat: 37.95, lng: -8.87, name: 'Sines', offshore: [37.891, -9.117] },
  N_ES_ALGECIRAS: { lat: 36.13, lng: -5.43, name: 'Algeciras', offshore: [35.973, -5.269] },
  N_ES_VALENCIA: { lat: 39.45, lng: -0.32, name: 'Valencia', offshore: [39.556, 0.138] },
  N_ES_BARCELONA: { lat: 41.35, lng: 2.17, name: 'Barcelona', offshore: [41.3, 2.5] },
  N_MT_MALTA:   { lat: 35.82, lng: 14.55, name: 'Marsaxlokk (Malta Freeport)', offshore: [36.0, 14.7] },
  N_CY_LIMASSOL:{ lat: 34.65, lng: 33.02, name: 'Limassol', offshore: [34.507, 33.04] },
  N_OTRANTO:    { lat: 40.1, lng: 18.9, name: 'Strait of Otranto (Adriatic entrance)' },
  N_SI_KOPER:   { lat: 45.55, lng: 13.73, name: 'Koper (Central Europe gateway)', offshore: [45.629, 13.581] },
  N_HR_RIJEKA:  { lat: 45.33, lng: 14.43, name: 'Rijeka', offshore: [45.022, 14.217] },
  N_RO_CONSTANTA: { lat: 44.17, lng: 28.65, name: 'Constanța', offshore: [44.073, 29.032] },
  N_BG_VARNA:   { lat: 43.2, lng: 27.95, name: 'Varna', offshore: [43.023, 28.439] },
  N_AL_DURRES:  { lat: 41.31, lng: 19.45, name: 'Durrës', offshore: [41.238, 18.72] },
  N_ME_BAR:     { lat: 42.09, lng: 19.08, name: 'Bar', offshore: [41.916, 18.613] },
  N_GR_THESS:   { lat: 40.63, lng: 22.93, name: 'Thessaloniki (Balkan gateway)', offshore: [40.253, 22.872] },
  N_IS_REYKJAVIK: { lat: 64.15, lng: -21.95, name: 'Reykjavík / Straumsvík', offshore: [63.748, -22.917] },
  N_SKAGEN:     { lat: 57.8, lng: 10.733, name: 'Skagerrak / Skagen' },
  N_DK_AARHUS:  { lat: 56.15, lng: 10.22, name: 'Aarhus', offshore: [56.12, 10.951] },
  N_SE_GOTHENBURG: { lat: 57.7, lng: 11.9, name: 'Gothenburg', offshore: [57.7, 11.4] },
  N_BALTIC_SW:  { lat: 55.24, lng: 13.836, name: 'South Baltic (Bornholm Gat)' },
  N_BALTIC_C:   { lat: 57.309, lng: 20.344, name: 'Central Baltic (east of Gotland)' },
  N_PL_GDANSK:  { lat: 54.4, lng: 18.67, name: 'Gdańsk / Gdynia', offshore: [55.0, 19.0] },
  N_LT_KLAIPEDA:{ lat: 55.7, lng: 21.1, name: 'Klaipėda', offshore: [55.768, 20.312] },
  N_LV_RIGA:    { lat: 57.0, lng: 24.1, name: 'Riga', offshore: [57.877, 22.659] },
  N_EE_TALLINN: { lat: 59.45, lng: 24.77, name: 'Tallinn / Muuga', offshore: [59.702, 24.011] },
  N_FI_HELSINKI:{ lat: 60.2, lng: 25.2, name: 'Helsinki / Vuosaari', offshore: [59.8, 24.7] },
  N_SE_STOCKHOLM: { lat: 59.3, lng: 18.1, name: 'Stockholm', offshore: [59.373, 18.726] },

  // 2D. Africa & Red Sea
  N_DAKAR:      { lat: 15, lng: -18, name: 'Dakar Offing' },
  N_GUINEA_OFF: { lat: -0.0, lng: -10, name: 'Gulf of Guinea Approach' },
  N_NIGERIA:    { lat: 6.4, lng: 3.4, name: 'Lagos / Gulf of Guinea', offshore: [6.381, 3.406] },
  // 2D-2. West African coast (Batch 2)
  N_MR_NOUAKCHOTT: { lat: 18.0, lng: -16.03, name: 'Nouakchott', offshore: [17.95, -16.3] },
  N_CV_PRAIA:   { lat: 14.92, lng: -23.5, name: 'Praia', offshore: [15, -23] },
  N_SN_DAKAR:   { lat: 14.68, lng: -17.42, name: 'Port of Dakar', offshore: [14.6, -17.6] },
  N_GM_BANJUL:  { lat: 13.45, lng: -16.58, name: 'Banjul', offshore: [13.517, -17.151] },
  N_GW_BISSAU:  { lat: 11.85, lng: -15.6, name: 'Bissau', offshore: [11.641, -16.606] },
  N_GN_CONAKRY: { lat: 9.5, lng: -13.72, name: 'Conakry', offshore: [9.3, -14.0] },
  N_SL_FREETOWN:{ lat: 8.5, lng: -13.25, name: 'Freetown', offshore: [8.4, -13.5] },
  N_LR_MONROVIA:{ lat: 6.35, lng: -10.8, name: 'Monrovia', offshore: [6.2, -11.0] },
  N_CI_ABIDJAN: { lat: 5.25, lng: -4.0, name: 'Abidjan', offshore: [4.867, -4.032] },
  N_GH_TAKORADI:{ lat: 4.89, lng: -1.75, name: 'Takoradi', offshore: [4.7, -1.7] },
  N_GH_TEMA:    { lat: 5.62, lng: 0.02, name: 'Tema', offshore: [5.304, 0.016] },
  N_TG_LOME:    { lat: 6.13, lng: 1.28, name: 'Lomé', offshore: [5.837, 1.422] },
  N_BJ_COTONOU: { lat: 6.35, lng: 2.43, name: 'Cotonou', offshore: [6.075, 2.516] },
  N_ANGOLA:     { lat: -12.3, lng: 13.5, name: 'Lobito Mineral Terminal', offshore: [-12.3, 13.2] },
  N_CAPE:       { lat: -35.0, lng: 18.6, name: 'Cape of Good Hope (offshore lane)' },
  N_AGULHAS:    { lat: -34.5, lng: 26, name: 'Agulhas Bank Offing' },
  N_DURBAN:     { lat: -29.9, lng: 31.05, name: 'Durban', offshore: [-29.817, 31.174] },
  N_MOZ_CHAN:   { lat: -16.678, lng: 42.517, name: 'Mozambique Channel' },
  N_GUARDAFUI:  { lat: 11.6, lng: 52.3, name: 'Cape Guardafui Offing' },
  N_SUEZ_N:     { lat: 31.3, lng: 32.35, name: 'Port Said (Suez North)' },
  N_SAUDI:      { lat: 21.5, lng: 39.15, name: 'Jeddah / Red Sea Hub', offshore: [20.807, 38.573] },
  N_BAB:        { lat: 13.676, lng: 42.541, name: 'Bab el-Mandeb Gate' },
  N_DJIBOUTI:   { lat: 11.6, lng: 43.15, name: 'Djibouti (Ethiopia gateway)' },
  N_KE_MOMBASA: { lat: -4.05, lng: 39.67, name: 'Mombasa', offshore: [-4.2, 40.3] },

  // 2D-3. Rest of Africa (Batch 7)
  N_DZ_ALGIERS: { lat: 36.77, lng: 3.07, name: 'Algiers / Arzew', offshore: [37.2, 3.1] },
  N_TN_RADES:   { lat: 36.8, lng: 10.3, name: 'Radès / Tunis', offshore: [37.482, 10.373] },
  N_LY_MISRATA: { lat: 32.38, lng: 15.2, name: 'Misrata / Mellitah (west Libya)', offshore: [32.405, 15.305] },
  N_LY_SIDRA:   { lat: 30.63, lng: 18.35, name: 'Es Sider / Ras Lanuf (oil crescent)', offshore: [31.228, 19.293] },
  N_MR_NOUADHIBOU: { lat: 20.9, lng: -17.05, name: 'Nouadhibou (SNIM iron ore)', offshore: [21.0, -18.0] },
  N_SD_PORTSUDAN: { lat: 19.6, lng: 37.22, name: 'Port Sudan', offshore: [19.987, 38.007] },
  N_SO_BERBERA: { lat: 10.44, lng: 45.01, name: 'Berbera (Somaliland)', offshore: [10.7, 45.05] },
  N_SO_MOGADISHU: { lat: 2.03, lng: 45.34, name: 'Mogadishu', offshore: [1.733, 45.852] },
  N_TZ_DAR:     { lat: -6.82, lng: 39.3, name: 'Dar es Salaam', offshore: [-6.5, 40.0] },
  N_MZ_NACALA:  { lat: -14.54, lng: 40.67, name: 'Nacala', offshore: [-15.0, 41.7] },
  N_MZ_BEIRA:   { lat: -19.83, lng: 34.84, name: 'Beira', offshore: [-20.004, 35.409] },
  N_MZ_MAPUTO:  { lat: -25.97, lng: 32.57, name: 'Maputo', offshore: [-25.703, 32.861] },
  N_MG_TOAMASINA: { lat: -18.15, lng: 49.42, name: 'Toamasina', offshore: [-18.226, 49.95] },
  N_MU_PORTLOUIS: { lat: -20.16, lng: 57.5, name: 'Port Louis', offshore: [-20.019, 57.454] },
  N_SC_VICTORIA: { lat: -4.62, lng: 55.45, name: 'Port Victoria (Mahé)', offshore: [-4.6, 55.3] },
  N_KM_MORONI:  { lat: -11.7, lng: 43.25, name: 'Moroni', offshore: [-12.0, 43.0] },
  N_NA_WALVIS:  { lat: -22.95, lng: 14.5, name: 'Walvis Bay', offshore: [-22.909, 13.809] },
  N_CM_DOUALA:  { lat: 4.05, lng: 9.7, name: 'Douala / Kribi', offshore: [3.722, 9.415] },
  N_GQ_MALABO:  { lat: 3.75, lng: 8.78, name: 'Malabo / Punta Europa', offshore: [3.5, 8.52] },
  N_ST_SAOTOME: { lat: 0.34, lng: 6.73, name: 'São Tomé', offshore: [0.434, 6.735] },
  N_GA_OWENDO:  { lat: 0.3, lng: 9.5, name: 'Owendo / Libreville', offshore: [0.4, 9.2] },
  N_CG_POINTENOIRE: { lat: -4.79, lng: 11.83, name: 'Pointe-Noire', offshore: [-4.992, 11.14] },
  N_CD_MATADI:  { lat: -5.82, lng: 13.45, name: 'Matadi (Congo River)', offshore: [-5.96, 11.544] },
  N_MA_TANGER:  { lat: 35.89, lng: -5.5, name: 'Tanger Med', offshore: [35.95, -5.75] },
  N_MA_JORF:    { lat: 33.12, lng: -8.62, name: 'Casablanca / Jorf Lasfar (OCP)', offshore: [33.623, -8.751] },
  N_GULF_ADEN:  { lat: 12.884, lng: 50.856, name: 'Gulf of Aden (East)' },

  // 2E. Persian Gulf, Arabian Sea & South Asia
  N_HORMUZ:     { lat: 25.3, lng: 57.3, name: 'Strait of Hormuz Gate (Gulf of Oman side)' },
  N_UAE:        { lat: 25.05, lng: 55.0, name: 'Jebel Ali / Dubai', offshore: [25.6, 55.2] },
  N_FUJAIRAH:   { lat: 25.15, lng: 56.45, name: 'Fujairah / Khor Fakkan (outside Hormuz)', offshore: [25.15, 56.7] },
  N_DAMMAM:     { lat: 26.5, lng: 50.25, name: 'Dammam / Ras Tanura', offshore: [26.805, 50.243] },
  N_BANDAR:     { lat: 26.6, lng: 55.5, name: 'Bandar Abbas (approach)' },
  N_CHABAHAR:   { lat: 25.0, lng: 60.5, name: 'Chabahar (approach)' },

  // 2E-2. Gulf, Oman & the Levant (Batch 6). Every Gulf port except Sohar
  //       and Salalah sits inside Hormuz.
  N_QA_RASLAFFAN: { lat: 25.92, lng: 51.55, name: 'Ras Laffan (LNG)', offshore: [26.3, 51.6] },
  N_KW_KUWAIT:  { lat: 29.05, lng: 48.17, name: 'Shuwaikh / Mina al-Ahmadi', offshore: [29.1, 48.3] },
  N_BH_KHALIFA: { lat: 26.2, lng: 50.72, name: 'Khalifa bin Salman Port', offshore: [26.4, 50.9] },
  N_IQ_BASRA:   { lat: 30.03, lng: 47.95, name: 'Umm Qasr / Basra Oil Terminal', offshore: [29.702, 48.66] },
  N_OM_SOHAR:   { lat: 24.5, lng: 56.63, name: 'Sohar (outside Hormuz)', offshore: [24.6, 57.0] },
  N_OM_SALALAH: { lat: 16.94, lng: 54.0, name: 'Salalah (transshipment hub)', offshore: [16.8, 54.15] },
  N_IL_HAIFA:   { lat: 32.82, lng: 35.0, name: 'Haifa', offshore: [33.0, 34.8] },
  N_IL_EILAT:   { lat: 29.55, lng: 34.95, name: 'Eilat (Red Sea)', offshore: [29.461, 34.926] },
  N_RAS_HADD:   { lat: 22.7, lng: 60.4, name: 'Ras al Hadd / Arabian Sea' },
  N_KARACHI:    { lat: 24.75, lng: 66.95, name: 'Karachi / Port Qasim', offshore: [24.3, 66.6] },
  N_INDIA_W:    { lat: 18.9, lng: 72.85, name: 'Mumbai / JNPT', offshore: [19, 72.4] },
  N_SRI_LANKA:  { lat: 6.95, lng: 79.8, name: 'Colombo', offshore: [5.8, 80.1] },
  N_INDIA_E:    { lat: 13.1, lng: 80.35, name: 'Chennai', offshore: [13, 81] },
  N_CHITTAGONG: { lat: 22.2, lng: 91.75, name: 'Chittagong', offshore: [21.799, 91.629] },

  // 2F. Southeast & East Asia, Pacific
  N_MALACCA_NW: { lat: 6.157, lng: 94.326, name: 'Malacca Strait (NW Entrance)' },
  N_MALACCA:    { lat: 1.2, lng: 103.85, name: 'Singapore / Malacca Gate', offshore: [1.171, 103.861] },
  N_JAKARTA:    { lat: -6.05, lng: 106.9, name: 'Jakarta / Tanjung Priok', offshore: [-5.917, 106.868] },
  N_SUNDA:      { lat: -6.593, lng: 104.828, name: 'Sunda Strait (Malacca Bypass)' },
  N_LOMBOK:     { lat: -8.64, lng: 115.75, name: 'Lombok Strait (Deepwater Bypass)' },
  N_SCS_SOUTH:  { lat: 9.798, lng: 111.913, name: 'Spratly / SCS South' },
  N_SCS_NORTH:  { lat: 19.666, lng: 115.841, name: 'South China Sea North' },
  N_VN_SOUTH:   { lat: 10.3, lng: 107.1, name: 'Cai Mep / Vung Tau', offshore: [10, 107.3] },
  N_VN_NORTH:   { lat: 20.75, lng: 106.85, name: 'Hai Phong', offshore: [20.686, 106.873] },
  N_MANILA:     { lat: 14.55, lng: 120.85, name: 'Manila', offshore: [14.262, 120.535] },
  N_TAIWAN_ST:  { lat: 24.449, lng: 119.339, name: 'Taiwan Strait Gate' },
  N_PHIL_SEA:   { lat: 21.218, lng: 124.536, name: 'Luzon / Philippine Sea Bypass' },
  N_TAIWAN:     { lat: 22.55, lng: 120.25, name: 'Kaohsiung Tech Hub', offshore: [22.702, 120.141] },
  N_CHINA_E:    { lat: 30.7, lng: 122.2, name: 'Shanghai / Ningbo Hub', offshore: [30.932, 122.669] },
  N_KOREA:      { lat: 35.05, lng: 129.05, name: 'Busan Port', offshore: [35, 129.2] },
  N_JAPAN:      { lat: 35.4, lng: 139.75, name: 'Tokyo / Yokohama', offshore: [34.8, 139.9] },
  N_VLADIVOSTOK:{ lat: 43.05, lng: 131.9, name: 'Vladivostok', offshore: [42.3, 132] },
  N_AUS_WEST:   { lat: -20.3, lng: 118.6, name: 'Port Hedland / Pilbara', offshore: [-19.6, 118.6] },
  // 2F-2. Southeast Asia & Oceania (Batch 3)
  N_MY_KLANG:   { lat: 3.0, lng: 101.38, name: 'Port Klang', offshore: [2.879, 101.252] },
  N_MY_PTP:     { lat: 1.36, lng: 103.55, name: 'Tanjung Pelepas', offshore: [1.198, 103.658] },
  N_TH_LAEM:    { lat: 13.08, lng: 100.88, name: 'Laem Chabang', offshore: [12.971, 100.6] },
  N_KH_SIHANOUK:{ lat: 10.63, lng: 103.5, name: 'Sihanoukville', offshore: [10.511, 103.39] },
  N_MM_YANGON:  { lat: 16.6, lng: 96.25, name: 'Yangon / Thilawa', offshore: [16.412, 96.394] },
  N_BN_MUARA:   { lat: 5.03, lng: 115.07, name: 'Muara', offshore: [5.091, 115.098] },
  N_TL_DILI:    { lat: -8.55, lng: 125.57, name: 'Dili', offshore: [-8.385, 125.299] },
  N_AUS_EAST:   { lat: -33.85, lng: 151.25, name: 'Sydney / Port Botany', offshore: [-34.0, 151.5] },
  N_PG_POM:     { lat: -9.48, lng: 147.15, name: 'Port Moresby / Caution Bay (PNG LNG)', offshore: [-10.0, 147.0] },
  N_HK_HKG:     { lat: 22.3, lng: 114.17, name: 'Hong Kong (Kwai Tsing)', offshore: [22.2, 114.3] },
  N_NZ_TAURANGA:{ lat: -37.65, lng: 176.18, name: 'Tauranga / Auckland', offshore: [-36.517, 175.893] },

  // 2G. Inland hubs (road/rail corridors to landlocked states)
  N_GH_TAMALE:  { lat: 9.4, lng: -0.85, name: 'Tamale (Northern Ghana)' },
  N_BF_OUAGA:   { lat: 12.37, lng: -1.52, name: 'Ouagadougou (dry port)' },
  N_NE_NIAMEY:  { lat: 13.51, lng: 2.11, name: 'Niamey' },
  N_NG_KAMBA:   { lat: 11.85, lng: 3.66, name: 'Kamba (Nigeria border)' },
  N_ML_BAMAKO:  { lat: 12.64, lng: -8.0, name: 'Bamako' },

  N_LA_VIENTIANE: { lat: 17.97, lng: 102.6, name: 'Vientiane (Thanaleng dry port)' },
  N_CN_KUNMING: { lat: 25.04, lng: 102.71, name: 'Kunming (rail hub)' },
  N_PY_ASUNCION:  { lat: -25.28, lng: -57.63, name: 'Asunción (river port)' },
  N_BO_ELALTO:    { lat: -16.5, lng: -68.15, name: 'La Paz / El Alto' },
  N_BO_SANTACRUZ: { lat: -17.78, lng: -63.18, name: 'Santa Cruz de la Sierra' },
  N_BO_AGUIRRE:   { lat: -18.98, lng: -57.8, name: 'Puerto Aguirre / Quijarro (river port)' },
  N_AT_VIENNA:    { lat: 48.2, lng: 16.37, name: 'Vienna (rail & Danube hub)' },
  N_CZ_PRAGUE:    { lat: 50.08, lng: 14.43, name: 'Prague' },
  N_SK_BRATISLAVA:{ lat: 48.15, lng: 17.11, name: 'Bratislava (rail & Danube hub)' },
  N_HU_BUDAPEST:  { lat: 47.5, lng: 19.04, name: 'Budapest (rail & Danube hub)' },
  N_LU_LUX:       { lat: 49.6, lng: 6.13, name: 'Luxembourg (Bettembourg rail terminal)' },
  N_MK_SKOPJE:    { lat: 42.0, lng: 21.43, name: 'Skopje' },
  N_BY_MINSK:     { lat: 53.9, lng: 27.57, name: 'Minsk' },
  N_AM_YEREVAN:   { lat: 40.18, lng: 44.51, name: 'Yerevan' },
  N_UZ_TASHKENT:  { lat: 41.3, lng: 69.28, name: 'Tashkent' },
  N_KG_BISHKEK:   { lat: 42.87, lng: 74.6, name: 'Bishkek' },
  N_TJ_DUSHANBE:  { lat: 38.56, lng: 68.77, name: 'Dushanbe' },
  N_IQ_KIRKUK:    { lat: 35.47, lng: 44.39, name: 'Kirkuk (oilfields)' },
  N_KZ_ATYRAU:    { lat: 47.1, lng: 51.9, name: 'Atyrau / Tengiz (oil hub)' },
  N_ET_ADDIS:     { lat: 8.98, lng: 38.79, name: 'Addis Ababa (Indode dry port)' },
  N_ZA_JOBURG:    { lat: -26.2, lng: 28.05, name: 'Johannesburg (City Deep rail hub)' },
  N_BW_GABORONE:  { lat: -24.65, lng: 25.91, name: 'Gaborone' },
  N_LS_MASERU:    { lat: -29.31, lng: 27.48, name: 'Maseru' },
  N_SZ_MATSAPHA:  { lat: -26.52, lng: 31.31, name: 'Matsapha (Eswatini)' },
  N_ZW_HARARE:    { lat: -17.83, lng: 31.05, name: 'Harare' },
  N_ZM_LUSAKA:    { lat: -15.39, lng: 28.32, name: 'Lusaka / Copperbelt hub' },
  N_CD_LUBUMBASHI:{ lat: -11.66, lng: 27.48, name: 'Lubumbashi / Kolwezi (Katanga copperbelt)' },
  N_MW_LILONGWE:  { lat: -13.96, lng: 33.79, name: 'Lilongwe / Blantyre' },
  N_RW_KIGALI:    { lat: -1.95, lng: 30.06, name: 'Kigali' },
  N_BI_BUJUMBURA: { lat: -3.38, lng: 29.36, name: 'Bujumbura' },
  N_UG_KAMPALA:   { lat: 0.35, lng: 32.58, name: 'Kampala' },
  N_SS_JUBA:      { lat: 4.85, lng: 31.58, name: 'Juba / Paloch oilfields' },
  N_CF_BANGUI:    { lat: 4.37, lng: 18.56, name: 'Bangui' },
  N_TD_NDJAMENA:  { lat: 12.11, lng: 15.04, name: "N'Djamena / Doba oilfields" },

  // 2H. Overland rail hubs
  N_RAIL_KAZ:   { lat: 45.2, lng: 79.0, name: 'Khorgos / Eurasian Rail Hub' },
  N_RAIL_INSTC: { lat: 36.8, lng: 54.0, name: 'Caspian / INSTC Corridor' },
  N_KZ_AKTAU:   { lat: 43.65, lng: 51.17, name: 'Aktau (Caspian ferry port)' },
  N_AZ_BAKU:    { lat: 40.35, lng: 49.9, name: 'Baku / Alat (Caspian ferry port)' },
  N_RAIL_MALA:  { lat: 52.03, lng: 23.48, name: 'Małaszewicze / Brest (EU–1520 mm gauge change)' }
};

// ----------------------------------------------------------------------------
// 3. NAVIGATION GRAPH — EDGES  [nodeA, nodeB, mode, gateId, costMultiplier]
//    [.., factor, owner]: optional distance factor; optional owner ISO3 for
//    national pipelines, or '!ISO,ISO' = closed to corridors with those
//    endpoints (EU sanctions on Russian & Belarusian goods by rail).
//    mode: 'maritime' | 'land' (rail) | 'road' | 'river' (barge) | 'pipeline'. Only an edge that physically passes THROUGH
//    a chokepoint carries its gateId; build_sea_lanes.py forbids every other
//    sea lane from slipping through that chokepoint. Switching mode
//    (port <-> rail) adds a transshipment penalty (math-geodesic.js §4).
//    Write sea edges port-to-port here; §3K rewires them to offshore points.
// ----------------------------------------------------------------------------
const RAW_EDGES = [
  // 3A. North Atlantic & North America
  ['N_US_EAST', 'N_USHANT', 'maritime', null, 1.0],
  ['N_US_EAST', 'N_MED_WEST', 'maritime', null, 1.0],
  ['N_US_EAST', 'N_CA_EAST', 'maritime', null, 1.0],
  ['N_CA_EAST', 'N_USHANT', 'maritime', null, 1.0],
  ['N_US_EAST', 'N_FL_STRAITS', 'maritime', null, 1.0],
  ['N_US_GULF', 'N_FL_STRAITS', 'maritime', null, 1.0],
  ['N_US_GULF', 'N_YUCATAN', 'maritime', null, 1.0],
  ['N_CA_WEST', 'N_US_WEST', 'maritime', null, 1.0],

  // 3B. Caribbean, Panama Canal & Latin America
  //     The canal is ONE gated edge (Colón <-> Balboa); everything else
  //     touching either side is an ordinary sea lane.
  ['N_US_EAST', 'N_WINDWARD', 'maritime', null, 1.0],
  ['N_FL_STRAITS', 'N_YUCATAN', 'maritime', null, 1.0],
  ['N_MX_GULF', 'N_YUCATAN', 'maritime', null, 1.0],
  ['N_MX_GULF', 'N_FL_STRAITS', 'maritime', null, 1.0],
  ['N_YUCATAN', 'N_PANAMA', 'maritime', null, 1.0],
  ['N_WINDWARD', 'N_PANAMA', 'maritime', null, 1.0],
  ['N_WINDWARD', 'N_COL_CARIB', 'maritime', null, 1.0],
  ['N_COL_CARIB', 'N_PANAMA', 'maritime', null, 1.0],
  ['N_PANAMA', 'N_PANAMA_PAC', 'maritime', 'panama', 1.0],
  ['N_PANAMA_PAC', 'N_US_WEST', 'maritime', null, 1.0],
  ['N_PANAMA_PAC', 'N_MX_PAC', 'maritime', null, 1.0],
  ['N_PANAMA_PAC', 'N_COL_PAC', 'maritime', null, 1.0],
  ['N_MX_PAC', 'N_US_WEST', 'maritime', null, 1.0],
  ['N_MX_GULF', 'N_US_GULF', 'maritime', null, 1.0],      // direct Gulf of Mexico crossing
  ['N_US_EAST', 'N_BRAZIL', 'maritime', null, 1.0],
  ['N_BRAZIL', 'N_CAPE', 'maritime', null, 1.0],
  ['N_BRAZIL', 'N_NIGERIA', 'maritime', null, 1.0],
  ['N_BRAZIL', 'N_DAKAR', 'maritime', null, 1.0],          // South America <-> Europe trunk
  ['N_BRAZIL', 'N_COL_CARIB', 'maritime', null, 1.0],      // Brazil <-> Caribbean coast
  ['N_BRAZIL', 'N_HORN_SA', 'maritime', null, 1.15],
  ['N_HORN_SA', 'N_US_WEST', 'maritime', null, 1.15],
  ['N_HORN_SA', 'N_COL_PAC', 'maritime', null, 1.15],

  // 3B-2. South America: Pacific coast & Southern Cone (Batch 4)
  //       Pacific chain runs Panama -> Guayaquil -> Peru -> Chile -> the Horn.
  //       Chancay carries the direct trans-Pacific services (opened Nov 2024).
  ['N_VE_PCABELLO', 'N_WINDWARD', 'maritime', null, 1.0],            // Venezuela & Cuba (Batch 8)
  ['N_VE_PCABELLO', 'N_PANAMA', 'maritime', null, 1.0],
  ['N_VE_PCABELLO', 'N_COL_CARIB', 'maritime', null, 1.0],
  ['N_VE_JOSE', 'N_VE_PCABELLO', 'maritime', null, 1.0],
  ['N_VE_JOSE', 'N_US_EAST', 'maritime', null, 1.0],
  ['N_VE_JOSE', 'N_DAKAR', 'maritime', null, 1.0],                    // to Europe, India & China via the Cape
  ['N_CU_MARIEL', 'N_FL_STRAITS', 'maritime', null, 1.0],
  ['N_CU_MARIEL', 'N_YUCATAN', 'maritime', null, 1.0],
  ['N_CU_MARIEL', 'N_WINDWARD', 'maritime', null, 1.0],
  ['N_PANAMA_PAC', 'N_EC_GUAYAQUIL', 'maritime', null, 1.0],
  ['N_COL_PAC', 'N_EC_GUAYAQUIL', 'maritime', null, 1.0],
  ['N_EC_GUAYAQUIL', 'N_PE_CHANCAY', 'maritime', null, 1.0],
  ['N_PANAMA_PAC', 'N_PE_CALLAO', 'maritime', null, 1.0],
  ['N_PE_CHANCAY', 'N_PE_CALLAO', 'maritime', null, 1.0],
  ['N_PE_CALLAO', 'N_PE_ILO', 'maritime', null, 1.0],
  ['N_PE_ILO', 'N_CL_ARICA', 'maritime', null, 1.0],
  ['N_CL_ARICA', 'N_CL_ANTOF', 'maritime', null, 1.0],
  ['N_CL_ANTOF', 'N_CL_SANANT', 'maritime', null, 1.0],
  ['N_CL_SANANT', 'N_HORN_SA', 'maritime', null, 1.15],
  ['N_PE_CHANCAY', 'N_CHINA_E', 'maritime', null, 1.0],
  ['N_PE_CHANCAY', 'N_JAPAN', 'maritime', null, 1.0],
  ['N_CL_SANANT', 'N_NZ_TAURANGA', 'maritime', null, 1.0],
  ['N_CL_SANANT', 'N_PE_CALLAO', 'maritime', null, 1.0],      // offshore trunk: skips the northern Chile calls
  ['N_EC_GUAYAQUIL', 'N_MX_PAC', 'maritime', null, 1.0],      // Ecuador -> North America west coast
  //       Atlantic: Santos -> Montevideo (Río de la Plata hub) -> Buenos Aires,
  //       up the Paraná to Rosario, and south to Bahía Blanca and the Horn.
  ['N_BRAZIL', 'N_UY_MVD', 'maritime', null, 1.0],
  ['N_UY_MVD', 'N_AR_BSAS', 'maritime', null, 1.0],
  ['N_UY_MVD', 'N_AR_ROSARIO', 'maritime', null, 1.0],       // ocean-going ships via the Paraná channels
  ['N_UY_MVD', 'N_AR_BAHIA', 'maritime', null, 1.0],
  ['N_AR_BAHIA', 'N_HORN_SA', 'maritime', null, 1.15],
  ['N_UY_MVD', 'N_CAPE', 'maritime', null, 1.0],             // Southern Cone -> Asia via the Cape

  // 3C. Europe & Mediterranean
  ['N_UK_NL', 'N_GERMANY', 'maritime', null, 1.0],
  ['N_UK_NL', 'N_UK', 'maritime', null, 1.0],
  ['N_UK_NL', 'N_FR_NORTH', 'maritime', null, 1.0],
  ['N_UK_NL', 'N_USHANT', 'maritime', null, 1.0],
  ['N_UK', 'N_USHANT', 'maritime', null, 1.0],
  ['N_UK', 'N_FR_NORTH', 'maritime', null, 1.0],          // Channel crossing
  ['N_FR_NORTH', 'N_USHANT', 'maritime', null, 1.0],
  ['N_USHANT', 'N_FINISTERRE', 'maritime', null, 1.0],
  ['N_FINISTERRE', 'N_MED_WEST', 'maritime', null, 1.0],
  ['N_MED_WEST', 'N_FR_MED', 'maritime', null, 1.0],
  ['N_MED_WEST', 'N_ITALY', 'maritime', null, 1.0],
  ['N_FR_MED', 'N_ITALY', 'maritime', null, 1.0],
  ['N_ITALY', 'N_GREECE', 'maritime', null, 1.0],
  ['N_GREECE', 'N_SUEZ_N', 'maritime', null, 1.0],
  ['N_GREECE', 'N_TR_MED', 'maritime', null, 1.0],
  ['N_TR_MED', 'N_SUEZ_N', 'maritime', null, 1.0],
  ['N_GREECE', 'N_TR_IST', 'maritime', null, 1.0],                  // Dardanelles + Marmara (not gated)
  ['N_TR_IST', 'N_BLACK_SEA', 'maritime', 'turkish_straits', 1.0],  // the Bosphorus itself
  ['N_BLACK_SEA', 'N_RUSSIA_W', 'maritime', 'black_sea_war', 1.0],
  ['N_SUEZ_N', 'N_MED_WEST', 'maritime', null, 1.0],       // Mediterranean trunk (Suez <-> Gibraltar)

  // 3C-2. EU coastal states (Batch 5)
  //       North Sea & Atlantic
  ['N_BE_ANTWERP', 'N_UK_NL', 'maritime', null, 1.0],
  ['N_BE_ANTWERP', 'N_UK', 'maritime', null, 1.0],
  ['N_BE_ANTWERP', 'N_FR_NORTH', 'maritime', null, 1.0],
  ['N_BE_ANTWERP', 'N_USHANT', 'maritime', null, 1.0],
  ['N_IE_DUBLIN', 'N_USHANT', 'maritime', null, 1.0],
  ['N_IE_DUBLIN', 'N_US_EAST', 'maritime', null, 1.0],
  ['N_PT_SINES', 'N_FINISTERRE', 'maritime', null, 1.0],
  ['N_PT_SINES', 'N_ES_ALGECIRAS', 'maritime', null, 1.0],
  ['N_PT_SINES', 'N_DAKAR', 'maritime', null, 1.0],
  ['N_PT_SINES', 'N_US_EAST', 'maritime', null, 1.0],
  //       Western & central Mediterranean
  ['N_ES_ALGECIRAS', 'N_MED_WEST', 'maritime', null, 1.0],
  ['N_ES_VALENCIA', 'N_MED_WEST', 'maritime', null, 1.0],
  ['N_ES_VALENCIA', 'N_ES_BARCELONA', 'maritime', null, 1.0],
  ['N_ES_BARCELONA', 'N_FR_MED', 'maritime', null, 1.0],
  ['N_ES_BARCELONA', 'N_ITALY', 'maritime', null, 1.0],
  ['N_MT_MALTA', 'N_MED_WEST', 'maritime', null, 1.0],
  ['N_MT_MALTA', 'N_SUEZ_N', 'maritime', null, 1.0],
  ['N_MT_MALTA', 'N_ITALY', 'maritime', null, 1.0],
  ['N_MT_MALTA', 'N_GREECE', 'maritime', null, 1.0],
  ['N_MT_MALTA', 'N_OTRANTO', 'maritime', null, 1.0],
  //       Adriatic & eastern Mediterranean
  ['N_OTRANTO', 'N_GREECE', 'maritime', null, 1.0],
  ['N_OTRANTO', 'N_ITALY', 'maritime', null, 1.0],
  ['N_OTRANTO', 'N_SUEZ_N', 'maritime', null, 1.0],
  ['N_OTRANTO', 'N_SI_KOPER', 'maritime', null, 1.0],
  ['N_OTRANTO', 'N_HR_RIJEKA', 'maritime', null, 1.0],
  ['N_SI_KOPER', 'N_HR_RIJEKA', 'maritime', null, 1.0],
  ['N_AL_DURRES', 'N_OTRANTO', 'maritime', null, 1.0],                // Batch 8: Albania & Montenegro
  ['N_AL_DURRES', 'N_ME_BAR', 'maritime', null, 1.0],
  ['N_ME_BAR', 'N_OTRANTO', 'maritime', null, 1.0],
  ['N_GR_THESS', 'N_GREECE', 'maritime', null, 1.0],                  // Thessaloniki: North Aegean
  ['N_GR_THESS', 'N_TR_IST', 'maritime', null, 1.0],
  ['N_CY_LIMASSOL', 'N_SUEZ_N', 'maritime', null, 1.0],
  ['N_CY_LIMASSOL', 'N_TR_MED', 'maritime', null, 1.0],
  ['N_CY_LIMASSOL', 'N_GREECE', 'maritime', null, 1.0],
  //       Black Sea (EU side). Both ports reach the Aegean only through the Bosphorus.
  ['N_RO_CONSTANTA', 'N_BLACK_SEA', 'maritime', 'black_sea_war', 1.0],
  ['N_BG_VARNA', 'N_BLACK_SEA', 'maritime', 'black_sea_war', 1.0],
  ['N_RO_CONSTANTA', 'N_BG_VARNA', 'maritime', null, 1.0],
  ['N_RO_CONSTANTA', 'N_TR_IST', 'maritime', 'turkish_straits', 1.0],
  ['N_BG_VARNA', 'N_TR_IST', 'maritime', 'turkish_straits', 1.0],
  //       Black Sea (Batch 6): Odesa runs the corridor along Romanian waters
  //       to Constanța; Poti and the CPC terminal cross the open (war-risk) sea.
  ['N_UA_ODESA', 'N_RO_CONSTANTA', 'maritime', 'odesa_corridor', 1.0],
  ['N_RU_CPC', 'N_BLACK_SEA', 'maritime', 'black_sea_war', 1.0],
  ['N_GE_POTI', 'N_BLACK_SEA', 'maritime', 'black_sea_war', 1.0],
  //       Norway
  ['N_NO_BERGEN', 'N_UK_NL', 'maritime', null, 1.0],
  ['N_NO_BERGEN', 'N_SKAGEN', 'maritime', null, 1.0],
  ['N_NO_BERGEN', 'N_GERMANY', 'maritime', null, 1.0],
  ['N_NO_BERGEN', 'N_UK', 'maritime', null, 1.0],
  ['N_IS_REYKJAVIK', 'N_UK_NL', 'maritime', null, 1.0],              // Iceland (Batch 8)
  ['N_IS_REYKJAVIK', 'N_NO_BERGEN', 'maritime', null, 1.0],
  ['N_IS_REYKJAVIK', 'N_CA_EAST', 'maritime', null, 1.0],
  ['N_IS_REYKJAVIK', 'N_US_EAST', 'maritime', null, 1.0],
  //       Morocco (Tanger Med faces Gibraltar; Jorf Lasfar is the phosphate port)
  ['N_MA_TANGER', 'N_MED_WEST', 'maritime', null, 1.0],
  ['N_MA_TANGER', 'N_PT_SINES', 'maritime', null, 1.0],
  ['N_MA_TANGER', 'N_DAKAR', 'maritime', null, 1.0],
  ['N_MA_TANGER', 'N_US_EAST', 'maritime', null, 1.0],
  ['N_MA_JORF', 'N_MA_TANGER', 'maritime', null, 1.0],
  ['N_MA_JORF', 'N_DAKAR', 'maritime', null, 1.0],
  //       Levant: Haifa on the Mediterranean; Eilat only through Bab el-Mandeb
  ['N_IL_HAIFA', 'N_SUEZ_N', 'maritime', null, 1.0],
  ['N_IL_HAIFA', 'N_TR_MED', 'maritime', null, 1.0],
  ['N_IL_HAIFA', 'N_GREECE', 'maritime', null, 1.0],
  ['N_IL_HAIFA', 'N_CY_LIMASSOL', 'maritime', null, 1.0],
  ['N_IL_EILAT', 'N_BAB', 'maritime', 'bab_el_mandeb', 1.0],
  //       Kattegat & the Baltic. Every exit runs Skagen <-> South Baltic (gated).
  ['N_SKAGEN', 'N_UK_NL', 'maritime', null, 1.0],
  ['N_SKAGEN', 'N_GERMANY', 'maritime', null, 1.0],
  ['N_SKAGEN', 'N_SE_GOTHENBURG', 'maritime', null, 1.0],
  ['N_SKAGEN', 'N_DK_AARHUS', 'maritime', null, 1.0],
  ['N_SKAGEN', 'N_BALTIC_SW', 'maritime', 'danish_straits', 1.0],
  ['N_BALTIC_SW', 'N_PL_GDANSK', 'maritime', null, 1.0],
  ['N_BALTIC_SW', 'N_LT_KLAIPEDA', 'maritime', null, 1.0],
  ['N_BALTIC_SW', 'N_BALTIC_C', 'maritime', null, 1.0],
  ['N_BALTIC_SW', 'N_SE_STOCKHOLM', 'maritime', null, 1.0],
  ['N_PL_GDANSK', 'N_BALTIC_C', 'maritime', null, 1.0],
  ['N_PL_GDANSK', 'N_LT_KLAIPEDA', 'maritime', null, 1.0],
  ['N_BALTIC_C', 'N_LT_KLAIPEDA', 'maritime', null, 1.0],
  ['N_BALTIC_C', 'N_LV_RIGA', 'maritime', null, 1.0],
  ['N_BALTIC_C', 'N_SE_STOCKHOLM', 'maritime', null, 1.0],
  ['N_BALTIC_C', 'N_EE_TALLINN', 'maritime', null, 1.0],
  ['N_BALTIC_C', 'N_FI_HELSINKI', 'maritime', null, 1.0],
  ['N_BALTIC_C', 'N_RU_BALTIC', 'maritime', null, 1.0],
  ['N_EE_TALLINN', 'N_FI_HELSINKI', 'maritime', null, 1.0],
  ['N_EE_TALLINN', 'N_RU_BALTIC', 'maritime', null, 1.0],
  ['N_FI_HELSINKI', 'N_RU_BALTIC', 'maritime', null, 1.0],

  // 3D. West Africa & South Atlantic
  ['N_FINISTERRE', 'N_DAKAR', 'maritime', null, 1.0],
  ['N_DAKAR', 'N_GUINEA_OFF', 'maritime', null, 1.0],
  ['N_GUINEA_OFF', 'N_NIGERIA', 'maritime', null, 1.0],
  ['N_NIGERIA', 'N_ANGOLA', 'maritime', null, 1.0],
  ['N_ANGOLA', 'N_CAPE', 'maritime', null, 1.0],
  ['N_CAPE', 'N_DAKAR', 'maritime', null, 1.0],
  ['N_ANGOLA', 'N_GUINEA_OFF', 'maritime', null, 1.0],
  ['N_GUINEA_OFF', 'N_US_EAST', 'maritime', null, 1.0],
  ['N_NIGERIA', 'N_DAKAR', 'maritime', null, 1.0],         // West African coastal lane
  ['N_GUINEA_OFF', 'N_WINDWARD', 'maritime', null, 1.0],   // West Africa <-> Caribbean
  ['N_DAKAR', 'N_WINDWARD', 'maritime', null, 1.0],        // Senegambia <-> Caribbean (mid-Atlantic)
  ['N_DAKAR', 'N_US_EAST', 'maritime', null, 1.0],         // Senegambia <-> US East Coast
  ['N_ANGOLA', 'N_BRAZIL', 'maritime', null, 1.0],         // South Atlantic crossing

  // 3D-2. West African coastal chain (Batch 2)
  ['N_MR_NOUAKCHOTT', 'N_DAKAR', 'maritime', null, 1.0],
  ['N_CV_PRAIA', 'N_DAKAR', 'maritime', null, 1.0],
  ['N_DAKAR', 'N_SN_DAKAR', 'maritime', null, 1.0],
  ['N_SN_DAKAR', 'N_GM_BANJUL', 'maritime', null, 1.0],
  ['N_GM_BANJUL', 'N_GW_BISSAU', 'maritime', null, 1.0],
  ['N_GW_BISSAU', 'N_GN_CONAKRY', 'maritime', null, 1.0],
  ['N_GN_CONAKRY', 'N_SL_FREETOWN', 'maritime', null, 1.0],
  ['N_SL_FREETOWN', 'N_LR_MONROVIA', 'maritime', null, 1.0],
  ['N_LR_MONROVIA', 'N_CI_ABIDJAN', 'maritime', null, 1.0],
  ['N_CI_ABIDJAN', 'N_GH_TAKORADI', 'maritime', null, 1.0],
  ['N_GH_TAKORADI', 'N_GH_TEMA', 'maritime', null, 1.0],
  ['N_GH_TEMA', 'N_TG_LOME', 'maritime', null, 1.0],
  ['N_TG_LOME', 'N_BJ_COTONOU', 'maritime', null, 1.0],
  ['N_BJ_COTONOU', 'N_NIGERIA', 'maritime', null, 1.0],
  ['N_GUINEA_OFF', 'N_CI_ABIDJAN', 'maritime', null, 1.0],   // Gulf of Guinea approaches
  ['N_GUINEA_OFF', 'N_GH_TEMA', 'maritime', null, 1.0],
  ['N_CAPE', 'N_GUINEA_OFF', 'maritime', null, 1.0],

  // 3E. Red Sea, Horn of Africa & the Cape diversion
  ['N_SUEZ_N', 'N_BAB', 'maritime', 'bab_el_mandeb', 1.0],   // Red Sea trunk (Jeddah is a spur)
  ['N_SUEZ_N', 'N_SAUDI', 'maritime', 'bab_el_mandeb', 1.0],
  ['N_SAUDI', 'N_BAB', 'maritime', 'bab_el_mandeb', 1.0],
  ['N_BAB', 'N_GULF_ADEN', 'maritime', 'bab_el_mandeb', 1.0],
  ['N_DJIBOUTI', 'N_GULF_ADEN', 'maritime', null, 1.0],
  ['N_DJIBOUTI', 'N_BAB', 'maritime', 'bab_el_mandeb', 1.0], // Djibouti <-> Red Sea through the strait
  ['N_GULF_ADEN', 'N_GUARDAFUI', 'maritime', null, 1.0],
  ['N_GUARDAFUI', 'N_MOZ_CHAN', 'maritime', null, 1.0],
  ['N_MOZ_CHAN', 'N_DURBAN', 'maritime', null, 1.0],
  ['N_DURBAN', 'N_AGULHAS', 'maritime', null, 1.0],
  ['N_MOZ_CHAN', 'N_AGULHAS', 'maritime', null, 1.0],
  ['N_AGULHAS', 'N_CAPE', 'maritime', null, 1.0],
  ['N_CAPE', 'N_SRI_LANKA', 'maritime', null, 1.0],
  ['N_CAPE', 'N_SUNDA', 'maritime', null, 1.0],
  ['N_CAPE', 'N_LOMBOK', 'maritime', null, 1.0],
  ['N_CAPE', 'N_AUS_WEST', 'maritime', null, 1.0],

  // 3F. Persian Gulf, Hormuz & Arabian Sea
  //     Hormuz gates only the edges INTO the Gulf. Bypasses: the UAE->Jeddah
  //     land bridge, Saudi East-West line (Dammam->Jeddah), Iranian rail.
  ['N_HORMUZ', 'N_UAE', 'maritime', 'hormuz', 1.0],
  ['N_HORMUZ', 'N_BANDAR', 'maritime', 'hormuz', 1.0],
  ['N_UAE', 'N_DAMMAM', 'maritime', null, 1.0],
  ['N_UAE', 'N_BANDAR', 'maritime', null, 1.0],
  ['N_UAE', 'N_SAUDI', 'road', null, 1.0],                   // GCC highway to the Red Sea (no rail link yet)
  ['N_DAMMAM', 'N_SAUDI', 'pipeline', null, 1.0, 1, 'SAU'], // East-West Petroline (Abqaiq -> Yanbu)
  ['N_RAS_HADD', 'N_HORMUZ', 'maritime', null, 1.0],
  ['N_HORMUZ', 'N_CHABAHAR', 'maritime', null, 1.0],
  ['N_HORMUZ', 'N_FUJAIRAH', 'maritime', null, 1.0],
  ['N_FUJAIRAH', 'N_RAS_HADD', 'maritime', null, 1.0],
  ['N_UAE', 'N_FUJAIRAH', 'pipeline', null, 1.0, 1, 'ARE'], // Habshan-Fujairah (ADCOP) crude pipeline
  ['N_RAS_HADD', 'N_SRI_LANKA', 'maritime', null, 1.0],    // Gulf <-> Asia trunk south of India
  ['N_GUARDAFUI', 'N_RAS_HADD', 'maritime', null, 1.0],
  ['N_RAS_HADD', 'N_CHABAHAR', 'maritime', null, 1.0],
  ['N_RAS_HADD', 'N_KARACHI', 'maritime', null, 1.0],
  ['N_RAS_HADD', 'N_INDIA_W', 'maritime', null, 1.0],
  ['N_CHABAHAR', 'N_KARACHI', 'maritime', null, 1.0],
  ['N_KARACHI', 'N_INDIA_W', 'maritime', null, 1.0],
  ['N_GULF_ADEN', 'N_INDIA_W', 'maritime', null, 1.0],
  ['N_SRI_LANKA', 'N_GULF_ADEN', 'maritime', null, 1.0], // main Asia-Europe lane

  // 3F-2. Gulf states, Oman & East Africa (Batch 6). Inside-Gulf lanes stay
  //       west of Hormuz; Sohar and Salalah are the Hormuz-free Omani ports.
  ['N_QA_RASLAFFAN', 'N_UAE', 'maritime', null, 1.0],
  ['N_QA_RASLAFFAN', 'N_DAMMAM', 'maritime', null, 1.0],
  ['N_QA_RASLAFFAN', 'N_BH_KHALIFA', 'maritime', null, 1.0],
  ['N_BH_KHALIFA', 'N_DAMMAM', 'maritime', null, 1.0],
  ['N_KW_KUWAIT', 'N_DAMMAM', 'maritime', null, 1.0],
  ['N_KW_KUWAIT', 'N_IQ_BASRA', 'maritime', null, 1.0],
  ['N_IQ_BASRA', 'N_DAMMAM', 'maritime', null, 1.0],
  ['N_OM_SOHAR', 'N_FUJAIRAH', 'maritime', null, 1.0],
  ['N_OM_SOHAR', 'N_HORMUZ', 'maritime', null, 1.0],
  ['N_OM_SOHAR', 'N_RAS_HADD', 'maritime', null, 1.0],
  ['N_OM_SALALAH', 'N_RAS_HADD', 'maritime', null, 1.0],
  ['N_OM_SALALAH', 'N_GULF_ADEN', 'maritime', null, 1.0],
  ['N_OM_SALALAH', 'N_GUARDAFUI', 'maritime', null, 1.0],
  ['N_OM_SALALAH', 'N_SRI_LANKA', 'maritime', null, 1.0],
  ['N_KE_MOMBASA', 'N_GUARDAFUI', 'maritime', null, 1.0],
  ['N_KE_MOMBASA', 'N_MOZ_CHAN', 'maritime', null, 1.0],
  ['N_KE_MOMBASA', 'N_SRI_LANKA', 'maritime', null, 1.0],

  // 3E-2. Rest of Africa (Batch 7)
  //       North Africa & Mauritania
  ['N_DZ_ALGIERS', 'N_MED_WEST', 'maritime', null, 1.0],
  ['N_DZ_ALGIERS', 'N_FR_MED', 'maritime', null, 1.0],
  ['N_DZ_ALGIERS', 'N_MT_MALTA', 'maritime', null, 1.0],
  ['N_TN_RADES', 'N_MT_MALTA', 'maritime', null, 1.0],
  ['N_TN_RADES', 'N_ITALY', 'maritime', null, 1.0],
  ['N_LY_MISRATA', 'N_MT_MALTA', 'maritime', null, 1.0],
  ['N_LY_MISRATA', 'N_SUEZ_N', 'maritime', null, 1.0],
  ['N_LY_SIDRA', 'N_LY_MISRATA', 'maritime', null, 1.0],
  ['N_LY_SIDRA', 'N_SUEZ_N', 'maritime', null, 1.0],
  ['N_LY_SIDRA', 'N_GREECE', 'maritime', null, 1.0],
  ['N_MR_NOUADHIBOU', 'N_DAKAR', 'maritime', null, 1.0],
  ['N_MR_NOUADHIBOU', 'N_MA_JORF', 'maritime', null, 1.0],
  ['N_MR_NOUADHIBOU', 'N_MR_NOUAKCHOTT', 'maritime', null, 1.0],
  //       Red Sea & Horn (Port Sudan sits inside the Bab el-Mandeb zone)
  ['N_SD_PORTSUDAN', 'N_SAUDI', 'maritime', 'bab_el_mandeb', 1.0],
  ['N_SD_PORTSUDAN', 'N_BAB', 'maritime', 'bab_el_mandeb', 1.0],
  ['N_SD_PORTSUDAN', 'N_SUEZ_N', 'maritime', 'bab_el_mandeb', 1.0],
  ['N_SO_BERBERA', 'N_GULF_ADEN', 'maritime', null, 1.0],
  ['N_SO_BERBERA', 'N_DJIBOUTI', 'maritime', null, 1.0],
  ['N_SO_MOGADISHU', 'N_GUARDAFUI', 'maritime', null, 1.0],
  ['N_SO_MOGADISHU', 'N_KE_MOMBASA', 'maritime', null, 1.0],
  //       East African & Indian Ocean coast
  ['N_TZ_DAR', 'N_KE_MOMBASA', 'maritime', null, 1.0],
  ['N_TZ_DAR', 'N_MOZ_CHAN', 'maritime', null, 1.0],
  ['N_TZ_DAR', 'N_GUARDAFUI', 'maritime', null, 1.0],
  ['N_TZ_DAR', 'N_SRI_LANKA', 'maritime', null, 1.0],
  ['N_MZ_NACALA', 'N_MOZ_CHAN', 'maritime', null, 1.0],
  ['N_MZ_NACALA', 'N_TZ_DAR', 'maritime', null, 1.0],
  ['N_MZ_BEIRA', 'N_MOZ_CHAN', 'maritime', null, 1.0],
  ['N_MZ_BEIRA', 'N_DURBAN', 'maritime', null, 1.0],
  ['N_MZ_MAPUTO', 'N_DURBAN', 'maritime', null, 1.0],
  ['N_MZ_MAPUTO', 'N_MZ_BEIRA', 'maritime', null, 1.0],
  ['N_MG_TOAMASINA', 'N_MU_PORTLOUIS', 'maritime', null, 1.0],
  ['N_MG_TOAMASINA', 'N_MOZ_CHAN', 'maritime', null, 1.0],
  ['N_MG_TOAMASINA', 'N_DURBAN', 'maritime', null, 1.0],
  ['N_MU_PORTLOUIS', 'N_SRI_LANKA', 'maritime', null, 1.0],
  ['N_MU_PORTLOUIS', 'N_DURBAN', 'maritime', null, 1.0],
  ['N_MU_PORTLOUIS', 'N_SUNDA', 'maritime', null, 1.0],
  ['N_SC_VICTORIA', 'N_SRI_LANKA', 'maritime', null, 1.0],
  ['N_SC_VICTORIA', 'N_KE_MOMBASA', 'maritime', null, 1.0],
  ['N_SC_VICTORIA', 'N_GUARDAFUI', 'maritime', null, 1.0],
  ['N_KM_MORONI', 'N_MOZ_CHAN', 'maritime', null, 1.0],
  ['N_KM_MORONI', 'N_TZ_DAR', 'maritime', null, 1.0],
  //       Atlantic: Namibia & Central Africa
  ['N_NA_WALVIS', 'N_CAPE', 'maritime', null, 1.0],
  ['N_NA_WALVIS', 'N_ANGOLA', 'maritime', null, 1.0],
  ['N_CM_DOUALA', 'N_NIGERIA', 'maritime', null, 1.0],
  ['N_CM_DOUALA', 'N_GUINEA_OFF', 'maritime', null, 1.0],
  ['N_CM_DOUALA', 'N_GQ_MALABO', 'maritime', null, 1.0],
  ['N_GQ_MALABO', 'N_NIGERIA', 'maritime', null, 1.0],
  ['N_GQ_MALABO', 'N_ST_SAOTOME', 'maritime', null, 1.0],
  ['N_ST_SAOTOME', 'N_GUINEA_OFF', 'maritime', null, 1.0],
  ['N_ST_SAOTOME', 'N_GA_OWENDO', 'maritime', null, 1.0],
  ['N_GA_OWENDO', 'N_GUINEA_OFF', 'maritime', null, 1.0],
  ['N_GA_OWENDO', 'N_CG_POINTENOIRE', 'maritime', null, 1.0],
  ['N_CG_POINTENOIRE', 'N_ANGOLA', 'maritime', null, 1.0],
  ['N_CG_POINTENOIRE', 'N_CD_MATADI', 'maritime', null, 1.0],
  ['N_CD_MATADI', 'N_ANGOLA', 'maritime', null, 1.0],

  // 3G. Bay of Bengal, Malacca & Indonesian straits
  ['N_INDIA_W', 'N_SRI_LANKA', 'maritime', null, 1.0],
  ['N_SRI_LANKA', 'N_INDIA_E', 'maritime', null, 1.0],
  ['N_INDIA_E', 'N_CHITTAGONG', 'maritime', null, 1.0],
  ['N_INDIA_E', 'N_MALACCA_NW', 'maritime', null, 1.0],
  ['N_CHITTAGONG', 'N_MALACCA_NW', 'maritime', null, 1.0],
  ['N_SRI_LANKA', 'N_MALACCA_NW', 'maritime', null, 1.0],
  ['N_MALACCA_NW', 'N_MALACCA', 'maritime', 'malacca', 1.0], // the strait itself
  ['N_SRI_LANKA', 'N_SUNDA', 'maritime', null, 1.0],
  ['N_SRI_LANKA', 'N_LOMBOK', 'maritime', null, 1.08],
  ['N_SUNDA', 'N_JAKARTA', 'maritime', null, 1.0],
  ['N_MALACCA', 'N_JAKARTA', 'maritime', null, 1.0],

  // 3H. South China Sea, East Asia & Western Pacific
  ['N_MALACCA', 'N_SCS_SOUTH', 'maritime', null, 1.0],
  ['N_MALACCA', 'N_SCS_NORTH', 'maritime', null, 1.0],      // Singapore <-> Hong Kong trunk
  ['N_MALACCA', 'N_VN_SOUTH', 'maritime', null, 1.0],
  ['N_JAKARTA', 'N_SCS_SOUTH', 'maritime', null, 1.0],
  ['N_LOMBOK', 'N_AUS_WEST', 'maritime', null, 1.0],
  ['N_LOMBOK', 'N_JAKARTA', 'maritime', null, 1.0],        // Java Sea
  ['N_LOMBOK', 'N_MANILA', 'maritime', null, 1.0],         // Makassar Strait
  ['N_MANILA', 'N_TAIWAN', 'maritime', null, 1.0],
  ['N_LOMBOK', 'N_SCS_SOUTH', 'maritime', null, 1.05],
  ['N_LOMBOK', 'N_PHIL_SEA', 'maritime', null, 1.05],
  ['N_SCS_SOUTH', 'N_SCS_NORTH', 'maritime', null, 1.0],
  ['N_SCS_SOUTH', 'N_VN_SOUTH', 'maritime', null, 1.0],
  ['N_SCS_SOUTH', 'N_MANILA', 'maritime', null, 1.0],
  ['N_SCS_NORTH', 'N_MANILA', 'maritime', null, 1.0],
  ['N_SCS_NORTH', 'N_VN_NORTH', 'maritime', null, 1.0],
  ['N_SCS_NORTH', 'N_TAIWAN', 'maritime', null, 1.0],
  ['N_SCS_NORTH', 'N_TAIWAN_ST', 'maritime', 'taiwan_strait', 1.0],
  ['N_TAIWAN_ST', 'N_CHINA_E', 'maritime', 'taiwan_strait', 1.0],
  ['N_TAIWAN_ST', 'N_TAIWAN', 'maritime', 'taiwan_strait', 1.0], // Kaohsiung from the strait's south exit
  ['N_SCS_NORTH', 'N_PHIL_SEA', 'maritime', null, 1.08],
  ['N_PHIL_SEA', 'N_TAIWAN', 'maritime', null, 1.0],
  ['N_PHIL_SEA', 'N_CHINA_E', 'maritime', null, 1.08],
  ['N_PHIL_SEA', 'N_JAPAN', 'maritime', null, 1.0],
  ['N_PHIL_SEA', 'N_MANILA', 'maritime', null, 1.0],
  ['N_CHINA_E', 'N_KOREA', 'maritime', null, 1.0],
  ['N_KOREA', 'N_JAPAN', 'maritime', null, 1.0],
  ['N_KOREA', 'N_VLADIVOSTOK', 'maritime', null, 1.0],

  // 3H-2. Southeast Asia & Oceania (Batch 3)
  ['N_MALACCA_NW', 'N_MY_KLANG', 'maritime', 'malacca', 1.0],    // Port Klang sits INSIDE the strait,
  ['N_MY_KLANG', 'N_MALACCA', 'maritime', 'malacca', 1.0],       // so both of its sea legs are gated
  ['N_MY_PTP', 'N_MALACCA', 'maritime', null, 1.0],
  ['N_MY_PTP', 'N_SCS_SOUTH', 'maritime', null, 1.0],
  ['N_TH_LAEM', 'N_MALACCA', 'maritime', null, 1.0],             // Gulf of Thailand, east of the peninsula
  ['N_TH_LAEM', 'N_VN_SOUTH', 'maritime', null, 1.0],
  ['N_KH_SIHANOUK', 'N_TH_LAEM', 'maritime', null, 1.0],
  ['N_KH_SIHANOUK', 'N_VN_SOUTH', 'maritime', null, 1.0],
  ['N_KH_SIHANOUK', 'N_MALACCA', 'maritime', null, 1.0],
  ['N_MM_YANGON', 'N_MALACCA_NW', 'maritime', null, 1.0],
  ['N_MM_YANGON', 'N_INDIA_E', 'maritime', null, 1.0],
  ['N_MM_YANGON', 'N_CHITTAGONG', 'maritime', null, 1.0],      // Bay of Bengal coastal
  ['N_BN_MUARA', 'N_SCS_SOUTH', 'maritime', null, 1.0],
  ['N_BN_MUARA', 'N_MANILA', 'maritime', null, 1.0],
  ['N_TL_DILI', 'N_LOMBOK', 'maritime', null, 1.0],
  ['N_TL_DILI', 'N_AUS_EAST', 'maritime', null, 1.0],            // via Torres Strait
  ['N_AUS_EAST', 'N_PHIL_SEA', 'maritime', null, 1.0],           // Coral Sea -> East Asia
  ['N_AUS_EAST', 'N_AUS_WEST', 'maritime', null, 1.0],
  ['N_AUS_EAST', 'N_NZ_TAURANGA', 'maritime', null, 1.0],
  ['N_AUS_EAST', 'N_US_WEST', 'maritime', null, 1.0],
  ['N_NZ_TAURANGA', 'N_US_WEST', 'maritime', null, 1.0],
  ['N_NZ_TAURANGA', 'N_PANAMA_PAC', 'maritime', null, 1.0],
  ['N_NZ_TAURANGA', 'N_JAPAN', 'maritime', null, 1.0],
  ['N_NZ_TAURANGA', 'N_PHIL_SEA', 'maritime', null, 1.0],
  ['N_PG_POM', 'N_AUS_EAST', 'maritime', null, 1.0],                  // Papua New Guinea & Hong Kong (Batch 8)
  ['N_PG_POM', 'N_PHIL_SEA', 'maritime', null, 1.0],
  ['N_PG_POM', 'N_TL_DILI', 'maritime', null, 1.0],
  ['N_HK_HKG', 'N_SCS_NORTH', 'maritime', null, 1.0],
  ['N_HK_HKG', 'N_PHIL_SEA', 'maritime', null, 1.0],

  // 3I. Trans-Pacific
  ['N_JAPAN', 'N_US_WEST', 'maritime', null, 1.0],
  ['N_JAPAN', 'N_CA_WEST', 'maritime', null, 1.0],
  ['N_PHIL_SEA', 'N_US_WEST', 'maritime', null, 1.0], // Kaohsiung reaches the Pacific via Luzon Strait, not the Taiwan Strait
  ['N_CHINA_E', 'N_US_WEST', 'maritime', null, 1.0],
  ['N_KOREA', 'N_US_WEST', 'maritime', null, 1.0],
  ['N_PANAMA_PAC', 'N_JAPAN', 'maritime', null, 1.0],
  ['N_PANAMA_PAC', 'N_CHINA_E', 'maritime', null, 1.0],

  // 3J. Overland Eurasian rail. Since v4.1 the freight model (rail ≈ 5x a
  //     ship per NM) keeps containers at sea by itself; multipliers here are
  //     only real frictions: gauge changes, border dwell, sanctions screening.
  ['N_CHINA_E', 'N_RAIL_KAZ', 'land', null, 1.15],   // gauge change at Khorgos / Dostyk
  ['N_RAIL_KAZ', 'N_RUSSIA_W', 'land', null, 1.0],
  ['N_RAIL_KAZ', 'N_RAIL_INSTC', 'land', null, 1.1],
  ['N_RAIL_INSTC', 'N_RUSSIA_W', 'land', null, 1.1],
  ['N_RAIL_INSTC', 'N_BANDAR', 'land', null, 1.0],   // Iranian rail to Bandar Abbas (inside Hormuz)
  ['N_RAIL_INSTC', 'N_CHABAHAR', 'land', null, 1.3], // to Chabahar (outside Hormuz), partly road
  ['N_RUSSIA_W', 'N_GERMANY', 'land', 'russia_rail', 1.5, 1, '!RUS,BLR'],
  //     China–Europe block trains enter the EU at Małaszewicze (~90% of
  //     Northern Corridor volume). Belarus/Russia transit carries sanctions
  //     screening and insurance friction: 1.3 multiplier, x1.28 more while
  //     the russia_rail gate is CONTESTED (its default).
  ['N_RAIL_KAZ', 'N_RAIL_MALA', 'land', 'russia_rail', 1.3, 1, '!RUS,BLR'],
  ['N_RAIL_MALA', 'N_GERMANY', 'land', null, 1.0, 1.1],             // Warsaw–Berlin–Hamburg
  ['N_RAIL_MALA', 'N_PL_GDANSK', 'land', null, 1.0, 1.1],
  ['N_RAIL_MALA', 'N_SK_BRATISLAVA', 'land', null, 1.0, 1.2],       // via Katowice–Žilina

  // 3J-6. Middle Corridor, pipelines & Batch 6 inland links.
  //       Trans-Caspian route: Khorgos -> Aktau -> ferry -> Baku -> Georgia
  //       (Poti, across the war-risk Black Sea) or the Baku–Tbilisi–Kars line
  //       into Türkiye, avoiding Russia entirely. The ferry is a sea leg.
  ['N_RAIL_KAZ', 'N_KZ_AKTAU', 'land', null, 1.0, 1.15],
  ['N_KZ_ATYRAU', 'N_KZ_AKTAU', 'land', null, 1.0, 1.3],
  ['N_KZ_AKTAU', 'N_AZ_BAKU', 'maritime', null, 1.5],              // Caspian rail ferries: capacity & weather limited
  ['N_AZ_BAKU', 'N_GE_POTI', 'land', null, 1.0, 1.15],             // Baku–Tbilisi–Poti
  ['N_AZ_BAKU', 'N_TR_IST', 'land', null, 1.2, 1.35],              // Baku–Tbilisi–Kars, gauge change at Akhalkalaki
  ['N_TR_IST', 'N_HU_BUDAPEST', 'land', null, 1.0, 1.25],          // Halkalı–Kapıkule–Sofia–Belgrade into the EU
  //       Crude pipelines (carry oil only; tagged PIPELINE in the route chain).
  //       7th value = owner: only corridors with that nation as an endpoint
  //       may use it (no borrowing the UAE's Hormuz bypass for Iraqi crude).
  ['N_KZ_ATYRAU', 'N_RU_CPC', 'pipeline', null, 1.0, 1.1, 'KAZ'],   // CPC: ~80% of Kazakh crude exports
  ['N_IQ_KIRKUK', 'N_TR_MED', 'pipeline', null, 1.0, 1.1, 'IRQ'],   // Kirkuk–Ceyhan (flowing again; 1-yr deal Jul 2026)
  ['N_IQ_KIRKUK', 'N_IQ_BASRA', 'pipeline', null, 1.0, 1.15, 'IRQ'], // Iraqi Strategic Pipeline (north–south)
  //       Ukraine: Danube bypass and rail into the EU
  ['N_UA_IZMAIL', 'N_RO_CONSTANTA', 'river', null, 1.0, 1.25],      // out through the Sulina Canal
  ['N_UA_ODESA', 'N_UA_IZMAIL', 'land', null, 1.0, 1.3],
  ['N_UA_ODESA', 'N_PL_GDANSK', 'land', null, 1.3, 1.25],          // via Lviv–Przemyśl gauge change; air-raid stoppages
  //       Batch 8: Balkans, Belarus, Caucasus, Central Asia, Hong Kong
  ['N_MK_SKOPJE', 'N_GR_THESS', 'land', null, 1.0, 1.15],          // Corridor X to Thessaloniki
  ['N_MK_SKOPJE', 'N_AL_DURRES', 'road', null, 1.0, 1.3],          // Corridor VIII (incomplete)
  ['N_MK_SKOPJE', 'N_HU_BUDAPEST', 'land', null, 1.0, 1.2],        // via Belgrade
  ['N_BY_MINSK', 'N_RAIL_MALA', 'land', 'russia_rail', 1.0, 1.1, '!RUS,BLR'], // Minsk–Brest into the EU
  ['N_BY_MINSK', 'N_RU_BALTIC', 'land', null, 1.0, 1.2],           // potash to Ust-Luga (Klaipėda closed since 2022)
  ['N_BY_MINSK', 'N_RAIL_KAZ', 'land', null, 1.0, 1.15],           // via Russia
  ['N_AM_YEREVAN', 'N_GE_POTI', 'land', null, 1.0, 1.3],           // via Georgia (Turkish & Azerbaijani borders shut)
  ['N_AM_YEREVAN', 'N_BANDAR', 'road', null, 1.0, 1.3],            // North–South road via Iran
  ['N_UZ_TASHKENT', 'N_RAIL_KAZ', 'land', null, 1.0, 1.2],
  ['N_UZ_TASHKENT', 'N_KZ_AKTAU', 'land', null, 1.0, 1.25],         // Middle Corridor feeder
  ['N_UZ_TASHKENT', 'N_RAIL_INSTC', 'land', null, 1.0, 1.2],        // via Turkmenistan to Iran
  ['N_KG_BISHKEK', 'N_RAIL_KAZ', 'land', null, 1.0, 1.2],
  ['N_TJ_DUSHANBE', 'N_UZ_TASHKENT', 'land', null, 1.0, 1.3],
  ['N_HK_HKG', 'N_CHINA_E', 'land', null, 1.0, 1.3],              // via Shenzhen into the mainland network
  //       Ethiopia
  ['N_ET_ADDIS', 'N_DJIBOUTI', 'land', null, 1.0, 1.15],            // Addis Ababa–Djibouti railway (2018)
  ['N_ET_ADDIS', 'N_SO_BERBERA', 'road', null, 1.0, 1.2],          // Berbera corridor (Ethiopia's Djibouti alternative)

  // 3J-7. African corridors (Batch 7). Trucks dominate most of them; the rail
  //       lines carry multipliers where reliability or capacity is poor.
  //       Southern Africa (via the Johannesburg hub)
  ['N_ZA_JOBURG', 'N_DURBAN', 'land', null, 1.2, 1.15],             // Natcor; Transnet rail underperforming
  ['N_ZA_JOBURG', 'N_MZ_MAPUTO', 'land', null, 1.0, 1.15],          // Maputo Development Corridor
  ['N_ZA_JOBURG', 'N_BW_GABORONE', 'land', null, 1.0, 1.15],
  ['N_BW_GABORONE', 'N_NA_WALVIS', 'road', null, 1.0, 1.15],        // Trans-Kalahari corridor
  ['N_LS_MASERU', 'N_ZA_JOBURG', 'road', null, 1.0, 1.2],
  ['N_LS_MASERU', 'N_DURBAN', 'road', null, 1.0, 1.25],
  ['N_SZ_MATSAPHA', 'N_MZ_MAPUTO', 'land', null, 1.0, 1.15],
  ['N_SZ_MATSAPHA', 'N_DURBAN', 'road', null, 1.0, 1.2],
  ['N_ZW_HARARE', 'N_MZ_BEIRA', 'road', null, 1.0, 1.2],            // Beira corridor
  ['N_ZW_HARARE', 'N_ZA_JOBURG', 'road', null, 1.0, 1.15],          // via Beitbridge
  //       Copperbelt: Zambia & Katanga
  ['N_ZM_LUSAKA', 'N_ZW_HARARE', 'road', null, 1.0, 1.2],           // via Chirundu
  ['N_ZM_LUSAKA', 'N_TZ_DAR', 'road', null, 1.0, 1.2],              // Dar corridor (trucks carry most copper)
  ['N_ZM_LUSAKA', 'N_TZ_DAR', 'land', null, 2.0, 1.2],              // TAZARA: decaying, China-backed revival underway
  ['N_ZM_LUSAKA', 'N_NA_WALVIS', 'road', null, 1.0, 1.25],          // Walvis Bay–Ndola–Lubumbashi corridor
  ['N_ZM_LUSAKA', 'N_CD_LUBUMBASHI', 'road', null, 1.2, 1.2],       // Kasumbalesa border queues
  ['N_CD_LUBUMBASHI', 'N_ANGOLA', 'land', null, 1.0, 1.2],          // Lobito Atlantic Railway (Benguela line)
  //       Malawi
  ['N_MW_LILONGWE', 'N_MZ_NACALA', 'land', null, 1.0, 1.25],        // Nacala Logistics Corridor rail
  ['N_MW_LILONGWE', 'N_MZ_BEIRA', 'road', null, 1.0, 1.25],
  ['N_MW_LILONGWE', 'N_TZ_DAR', 'road', null, 1.0, 1.25],
  ['N_MW_LILONGWE', 'N_ZM_LUSAKA', 'road', null, 1.0, 1.15],
  //       Great Lakes: Northern & Central corridors
  ['N_UG_KAMPALA', 'N_KE_MOMBASA', 'road', null, 1.0, 1.2],         // Northern Corridor
  ['N_UG_KAMPALA', 'N_KE_MOMBASA', 'land', null, 1.4, 1.2],         // SGR to Naivasha + metre gauge (transload)
  ['N_UG_KAMPALA', 'N_TZ_DAR', 'road', null, 1.0, 1.3],             // Central Corridor via Mwanza
  ['N_RW_KIGALI', 'N_UG_KAMPALA', 'road', null, 1.0, 1.2],
  ['N_RW_KIGALI', 'N_TZ_DAR', 'road', null, 1.0, 1.2],              // Central Corridor via Rusumo
  ['N_BI_BUJUMBURA', 'N_TZ_DAR', 'road', null, 1.0, 1.25],
  ['N_BI_BUJUMBURA', 'N_RW_KIGALI', 'road', null, 1.0, 1.2],
  ['N_SS_JUBA', 'N_UG_KAMPALA', 'road', null, 1.0, 1.2],            // via Nimule
  ['N_SS_JUBA', 'N_SD_PORTSUDAN', 'pipeline', 'sudan_war', 1.0, 1.3, 'SSD'], // GNPOC/Petrodar lines through war-torn Sudan
  //       Central Africa: Douala corridors
  ['N_CF_BANGUI', 'N_CM_DOUALA', 'road', null, 1.2, 1.3],           // Douala–Bangui: insecure, escorted convoys
  ['N_TD_NDJAMENA', 'N_CM_DOUALA', 'road', null, 1.0, 1.25],        // Douala–N'Djamena (rail to Ngaoundéré)
  ['N_TD_NDJAMENA', 'N_CM_DOUALA', 'pipeline', null, 1.0, 1.15, 'TCD'], // Chad–Cameroon pipeline (Doba -> Kribi)
  //       Mediterranean gas pipelines (national)
  ['N_DZ_ALGIERS', 'N_ES_VALENCIA', 'pipeline', null, 1.0, 1.1, 'DZA'], // Medgaz (Beni Saf -> Almería)
  ['N_DZ_ALGIERS', 'N_ITALY', 'pipeline', null, 1.0, 1.2, 'DZA'],       // TransMed via Tunisia & Sicily
  ['N_LY_MISRATA', 'N_ITALY', 'pipeline', null, 1.0, 1.1, 'LBY'],       // Greenstream (Mellitah -> Sicily)

  // 3J-2. West African transit corridors (Batch 2) — 'road' unless noted.
  //     Optional 6th value = distance factor (road km vs straight line).
  //     Corridor roles per 2025-26 reporting: Lomé carries most Burkina
  //     transit; Abidjan has the only rail (Sitarail); Tema ~30% of
  //     Burkina imports; Mali via Dakar, Abidjan, Conakry, Nouakchott.
  ['N_GH_TEMA', 'N_GH_TAMALE', 'road', null, 1.0],             // Tema–Kintampo–Tamale
  ['N_GH_TAMALE', 'N_BF_OUAGA', 'road', null, 1.0],            // via Paga border
  ['N_TG_LOME', 'N_BF_OUAGA', 'road', null, 1.0],              // Lomé–Ouagadougou corridor
  ['N_CI_ABIDJAN', 'N_BF_OUAGA', 'land', null, 4.0],           // Sitarail: ~1 Mt/yr, slow & derailment-prone, so Lomé trucks dominate
  ['N_BF_OUAGA', 'N_NE_NIAMEY', 'road', null, 1.0],            // trans-Sahelian highway
  ['N_BJ_COTONOU', 'N_NE_NIAMEY', 'road', 'benin_niger', 1.0], // direct via Malanville–Gaya
  ['N_BJ_COTONOU', 'N_NG_KAMBA', 'road', 'kamba', 1.0, 1.9],   // detour through Nigeria (+600-900 km)
  ['N_NG_KAMBA', 'N_NE_NIAMEY', 'road', null, 1.0],
  ['N_SN_DAKAR', 'N_ML_BAMAKO', 'road', 'jnim_bamako', 1.0],   // Dakar–Kayes–Bamako
  ['N_CI_ABIDJAN', 'N_ML_BAMAKO', 'road', 'jnim_bamako', 1.0], // Abidjan–Bougouni–Bamako
  ['N_GN_CONAKRY', 'N_ML_BAMAKO', 'road', null, 1.0],          // Conakry–Kankan–Bamako
  ['N_MR_NOUAKCHOTT', 'N_ML_BAMAKO', 'road', null, 1.15],      // long desert route

  // 3J-3. Mainland Southeast Asia (Batch 3)
  ['N_LA_VIENTIANE', 'N_TH_LAEM', 'road', null, 1.0],          // Thanaleng–Nong Khai–Laem Chabang (main Lao gateway)
  ['N_LA_VIENTIANE', 'N_VN_NORTH', 'road', null, 1.15],        // to Vietnamese ports via the Annamite passes
  ['N_LA_VIENTIANE', 'N_CN_KUNMING', 'land', null, 1.0],       // Laos–China Railway (opened Dec 2021)
  ['N_CN_KUNMING', 'N_CHINA_E', 'land', null, 1.0],            // Chinese rail network to the coast

  // 3J-4. South American landlocked corridors (Batch 4). 'river' = barge
  //       convoys on the Paraná–Paraguay Hidrovía. The freight model prices a
  //       truck-mile at ~7x a barge-mile, so trucks to Santos/Buenos Aires
  //       take over only when the river is cut (matching the ~80% river share).
  ['N_PY_ASUNCION', 'N_AR_ROSARIO', 'river', 'hidrovia', 1.0],      // ~1,200 km downstream to the Up-River terminals
  ['N_BO_AGUIRRE', 'N_PY_ASUNCION', 'river', 'hidrovia', 1.0, 1.2], // Bolivia's only river outlet
  ['N_BO_SANTACRUZ', 'N_BO_AGUIRRE', 'land', null, 1.0],            // Ferroviaria Oriental to the river
  ['N_BO_ELALTO', 'N_BO_SANTACRUZ', 'road', null, 1.0, 1.15],
  ['N_BO_ELALTO', 'N_CL_ARICA', 'road', null, 1.0, 1.2],            // main Bolivian outlet (1904 treaty free transit)
  ['N_BO_ELALTO', 'N_PE_ILO', 'road', null, 1.2, 1.22],             // via Desaguadero; thinner transit regime than Arica
  ['N_BO_ELALTO', 'N_CL_ANTOF', 'land', null, 1.8, 1.2],            // FCAB rail via Oruro–Ollagüe: single-track, mostly minerals
  ['N_PY_ASUNCION', 'N_AR_BSAS', 'road', null, 1.0],
  ['N_PY_ASUNCION', 'N_BRAZIL', 'road', null, 1.0],                 // via Ciudad del Este to Paranaguá/Santos

  // 3J-5. Central European rail & the Danube (Batch 5). Hamburg (N_GERMANY)
  //       and Koper are the two big seaports for the landlocked members;
  //       the Danube runs Vienna–Bratislava–Budapest–Constanța.
  ['N_CZ_PRAGUE', 'N_GERMANY', 'land', null, 1.0],                  // Elbe corridor to Hamburg
  ['N_AT_VIENNA', 'N_GERMANY', 'land', null, 1.0, 1.1],
  ['N_AT_VIENNA', 'N_SI_KOPER', 'land', null, 1.0, 1.15],           // Southern / Tauern lines over the Alps
  ['N_AT_VIENNA', 'N_CZ_PRAGUE', 'land', null, 1.0],
  ['N_SK_BRATISLAVA', 'N_AT_VIENNA', 'land', null, 1.0],
  ['N_SK_BRATISLAVA', 'N_CZ_PRAGUE', 'land', null, 1.0],
  ['N_HU_BUDAPEST', 'N_SI_KOPER', 'land', null, 1.0, 1.1],
  ['N_HU_BUDAPEST', 'N_HR_RIJEKA', 'land', null, 1.0, 1.1],
  ['N_HU_BUDAPEST', 'N_SK_BRATISLAVA', 'land', null, 1.0],
  ['N_LU_LUX', 'N_BE_ANTWERP', 'land', null, 1.0],
  ['N_LU_LUX', 'N_UK_NL', 'land', null, 1.0],
  ['N_UK_NL', 'N_GERMANY', 'land', null, 1.0, 1.2],                // Betuweroute / Rotterdam–Hamburg
  ['N_FR_NORTH', 'N_GERMANY', 'land', null, 1.0, 1.2],             // Paris–Cologne–Hamburg
  ['N_GERMANY', 'N_ITALY', 'land', null, 1.0, 1.25],               // Brenner & Gotthard base tunnels
  ['N_RO_CONSTANTA', 'N_HU_BUDAPEST', 'land', null, 1.0, 1.15],    // Constanța–Bucharest–Arad–Budapest
  //       Baltic rail: the only way round a Danish Straits closure. Poland
  //       links west to Hamburg; the Baltic states run on 1520 mm broad gauge
  //       to the Polish border until Rail Baltica opens (~2030). Finland has
  //       no practical rail outlet, so a closure isolates it.
  ['N_PL_GDANSK', 'N_GERMANY', 'land', null, 1.0, 1.1],
  ['N_PL_GDANSK', 'N_CZ_PRAGUE', 'land', null, 1.0, 1.15],         // Polish trunk south toward Central Europe
  ['N_LT_KLAIPEDA', 'N_PL_GDANSK', 'land', null, 1.0, 1.3],        // via Kaunas–Mockava gauge change
  ['N_LV_RIGA', 'N_LT_KLAIPEDA', 'land', null, 1.0, 1.2],
  ['N_EE_TALLINN', 'N_LV_RIGA', 'land', null, 1.0, 1.15],
  ['N_RO_CONSTANTA', 'N_HU_BUDAPEST', 'river', 'danube', 1.0, 1.47], // ~1,700 km via the Danube–Black Sea Canal
  ['N_HU_BUDAPEST', 'N_SK_BRATISLAVA', 'river', null, 1.0],
  ['N_SK_BRATISLAVA', 'N_AT_VIENNA', 'river', null, 1.0]
];

// ----------------------------------------------------------------------------
// 3K. HARBOUR / OFFSHORE SPLIT (derived; mirrored in tools/build_sea_lanes.py)
//     For each harbour with `offshore`:
//       - add node <ID>_WP at the offshore point (flagged waypoint: true)
//       - sea edges touching <ID> attach to <ID>_WP instead
//       - add approach edge <ID> <-> <ID>_WP
//     Land edges (rail/road) keep the harbour itself (inland freight leaves from the port).
// ----------------------------------------------------------------------------
// A missing comma between two entries turns `[...] [...]` into an index
// lookup that silently drops BOTH edges (it happened twice). Fail loudly.
const MODES = new Set(['maritime', 'land', 'road', 'river', 'pipeline']);
RAW_EDGES.forEach((e, i) => {
  if (!Array.isArray(e) || !GRAPH_NODES[e[0]] || !GRAPH_NODES[e[1]] || !MODES.has(e[2])) {
    throw new Error(`intel-store.js RAW_EDGES[${i}] is malformed (check the comma after the previous entry): ${JSON.stringify(e)}`);
  }
});

const HARBOURS = Object.keys(GRAPH_NODES).filter(id => GRAPH_NODES[id].offshore);
for (const id of HARBOURS) {
  const [lat, lng] = GRAPH_NODES[id].offshore;
  GRAPH_NODES[`${id}_WP`] = { lat, lng, name: `${GRAPH_NODES[id].name} (offshore)`, waypoint: true, harbour: id };
}
const wp = id => (GRAPH_NODES[id].offshore ? `${id}_WP` : id);

export const GRAPH_EDGES = RAW_EDGES
  .map(([u, v, mode, gate, mult, factor, owner]) =>
    (mode === 'maritime' ? [wp(u), wp(v), mode, gate, mult, factor] : [u, v, mode, gate, mult, factor, owner]))
  .concat(HARBOURS.map(id => [id, `${id}_WP`, 'maritime', null, 1.0]));

// ----------------------------------------------------------------------------
// 4. VESSEL CLASSES & AUTONOMOUS FLEET MANIFEST
//    burnMTd = approximate main-engine fuel burn (MT/day) at the listed speed.
//    Order-of-magnitude placeholders: replace with your own figures.
//    panama = fits the Neopanamax locks. VLCCs, ULCVs, Q-Max LNG carriers and
//    supercarriers do not, so the router excludes the Panama gate for them.
// ----------------------------------------------------------------------------
export const VESSEL_CLASSES = {
  14: { label: 'VLCC Tanker', burnMTd: 60, panama: false },
  18: { label: 'ULCV Container', burnMTd: 120, panama: false },
  22: { label: 'Fast Sealift', burnMTd: 200, panama: true }
};

export const VESSEL_MANIFEST = [
  { name: 'MV COSCO SHIPPING UNIVERSE (ULCV)', orig: 'N_CHINA_E', dest: 'N_UK_NL', type: 'commercial', kts: 18, panama: false, progress: 0.15 },
  { name: 'MT BAHRI YANBU (VLCC CRUDE)', orig: 'N_DAMMAM', dest: 'N_JAPAN', type: 'commercial', kts: 13, panama: false, progress: 0.42 },
  { name: 'LNG AL NUAMAN (Q-MAX LNG)', orig: 'N_UAE', dest: 'N_ITALY', type: 'commercial', kts: 19, panama: false, progress: 0.68 },
  { name: 'CSG-9 USS ABRAHAM LINCOLN', orig: 'N_PHIL_SEA', dest: 'N_MALACCA', type: 'naval', kts: 20, panama: false, progress: 0.31 },
  { name: 'CTF-153 RED SEA ESCORT GROUP', orig: 'N_GULF_ADEN', dest: 'N_SUEZ_N', type: 'naval', kts: 16, panama: true, progress: 0.52 }
];

// ----------------------------------------------------------------------------
// 5. CONFLICT FLASHPOINTS
//    severity: theater-level threat scale (replaces DEFCON, which is a single
//    US-wide readiness posture, not a per-theater rating):
//      5 = open interstate war    4 = sustained kinetic / interdiction
//      3 = gray-zone / insurgency 2 = elevated watch    1 = monitoring
// ----------------------------------------------------------------------------
export const SEVERITY_LABELS = { 5: 'OPEN WAR', 4: 'KINETIC', 3: 'GRAY-ZONE', 2: 'WATCH', 1: 'MONITOR' };

export const CONFLICTS = [
  {
    id: 'ukr_blk',
    name: 'Eastern Europe & Black Sea Theater',
    lat: 47.2, lng: 35.8, radiusKm: 420,
    severity: 4, intensity: 'HIGH KINETIC // ATTRITIONAL',
    summary: 'Two-way port war since Jul 2026: Russian strikes shut Greater Odesa, Ukrainian naval drones hit Novorossiysk and the CPC terminal; Lloyd\'s JWC high-risk zone covers almost the whole Black Sea.',
    impactedGate: 'black_sea_war'
  },
  {
    id: 'red_sea',
    name: 'Bab el-Mandeb & Southern Red Sea',
    lat: 14.2, lng: 42.8, radiusKm: 380,
    severity: 4, intensity: 'MARITIME INTERDICTION',
    summary: 'ASBM, USV, and loitering munition threats against commercial shipping transiting Suez corridor.',
    impactedGate: 'bab_el_mandeb'
  },
  {
    id: 'levant',
    name: 'Eastern Mediterranean & Levant',
    lat: 32.8, lng: 35.2, radiusKm: 280,
    severity: 4, intensity: 'MULTI-FRONT KINETIC',
    summary: 'Air-defense saturation, regional proxy escalation, and Eastern Med offshore gas platform risk.',
    impactedGate: 'bab_el_mandeb'
  },
  {
    id: 'taiwan_adiz',
    name: 'Taiwan Strait & First Island Chain',
    lat: 24.1, lng: 119.8, radiusKm: 320,
    severity: 3, intensity: 'GRAY-ZONE AMPHIBIOUS / ADIZ',
    summary: 'Joint naval blockade drills, subsea cable vulnerability, and daily median-line air patrols.',
    impactedGate: 'taiwan_strait'
  },
  {
    id: 'scs_reefs',
    name: 'South China Sea (Second Thomas / Sabina)',
    lat: 10.2, lng: 115.3, radiusKm: 360,
    severity: 3, intensity: 'MARITIME MILITIA STANDOFF',
    summary: 'Coast Guard ramming tactics and EEZ hydrographic confrontations near key sea lines of communication.',
    impactedGate: 'malacca'
  },
  {
    id: 'hormuz_gulf',
    name: 'Strait of Hormuz & Gulf of Oman',
    lat: 26.2, lng: 56.5, radiusKm: 260,
    severity: 3, intensity: 'TANKER SEIZURE / EW SPOOFING',
    summary: 'GPS/AIS electronic warfare jamming and fast-attack craft shadow operations on VLCC tankers.',
    impactedGate: 'hormuz'
  },
  {
    id: 'sahel_belt',
    name: 'Central Sahel & Tri-Border Insurgency',
    lat: 15.1, lng: -0.5, radiusKm: 480,
    severity: 3, intensity: 'ASYMMETRIC / RESOURCE COUP BELT',
    summary: 'Realignment of uranium, gold, and trans-Saharan pipeline security architecture.',
    impactedGate: null
  },
  {
    id: 'drc_east',
    name: 'Eastern DRC Critical Mineral Basin',
    lat: -1.6, lng: 29.1, radiusKm: 290,
    severity: 3, intensity: 'MINERAL SUPPLY CHAIN CONFLICT',
    summary: 'Artillery and militia clashes around coltan, tantalum, and cobalt extraction zones feeding Lobito.',
    impactedGate: null
  },
  {
    id: 'baltic_grey',
    name: 'Baltic Sea (Shadow Fleet & Subsea Cables)',
    lat: 57.6, lng: 19.5, radiusKm: 380,
    severity: 3, intensity: 'GRAY-ZONE / SUBSEA SABOTAGE',
    summary: 'Repeated anchor-drag cable damage (latest: Lithuania–Latvia near Liepāja, Jan 2026) under NATO Baltic Sentry patrols; Swedish and Danish checks on Russian shadow-fleet tankers.',
    impactedGate: 'danish_straits'
  },
  {
    id: 'sudan_war',
    name: 'Sudan Civil War (SAF vs RSF)',
    lat: 14.5, lng: 30.0, radiusKm: 650,
    severity: 5, intensity: 'OPEN WAR // FAMINE',
    summary: 'Since Apr 2023. RSF took El Fasher (Oct 2025); fighting now centres on Kordofan and Blue Nile, with drone strikes on cities. The South Sudan oil pipeline crosses the war zone.',
    impactedGate: 'sudan_war'
  },
  {
    id: 'cabo_delgado',
    name: 'Cabo Delgado Insurgency (Mozambique)',
    lat: -12.0, lng: 40.2, radiusKm: 230,
    severity: 3, intensity: 'ISLAMIST INSURGENCY',
    summary: 'IS-Mozambique attacks around the $20bn Mozambique LNG site, whose construction relaunched in Jan 2026 under Rwandan and Mozambican security.',
    impactedGate: null
  },
  {
    id: 'somalia',
    name: 'Somalia & Gulf of Aden (al-Shabaab, piracy)',
    lat: 4.5, lng: 47.0, radiusKm: 520,
    severity: 3, intensity: 'INSURGENCY // PIRACY RESURGENCE',
    summary: 'al-Shabaab insurgency inland; Somali piracy revived since late 2023 alongside the Houthi campaign, hitting shipping off the Horn.',
    impactedGate: 'bab_el_mandeb'
  },
  {
    id: 'cuba_crisis',
    name: 'Cuba Fuel & Grid Collapse',
    lat: 22.6, lng: -80.5, radiusKm: 260,
    severity: 2, intensity: 'US FUEL BLOCKADE // GRID FAILURE',
    summary: 'A Jan 2026 US executive order threatened tariffs on any country shipping fuel to Cuba; diesel and fuel oil ran out by May and island-wide blackouts followed in July.',
    impactedGate: null
  },
  {
    id: 'ecu_ports',
    name: 'Ecuador Pacific Ports (Guayaquil)',
    lat: -2.4, lng: -80.0, radiusKm: 200,
    severity: 3, intensity: 'NARCO-TRAFFICKING / PORT CONTAMINATION',
    summary: 'Gang-linked crews load cocaine into banana and container exports, including "Spiderman" boardings of ships in the Guayas channel; internal armed conflict declared Jan 2024.',
    impactedGate: null
  }
];

// ----------------------------------------------------------------------------
// 6. CORRIDOR PRESET PAIRS
// ----------------------------------------------------------------------------
export const PRESET_PAIRS = [
  { label: 'CHN ↔ NLD (EUV / Suez Test)', orig: 'CHN', dest: 'NLD' },
  { label: 'IND ↔ ARE (IMEC Corridor)', orig: 'IND', dest: 'ARE' },
  { label: 'USA ↔ TWN (Silicon Shield)', orig: 'USA', dest: 'TWN' },
  { label: 'CHN ↔ BRA (Soy / Iron South)', orig: 'CHN', dest: 'BRA' },
  { label: 'AGO ↔ USA (Lobito Cobalt)', orig: 'AGO', dest: 'USA' },
  { label: 'MEX ↔ USA (Nearshoring)', orig: 'MEX', dest: 'USA' },
  { label: 'IRN ↔ CHN (Hormuz Crude)', orig: 'IRN', dest: 'CHN' },
  { label: 'ZAF ↔ CHN (PGMs / Ore)', orig: 'ZAF', dest: 'CHN' },
  { label: 'KOR ↔ DEU (Chips / Machinery)', orig: 'KOR', dest: 'DEU' },
  { label: 'CHN → Tamale (Project Corridor)', orig: 'CHN', dest: 'TAMALE' },
  { label: 'CHN ↔ NER (Niger Access)', orig: 'CHN', dest: 'NER' },
  { label: 'FRA ↔ MLI (Bamako Supply)', orig: 'FRA', dest: 'MLI' },
  { label: 'NLD ↔ CIV (Cocoa)', orig: 'NLD', dest: 'CIV' },
  { label: 'CHN ↔ LAO (Rail Corridor)', orig: 'CHN', dest: 'LAO' },
  { label: 'NLD ↔ MYS (Malacca Test)', orig: 'NLD', dest: 'MYS' },
  { label: 'AUS ↔ CHN (Iron Ore)', orig: 'AUS', dest: 'CHN' },
  { label: 'CHL ↔ CHN (Copper / Lithium)', orig: 'CHL', dest: 'CHN' },
  { label: 'PER ↔ CHN (Chancay)', orig: 'PER', dest: 'CHN' },
  { label: 'PRY ↔ NLD (Hidrovía Soy)', orig: 'PRY', dest: 'NLD' },
  { label: 'BOL ↔ CHN (Landlocked Lithium)', orig: 'BOL', dest: 'CHN' },
  { label: 'ARG ↔ USA (Shale / Beef)', orig: 'ARG', dest: 'USA' },
  { label: 'RUS ↔ IND (Urals Crude)', orig: 'RUS', dest: 'IND' },
  { label: 'POL ↔ USA (LNG / Baltic)', orig: 'POL', dest: 'USA' },
  { label: 'HUN ↔ CHN (EV Batteries)', orig: 'HUN', dest: 'CHN' },
  { label: 'ROU ↔ EGY (Black Sea Grain)', orig: 'ROU', dest: 'EGY' },
  { label: 'IRL ↔ USA (Pharma)', orig: 'IRL', dest: 'USA' },
  { label: 'QAT ↔ JPN (LNG / Hormuz)', orig: 'QAT', dest: 'JPN' },
  { label: 'IRQ ↔ CHN (Basra Crude)', orig: 'IRQ', dest: 'CHN' },
  { label: 'UKR ↔ EGY (Grain Corridor)', orig: 'UKR', dest: 'EGY' },
  { label: 'KAZ ↔ DEU (Eurasian Rail)', orig: 'KAZ', dest: 'DEU' },
  { label: 'ISR ↔ IND (IMEC)', orig: 'ISR', dest: 'IND' },
  { label: 'COD ↔ CHN (Cobalt / Lobito)', orig: 'COD', dest: 'CHN' },
  { label: 'ZMB ↔ CHN (Copper Corridors)', orig: 'ZMB', dest: 'CHN' },
  { label: 'DZA ↔ ITA (Gas Pipelines)', orig: 'DZA', dest: 'ITA' },
  { label: 'UGA ↔ IND (Northern Corridor)', orig: 'UGA', dest: 'IND' },
  { label: 'SSD ↔ CHN (Sudan Pipeline)', orig: 'SSD', dest: 'CHN' },
  { label: 'BLR ↔ CHN (Potash via Russia)', orig: 'BLR', dest: 'CHN' },
  { label: 'UZB ↔ DEU (Central Asia)', orig: 'UZB', dest: 'DEU' },
  { label: 'VEN ↔ IND (Orinoco Crude)', orig: 'VEN', dest: 'IND' },
  { label: 'HKG ↔ USA (Re-exports)', orig: 'HKG', dest: 'USA' }
];
