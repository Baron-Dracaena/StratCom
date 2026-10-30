// ============================================================================
// LAYER 4D: THREE.JS 3D GEODESIC GLOBE (SEA-LANE MESH + 3D HOVER TOOLTIPS)
// ============================================================================
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const R = 100;
// Point markers keep a constant on-screen size: world size scales with the camera's height
// above the surface, relative to the default view (camDist 285). MARKER_BASE shrinks them
// overall; the clamp stops them vanishing at full zoom or ballooning when zoomed out.
const DEFAULT_ALT = 285 - R;
const MARKER_BASE = 0.6;
const MARKER_CLAMP = [0.05, 1.4];

function latLngToVec3(lat, lng, radius = R) {
  const phi = (90 - lat) * DEG2RAD;
  const theta = (lng + 180) * DEG2RAD;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

export class StratcomGlobe3D {
  constructor(containerId, onCursorMove, onSelectEndpoint, onCycleGate) {
    this.container = document.getElementById(containerId);
    this.onCursorMove = onCursorMove;
    this.onSelectEndpoint = onSelectEndpoint;
    this.onCycleGate = onCycleGate;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 1, 2000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    // Floating 3D Hover Tooltip DOM element
    this.tooltip = document.createElement('div');
    this.tooltip.style.cssText = 'position:fixed;pointer-events:none;z-index:850;background:rgba(7,11,18,0.94);border:1px solid rgba(56,189,248,0.55);color:#f1f5f9;font-family:"JetBrains Mono",monospace;font-size:10.5px;padding:5px 8px;border-radius:6px;box-shadow:0 8px 20px rgba(0,0,0,0.8);display:none;white-space:nowrap;';
    document.body.appendChild(this.tooltip);

    this.camLat = 20;
    this.camLng = -30;
    this.camDist = 285;
    this.isDragging = false;
    this.prevMouse = { x: 0, y: 0 };

    this.globeGroup = new THREE.Group();
    this.scene.add(this.globeGroup);
    this.graticuleGroup = new THREE.Group();
    this.lanesGroup = new THREE.Group();
    this.conflictsGroup = new THREE.Group();
    this.chokepointsGroup = new THREE.Group();
    this.dynamicGroup = new THREE.Group();
    this.solGroup = new THREE.Group();
    this.globeGroup.add(this.graticuleGroup, this.lanesGroup, this.conflictsGroup, this.chokepointsGroup,
                        this.dynamicGroup, this.solGroup);

    this.markers = [];
    this.markerScale = null;
    this.pulses = [];
    this.pickables = [];
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.initLightsAndSphere();
    this.buildProceduralGraticule();
    this.initInteraction();
    this.animate();
  }

  initLightsAndSphere() {
    this.scene.add(new THREE.AmbientLight(0xdbeafe, 1.35));
    const dir = new THREE.DirectionalLight(0x38bdf8, 1.2);
    dir.position.set(200, 150, 200);
    this.scene.add(dir);

    const loader = new THREE.TextureLoader();
    const earthTex = loader.load('https://unpkg.com/three-globe@2.31.0/example/img/earth-blue-marble.jpg');
    const bumpTex = loader.load('https://unpkg.com/three-globe@2.31.0/example/img/earth-topology.png');

    this.earthMesh = new THREE.Mesh(
      new THREE.SphereGeometry(R, 64, 64),
      new THREE.MeshStandardMaterial({ map: earthTex, bumpMap: bumpTex, bumpScale: 1.2, roughness: 0.75, metalness: 0.15 })
    );
    this.globeGroup.add(this.earthMesh);

    this.globeGroup.add(new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.022, 48, 48),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.08, side: THREE.BackSide })
    ));
  }

  buildProceduralGraticule() {
    this.graticuleGroup.clear();
    const r = R * 1.002;
    const matMinor = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.18 });
    const matMajor = new THREE.LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.55 });
    const matTropic = new THREE.LineBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.32 });

    for (let lat = -75; lat <= 75; lat += 15) {
      const pts = [];
      for (let lng = -180; lng <= 180; lng += 3) pts.push(latLngToVec3(lat, lng, r));
      this.graticuleGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lat === 0 ? matMajor : matMinor));
    }
    [23.44, -23.44, 66.56, -66.56].forEach(lat => {
      const pts = [];
      for (let lng = -180; lng <= 180; lng += 3) pts.push(latLngToVec3(lat, lng, r));
      this.graticuleGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), matTropic));
    });
    for (let lng = -180; lng < 180; lng += 15) {
      const pts = [];
      for (let lat = -85; lat <= 85; lat += 3) pts.push(latLngToVec3(lat, lng, r));
      this.graticuleGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), (lng === 0 || lng === -180) ? matMajor : matMinor));
    }
  }

  setLayerVisible(key, visible) {
    if (key === 'graticule') this.graticuleGroup.visible = visible;
    if (key === 'corridors') this.lanesGroup.visible = visible;
    if (key === 'conflicts') this.conflictsGroup.visible = visible;
    if (key === 'chokepoints') this.chokepointsGroup.visible = visible;
    if (key === 'sol') this.solGroup.visible = visible;
  }

  // Register a point marker for constant on-screen sizing (see MARKER_BASE).
  marker(mesh) {
    this.markers.push(mesh);
    return mesh;
  }

  applyMarkerScale(force = false) {
    const alt = Math.max(1, this.camDist - R);
    const s = MARKER_BASE * Math.min(MARKER_CLAMP[1], Math.max(MARKER_CLAMP[0], alt / DEFAULT_ALT));
    if (!force && this.markerScale !== null && Math.abs(s - this.markerScale) < 1e-3) return;
    this.markerScale = s;
    this.markers.forEach(m => m.scale.setScalar(s));
  }

  flyTo(lat, lng, leafletZoom = 4) {
    // Signature is (lat, lng, leafletZoom). A MapLibre-style {center: [lng, lat], zoom} object
    // used to land here and set the camera to NaN (blank globe); accept it, and ignore bad input.
    if (lat && typeof lat === 'object') {
      const o = lat;
      [lng, lat] = Array.isArray(o.center) ? o.center : [this.camLng, this.camLat];
      leafletZoom = Number.isFinite(+o.zoom) ? +o.zoom + 0.8 : 4;
    }
    lat = +lat; lng = +lng; leafletZoom = +leafletZoom;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (!Number.isFinite(leafletZoom)) leafletZoom = 4;
    this.camLat = Math.max(-80, Math.min(80, lat));
    this.camLng = lng;
    this.camDist = Math.max(125, Math.min(380, 360 - leafletZoom * 28));
    this.updateCamera();
  }

  updateCamera() {
    this.camera.position.copy(latLngToVec3(this.camLat, this.camLng, this.camDist));
    this.camera.lookAt(0, 0, 0);
    this.applyMarkerScale();
  }

  syncScene({ routeRes, corridors, chokepoints, sites, nations, conflicts, osintEvents, originId, destId, activeBloc, fmtTrillions, solSites }) {
    this.lanesGroup.clear();
    this.conflictsGroup.clear();
    this.chokepointsGroup.clear();
    this.dynamicGroup.clear();
    this.solGroup.clear();
    this.markers = [];
    this.pulses = [];
    this.pickables = [];

    // 1. Background Sea-Lane & Multi-Modal Mesh
    const MODE_COLORS = { maritime: 0x38bdf8, land: 0xf59e0b, road: 0x4ade80, river: 0xa78bfa, pipeline: 0xf472b6, blockaded: 0xef4444 };
    (corridors || []).forEach(c => {
      if (!c.pts || c.pts.length < 2) return;
      const vecs = c.pts.map(([lt, ln]) => latLngToVec3(lt, ln, R * 1.0035));
      const col = c.blockaded ? MODE_COLORS.blockaded : (MODE_COLORS[c.mode] || MODE_COLORS.maritime);
      const mat = new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: c.blockaded ? 0.55 : (c.mode === 'maritime' ? 0.26 : 0.42) });
      this.lanesGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(vecs), mat));
    });

    // 2. Active Dijkstra Route + Baseline Ghost (if diverted)
    if (routeRes) {
      if ((routeRes.isDiverted || !routeRes.activeRoute.reachable) && routeRes.baselineRoute?.flatWaypoints?.length > 1) {
        const ghostPts = routeRes.baselineRoute.flatWaypoints.map(([lt, ln]) => latLngToVec3(lt, ln, R * 1.006));
        this.dynamicGroup.add(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(ghostPts),
          new THREE.LineBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.65 })
        ));
      }
      if (routeRes.activeRoute?.reachable && routeRes.activeRoute.flatWaypoints?.length > 1) {
        const wps = routeRes.activeRoute.flatWaypoints;
        const curvePts = wps.map(([lat, lng], idx) => {
          const t = idx / (wps.length - 1);
          return latLngToVec3(lat, lng, R * (1.008 + Math.sin(t * Math.PI) * 0.055));
        });
        const curve = new THREE.CatmullRomCurve3(curvePts);
        const col = routeRes.isDiverted ? 0xf59e0b : 0x38bdf8;
        this.dynamicGroup.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 96, 0.45, 8, false), new THREE.MeshBasicMaterial({ color: col })));

        for (let i = 0; i < 3; i++) {
          const mesh = this.marker(new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffffff })));
          this.dynamicGroup.add(mesh);
          this.pulses.push({ mesh, curve, offset: i / 3 });
        }
      }
    }

    // 3. Chokepoint Gates (Click to cycle OPEN / CONTESTED / BLOCKADED)
    (chokepoints || []).forEach(cp => {
      const col = cp.state === 'blockaded' ? 0xef4444 : cp.state === 'contested' ? 0xf59e0b : 0x10b981;
      const mesh = this.marker(new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), new THREE.MeshBasicMaterial({ color: col })));
      mesh.position.copy(latLngToVec3(cp.lat, cp.lng, R * 1.011));
      mesh.userData = {
        kind: 'gate',
        gateId: cp.id,
        html: `<b style="color:#38bdf8;">⚓ ${cp.name}</b> <span style="color:${cp.state === 'blockaded' ? '#ef4444' : cp.state === 'contested' ? '#f59e0b' : '#10b981'};">[${cp.state.toUpperCase()}]</span><br/><span style="color:#94a3b8;">${cp.dailyFlow} · Click to cycle</span>`
      };
      this.chokepointsGroup.add(mesh);
      this.pickables.push(mesh);
    });

    // 4. Project & Sovereign Sites
    Object.values(sites || {}).forEach(s => {
      if (!s._coords || s.sol) return;                   // Sol sites are drawn in section 7
      const mesh = this.marker(new THREE.Mesh(
        new THREE.OctahedronGeometry(1.75, 0),
        new THREE.MeshBasicMaterial({ color: s.sovereign ? 0xf59e0b : 0x38bdf8 })
      ));
      mesh.position.copy(latLngToVec3(s._coords.lat, s._coords.lng, R * 1.012));
      mesh.userData = {
        kind: 'endpoint',
        id: s.id,
        html: `<b style="color:#fcd34d;">◆ ${s.name}</b><br/><span style="color:#94a3b8;">Click: Set Dest · Shift+Click: Set Origin</span>`
      };
      this.dynamicGroup.add(mesh);
      this.pickables.push(mesh);
    });

    // 5. Nation Nodes
    Object.values(nations || {}).forEach(n => {
      const isEp = n.id === originId || n.id === destId;
      const inBloc = !!(activeBloc && n.blocs && n.blocs.includes(activeBloc));
      const mesh = this.marker(new THREE.Mesh(
        new THREE.SphereGeometry(isEp ? 1.55 : inBloc ? 1.2 : 0.85, 12, 12),
        new THREE.MeshBasicMaterial({ color: isEp ? 0x38bdf8 : inBloc ? 0x10b981 : 0x94a3b8 })
      ));
      mesh.position.copy(latLngToVec3(n.lat, n.lng, R * 1.008));
      const gdpStr = fmtTrillions ? fmtTrillions(n.gdpNominal) : '';
      mesh.userData = {
        kind: 'endpoint',
        id: n.id,
        html: `<b style="color:#38bdf8;">[${n.id}]</b> <b>${n.name}</b> <span style="color:#10b981;">${gdpStr}</span><br/><span style="color:#94a3b8;">${n.region} · Click: Dest / Shift+Click: Origin</span>`
      };
      this.dynamicGroup.add(mesh);
      this.pickables.push(mesh);
    });

    // 6. Conflict Flashpoints & Live OSINT Wire Dots
    (conflicts || []).forEach(c => {
      const mesh = this.marker(new THREE.Mesh(new THREE.SphereGeometry(1.25, 12, 12), new THREE.MeshBasicMaterial({ color: 0xef4444 })));
      mesh.position.copy(latLngToVec3(c.lat, c.lng, R * 1.01));
      mesh.userData = {
        kind: 'info',
        html: `<b style="color:#ef4444;">🎯 ${c.name}</b> <span style="color:#f59e0b;">[SEV ${c.severity}]</span><br/><span style="color:#cbd5e1;">${c.intensity}</span>`
      };
      this.conflictsGroup.add(mesh);
      this.pickables.push(mesh);
    });

    (osintEvents || []).forEach(ev => {
      const mesh = this.marker(new THREE.Mesh(new THREE.SphereGeometry(0.95, 10, 10), new THREE.MeshBasicMaterial({ color: 0xf59e0b })));
      mesh.position.copy(latLngToVec3(ev.lat, ev.lng, R * 1.011));
      mesh.userData = {
        kind: 'info',
        html: `<span style="color:#f59e0b;">📡 ${ev.source} // ${ev.theater}</span><br/><b>${ev.title.slice(0, 78)}${ev.title.length > 78 ? '…' : ''}</b>`
      };
      this.conflictsGroup.add(mesh);
      this.pickables.push(mesh);
    });

    // 7. Sol solar sites (P90 colour; red ring = inside a StratCom conflict theater)
    (solSites || []).forEach(s => {
      const pos = latLngToVec3(s.lat, s.lng, R * 1.012);
      const mesh = this.marker(new THREE.Mesh(new THREE.SphereGeometry(1.3, 14, 14),
                                              new THREE.MeshBasicMaterial({ color: new THREE.Color(s.color) })));
      mesh.position.copy(pos);
      mesh.userData = { kind: 'endpoint', id: s.key, html: s.html };
      this.solGroup.add(mesh);
      this.pickables.push(mesh);
      if (s.threat) {
        const ring = this.marker(new THREE.Mesh(new THREE.RingGeometry(1.7, 2.15, 24),
          new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })));
        ring.position.copy(latLngToVec3(s.lat, s.lng, R * 1.0125));
        ring.lookAt(0, 0, 0);
        this.solGroup.add(ring);
      }
    });
    this.applyMarkerScale(true);
  }

  initInteraction() {
    const dom = this.renderer.domElement;
    dom.addEventListener('mousedown', e => {
      this.isDragging = true;
      this.dragDist = 0;
      this.prevMouse = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('mouseup', e => {
      if (this.isDragging && this.dragDist < 5) this.handleClick(e);
      this.isDragging = false;
    });
    window.addEventListener('mousemove', e => {
      if (this.isDragging) {
        const dx = e.clientX - this.prevMouse.x;
        const dy = e.clientY - this.prevMouse.y;
        this.dragDist += Math.abs(dx) + Math.abs(dy);
        this.prevMouse = { x: e.clientX, y: e.clientY };
        const scale = this.camDist / 900;
        this.camLng = ((this.camLng - dx * scale + 540) % 360) - 180;
        this.camLat = Math.max(-82, Math.min(82, this.camLat + dy * scale));
        this.updateCamera();
      }
      this.updateHoverAndCursor(e);
    });
    dom.addEventListener('wheel', e => {
      e.preventDefault();
      // zoom step proportional to altitude, so close-in zoom stays controllable
      this.camDist = Math.max(112, Math.min(420, this.camDist + e.deltaY * 0.0012 * (this.camDist - R + 4)));
      this.updateCamera();
    }, { passive: false });
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    this.updateCamera();
  }

  getVisibleHit(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const earthHits = this.raycaster.intersectObject(this.earthMesh);
    const maxDist = earthHits.length > 0 ? earthHits[0].distance : Infinity;
    const nodeHits = this.raycaster.intersectObjects(this.pickables).filter(h => {
      let p = h.object;
      while (p) { if (!p.visible) return false; p = p.parent; }
      return h.distance <= maxDist + 2.5;
    });
    return { earthHit: earthHits[0] || null, nodeHit: nodeHits[0] || null };
  }

  updateHoverAndCursor(e) {
    if (this.container.hidden || e.target !== this.renderer.domElement) {
      this.tooltip.style.display = 'none';
      return;
    }
    const { earthHit, nodeHit } = this.getVisibleHit(e);
    if (nodeHit && nodeHit.object.userData.html) {
      this.renderer.domElement.style.cursor = 'pointer';
      this.tooltip.innerHTML = nodeHit.object.userData.html;
      this.tooltip.style.display = 'block';
      this.tooltip.style.left = `${Math.min(window.innerWidth - 280, e.clientX + 14)}px`;
      this.tooltip.style.top = `${Math.max(12, e.clientY - 28)}px`;
    } else {
      this.renderer.domElement.style.cursor = this.isDragging ? 'grabbing' : 'grab';
      this.tooltip.style.display = 'none';
    }

    if (earthHit && this.onCursorMove) {
      const p = earthHit.point.clone().normalize();
      const lat = 90 - Math.acos(p.y) * RAD2DEG;
      const lng = ((Math.atan2(p.z, -p.x) * RAD2DEG) - 180 + 540) % 360 - 180;
      this.onCursorMove(lat, lng);
    }
  }

  handleClick(e) {
    const { nodeHit } = this.getVisibleHit(e);
    if (!nodeHit) return;
    const data = nodeHit.object.userData;
    if (data.kind === 'gate' && this.onCycleGate) {
      this.onCycleGate(data.gateId);
    } else if (data.kind === 'endpoint' && this.onSelectEndpoint) {
      this.onSelectEndpoint(data.id, e.shiftKey);
    }
  }

  animate() {
    const loop = (t) => {
      requestAnimationFrame(loop);
      if (this.container.hidden) {
        if (this.tooltip.style.display !== 'none') this.tooltip.style.display = 'none';
        return;
      }
      const phase = (t * 0.00018) % 1;
      this.pulses.forEach(p => {
        p.mesh.position.copy(p.curve.getPointAt((phase + p.offset) % 1));
      });
      this.renderer.render(this.scene, this.camera);
    };
    requestAnimationFrame(loop);
  }
}
