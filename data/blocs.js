// ============================================================================
// LAYER 2C: BLOC REGISTRY — single source of truth for memberships (v3.5)
//    Each bloc lists ALL its members (ISO3), modelled or not. Nations pick
//    up their memberships from here at load (nation.blocs), and the UI
//    computes combined GDP from whichever members are currently modelled,
//    so adding a nation in a later batch needs no bloc edits.
//    Membership as of Oct 2026; check `note` fields for in-flux cases.
// ============================================================================

import { NATIONS } from './nations.js';

// ----------------------------------------------------------------------------
// 1. BLOC GROUPS (panel sections)
// ----------------------------------------------------------------------------
export const BLOC_GROUPS = [
  { id: 'security', label: 'SECURITY ALLIANCES' },
  { id: 'trade', label: 'TRADE & ECONOMIC BLOCS' },
  { id: 'political', label: 'POLITICAL & REGIONAL FORUMS' },
  { id: 'analyst', label: 'ANALYST GROUPINGS (NOT INSTITUTIONS)' }
];

// ----------------------------------------------------------------------------
// 2. AFRICAN STATES (for AfCFTA: every AU state except Eritrea has signed)
// ----------------------------------------------------------------------------
const AFRICA = ['DZA', 'AGO', 'BEN', 'BWA', 'BFA', 'BDI', 'CPV', 'CMR', 'CAF', 'TCD', 'COM', 'COD', 'COG',
  'CIV', 'DJI', 'EGY', 'GNQ', 'SWZ', 'ETH', 'GAB', 'GMB', 'GHA', 'GIN', 'GNB', 'KEN', 'LSO', 'LBR', 'LBY',
  'MDG', 'MWI', 'MLI', 'MRT', 'MUS', 'MAR', 'MOZ', 'NAM', 'NER', 'NGA', 'RWA', 'STP', 'SEN', 'SYC', 'SLE',
  'SOM', 'ZAF', 'SSD', 'SDN', 'TZA', 'TGO', 'TUN', 'UGA', 'ZMB', 'ZWE'];

const EU27 = ['AUT', 'BEL', 'BGR', 'HRV', 'CYP', 'CZE', 'DNK', 'EST', 'FIN', 'FRA', 'DEU', 'GRC', 'HUN', 'IRL',
  'ITA', 'LVA', 'LTU', 'LUX', 'MLT', 'NLD', 'POL', 'PRT', 'ROU', 'SVK', 'SVN', 'ESP', 'SWE'];

const ASEAN = ['BRN', 'KHM', 'IDN', 'LAO', 'MYS', 'MMR', 'PHL', 'SGP', 'THA', 'VNM', 'TLS'];

