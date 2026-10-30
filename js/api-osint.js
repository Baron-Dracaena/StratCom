// ============================================================================
// LAYER 4C: FASTAPI LOCAL OSINT, SOVEREIGN NODES & SQLITE STATE BRIDGE
// ============================================================================
export const MODULE_BUILD = '4.3.0';

export async function fetchLiveOsintEvents(force = false) {
  try {
    const res = await fetch(`/api/osint/live${force ? '?force=true' : ''}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (_) {
    return { cached: false, count: 0, events: [] };
  }
}

export async function fetchPersistedGates() {
  try {
    const res = await fetch('/api/wargame/gates');
    if (!res.ok) return {};
    const data = await res.json();
    return data.gates || {};
  } catch (_) {
    return {};
  }
}

export async function persistGateState(gateId, state) {
  try {
    await fetch('/api/wargame/gates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gate_id: gateId, state })
    });
  } catch (_) {}
}

export async function resetPersistedGates() {
  try {
    await fetch('/api/wargame/reset', { method: 'POST' });
  } catch (_) {}
}

// ----------------------------------------------------------------------------
// 3. SOVEREIGN SITES & CUSTOM RSS / DOMEPOLITICAL FEEDS (SQLite + localStorage fallback)
// ----------------------------------------------------------------------------
export async function fetchSovereignSites() {
  try {
    const res = await fetch('/api/sovereign/sites');
    if (!res.ok) throw new Error('offline');
    const data = await res.json();
    return data.sites || [];
  } catch (_) {
    try { return JSON.parse(localStorage.getItem('stratcom.sovereignSites') || '[]'); }
    catch (e) { return []; }
  }
}

export async function saveSovereignSite(site) {
  try {
    const local = JSON.parse(localStorage.getItem('stratcom.sovereignSites') || '[]');
    local.push(site);
    localStorage.setItem('stratcom.sovereignSites', JSON.stringify(local));
  } catch (_) {}

  try {
    const res = await fetch('/api/sovereign/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(site)
    });
    if (res.ok) return await res.json();
  } catch (_) {}
  return { ok: true, site };
}

export async function subscribeCustomRssFeed(feedSpec) {
  try {
    const res = await fetch('/api/osint/feeds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(feedSpec)
    });
    if (res.ok) return await res.json();
  } catch (_) {}
  return { ok: false };
}
