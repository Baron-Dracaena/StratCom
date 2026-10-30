// ============================================================================
// LAYER 4E: LIVE FEEDS (OSINT auto-refresh, GDELT events, live AIS, Sol nowcast)
// ============================================================================
// Polls StratCom's own backend (launch.py + live_feeds.py); the browser never calls
// GDELT, aisstream or Open-Meteo directly. Each feed has its own status, shown in the
// LIVE strip in the bottom bar, so a dead feed is visible instead of silently stale.
// Polling pauses while the tab is hidden and catches up when it becomes visible.
// ============================================================================
export const LIVE_BUILD = 'live-1';

const EVERY = { osint: 10 * 60e3, gdelt: 15 * 60e3, ais: 30e3, nowcast: 30 * 60e3 };
// CAMEO root categories kept by live_feeds.py (GDELT 2.0 event exports)
const GDELT_STYLE = { 'MASS VIOLENCE': '#dc2626', FIGHT: '#f97316', ASSAULT: '#fb923c', COERCION: '#a855f7', PROTEST: '#eab308' };

const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = u => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : '#'; } catch (_) { return '#'; } };

export function ago(tsSeconds) {
  if (!tsSeconds) return '—';
  const s = Math.max(0, Date.now() / 1000 - tsSeconds);
  if (s < 90) return `${Math.round(s)}s`;
  if (s < 5400) return `${Math.round(s / 60)}m`;
  if (s < 172800) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

async function getJSON(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// ----------------------------------------------------------------------------
// 1. RENDERERS
// ----------------------------------------------------------------------------
export function renderGdelt(layer, data) {
  layer.clearLayers();
  (data?.points || []).forEach(p => {
    const col = GDELT_STYLE[p.label] || '#f97316';
    const arts = (p.articles || []).map(a =>
      `<div style="margin-top:3px;"><a href="${esc(safeUrl(a.url))}" target="_blank" rel="noopener noreferrer" style="color:#38bdf8;font-size:10.5px;">${esc(a.title)}</a></div>`).join('');
    L.circleMarker([p.lat, p.lng], {
      radius: Math.min(9, 2.5 + Math.log2(1 + (p.count || 1))), color: col, weight: 1,
      fillColor: col, fillOpacity: 0.55
    }).bindPopup(`
      <div style="font-family:JetBrains Mono;font-size:9.5px;color:${col};">GDELT // ${esc(p.label)} // ${esc(p.count)} event${p.count === 1 ? '' : 's'}, ${esc(p.mentions ?? '—')} mentions, last ${esc(data.timespan || '24h')}</div>
      <div style="font-weight:600;font-size:11.5px;margin:3px 0;">${esc(p.name)}</div>${arts}
      <div style="font-size:9.5px;color:#94a3b8;margin-top:4px;">Machine-coded from news (CAMEO) and machine-geocoded. Read the source before acting on the location or the category.</div>
    `).addTo(layer);
  });
}

let aisCanvas = null;     // thousands of points: draw on canvas, not SVG
export function renderAis(layer, data) {
  aisCanvas = aisCanvas || L.canvas({ padding: 0.3 });
  layer.clearLayers();
  (data?.vessels || []).forEach(v => {
    const moving = (v.sog ?? 0) >= 1;
    L.circleMarker([v.lat, v.lng], {
      renderer: aisCanvas, radius: moving ? 2.6 : 2, weight: 0, fillColor: moving ? '#38bdf8' : '#64748b', fillOpacity: 0.85
    }).bindPopup(`
      <div style="font-family:JetBrains Mono;font-size:9.5px;color:#38bdf8;">LIVE AIS // MMSI ${esc(v.mmsi)}</div>
      <div style="font-weight:600;font-size:11.5px;margin:3px 0;">${esc(v.name || 'Unnamed vessel')}</div>
      <div style="font-size:10.5px;color:#cbd5e1;">${v.sog != null ? `${(+v.sog).toFixed(1)} kn` : '— kn'} · course ${v.cog != null ? `${Math.round(v.cog)}°` : '—'}${v.hdg != null ? ` · heading ${v.hdg}°` : ''}<br/>position ${esc(ago(Date.now() / 1000 - v.age_s))} old</div>
    `).addTo(layer);
  });
}

// ----------------------------------------------------------------------------
// 2. STATUS STRIP
// ----------------------------------------------------------------------------
function chip(label, text, tone, title) {
  const col = { ok: '#10b981', warn: '#f59e0b', bad: '#ef4444', off: '#64748b' }[tone];
  return `<span class="kin-coords" title="${esc(title)}" style="color:${col};margin-right:10px;white-space:nowrap;">● ${label} ${esc(text)}</span>`;
}

function renderStrip(el, st) {
  if (!el) return;
  const a = st.ais || {}, g = st.gdelt || {}, n = st.nowcast || {};
  const aisTone = a.status === 'live' ? 'ok' : a.status === 'no_key' ? 'off' : a.status === 'reconnecting' || a.status === 'starting' ? 'warn' : 'bad';
  const aisText = a.status === 'live' ? `${(a.tracked || 0).toLocaleString()} ships` : (a.status || '—').replace('_', ' ');
  const nText = n.status === 'old server' || n.status === 'error' ? n.status : n.status === 'none' ? 'none' : null;
  const nAge = n.age_s != null ? ago(Date.now() / 1000 - n.age_s) : '—';
  el.innerHTML =
    chip('NEWS', st.osintAt ? ago(st.osintAt) : 'no data',
         !st.osintAt ? 'bad' : Date.now() / 1000 - st.osintAt < 1800 ? 'ok' : 'warn',
         st.osintEmpty ? 'The RSS feeds returned nothing on the last poll (offline, or every feed failed)'
                       : 'RSS wire; auto-refreshes every 10 min (backend caches 10 min)') +
    chip('GDELT', g.status === 'ok' || g.status === 'refreshing' ? `${(g.events ?? g.count ?? 0).toLocaleString()} ev · ${ago(g.fetched_at)}` : (g.status || '—'),
         g.status === 'ok' ? 'ok' : g.status === 'refreshing' ? 'warn' : 'bad', g.error || 'GDELT 2.0 event exports: protest, coercion, assault, fight, mass violence; last 24 h, every 15 min') +
    chip('AIS', aisText, aisTone, a.error || (a.status === 'no_key'
      ? 'No aisstream key: set AISSTREAM_API_KEY or put the key in stratcom/aisstream.key, then restart launch.py'
      : 'aisstream.io live positions (terrestrial AIS)')) +
    chip('SOIL', nText || nAge, n.status === 'ok' && n.age_s < 8 * 3600 ? 'ok' : n.status === 'refreshing' ? 'warn' : 'bad',
         n.error || 'Sol soiling nowcast (Open-Meteo weather through Sol\'s soiling model); refreshed when > 6 h old');
}

// ----------------------------------------------------------------------------
// 3. POLLING LOOP
// ----------------------------------------------------------------------------
/**
 * ctx: { map, layers: {gdelt, ais}, syncOsint: async (force) => void,
 *        onNowcast: (data) => void, stripEl }
 */
export function initLiveFeeds(ctx) {
  const st = { osintAt: null, gdelt: null, ais: null, nowcast: null };
  const last = {};
  const due = k => !last[k] || Date.now() - last[k] >= EVERY[k];

  const jobs = {
    osint: async () => {                     // an empty wire is "no data", never a fresh green stamp
      const t = await ctx.syncOsint(false);
      st.osintAt = t || st.osintAt;
      st.osintEmpty = !t;
    },
    gdelt: async () => {
      const d = await getJSON('/api/gdelt/live');
      st.gdelt = d;
      renderGdelt(ctx.layers.gdelt, d);
      if (d.status === 'refreshing') last.gdelt = Date.now() - EVERY.gdelt + 20e3;   // re-check in 20 s
    },
    ais: async () => {
      if (!ctx.map.hasLayer(ctx.layers.ais)) {                      // layer hidden: status only
        st.ais = await getJSON('/api/ais/live?limit=1');
        ctx.layers.ais.clearLayers();
        return;
      }
      const b = ctx.map.getBounds();
      const q = `s=${b.getSouth().toFixed(2)}&w=${b.getWest().toFixed(2)}&n=${b.getNorth().toFixed(2)}&e=${b.getEast().toFixed(2)}&limit=3000`;
      const d = await getJSON(`/api/ais/live?${Math.abs(b.getEast() - b.getWest()) >= 360 ? 'limit=3000' : q}`);
      st.ais = d;
      renderAis(ctx.layers.ais, d);
    },
    nowcast: async () => {
      const d = await getJSON('/api/sol/nowcast');
      st.nowcast = d;
      ctx.onNowcast(d);
      if (d.status === 'refreshing') last.nowcast = Date.now() - EVERY.nowcast + 30e3;
    },
  };

  async function tick(force = false) {
    if (document.hidden && !force) return;
    for (const [k, fn] of Object.entries(jobs)) {
      if (!force && !due(k)) continue;
      last[k] = Date.now();
      try { await fn(); } catch (e) {
        const msg = String(e);
        st[k] = { ...(st[k] || {}), status: /HTTP 404/.test(msg) ? 'old server' : 'error',
                  error: /HTTP 404/.test(msg)
                    ? 'This StratCom server predates the live feeds (route missing). Close every running launch.py window and start it again.'
                    : msg };
      }
    }
    renderStrip(ctx.stripEl, st);
  }

  setInterval(() => tick(), 5e3);
  setInterval(() => renderStrip(ctx.stripEl, st), 15e3);     // keep the "x min ago" ages honest
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  ctx.map.on('moveend', () => { if (ctx.map.hasLayer(ctx.layers.ais)) { last.ais = 0; } });
  tick(true);
  return { refresh: () => tick(true), state: st };
}