// ----------------------------------------------------------------------------
// 3. BLOCS
// ----------------------------------------------------------------------------
export const BLOCS = [
  // 3A. Security alliances
  { id: 'NATO', name: 'NATO Alliance', type: 'Mutual Defense Treaty', group: 'security', color: '#38bdf8',
    members: ['ALB', 'BEL', 'BGR', 'CAN', 'HRV', 'CZE', 'DNK', 'EST', 'FIN', 'FRA', 'DEU', 'GRC', 'HUN', 'ISL',
      'ITA', 'LVA', 'LTU', 'LUX', 'MNE', 'NLD', 'MKD', 'NOR', 'POL', 'PRT', 'ROU', 'SVK', 'SVN', 'ESP', 'SWE',
      'TUR', 'GBR', 'USA'] },
  { id: 'QUAD', name: 'The QUAD', type: 'Indo-Pacific Security Dialogue', group: 'security', color: '#10b981',
    members: ['USA', 'IND', 'JPN', 'AUS'] },
  { id: 'AUKUS', name: 'AUKUS', type: 'Trilateral Security Pact', group: 'security', color: '#0ea5e9',
    members: ['AUS', 'GBR', 'USA'] },
  { id: 'CSTO', name: 'CSTO', type: 'Russia-led Collective Security Treaty', group: 'security', color: '#b91c1c',
    members: ['RUS', 'BLR', 'KAZ', 'KGZ', 'TJK', 'ARM'], note: 'Armenia froze its participation in 2024.' },
  { id: 'SCO', name: 'Shanghai Coop (SCO)', type: 'Eurasian Security & Trade Pact', group: 'security', color: '#f97316',
    members: ['CHN', 'RUS', 'IND', 'PAK', 'KAZ', 'KGZ', 'TJK', 'UZB', 'IRN', 'BLR'] },

  // 3B. Trade & economic blocs
  { id: 'EU', name: 'European Union', type: 'Single Market & Customs Union', group: 'trade', color: '#60a5fa',
    members: EU27 },
  { id: 'EURO', name: 'Eurozone', type: 'Single Currency Area (euro)', group: 'trade', color: '#3b82f6',
    members: ['AUT', 'BEL', 'BGR', 'HRV', 'CYP', 'EST', 'FIN', 'FRA', 'DEU', 'GRC', 'IRL', 'ITA', 'LVA', 'LTU',
      'LUX', 'MLT', 'NLD', 'PRT', 'SVK', 'SVN', 'ESP'], note: 'Bulgaria adopted the euro on 1 Jan 2026 (21st member).' },
  { id: 'USMCA', name: 'USMCA', type: 'North American Free Trade Agreement', group: 'trade', color: '#93c5fd',
    members: ['USA', 'CAN', 'MEX'] },
  { id: 'RCEP', name: 'RCEP Trade Bloc', type: 'Asia-Pacific Free Trade Agreement', group: 'trade', color: '#a855f7',
    members: ASEAN.filter(c => c !== 'TLS').concat(['CHN', 'JPN', 'KOR', 'AUS', 'NZL']) },
  { id: 'CPTPP', name: 'CPTPP', type: 'Trans-Pacific Free Trade Agreement', group: 'trade', color: '#c084fc',
    members: ['AUS', 'BRN', 'CAN', 'CHL', 'JPN', 'MYS', 'MEX', 'NZL', 'PER', 'SGP', 'VNM', 'GBR'],
    note: 'UK in force Dec 2024. Costa Rica accession substantially concluded May 2026, not yet in force.' },
  { id: 'Mercosur', name: 'Mercosur', type: 'South American Customs Union', group: 'trade', color: '#facc15',
    members: ['ARG', 'BRA', 'PRY', 'URY', 'BOL'],
    note: 'Bolivia full member since 2024 (in transition). Venezuela suspended.' },
  { id: 'CAN-AND', name: 'Andean Community', type: 'Andean Customs Union', group: 'trade', color: '#fde047',
    members: ['BOL', 'COL', 'ECU', 'PER'] },
  { id: 'PacAll', name: 'Pacific Alliance', type: 'Latin American Trade Integration', group: 'trade', color: '#fbbf24',
    members: ['CHL', 'COL', 'MEX', 'PER'] },
  { id: 'ECOWAS', name: 'ECOWAS', type: 'West African Economic Community', group: 'trade', color: '#4ade80',
    members: ['BEN', 'CPV', 'CIV', 'GMB', 'GHA', 'GIN', 'GNB', 'LBR', 'NGA', 'SEN', 'SLE', 'TGO'],
    note: 'Mali, Burkina Faso and Niger left on 29 Jan 2025 (now AES).' },
  { id: 'SADC', name: 'SADC', type: 'Southern African Development Community', group: 'trade', color: '#22c55e',
    members: ['AGO', 'BWA', 'COM', 'COD', 'SWZ', 'LSO', 'MDG', 'MWI', 'MUS', 'MOZ', 'NAM', 'SYC', 'ZAF', 'TZA', 'ZMB', 'ZWE'] },
  { id: 'EAC', name: 'East African Community', type: 'East African Customs Union', group: 'trade', color: '#16a34a',
    members: ['BDI', 'COD', 'KEN', 'RWA', 'SOM', 'SSD', 'TZA', 'UGA'] },
  { id: 'CEMAC', name: 'CEMAC', type: 'Central African Monetary Union (CFA franc)', group: 'trade', color: '#15803d',
    members: ['CMR', 'CAF', 'TCD', 'COG', 'GNQ', 'GAB'] },
  { id: 'AfCFTA', name: 'AfCFTA', type: 'Continental Free Trade Area (signatories)', group: 'trade', color: '#84cc16',
    members: AFRICA, note: 'Signatories: every AU member except Eritrea; ratification still incomplete for some.' },
  { id: 'EAEU', name: 'Eurasian Economic Union', type: 'Customs Union (Russia-led)', group: 'trade', color: '#ef4444',
    members: ['RUS', 'BLR', 'KAZ', 'KGZ', 'ARM'], note: 'Members are exempt from the router\'s Russian-port sanctions rule.' },
  { id: 'GCC', name: 'Gulf Cooperation Council', type: 'Gulf Political & Economic Union', group: 'trade', color: '#2dd4bf',
    members: ['SAU', 'ARE', 'QAT', 'KWT', 'OMN', 'BHR'] },
  { id: 'OPEC', name: 'OPEC', type: 'Oil Producers Cartel', group: 'trade', color: '#fb923c',
    members: ['DZA', 'COG', 'GNQ', 'GAB', 'IRN', 'IRQ', 'KWT', 'LBY', 'NGA', 'SAU', 'ARE', 'VEN'],
    note: 'Angola left in Jan 2024.' },
  { id: 'IMEC', name: 'IMEC Corridor', type: 'India-Middle East-Europe Corridor MoU', group: 'trade', color: '#14b8a6',
    members: ['IND', 'USA', 'SAU', 'ARE', 'FRA', 'DEU', 'ITA'], note: 'The EU is also a signatory.' },

  // 3C. Political & regional forums
  { id: 'G7', name: 'G7', type: 'Advanced Economies Forum', group: 'political', color: '#e2e8f0',
    members: ['USA', 'CAN', 'GBR', 'FRA', 'DEU', 'ITA', 'JPN'] },
  { id: 'G20', name: 'G20', type: 'Major Economies Forum', group: 'political', color: '#cbd5e1',
    members: ['ARG', 'AUS', 'BRA', 'CAN', 'CHN', 'FRA', 'DEU', 'IND', 'IDN', 'ITA', 'JPN', 'KOR', 'MEX', 'RUS',
      'SAU', 'ZAF', 'TUR', 'GBR', 'USA'], note: 'Plus the EU and African Union as members.' },
  { id: 'BRICS+', name: 'BRICS+', type: 'Multipolar Economic Bloc (full members)', group: 'political', color: '#f59e0b',
    members: ['BRA', 'RUS', 'IND', 'CHN', 'ZAF', 'EGY', 'ETH', 'IRN', 'SAU', 'ARE', 'IDN'],
    note: "Saudi Arabia is listed by BRICS but has not publicly confirmed full membership." },
  { id: 'BRICS-P', name: 'BRICS Partners', type: 'BRICS Partner Countries', group: 'political', color: '#d97706',
    members: ['BLR', 'BOL', 'CUB', 'KAZ', 'MYS', 'NGA', 'THA', 'UGA', 'UZB', 'VNM'] },
  { id: 'ASEAN', name: 'ASEAN', type: 'Southeast Asian Regional Association', group: 'political', color: '#818cf8',
    members: ASEAN, note: 'Timor-Leste joined as 11th member in Oct 2025.' },
  { id: 'APEC', name: 'APEC', type: 'Asia-Pacific Economic Cooperation', group: 'political', color: '#22d3ee',
    members: ['AUS', 'BRN', 'CAN', 'CHL', 'CHN', 'HKG', 'IDN', 'JPN', 'KOR', 'MYS', 'MEX', 'NZL', 'PNG', 'PER',
      'PHL', 'RUS', 'SGP', 'TWN', 'THA', 'USA', 'VNM'], note: 'Members are "economies": Taiwan sits as Chinese Taipei.' },
  { id: 'V4', name: 'Visegrád Group', type: 'Central European Cooperation', group: 'political', color: '#e11d48',
    members: ['CZE', 'HUN', 'POL', 'SVK'], note: 'Split over Russia policy since 2022; Hungary and Slovakia diverge from Poland and Czechia.' },
  { id: 'AES', name: 'Alliance of Sahel States', type: 'Sahel Confederation', group: 'political', color: '#dc2626',
    members: ['MLI', 'BFA', 'NER'] },

  // 3D. Analyst groupings (investment-bank acronyms, not institutions)
  { id: 'E7', name: 'E7', type: 'PwC "Emerging Seven"', group: 'analyst', color: '#94a3b8',
    members: ['BRA', 'CHN', 'IND', 'IDN', 'MEX', 'RUS', 'TUR'] },
  { id: 'N-11', name: 'Next Eleven', type: 'Goldman Sachs grouping', group: 'analyst', color: '#94a3b8',
    members: ['BGD', 'EGY', 'IDN', 'IRN', 'MEX', 'NGA', 'PAK', 'PHL', 'TUR', 'KOR', 'VNM'] },
  { id: 'MIST', name: 'MIST', type: 'Goldman Sachs grouping', group: 'analyst', color: '#94a3b8',
    members: ['MEX', 'IDN', 'KOR', 'TUR'] },
  { id: 'CIVETS', name: 'CIVETS', type: 'EIU / HSBC grouping', group: 'analyst', color: '#94a3b8',
    members: ['COL', 'IDN', 'VNM', 'EGY', 'TUR', 'ZAF'] },
  { id: 'EAGLEs', name: 'EAGLEs', type: 'BBVA grouping', group: 'analyst', color: '#94a3b8',
    members: ['BRA', 'RUS', 'IND', 'CHN', 'MEX', 'IDN', 'KOR', 'TUR', 'EGY', 'TWN'],
    note: 'Membership varies by BBVA edition.' }
];

// ----------------------------------------------------------------------------
// 4. ATTACH MEMBERSHIPS TO NATIONS
// ----------------------------------------------------------------------------
for (const n of Object.values(NATIONS)) n.blocs = [];
for (const b of BLOCS) {
  for (const iso of b.members) if (NATIONS[iso]) NATIONS[iso].blocs.push(b.id);
}
