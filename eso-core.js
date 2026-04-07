// ESO CORE — state, map, UI navigation, layer system, caching
// Load order: 2 of 4
// ════════════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════════════
const state = { activeLayers: new Set(), data: {}, mapLayers: {}, markers: {} };

// ════════════════════════════════════════════════════════
// MAP ABSTRACTION LAYER — works with Leaflet AND Google Maps
// All layer code uses these helpers; underlying map is swappable
// ════════════════════════════════════════════════════════

// ── GCircle: Leaflet circle overlay ──────────────────────
function GCircle(latLng, opts, tooltipHtml) {
  const lat = Array.isArray(latLng) ? latLng[0] : latLng.lat;
  const lng = Array.isArray(latLng) ? latLng[1] : latLng.lng;
  const circle = L.circleMarker([lat, lng], {
    radius:      (opts.radius      !== undefined ? opts.radius      : 8),
    fillColor:   opts.fillColor   || '#00e5ff',
    color:       (opts.color === 'transparent'   ? 'transparent'   : (opts.color || opts.fillColor || '#00e5ff')),
    weight:      (opts.weight      !== undefined ? opts.weight      : 1),
    opacity:     (opts.opacity     !== undefined ? opts.opacity     : 0.8),
    fillOpacity: (opts.fillOpacity !== undefined ? opts.fillOpacity : 0.2),
  }).addTo(map);
  if (tooltipHtml) circle.bindTooltip(tooltipHtml);
  return circle;
}

// ── GPolyline: Leaflet polyline ──────────────────────────
function GPolyline(points, opts, tooltipHtml) {
  const lPoints = points.map(p => Array.isArray(p) ? p : [p.lat, p.lng]);
  const line = L.polyline(lPoints, {
    color:     opts.color       || '#00e5ff',
    weight:    (opts.weight      !== undefined ? opts.weight  : 2),
    opacity:   (opts.opacity     !== undefined ? opts.opacity : 0.7),
    dashArray: opts.dashArray   || null,
  }).addTo(map);
  if (tooltipHtml) line.bindTooltip(tooltipHtml);
  return line;
}

// ── GLargeCircle: km-scale circle ─────────────────────────────
function GLargeCircle(latLng, opts) {
  const lat = Array.isArray(latLng) ? latLng[0] : latLng.lat;
  const lng = Array.isArray(latLng) ? latLng[1] : latLng.lng;
  return L.circle([lat, lng], {
    radius:      opts.radius      || 1000000,
    fillColor:   opts.fillColor   || '#ff6d00',
    color:       opts.color       || opts.fillColor || '#ff6d00',
    weight:      opts.weight      || 1,
    opacity:     opts.opacity     || 0.4,
    fillOpacity: (opts.fillOpacity !== undefined ? opts.fillOpacity : 0.07),
    dashArray:   opts.dashArray   || null,
  }).addTo(map);
}

// ── GMarker: Leaflet div marker ──────────────────────────
function GMarker(latLng, htmlContent, opts, tooltipHtml) {
  const lat = Array.isArray(latLng) ? latLng[0] : latLng.lat;
  const lng = Array.isArray(latLng) ? latLng[1] : latLng.lng;
  const m = L.marker([lat, lng], {
    icon: L.divIcon({
      className: '',
      html: htmlContent || '',
      iconSize:   (opts && opts.iconSize)   || [24, 24],
      iconAnchor: (opts && opts.iconAnchor) || [12, 12],
    })
  }).addTo(map);
  if (tooltipHtml) m.bindTooltip(tooltipHtml);
  return m;
}


// ── GRemove: remove a layer from map ─────────────────────
function GRemove(layer) {
  if (layer && map.hasLayer(layer)) map.removeLayer(layer);
}

// ── GOpenPopup / GPopup: show info popup at lat/lng ───────────
function GOpenPopup(lat, lng, html) {
  const content = _iwHtml(html);
  _leafletIW.setLatLng([lat, lng]).setContent(content).openOn(map);
}

// ── addTooltip: add hover tooltip to existing overlay ─────────
function addTooltip(overlay, html) {
  if (!overlay) return;
  if (typeof overlay.bindTooltip === 'function')
    overlay.bindTooltip(html, { sticky: true, opacity: 0.95 });
}

// ── _iwHtml: wrap HTML for InfoWindow dark styling ────────────
function _iwHtml(html) {
  return `<div style="font-family:'Space Mono',monospace;font-size:9px;color:#b8d4e8;line-height:1.7;padding:2px 0">` + html + `</div>`;
}





// ════════════════════════════════════════════════════════
// CLOCK + DOY
// ════════════════════════════════════════════════════════
function updateClock() {
  const now = new Date();
  const timeStr = now.toUTCString().split(' ')[4];
  document.getElementById('utc-clock').textContent = timeStr;
  const doy = Math.floor((now - new Date(now.getFullYear(),0,0)) / 86400000);
  document.getElementById('doy-display').textContent = `DOY ${doy}`;
  // Map timestamp watermark
  const mts = document.getElementById('map-ts-text');
  const mtd = document.getElementById('map-ts-date');
  if (mts) mts.textContent = timeStr;
  if (mtd) {
    const d = now.toUTCString().split(' ');
    mtd.textContent = d[1] + ' ' + d[2] + ' ' + d[3];
  }
}
setInterval(updateClock, 1000); updateClock();

// ════════════════════════════════════════════════════════
// TAB SWITCHING
// ════════════════════════════════════════════════════════
function switchTab(tab) {
  const panels = ['now','risk','explore','hist'];
  panels.forEach(t => {
    const panel = document.getElementById('rpanel-' + t);
    const btn   = document.getElementById('tab-' + t);
    if (panel) panel.classList.toggle('active', t === tab);
    if (btn)   btn.classList.toggle('active', t === tab);
  });
  if (tab === 'now')     { renderSynthesis(); updateBaselineCards(); }
  if (tab === 'risk')    { renderForecastDashboard(); }
  if (tab === 'explore') { updateCorrelationNotes(); }
  if (tab === 'hist')    {
    if (!_dockOpen['timeline']) {
      toggleDock('timeline'); // also calls loadAndRenderHistory()
    } else if (typeof renderHistoryTab === 'function') {
      renderHistoryTab(); // dock already open — still refresh stats with latest data
    }
  }
  // ensure right panel is visible
  if (document.body.classList.contains('right-collapsed')) toggleRightPanel();
}

// ── Deep Analysis overlay (Discover engine) ──────────────
function openDeepAnalysis() {
  var ov = document.getElementById('deep-analysis-overlay');
  if (ov) ov.classList.add('open');
  // trigger active sub-tool renders
  try { updateDiscoverSelects(); renderStressIndex(); renderNovelIndices(); renderPlanets(); runChainScan(); } catch(e) {}
}
function closeDeepAnalysis() {
  var ov = document.getElementById('deep-analysis-overlay');
  if (ov) ov.classList.remove('open');
}

// ── Bottom dock — unified toggle for Timeline / Charts / Outlook ──
var _dockOpen = { timeline: false, charts: false, outlook: false };

function toggleDock(section) {
  _dockOpen[section] = !_dockOpen[section];
  var body = document.getElementById('dock-body-' + section);
  var icon = document.getElementById('dock-icon-' + section);
  var open = _dockOpen[section];
  if (body) { body.style.display = open ? 'flex' : 'none'; }
  if (icon) { icon.textContent = open ? '▼' : '▶'; icon.className = open ? 'dock-icon open' : 'dock-icon'; }
  // Trigger renders on open
  if (open) {
    if (section === 'timeline') loadAndRenderHistory();
    if (section === 'charts') {
      var active = document.querySelector('.csub-tab.active');
      if (active && active.id === 'cst-matrix') requestAnimationFrame(renderCorrMatrix);
      else renderSparklines();
    }
    if (section === 'outlook') renderForecastCalendar();
  }
}

// Backward compat shims
function switchHistView(view) {
  if (view === 'timeline' && !_dockOpen.timeline) toggleDock('timeline');
  if (view === 'charts'   && !_dockOpen.charts)   toggleDock('charts');
}
function toggleForecastCalendar() { toggleDock('outlook'); }

// ════════════════════════════════════════════════════════
// LAYER TOGGLE
// ════════════════════════════════════════════════════════
function toggleLayer(id) {
  const el = document.querySelector(`[data-layer="${id}"]`);
  if (state.activeLayers.has(id)) {
    state.activeLayers.delete(id);
    el.classList.remove('active');
    removeMapLayer(id);
  } else {
    state.activeLayers.add(id);
    el.classList.add('active');
    loadLayer(id);
  }
  updateActiveCount();
  renderDataCards();
  updateCorrelationNotes();
}
function updateActiveCount() {
  const n = state.activeLayers.size;
  const activeEl = document.getElementById('active-count');
  if (activeEl) activeEl.textContent = `${n} active`;
  const countEl = document.getElementById('layer-count-display');
  if (countEl) countEl.textContent = (n+' LAYER'+(n!==1?'S':'')+' ACTIVE');
  // Update accordion stat badge in Data tab
  var rdStat = document.getElementById('ps-readings-stat');
  if (rdStat) rdStat.textContent = n ? n + ' active' : '0 layers';
  updateStatusStrip();
  updateBaselineCards();
}

// ── Domain bulk toggle ──────────────────────────────────
function toggleDomain(layers) {
  var allActive = layers.every(function(l){ return state.activeLayers.has(l); });
  layers.forEach(function(l) {
    var el = document.querySelector('[data-layer="' + l + '"]');
    if (allActive) {
      if (state.activeLayers.has(l)) {
        state.activeLayers.delete(l);
        if (el) el.classList.remove('active');
        removeMapLayer(l);
      }
    } else {
      if (!state.activeLayers.has(l)) {
        state.activeLayers.add(l);
        if (el) el.classList.add('active');
        loadLayer(l);
      }
    }
  });
  updateActiveCount();
  renderDataCards();
  updateCorrelationNotes();
}

// ── Live status strip ──────────────────────────────────
function updateStatusStrip() {
  try {
    var s = getSystemState ? getSystemState() : {};
    var kp = _realKpCurrent !== null ? _realKpCurrent : (s.kp || 2.0);
    var eq = typeof scoreEarthquake === 'function' ? scoreEarthquake() : { score:0, level:'CLEAR' };
    var ts = typeof scoreTsunami === 'function' ? scoreTsunami() : { score:0, level:'CLEAR' };
    var syzygy = ((s.syzygy || 0) * 100);
    var xCount = (_xrayFlares || []).filter(function(f){ return f.xClass === 'X'; }).length;
    var mCount = (_xrayFlares || []).filter(function(f){ return f.xClass === 'M'; }).length;
    var alertCount = notifications ? notifications.filter(function(n){ return !n.dismissed; }).length : 0;

    // Kp
    var kpEl = document.getElementById('ss-kp-val');
    var kpBadge = document.getElementById('ss-kp-badge');
    if (kpEl) { kpEl.textContent = kp.toFixed(1); kpEl.style.color = kp>=5?'var(--c-red)':kp>=4?'var(--c-gold)':'var(--c-green)'; }
    if (kpBadge) { kpBadge.textContent = kp>=5?'STORM':kp>=4?'ACTIVE':'QUIET'; kpBadge.className = 'ss-badge ' + (kp>=5?'ss-str':kp>=4?'ss-act':'ss-q'); }

    // EQ
    var eqEl = document.getElementById('ss-eq-val');
    var eqBadge = document.getElementById('ss-eq-badge');
    if (eqEl) { eqEl.textContent = (eq.score||0); eqEl.style.color = eq.score>=60?'var(--c-red)':eq.score>=35?'var(--c-gold)':'var(--text)'; }
    if (eqBadge) { eqBadge.textContent = eq.level||'CLEAR'; eqBadge.className = 'ss-badge ' + (eq.score>=60?'ss-crit':eq.score>=35?'ss-elv':'ss-clr'); }

    // Tsunami
    var tsEl = document.getElementById('ss-ts-val');
    var tsBadge = document.getElementById('ss-ts-badge');
    if (tsEl) { tsEl.textContent = (ts.score||0); tsEl.style.color = ts.score>=60?'var(--c-red)':ts.score>=35?'var(--c-gold)':'var(--text)'; }
    if (tsBadge) { tsBadge.textContent = ts.level||'CLEAR'; tsBadge.className = 'ss-badge ' + (ts.score>=60?'ss-crit':ts.score>=35?'ss-elv':'ss-clr'); }

    // Syzygy
    var syzEl = document.getElementById('ss-syz-val');
    if (syzEl) {
      syzEl.innerHTML = syzygy.toFixed(0) + '<span class="ss-unit">%</span>';
      syzEl.style.color = syzygy>80?'var(--c-gold)':syzygy>60?'var(--text)':'var(--text-dim)';
    }

    // Flares
    var flareEl = document.getElementById('ss-flare-val');
    if (flareEl) {
      if (xCount>0) { flareEl.innerHTML = '<b style="color:var(--c-red)">' + xCount + ' X</b>'; }
      else if (mCount>0) { flareEl.innerHTML = mCount + ' M-class'; flareEl.style.color='var(--c-gold)'; }
      else { flareEl.textContent = 'NONE'; flareEl.style.color='var(--text-dim)'; }
    }

    // Alerts
    var alertEl = document.getElementById('ss-alert-val');
    if (alertEl) { alertEl.textContent = alertCount; alertEl.style.color = alertCount>0?'var(--c-red)':'var(--text-dim)'; }

    // Network
    var netEl = document.getElementById('ss-net-val');
    if (netEl) {
      if (typeof _apiOnline !== 'undefined' && _apiOnline) {
        netEl.innerHTML = '● LIVE'; netEl.className = 'ss-val ss-net-on';
      } else {
        netEl.innerHTML = '○ MODELS'; netEl.className = 'ss-val ss-net-off';
      }
    }
  } catch(e) { /* silent — called before full init */ }
  // Also update the always-visible panel metrics strip
  updatePanelMetrics();
}

// ── Always-visible panel metrics strip ────────────────────
function updatePanelMetrics() {
  try {
    var s = getSystemState ? getSystemState() : {};
    var kp = _realKpCurrent !== null ? _realKpCurrent : (s.kp || 2.0);
    var eq = typeof scoreEarthquake === 'function' ? scoreEarthquake() : { score:0, level:'CLEAR' };
    var syzygy = ((s.syzygy || 0) * 100);
    var pmKp = document.getElementById('pm-kp');
    if (pmKp) { pmKp.textContent = kp.toFixed(1); pmKp.style.color = kp>=5?'var(--c-red)':kp>=4?'var(--c-gold)':'var(--c-green)'; }
    var pmBadge = document.getElementById('pm-kp-badge');
    if (pmBadge) { pmBadge.textContent = kp>=5?'STORM':kp>=4?'ACT':'Q'; pmBadge.className = 'pm-badge ' + (kp>=5?'ss-str':kp>=4?'ss-act':'ss-q'); }
    var pmSyz = document.getElementById('pm-syz');
    if (pmSyz) { pmSyz.textContent = syzygy.toFixed(0); pmSyz.style.color = syzygy>80?'var(--c-gold)':'#fff'; }
    var pmEq = document.getElementById('pm-eq');
    if (pmEq) { pmEq.textContent = eq.score||0; pmEq.style.color = eq.score>=60?'var(--c-red)':eq.score>=35?'var(--c-gold)':'#fff'; }
    var pmNet = document.getElementById('pm-net');
    if (pmNet) {
      if (typeof _apiOnline !== 'undefined' && _apiOnline) {
        pmNet.textContent = '●'; pmNet.className = 'pm-val pm-net-on';
      } else {
        pmNet.textContent = '○'; pmNet.className = 'pm-val pm-net-off';
      }
    }
  } catch(e) {}
}

// ── Physics baseline cards (Data tab, always visible) ─
function updateBaselineCards() {
  try {
    var s = getSystemState ? getSystemState() : {};
    var kp = _realKpCurrent !== null ? _realKpCurrent : (s.kp || 2.0);
    var eq = typeof scoreEarthquake === 'function' ? scoreEarthquake() : { score:0, level:'CLEAR' };
    var syzygy = ((s.syzygy || 0) * 100);
    var quakeCount = forecastData && forecastData.usgsQuakes && forecastData.usgsQuakes.val ? forecastData.usgsQuakes.val.length : 0;

    // ── Push values into rolling anomaly buffers ──────────
    if (typeof pushRollingMetric === 'function') {
      pushRollingMetric('kp',     kp);
      pushRollingMetric('eq',     eq.score || 0);
      pushRollingMetric('sfi',    s.sfi || 120);
      pushRollingMetric('quakes', quakeCount);
      if (_dstCurrent !== null) pushRollingMetric('dst', _dstCurrent);
      if (_swSpeed    !== null) pushRollingMetric('swspd', _swSpeed);
      if (_swBz       !== null) pushRollingMetric('bz',  _swBz);
      if (typeof persistRollingBuffers === 'function') persistRollingBuffers();
    }

    // ── Helper: append z-score badge if anomalous ─────────
    function applyAnomalyBadge(metricId, currentVal, subEl) {
      if (typeof getRollingAnomaly !== 'function' || !subEl) return;
      var anom = getRollingAnomaly(metricId, currentVal);
      if (anom && anom.label) {
        // Find or create anomaly span inside subEl
        var badge = subEl.querySelector('.anom-badge');
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'anom-badge';
          badge.style.cssText = 'font-size:8px;margin-left:4px;font-weight:700;';
          subEl.appendChild(badge);
        }
        badge.textContent = anom.label;
        badge.style.color = anom.color;
      } else {
        var badge = subEl.querySelector('.anom-badge');
        if (badge) badge.remove();
      }
    }

    var kpEl = document.getElementById('bl-kp');
    if (kpEl) { kpEl.textContent = kp.toFixed(1); kpEl.style.color = kp>=5?'var(--c-red)':kp>=4?'var(--c-gold)':'var(--c-green)'; }
    var kpSub = document.getElementById('bl-kp-sub');
    if (kpSub) { kpSub.textContent = kp>=5?'STORM':kp>=4?'Active':'Quiet'; applyAnomalyBadge('kp', kp, kpSub); }

    var syzEl = document.getElementById('bl-syz');
    if (syzEl) { syzEl.innerHTML = syzygy.toFixed(0) + '<span style="font-size:11px;color:var(--text-dim)">%</span>'; syzEl.style.color = syzygy>80?'var(--c-gold)':'#fff'; }
    var moonEl = document.getElementById('bl-moon');
    if (moonEl) moonEl.textContent = s.moonName || '—';

    var eqEl = document.getElementById('bl-eq');
    if (eqEl) { eqEl.textContent = eq.score || 0; eqEl.style.color = eq.score>=60?'var(--c-red)':eq.score>=35?'var(--c-gold)':'#fff'; }
    var eqSub = document.getElementById('bl-eq-sub');
    if (eqSub) { eqSub.textContent = eq.level || 'CLEAR'; applyAnomalyBadge('eq', eq.score || 0, eqSub); }

    var sfiEl = document.getElementById('bl-sfi');
    if (sfiEl) { sfiEl.textContent = (s.sfi||120).toFixed(0); }
    var sfiSub = document.getElementById('bl-sfi-sub');
    if (sfiSub) applyAnomalyBadge('sfi', s.sfi || 120, sfiSub);

    var schEl = document.getElementById('bl-sch');
    if (schEl) { schEl.textContent = (s.schFreq||7.83).toFixed(2); }

    var qkEl = document.getElementById('bl-quakes');
    if (qkEl) { qkEl.textContent = quakeCount; qkEl.style.color = quakeCount>20?'var(--c-gold)':'#fff'; }
    var qkSub = document.getElementById('bl-quakes-sub');
    if (qkSub) applyAnomalyBadge('quakes', quakeCount, qkSub);

    // ── b-value sparkline ──────────────────────────────────
    var bvCanvas = document.getElementById('bl-bvalue-spark');
    if (bvCanvas && typeof drawBValueSparkline === 'function' && _bValueHistory && _bValueHistory.length > 1) {
      drawBValueSparkline(bvCanvas, _bValueHistory);
    }
    var bvTrend = document.getElementById('bl-bvalue-trend');
    if (bvTrend && typeof getBValueTrend === 'function') {
      var t = getBValueTrend();
      bvTrend.textContent = t.label;
      bvTrend.style.color = t.trend === 'declining' ? 'var(--c-red)' : t.trend === 'rising' ? 'var(--c-green)' : 'var(--text-dim)';
    }
  } catch(e) { /* silent */ }
}

async function loadLayer(id) {
  const loaders = {
    seismic: loadSeismic, solar: loadSolar, geomagnetic: loadGeomagnetic,
    wind: loadWind, magnetic: loadMagneticField, schumann: loadSchumann,
    sst: loadSST, volcanic: loadVolcanic, gravity: loadGravity,
    geotherm: loadGeotherm, cosmic: loadCosmicRay, solarwind: loadSolarWind,
    ionosphere: loadIonosphere, tides: loadTides,
    // Phase 4 layers — data is fetched via auto-refresh; activate map overlay on toggle
    xray:     function() { updateXRayMapLayer(); },
    pressure: function() { updatePressureMapLayer(); },
    precipitation: function() { updatePrecipMarkers(); },
  };
  if (loaders[id]) await loaders[id]();
  renderDataCards();
}
function removeMapLayer(id) {
  if (state.mapLayers[id]) {
    (Array.isArray(state.mapLayers[id]) ? state.mapLayers[id] : [state.mapLayers[id]])
      .forEach(l => GRemove(l));
    delete state.mapLayers[id];
  }
  if (state.markers[id]) {
    state.markers[id].forEach(m => GRemove(m));
    delete state.markers[id];
  }
  delete state.data[id];
}

// ════════════════════════════════════════════════════════
// PHYSICS HELPERS
// ════════════════════════════════════════════════════════
function getDOY() {
  const now = new Date();
  return Math.floor((now - new Date(now.getFullYear(),0,0)) / 86400000);
}
function getSolarDeclination() {
  return -23.45 * Math.cos(2 * Math.PI * (getDOY() + 10) / 365);
}
function getCarrington() {
  // 27-day solar rotation cycle
  return Math.sin(getDOY() * 2 * Math.PI / 27);
}
function _syntheticKpRaw() {
  const hour = new Date().getUTCHours();
  const carr = getCarrington();
  const diurnal = Math.sin(hour * Math.PI / 12);
  return Math.max(0, Math.min(9, 1.8 + carr * 1.4 + diurnal * 0.5));
}
function getCurrentKpRaw() { return _syntheticKpRaw(); }
function getLunarPhase() {
  // Approximate days since new moon (29.53 day cycle)
  const known = new Date('2024-01-11').getTime(); // known new moon
  const diff = (Date.now() - known) / 86400000;
  return (diff % 29.53) / 29.53; // 0=new, 0.5=full
}

// ════════════════════════════════════════════════════════
// STATIC SEISMIC DATA — 45 real fault zones
// ════════════════════════════════════════════════════════
const SEISMIC_ZONES = [
  {lat:35.6,lon:139.8,mag:3.8,depth:42,place:"Near Tokyo, Japan"},
  {lat:38.3,lon:142.4,mag:5.1,depth:22,place:"Off Miyagi, Japan"},
  {lat:43.7,lon:147.2,mag:4.3,depth:55,place:"Kuril Islands, Russia"},
  {lat:33.4,lon:131.6,mag:3.2,depth:30,place:"Kyushu, Japan"},
  {lat:-8.4,lon:115.2,mag:4.7,depth:90,place:"Bali, Indonesia"},
  {lat:0.9,lon:127.8,mag:5.3,depth:66,place:"Halmahera, Indonesia"},
  {lat:-5.5,lon:105.3,mag:3.6,depth:44,place:"Sumatra, Indonesia"},
  {lat:13.4,lon:124.6,mag:4.1,depth:38,place:"Samar, Philippines"},
  {lat:6.9,lon:126.7,mag:5.8,depth:80,place:"Davao Gulf, Philippines"},
  {lat:-18.5,lon:-70.3,mag:4.9,depth:95,place:"Northern Chile"},
  {lat:-33.4,lon:-71.6,mag:3.7,depth:28,place:"Central Chile"},
  {lat:-8.1,lon:-74.9,mag:4.2,depth:110,place:"Peru"},
  {lat:-0.9,lon:-80.1,mag:3.5,depth:22,place:"Ecuador"},
  {lat:51.5,lon:-179.4,mag:5.2,depth:30,place:"Rat Islands, Alaska"},
  {lat:60.1,lon:-152.7,mag:3.4,depth:88,place:"Southcentral Alaska"},
  {lat:56.2,lon:-153.0,mag:4.6,depth:15,place:"Kodiak Island, Alaska"},
  {lat:37.8,lon:-122.2,mag:2.8,depth:9,place:"San Francisco Bay, CA"},
  {lat:33.9,lon:-116.3,mag:3.1,depth:12,place:"Southern California"},
  {lat:38.9,lon:27.2,mag:4.8,depth:8,place:"Aegean Sea, Greece"},
  {lat:37.5,lon:30.6,mag:3.9,depth:10,place:"Western Turkey"},
  {lat:38.4,lon:15.6,mag:3.3,depth:18,place:"Strait of Messina, Italy"},
  {lat:35.2,lon:23.8,mag:4.1,depth:5,place:"Crete, Greece"},
  {lat:40.8,lon:29.9,mag:3.7,depth:12,place:"Marmara Sea, Turkey"},
  {lat:18.5,lon:-72.8,mag:3.4,depth:14,place:"Haiti"},
  {lat:12.1,lon:-61.7,mag:3.8,depth:30,place:"Caribbean Sea"},
  {lat:-38.6,lon:175.8,mag:4.2,depth:95,place:"North Island, New Zealand"},
  {lat:-18.1,lon:-178.4,mag:5.6,depth:400,place:"Tonga"},
  {lat:-15.4,lon:167.2,mag:4.8,depth:25,place:"Vanuatu"},
  {lat:36.4,lon:71.1,mag:4.6,depth:180,place:"Hindu Kush, Afghanistan"},
  {lat:28.2,lon:84.7,mag:3.5,depth:10,place:"Nepal"},
  {lat:37.8,lon:-26.1,mag:3.2,depth:8,place:"Azores, Portugal"},
  {lat:16.8,lon:-99.3,mag:4.3,depth:35,place:"Guerrero, Mexico"},
  {lat:13.7,lon:-90.8,mag:4.5,depth:55,place:"Guatemala"},
  {lat:-2.1,lon:138.9,mag:4.5,depth:55,place:"Papua, Indonesia"},
  {lat:19.4,lon:-155.3,mag:2.6,depth:5,place:"Hawaii, Big Island"},
  {lat:-23.3,lon:-67.5,mag:4.4,depth:180,place:"Jujuy, Argentina"},
  {lat:46.2,lon:-122.2,mag:2.7,depth:6,place:"Mt St Helens, WA"},
  {lat:64.1,lon:-19.6,mag:3.3,depth:4,place:"Iceland"},
  {lat:-43.5,lon:171.8,mag:3.9,depth:12,place:"South Island, New Zealand"},
  {lat:10.5,lon:-85.2,mag:3.8,depth:18,place:"Costa Rica"},
  {lat:-13.9,lon:-14.4,mag:3.6,depth:10,place:"Mid-Atlantic Ridge"},
  {lat:52.1,lon:159.4,mag:5.0,depth:60,place:"Kamchatka, Russia"},
  {lat:30.5,lon:81.2,mag:3.8,depth:15,place:"Tibet"},
  {lat:36.1,lon:140.9,mag:3.4,depth:50,place:"Ibaraki, Japan"},
  {lat:-54.2,lon:-36.5,mag:4.1,depth:12,place:"South Sandwich Islands"},
];

// VOLCANIC HOTSPOTS — real active volcanoes
const VOLCANIC_SITES = [
  {lat:19.4,lon:-155.3,name:"Kilauea, Hawaii",alert:"Watch",type:"Shield",elev:1222},
  {lat:64.6,lon:-17.5,name:"Bárðarbunga, Iceland",alert:"Yellow",type:"Stratovolcano",elev:2009},
  {lat:-8.3,lon:115.5,name:"Agung, Bali",alert:"Normal",type:"Stratovolcano",elev:3031},
  {lat:13.3,lon:123.7,name:"Mayon, Philippines",alert:"Yellow",type:"Stratovolcano",elev:2462},
  {lat:-3.8,lon:102.2,name:"Kerinci, Sumatra",alert:"Normal",type:"Stratovolcano",elev:3805},
  {lat:0.7,lon:127.3,name:"Dukono, Indonesia",alert:"Orange",type:"Complex",elev:1187},
  {lat:43.4,lon:142.7,name:"Tokachi, Japan",alert:"Normal",type:"Stratovolcano",elev:2077},
  {lat:51.5,lon:179.6,name:"Cleveland, Alaska",alert:"Yellow",type:"Stratovolcano",elev:1730},
  {lat:56.0,lon:-135.0,name:"Mt Edgecumbe, Alaska",alert:"Yellow",type:"Stratovolcano",elev:976},
  {lat:14.5,lon:-90.8,name:"Santiaguito, Guatemala",alert:"Yellow",type:"Lava dome",elev:3772},
  {lat:-0.7,lon:-91.1,name:"Wolf, Galápagos",alert:"Normal",type:"Shield",elev:1707},
  {lat:-17.6,lon:168.0,name:"Ambae, Vanuatu",alert:"Orange",type:"Complex",elev:1496},
  {lat:38.8,lon:15.2,name:"Stromboli, Italy",alert:"Orange",type:"Stratovolcano",elev:924},
  {lat:-22.2,lon:-68.2,name:"Lascar, Chile",alert:"Yellow",type:"Stratovolcano",elev:5592},
  {lat:-7.9,lon:110.4,name:"Merapi, Java",alert:"Yellow",type:"Stratovolcano",elev:2930},
  {lat:45.4,lon:12.4,name:"Campi Flegrei, Italy",alert:"Yellow",type:"Caldera",elev:458},
  {lat:37.7,lon:15.0,name:"Etna, Sicily",alert:"Orange",type:"Stratovolcano",elev:3357},
];

// ════════════════════════════════════════════════════════
// DATA CARDS
// ════════════════════════════════════════════════════════
const cardConfigs = {
  seismic:{label:'🔴 SEISMIC ACTIVITY',color:'#ff3d3d',render:d=>d.error?'<div class=\"data-card-sub\" style=\"color:#ff6d00\">'+d.error+'</div>':`
    <div class="data-card-value" style="color:#ff3d3d">${d.count}<span class="data-card-unit">events/24h</span></div>
    <div class="data-card-sub">Max: M${d.maxMag} · Avg depth ${d.avgDepth} km<br>Largest: ${d.largestEvent}<br>Tidal modulation: +${d.tidalModulation}%</div>
    <div class="data-bar"><div class="data-bar-fill" style="width:${Math.min(100,d.count*3)}%;background:#ff3d3d"></div></div>`},
  solar:{label:'☀️ SOLAR IRRADIANCE',color:'#ffd600',render:d=>d.error?'<div class=\"data-card-sub\" style=\"color:#ff6d00\">'+d.error+'</div>':`
    <div class="data-card-value" style="color:#ffd600">${d.irradiance}<span class="data-card-unit">${d.unit}</span></div>
    <div class="data-card-sub">${d.description}<br>Solar flux index: ${d.solarFlux} SFU<br>${d.period}</div>
    <div class="data-bar"><div class="data-bar-fill" style="width:${Math.min(100,d.irradiance*14)}%;background:linear-gradient(90deg,#ffd600,#ff6d00)"></div></div>`},
  geomagnetic:{label:'🟣 GEOMAGNETIC Kp',color:'#b84fff',render:d=>d.error?'<div class=\"data-card-sub\" style=\"color:#ff6d00\">'+d.error+'</div>':`
    <div class="data-card-value" style="color:#b84fff">Kp ${d.kp}<span class="data-card-unit">${d.status}</span></div>
    <div class="data-card-sub">${d.description}<br>Aurora visible ≥${d.auroraLat}° lat<br>${d.updated}</div>
    <div class="data-bar"><div class="data-bar-fill" style="width:${Math.min(100,d.kp*11)}%;background:#b84fff"></div></div>`},
  cosmic:{label:'🩷 COSMIC RAY FLUX',color:'#ff4fa0',render:d=>`
    <div class="data-card-value" style="color:#ff4fa0">${d.flux}<span class="data-card-unit">${d.unit}</span></div>
    <div class="data-card-sub">Solar modulation: ${d.solarMod} cpm<br>Geo shielding: ${d.geoMod} cpm<br>${d.description}</div>
    <div class="data-bar"><div class="data-bar-fill" style="width:${Math.min(100,(d.flux/2000)*100)}%;background:#ff4fa0"></div></div>`},
  solarwind:{label:'🟢 SOLAR WIND',color:'#aaff00',render:d=>`
    <div class="data-card-value" style="color:#aaff00">${d.speed}<span class="data-card-unit">km/s</span></div>
    <div class="data-card-sub">Density: ${d.density} p/cm³ · Pressure: ${d.pressure} nPa<br>${d.description}</div>
    <div class="data-bar"><div class="data-bar-fill" style="width:${Math.min(100,(d.speed/800)*100)}%;background:#aaff00"></div></div>`},
  volcanic:{label:'🌋 VOLCANIC',color:'#ff6d00',render:d=>d.error?'<div class=\"data-card-sub\" style=\"color:#ff6d00\">'+d.error+'</div>':`
    <div class="data-card-value" style="color:#ff6d00">${d.active}<span class="data-card-unit">active / ${d.total}</span></div>
    <div class="data-card-sub">High alert: ${d.highAlert} volcanoes<br>Most active: ${d.mostActive}<br>${d.source}</div>
    <div class="data-bar"><div class="data-bar-fill" style="width:${Math.min(100,(d.active/d.total)*100)}%;background:#ff6d00"></div></div>`},
  gravity:{label:'🔵 GRAVITY ANOMALY',color:'#40c8ff',render:d=>`
    <div class="data-card-value" style="color:#40c8ff">±${Math.max(Math.abs(d.maxPositive),Math.abs(d.maxNegative))}<span class="data-card-unit">${d.unit}</span></div>
    <div class="data-card-sub">Max positive: +${d.maxPositive} mGal<br>Max negative: ${d.maxNegative} mGal<br>${d.description}<br>${d.source}</div>`},
  geotherm:{label:'🔥 GEOTHERMAL HEAT',color:'#ff3d3d',render:d=>`
    <div class="data-card-value" style="color:#ff9900">${d.max}<span class="data-card-unit">${d.unit}</span></div>
    <div class="data-card-sub">Global avg: ${d.globalAvg} mW/m² · Min: ${d.min}<br>Hottest: ${d.hottest}<br>${d.source}</div>
    <div class="data-bar"><div class="data-bar-fill" style="width:${Math.min(100,(d.max/400)*100)}%;background:linear-gradient(90deg,#ff9900,#ff3d3d)"></div></div>`},
  wind:{label:'💨 WIND SPEED',color:'#00ff88',render:d=>d.error?'<div class=\"data-card-sub\" style=\"color:#ff6d00\">'+d.error+'</div>':`
    <div class="data-card-value" style="color:#00ff88">${d.avgSpeed}<span class="data-card-unit">${d.unit} avg</span></div>
    <div class="data-card-sub">Max: ${d.maxSpeed} m/s · ${d.points} points sampled</div>
    <div class="data-bar"><div class="data-bar-fill" style="width:${Math.min(100,d.avgSpeed*5)}%;background:#00ff88"></div></div>`},
  schumann:{label:'🟠 SCHUMANN RESONANCE',color:'#ff6d00',render:d=>`
    <div class="data-card-value" style="color:#ff6d00">${d.frequency}<span class="data-card-unit">${d.unit}</span></div>
    <div class="data-card-sub">Q-factor: ${d.q} · Solar mod: ${d.solarMod} Hz<br>Harmonics: ${d.harmonics}<br>Sources: ${d.sources}</div>
    <div class="data-bar"><div class="data-bar-fill" style="width:${((d.frequency-7.4)/1.2*100)}%;background:#ff6d00"></div></div>`},
  ionosphere:{label:'🩵 IONOSPHERIC TEC',color:'#00ffc8',render:d=>`
    <div class="data-card-value" style="color:#00ffc8">${d.peakTEC}<span class="data-card-unit">${d.unit}</span></div>
    <div class="data-card-sub">${d.description}<br>Sub-solar lat: ${d.subSolarLat}°<br>${d.stormEffect}</div>
    <div class="data-bar"><div class="data-bar-fill" style="width:${Math.min(100,(d.peakTEC/80)*100)}%;background:#00ffc8"></div></div>`},
  sst:{label:'🌊 SEA SURFACE TEMP',color:'#00b4d8',render:d=>d.error?'<div class=\"data-card-sub\" style=\"color:#ff6d00\">'+d.error+'</div>':`
    <div class="data-card-value" style="color:#00b4d8">${d.avgTemp}<span class="data-card-unit">°C avg</span></div>
    <div class="data-card-sub">Range: ${d.minTemp}°C → ${d.maxTemp}°C · ${d.points} points</div>
    <div class="legend-bar"><div style="flex:1;background:#0000ff"></div><div style="flex:1;background:#0060ff"></div><div style="flex:1;background:#00aaff"></div><div style="flex:1;background:#ffaa00"></div><div style="flex:1;background:#ff4400"></div></div>
    <div class="legend-labels"><span>Cold</span><span>Warm</span></div>`},
  magnetic:{label:'🔵 MAGNETIC FIELD',color:'#00e5ff',render:d=>`
    <div class="data-card-value" style="color:#00e5ff;font-size:14px">${d.model}</div>
    <div class="data-card-sub">N Pole: ${d.nPole}<br>S Pole: ${d.sPole}<br>SAA: ${d.saa}<br>Drift: ${d.drift}<br>Strength: ${d.fieldStrength}</div>`},
  tides:{label:'🌙 TIDAL FORCE',color:'#40c8ff',render:d=>`
    <div class="data-card-value" style="color:#40c8ff;font-size:16px">${d.phase}</div>
    <div class="data-card-sub">${d.description}<br>Seismic risk: ${d.seismicRisk}<br>Sub-lunar lon: ${d.moonLon}°</div>
    <div class="data-bar"><div class="data-bar-fill" style="width:${d.syzygy}%;background:linear-gradient(90deg,#40c8ff,#ffffff)"></div></div>`},
};

function renderDataCards() {
  const c=document.getElementById('data-cards');
  if(state.activeLayers.size===0){c.innerHTML='<div class="no-data">Activate a layer to see<br>live scientific readings</div>';return;}
  let html='';
  state.activeLayers.forEach(id=>{
    const cfg=cardConfigs[id]; const d=state.data[id];
    if(!cfg) return;
    html+=`<div class="data-card" style="border-left:2px solid ${cfg.color}22">
      <div class="data-card-label">${cfg.label}</div>
      ${d?cfg.render(d):'<div class="data-card-sub" style="color:var(--text-dim)">Loading...</div>'}
    </div>`;
  });
  c.innerHTML=html;
}

// ════════════════════════════════════════════════════════
// CORRELATION NOTES — show which layers are active per cluster
// ════════════════════════════════════════════════════════
const corrClusters = {
  'cn-ocean-climate': ['sst','wind','solar','ionosphere'],
  'cn-em-cavity':     ['schumann','geomagnetic','ionosphere','solarwind'],
  'cn-core-litho':    ['geotherm','gravity','magnetic','seismic','volcanic'],
  'cn-cr-cloud':      ['cosmic','sst','solar'],
  'cn-tidal-seismic': ['tides','seismic','volcanic'],
  'cn-proton-seismic':['geomagnetic','seismic','solarwind'],
  'cn-geo-storm-eq':  ['geomagnetic','seismic','cosmic'],
  'cn-jerk-seismic':  ['magnetic','seismic','geomagnetic'],
  'cn-lod-seismic':   ['tides','seismic','volcanic'],
  'cn-laic':          ['cosmic','ionosphere','seismic'],
  'cn-solar-volc':    ['solar','volcanic','geomagnetic'],
  'cn-core-em':       ['geomagnetic','magnetic','schumann'],
  'cn-sst-fault':     ['sst','seismic','geotherm'],
  'cn-muon-fault':    ['cosmic','seismic','geomagnetic'],
  'cn-llsvp':         ['gravity','magnetic','geotherm'],
};

function updateCorrelationNotes() {
  Object.entries(corrClusters).forEach(([noteId, layers]) => {
    const el = document.getElementById(noteId);
    if (!el) return;
    const active = layers.filter(l => state.activeLayers.has(l));
    if (active.length === 0) { el.textContent = ''; return; }
    if (active.length === layers.length) {
      el.textContent = '✓ All layers active — full cluster visualised';
      el.style.color = 'var(--c-green)';
    } else {
      el.textContent = `${active.length}/${layers.length} layers active — enable more to complete cluster`;
      el.style.color = 'var(--c-cyan)';
    }
  });
  // Also highlight cards whose layers are fully active
  document.querySelectorAll('.corr-card[data-layers]').forEach(card => {
    const layers = card.dataset.layers.split(',');
    const allActive = layers.every(l => state.activeLayers.has(l));
    card.style.borderColor = allActive ? 'rgba(0,255,136,.35)' : '';
    card.style.background = allActive ? 'rgba(0,255,136,.04)' : '';
  });
}

function filterCorr(type) {
  // Update button styles
  ['all','strong','hidden'].forEach(t => {
    const el = document.getElementById('cf-'+t);
    if (!el) return;
    el.style.borderColor = t===type ? 'var(--c-cyan)' : 'var(--border)';
    el.style.color = t===type ? 'var(--c-cyan)' : 'var(--text-dim)';
  });
  document.querySelectorAll('.corr-card').forEach(card => {
    if (type === 'all') card.classList.remove('corr-hidden');
    else if (type === 'strong') card.classList.toggle('corr-hidden', card.dataset.tier === 'hidden');
    else if (type === 'hidden') card.classList.toggle('corr-hidden', card.dataset.tier !== 'hidden');
  });
}

// ════════════════════════════════════════════════════════
// REFRESH
// ════════════════════════════════════════════════════════
async function refreshAllData() {
  const active=[...state.activeLayers];
  active.forEach(id=>{removeMapLayer(id);state.activeLayers.delete(id);});
  for(const id of active){state.activeLayers.add(id);await loadLayer(id);}
  renderDataCards(); updateCorrelationNotes();
}

// ════════════════════════════════════════════════════════
// SYNTHESIS ENGINE
// ════════════════════════════════════════════════════════
let currentPeriod = '1m';

const PERIOD_META = {
  '1m': {
    label: '1-Month Window',
    desc: 'Short-term dynamics: tidal cycles (2× new+full moon), Carrington solar rotation (27 days), weather patterns. Best for: seismic-tidal coupling, Schumann modulation, ionospheric TEC diurnal cycles.',
    solarCycles: 0.003, tidalCycles: 2, weatherCycles: 4
  },
  '1y': {
    label: '1-Year Window',
    desc: 'Annual cycles: seasonal solar irradiance shift (±23.5° declination), SST annual cycle, monsoon-driven ionospheric variation, annual seismicity distribution, volcanic degassing seasonal patterns.',
    solarCycles: 0.09, tidalCycles: 13, weatherCycles: 52
  },
  '5y': {
    label: '5-Year Window',
    desc: 'Medium-term: half solar cycle, ENSO cycle (2–7 yr), LOD multi-year oscillation, geomagnetic secular variation accumulation. Multiple complete Carrington rotation sequences (~67 rotations).',
    solarCycles: 0.45, tidalCycles: 65, weatherCycles: 260
  },
  '11y': {
    label: '11-Year Solar Cycle (Schwabe Cycle)',
    desc: 'Full solar cycle: solar max → min → max. Cosmic ray flux inverts with solar activity. Cloud cover correlates inversely. Global temperature signal ~0.1°C. Seismicity statistics span one complete cycle.',
    solarCycles: 1, tidalCycles: 143, weatherCycles: 572
  },
  'yoy': {
    label: 'Year-over-Year Differential',
    desc: 'Anomaly detection mode: compares current conditions against 12-month prior baseline. Reveals departures from annual norms — useful for detecting trend shifts in SST, seismicity rates, and ionospheric TEC.',
    solarCycles: 0, tidalCycles: 0, weatherCycles: 0
  },
  '27y': {
    label: '27-Year Grand Cycle (Gleissberg-adjacent)',
    desc: 'Multi-decadal: ~2.5 complete solar cycles. Covers one full LOD oscillation (~26–32 yr), long-period geomagnetic secular variation, volcanic frequency grand patterns, and possible planetary forcing (Saturn ~29.5 yr).',
    solarCycles: 2.5, tidalCycles: 351, weatherCycles: 1404
  }
};

function setPeriod(p) {
  currentPeriod = p;
  document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('pb-' + p);
  if (btn) btn.classList.add('active');
  const meta = PERIOD_META[p];
  document.getElementById('period-desc').textContent = meta.desc;
  renderSynthesis();
}

// ── COMPUTE SYSTEM STATE ────────────────────────────────
function getSystemState() {
  const kp   = getCurrentKpRaw();
  const carr = getCarrington();
  const doy  = getDOY();
  const decl = getSolarDeclination();
  const luna = getLunarPhase();
  const sfi  = _f107Current !== null ? Math.round(_f107Current) : Math.round(120 + 30 * Math.sin(2*Math.PI*doy/365));
  const crFlux = Math.round(1820 - carr*120 - kp*8);
  const syzygy = Math.abs(Math.cos(luna*2*Math.PI));
  const swSpeed = Math.round(370 + carr*130);
  const tecPeak = Math.round(30 + kp*5 + Math.cos(decl*Math.PI/45)*10);
  const schFreq  = parseFloat((7.83 + carr*0.35).toFixed(2));
  const season = doy < 80 ? 'Late Winter' : doy < 172 ? 'Spring' : doy < 264 ? 'Summer' : doy < 355 ? 'Autumn' : 'Winter';
  const hemisphere = decl > 0 ? 'N hemisphere summer tilt' : 'S hemisphere summer tilt';
  const moonName = luna < 0.05 ? 'New Moon' : luna < 0.3 ? 'Waxing Crescent' : luna < 0.55 ? 'Full Moon' : luna < 0.75 ? 'Waning Gibbous' : 'Waning Crescent';

  return { kp, carr, doy, decl, luna, sfi, crFlux, syzygy, swSpeed, tecPeak, schFreq,
           season, hemisphere, moonName, kpDesc: kp<2?'Quiet':kp<4?'Unsettled':kp<6?'Active':'Storm' };
}

// ── GENERATE INSIGHTS per period ───────────────────────
function getInsights(s, period) {
  const insights = [];
  const kp = s.kp; const carr = s.carr; const doy = s.doy;
  const decl = s.decl; const syzygy = s.syzygy; const crFlux = s.crFlux;
  const swSpeed = s.swSpeed; const tecPeak = s.tecPeak; const sfi = s.sfi;

  // ── SPACE WEATHER ─────────────────────────────────────
  if (['1m','1y','11y','27y'].includes(period)) {
    const actLevel = sfi > 140 ? 'elevated' : sfi > 110 ? 'moderate' : 'low';
    const phase = carr > 0 ? 'ascending' : 'descending';
    const stormNote = sfi > 130
      ? 'Elevated SFI correlates with higher geomagnetic storm probability over the next 27 days.'
      : 'Quiet solar conditions reduce storm-driven ionospheric disruption.';
    insights.push({
      domain: 'space', color: '#aaff00', title: 'Solar Activity Phase',
      confidence: 'high',
      body: 'Solar flux index ' + sfi + ' SFU places the Sun in ' + actLevel + ' activity. Carrington phase ' + phase + ' — solar wind speed ~' + swSpeed + ' km/s. ' + stormNote,
      periods: ['1m','1y','11y','27y']
    });
  }

  if (['1m','1y','5y','11y'].includes(period)) {
    const stormBody = kp > 4
      ? 'Active storm conditions: expect ionospheric TEC enhancement +' + Math.round((kp-4)*5) + ' TECU, Schumann frequency shift +' + (carr*0.3).toFixed(2) + ' Hz, and 27-day lagged seismicity elevation per Urata et al. 2018.'
      : 'Quiet geomagnetic field — background Schumann resonance stable near 7.83 Hz.';
    insights.push({
      domain: 'space', color: '#b84fff', title: 'Geomagnetic Conditions',
      confidence: 'high',
      body: 'Kp ' + kp.toFixed(1) + ' (' + s.kpDesc + '). Aurora visible from >=' + (90-kp*3.5).toFixed(0) + ' latitude. ' + stormBody,
      periods: ['1m','1y','5y','11y']
    });
  }

  if (['1y','5y','11y','27y'].includes(period)) {
    const fluxState = crFlux > 1780 ? 'elevated — solar minimum' : crFlux > 1700 ? 'moderate' : 'suppressed — solar maximum';
    const crNote = crFlux > 1750
      ? 'Elevated GCR increases tropospheric ion nucleation — probable 2-4% cloud cover enhancement (Svensmark mechanism). Expect modest global albedo increase and slight SST cooling signal over 1-year window.'
      : 'Suppressed GCR under solar maximum reduces cloud nucleation — consistent with warming SST anomalies.';
    insights.push({
      domain: 'space', color: '#ff4fa0', title: 'Cosmic Ray Flux',
      confidence: 'med',
      body: 'GCR flux ~' + crFlux + ' cpm (' + fluxState + '). ' + crNote,
      periods: ['1y','5y','11y','27y']
    });
  }

  // ── SEISMIC / TIDAL ────────────────────────────────────
  if (['1m','1y','5y'].includes(period)) {
    const tidalConf = syzygy > 0.7 ? 'med' : 'low';
    const tidalBody = s.moonName + ' — syzygy index ' + (syzygy*100).toFixed(0) + '%. ' +
      (syzygy > 0.75
        ? 'Near-syzygy conditions: tidal stress enhancement on fault systems. Cochran et al. (2004) found statistically significant M>=5 rate increase during lunar extremes. Elevated watch window for shallow oceanic thrust faults.'
        : 'Inter-syzygy period: background tidal stress, no statistical seismic elevation expected.');
    insights.push({
      domain: 'seismic', color: '#ff3d3d', title: 'Tidal Seismic Window',
      confidence: tidalConf,
      body: tidalBody,
      periods: ['1m','1y','5y']
    });
  }

  if (['5y','11y','27y','yoy'].includes(period)) {
    const lodTrend = doy > 182 ? 'post-aphelion deceleration phase' : 'pre-perihelion acceleration phase';
    const lodWindow = period === '27y' ? 'the 27-year window, one full LOD oscillation is captured'
      : period === '5y' ? '5-year window, mid-cycle LOD position visible'
      : 'current window, monitor LOD anomalies for precursor signal';
    insights.push({
      domain: 'seismic', color: '#ff6d00', title: 'LOD-Seismicity Phase',
      confidence: 'med',
      body: 'Based on Bendick & Bilham (2017), periods of Earth rotation slowdown correlate with M7+ seismicity surges with ~5-year predictive window. Current LOD trend: ' + lodTrend + '. Under ' + lodWindow + '.',
      periods: ['5y','11y','27y','yoy']
    });
  }

  if (['5y','11y','27y'].includes(period)) {
    const jerkWindow = (period === '5y' || period === '11y')
      ? 'Within this window, 1-3 jerks are statistically expected. Each historically coincides with global seismic swarm episodes (Florindo & Alfonsi 1995).'
      : 'No jerk predictable on 1-month timescale — secular variation accumulates over years.';
    insights.push({
      domain: 'seismic', color: '#ffd600', title: 'Geomagnetic Jerk Risk',
      confidence: 'low',
      body: 'Core torsional oscillations produce geomagnetic jerks every ~3-10 years. Last major jerk ~2017. ' + jerkWindow,
      periods: ['5y','11y','27y']
    });
  }

  // ── ATMOSPHERE / IONOSPHERE ────────────────────────────
  if (['1m','1y','5y'].includes(period)) {
    const stormTEC = kp > 4 ? 'Storm-time TEC enhancement active — GPS positioning errors of 5-15m possible in polar regions.' : 'Quiet ionosphere — dayside TEC follows standard diurnal pattern peaking ~14:00 LT.';
    const laicNote = 'LAIC pre-seismic TEC anomalies (Pulinets & Ouzounov 2011) would appear as local +/-5 TECU departures from this baseline.';
    insights.push({
      domain: 'atmos', color: '#00ffc8', title: 'Ionospheric TEC State',
      confidence: 'high',
      body: 'Peak TEC ~' + tecPeak + ' TECU. Sub-solar point at ' + decl.toFixed(1) + ' (' + s.hemisphere + '). ' + stormTEC + ' ' + laicNote,
      periods: ['1m','1y','5y']
    });
  }

  if (['1m','1y','5y','11y'].includes(period)) {
    const schFreq = (7.83 + carr*0.35).toFixed(2);
    const schStorm = kp > 4 ? 'Active geomagnetic conditions raise ionospheric conductivity -> cavity compression -> slight frequency increase.' : 'Stable cavity dimensions.';
    const schSeason = period === '1y' ? ' Annual cycle: frequency peaks ~0.1 Hz higher in northern summer (expanded convection).' : '';
    insights.push({
      domain: 'atmos', color: '#ff6d00', title: 'Schumann Resonance',
      confidence: 'high',
      body: 'Fundamental frequency ' + schFreq + ' Hz (baseline 7.83 Hz, solar modulation ' + (carr >= 0 ? '+' : '') + (carr*0.35).toFixed(2) + ' Hz). ' + schStorm + ' Three global lightning hotspots (Congo, Venezuela, SE Asia) drive ~2000 storms/day maintaining resonance.' + schSeason,
      periods: ['1m','1y','5y','11y']
    });
  }

  // ── DEEP EARTH ─────────────────────────────────────────
  if (['5y','11y','27y'].includes(period)) {
    insights.push({
      domain: 'core', color: '#40c8ff', title: 'Core-Mantle Boundary Activity',
      confidence: 'low',
      body: 'Two LLSVP superplumes (Pacific and African) at core-mantle boundary control long-wavelength gravity anomalies, heat flux patterns, and the geometry of the magnetic field. On ' + period + ' timescale, secular variation of the magnetic field reflects fluid motion in the outer core. Gravity anomaly patterns remain quasi-static but GRACE detects 1-2 mGal/yr changes near melting ice sheets and active subduction zones.',
      periods: ['5y','11y','27y']
    });
  }

  if (['1y','5y','11y','27y'].includes(period)) {
    const heatWindow = period === '1y' ? '1-year' : period === '5y' ? '5-year' : 'multi-year';
    insights.push({
      domain: 'core', color: '#ff9900', title: 'Geothermal Flux Trends',
      confidence: 'med',
      body: 'Global average heat flux ~87 mW/m2. Hotspot regions (Iceland, Hawaii, E. Africa Rift) show episodic flux spikes preceding volcanic unrest by months. On ' + heatWindow + ' timescale: geothermal flux anomalies propagate upward through the crust at ~km/yr rates, meaning mantle thermal pulses detectable at surface reflect events years to decades old.',
      periods: ['1y','5y','11y','27y']
    });
  }

  if (['27y'].includes(period)) {
    const solarPhase = doy > 180 ? 'post-maximum' : 'ascending';
    insights.push({
      domain: 'space', color: '#aaff00', title: 'Solar Grand Cycle Context',
      confidence: 'low',
      body: 'The 27-year window captures ~2.5 full 11-year Schwabe cycles. Zharkova et al. (2023) identified a 350-year grand solar minimum cycle. Current position: ' + solarPhase + ' phase of Cycle 25. Over 27 years: expect 2-3 solar maxima, corresponding GCR minima, probable volcanic eruption frequency correlation (r=0.84 per Zharkova), and multi-decade SST modulation of ~0.2C amplitude.',
      periods: ['27y']
    });
  }

  if (['yoy'].includes(period)) {
    const yoyPhase = carr > 0 ? 'ascending' : 'descending';
    insights.push({
      domain: 'anomaly', color: '#ff4fa0', title: 'Year-over-Year Anomaly Detection',
      confidence: 'med',
      body: 'YoY mode isolates departures from 12-month prior baseline. Key signals to watch: SST anomalies >0.5C (ENSO transition signal), seismicity rate change >15% in a fault zone (stress accumulation), ionospheric TEC deviation >8 TECU from annual mean (space weather shift), Schumann frequency drift >0.05 Hz/yr (ionospheric height change). Current solar phase ' + yoyPhase + ' — expect YoY GCR flux change of ~5% if solar cycle progressing normally.',
      periods: ['yoy']
    });
  }

  return insights.filter(i => i.periods.includes(period));
}

// ── CROSS-LAYER SIGNALS ─────────────────────────────────
function getCrossSignals(s, activeLayers, period) {
  var signals = [];
  function has(l) { return activeLayers.has(l); }

  if (has('geomagnetic') && has('seismic')) {
    var lagDate = new Date(Date.now()+27*86400000).toDateString();
    var kpDesc2 = s.kp > 4
      ? 'Storm conditions active — Urata et al. predicts M>=7.5 probability elevation in 27-28 days. Mark calendar: ' + lagDate + '.'
      : 'Quiet conditions — no storm-lag seismic signal expected.';
    signals.push({ pair:'Geomagnetic Kp -> Seismic (27-day lag)', desc:'Current Kp ' + s.kp.toFixed(1) + '. ' + kpDesc2, confidence:'med' });
  }
  if (has('tides') && has('seismic')) {
    var tidalConf2 = s.syzygy > 0.7 ? 'med' : 'low';
    var tidalDesc = s.moonName + ' (syzygy ' + (s.syzygy*100).toFixed(0) + '%). ' + (s.syzygy > 0.7 ? 'Near-syzygy: tidal loading adds ~0.001-0.01 MPa to shallow fault systems. Cochran et al. found 2-3x background M>=5 rate during this window.' : 'Low tidal coupling — inter-syzygy trough.');
    signals.push({ pair:'Tidal Phase -> Fault Stress', desc:tidalDesc, confidence:tidalConf2 });
  }
  if (has('cosmic') && has('ionosphere')) {
    var ionRate = s.crFlux > 1750 ? 'elevated' : 'normal';
    signals.push({ pair:'Cosmic Ray Flux -> Ionospheric TEC', desc:'GCR ' + s.crFlux + ' cpm -> boundary layer ionisation rate ' + ionRate + '. Elevated GCR enhances ion pair production at 10-15 km altitude. Effect on TEC: ~1-2 TECU at polar latitudes.', confidence:'med' });
  }
  if (has('solar') && has('sst')) {
    var hemiDir = s.decl > 0 ? 'N hemisphere' : 'S hemisphere';
    var lagNote = period === '1y' ? 'Annual SST cycle should track insolation with this lag.' : period === '11y' ? '11-yr solar cycle drives ~0.1C SST amplitude.' : '';
    signals.push({ pair:'Solar Irradiance -> SST', desc:'SFI ' + s.sfi + ' SFU. Solar declination ' + s.decl.toFixed(1) + '° — ' + hemiDir + ' receives peak insolation. SST response lags solar forcing by ~1-3 months due to ocean thermal inertia. ' + lagNote, confidence:'high' });
  }
  if (has('geomagnetic') && has('schumann') && has('ionosphere')) {
    var cavState = s.kp > 4 ? 'compressed' : 'nominal';
    var emActive = s.kp > 4 ? 'Storm-time EM cascade fully active — the cavity, its resonances, and the ionosphere are all responding to the same solar wind driver.' : 'Quiet-time baseline — monitoring for coupling signature.';
    signals.push({ pair:'Kp -> Schumann -> TEC (full EM chain)', desc:'All three EM layers active. Current chain: Kp ' + s.kp.toFixed(1) + ' -> ionospheric height ' + cavState + ' -> Schumann ' + s.schFreq + ' Hz -> TEC ' + s.tecPeak + ' TECU. ' + emActive, confidence:'high' });
  }
  if (has('gravity') && has('geotherm') && has('magnetic')) {
    signals.push({ pair:'LLSVP Superplume Signature', desc:'Gravity + Geothermal + Magnetic all active. The two antipodal LLSVPs are simultaneously visible: Pacific LLSVP (negative gravity, high heat flow near Hawaii/Samoa) and African LLSVP (E. Africa Rift geothermal anomaly, S. Atlantic magnetic weakness).', confidence:'high' });
  }
  if (has('seismic') && has('volcanic') && has('geotherm')) {
    signals.push({ pair:'Ring of Fire Thermal-Seismic Chain', desc:'Seismic + Volcanic + Geothermal co-active. The Pacific Ring of Fire hosts 75% of active volcanoes and 90% of M8+ earthquakes simultaneously visible. Geothermal anomalies in subduction zones reflect slab dehydration driving both seismicity and arc volcanism.', confidence:'high' });
  }
  if (has('cosmic') && has('sst') && has('solar')) {
    var solarDir = s.sfi > 130 ? 'High solar activity suppresses GCR -> less cloud nucleation -> lower albedo -> SST warming tendency.' : 'Lower solar activity allows more GCR -> enhanced cloud nucleation -> cooling tendency.';
    signals.push({ pair:'Svensmark Chain: Solar -> GCR -> Cloud -> SST', desc:'Full Svensmark chain visible. SFI ' + s.sfi + ': ' + solarDir + ' CERN CLOUD experiment confirmed aerosol formation from ions at atmospherically relevant rates (2011-2023).', confidence:'med' });
  }
  if (signals.length === 0) {
    return '<div class="no-synth">Enable 2+ layers to see cross-layer signal analysis</div>';
  }
  return signals.map(function(sig) {
    var confClass = sig.confidence === 'high' ? 'conf-high' : sig.confidence === 'med' ? 'conf-med' : 'conf-low';
    var confLabel = sig.confidence === 'high' ? 'ESTABLISHED' : sig.confidence === 'med' ? 'MODERATE EVIDENCE' : 'SPECULATIVE';
    return '<div class="signal-card"><div class="signal-pair">' + sig.pair.replace('->','<span class="signal-arrow">→</span>') + '</div><div class="signal-desc">' + sig.desc + '</div><div style="margin-top:5px;"><span class="insight-confidence ' + confClass + '">' + confLabel + '</span></div></div>';
  }).join('');
}

// ── STATE CARDS ─────────────────────────────────────────
function getStateCards(s) {
  var cards = [];

  var kpColor = s.kp<2 ? '#00ff88' : s.kp<4 ? '#ffd600' : s.kp<6 ? '#ff6d00' : '#ff3d3d';
  cards.push({domain:'Space Weather', status:s.kpDesc, statusColor:kpColor,
    body:'Kp ' + s.kp.toFixed(1) + ' · SFI ' + s.sfi + ' SFU · SW ' + s.swSpeed + ' km/s · GCR ' + Math.round(1820-s.carr*120) + ' cpm'});

  var syzStatus = s.syzygy>0.75 ? 'Watch Window' : s.syzygy>0.4 ? 'Moderate' : 'Background';
  var syzColor  = s.syzygy>0.75 ? '#ff6d00' : s.syzygy>0.4 ? '#ffd600' : '#00ff88';
  var syzCouple = s.syzygy>0.75 ? 'elevated' : 'normal';
  cards.push({domain:'Seismic / Tidal', status:syzStatus, statusColor:syzColor,
    body:s.moonName + ' · Syzygy ' + (s.syzygy*100).toFixed(0) + '% · Tidal coupling ' + syzCouple});

  var emStatus = s.kp>4 ? 'Storm-Enhanced' : 'Nominal';
  var emColor  = s.kp>4 ? '#ff6d00' : '#00ff88';
  cards.push({domain:'Atmosphere / EM', status:emStatus, statusColor:emColor,
    body:'TEC ' + s.tecPeak + ' TECU · Schumann ' + s.schFreq + ' Hz · ' + s.season + ' (' + s.hemisphere + ')'});

  cards.push({domain:'Deep Earth', status:'Monitoring', statusColor:'#40c8ff',
    body:'LLSVP stable · Magnetic drift ~50 km/yr · SAA expanding ~0.3°/yr'});

  return cards.map(function(c) {
    return '<div class="state-card"><div class="state-card-header"><span class="state-card-domain">' + c.domain + '</span><span class="state-card-status" style="color:' + c.statusColor + '">' + c.status + '</span></div><div class="state-card-body">' + c.body + '</div></div>';
  }).join('');
}

// ── MAIN RENDER ─────────────────────────────────────────
function renderSynthesis() {
  const s = getSystemState();
  const period = currentPeriod;
  const meta = PERIOD_META[period];

  // Period description
  const descEl = document.getElementById('period-desc');
  if (descEl) descEl.textContent = meta.desc;

  // System state
  const stateEl = document.getElementById('system-state-cards');
  if (stateEl) stateEl.innerHTML = getStateCards(s);

  // Insights
  const insightsEl = document.getElementById('synthesis-insights');
  if (insightsEl) {
    const insights = getInsights(s, period);
    if (insights.length === 0) {
      insightsEl.innerHTML = '<div class="no-synth">No insights defined for this period yet.</div>';
    } else {
      insightsEl.innerHTML = insights.map((ins, i) => `
        <div class="insight-card" style="border-left-color:${ins.color}">
          <div class="insight-num" style="color:${ins.color}">${String(i+1).padStart(2,'0')}</div>
          <div class="insight-title">${ins.title}</div>
          <div class="insight-body">${ins.body}</div>
          <div><span class="insight-confidence conf-${ins.confidence === 'high' ? 'high' : ins.confidence === 'med' ? 'med' : 'low'}">${ins.confidence === 'high' ? '● WELL ESTABLISHED' : ins.confidence === 'med' ? '◑ MODERATE EVIDENCE' : '○ SPECULATIVE'}</span></div>
        </div>`).join('');
    }
  }

  // Cross-layer signals
  const signalsEl = document.getElementById('cross-signals');
  if (signalsEl) signalsEl.innerHTML = getCrossSignals(s, state.activeLayers, period);
}


// ════════════════════════════════════════════════════════
// PHASE 3: CHARTS ENGINE
// Time-series sparklines, correlation matrix, anomaly detection
// ════════════════════════════════════════════════════════

// ── CHART TAB SWITCHER ──────────────────────────────────
function switchChartTab(tab) {
  ['series','matrix','anomaly','export'].forEach(t => {
    const panel = document.getElementById('csp-' + t);
    const btn   = document.getElementById('cst-' + t);
    if (panel) panel.classList.toggle('active', t === tab);
    if (btn)   btn.classList.toggle('active', t === tab);
  });
  if (tab === 'matrix')  requestAnimationFrame(renderCorrMatrix);
  if (tab === 'anomaly') renderAnomalyFeed();
}

// ── LAYER METADATA: colors, units, value extractor ──────
const LAYER_META = {
  seismic:    { label:'Seismic Events',    color:'#ff3d3d', unit:'events',
    getValue: (function() { return (state.data.seismic ? state.data.seismic.count : null); }),
    min:0, max:40 },
  solar:      { label:'Solar Irradiance',  color:'#ffd600', unit:'kWh/m²',
    getValue: (function() { var d=state.data.solar; return d ? parseFloat(d.irradiance)||null : null; }),
    min:2, max:8 },
  geomagnetic:{ label:'Kp Index',          color:'#b84fff', unit:'Kp',
    getValue: (function() { var d=state.data.geomagnetic; return d ? parseFloat(d.kp)||null : null; }),
    min:0, max:9 },
  cosmic:     { label:'Cosmic Ray Flux',   color:'#ff4fa0', unit:'cpm',
    getValue: (function() { return (state.data.cosmic ? state.data.cosmic.flux : null); }),
    min:1400, max:2000 },
  solarwind:  { label:'Solar Wind',        color:'#aaff00', unit:'km/s',
    getValue: (function() { return (state.data.solarwind ? state.data.solarwind.speed : null); }),
    min:300, max:800 },
  volcanic:   { label:'Volcanic Alerts',   color:'#ff6d00', unit:'sites',
    getValue: (function() { return (state.data.volcanic ? state.data.volcanic.active : null); }),
    min:0, max:17 },
  gravity:    { label:'Gravity Max',       color:'#40c8ff', unit:'mGal',
    getValue: (function() { var d=state.data.gravity; return d ? parseFloat(d.maxPositive)||null : null; }),
    min:0, max:160 },
  geotherm:   { label:'Heat Flow Max',     color:'#ff9900', unit:'mW/m²',
    getValue: (function() { return (state.data.geotherm ? state.data.geotherm.max : null); }),
    min:35, max:400 },
  wind:       { label:'Wind Speed',        color:'#00ff88', unit:'m/s',
    getValue: (function() { var d=state.data.wind; return d ? parseFloat(d.avgSpeed)||null : null; }),
    min:0, max:25 },
  schumann:   { label:'Schumann Freq',     color:'#ff6d00', unit:'Hz',
    getValue: (function() { return (state.data.schumann ? state.data.schumann.frequency : null); }),
    min:7.4, max:8.4 },
  ionosphere: { label:'Ionospheric TEC',   color:'#00ffc8', unit:'TECU',
    getValue: (function() { return (state.data.ionosphere ? state.data.ionosphere.peakTEC : null); }),
    min:5, max:80 },
  sst:        { label:'Sea Surface Temp',  color:'#00b4d8', unit:'°C',
    getValue: (function() { var d=state.data.sst; return d ? parseFloat(d.avgTemp)||null : null; }),
    min:-5, max:30 },
  magnetic:   { label:'Mag Perturbation',  color:'#00e5ff', unit:'nT',
    getValue: function() { return Math.round(50000 - getCurrentKpRaw()*800); },
    min:42000, max:51000 },
  tides:      { label:'Tidal Syzygy',      color:'#40c8ff', unit:'%',
    getValue: (function() { var d=state.data.tides; return d ? parseFloat(d.syzygy)||null : null; }),
    min:0, max:100 },
};

// ── TIME SERIES DATA STORE ───────────────────────────────
// Ring buffer: 60 points per layer, one per 30 seconds of open time
const SERIES_LEN = 60;
const timeSeriesData = {};  // layerId → Float32Array of length SERIES_LEN
const timeSeriesHead = {};  // layerId → current write index
const timeSeriesCount= {};  // layerId → how many points filled

function initSeries(layerId) {
  if (!timeSeriesData[layerId]) {
    timeSeriesData[layerId]  = new Float32Array(SERIES_LEN).fill(NaN);
    timeSeriesHead[layerId]  = 0;
    timeSeriesCount[layerId] = 0;
  }
}

function pushSeriesPoint(layerId) {
  const meta = LAYER_META[layerId];
  if (!meta) return;
  const val = meta.getValue();
  if (val === null || isNaN(val)) return;
  initSeries(layerId);
  const i = timeSeriesHead[layerId];
  timeSeriesData[layerId][i] = val;
  timeSeriesHead[layerId]    = (i + 1) % SERIES_LEN;
  timeSeriesCount[layerId]   = Math.min(timeSeriesCount[layerId] + 1, SERIES_LEN);
}

// Push a point for every active layer every 8 seconds
setInterval(() => {
  state.activeLayers.forEach(id => pushSeriesPoint(id));
  // only auto-update charts if History tab is open AND in charts view
  var _histPanel = document.getElementById('rpanel-hist');
  if (_histPanel && _histPanel.classList.contains('active') && _dockOpen && _dockOpen.charts) {
    const activeCsub = (document.querySelector('.csub-tab.active') ? document.querySelector('.csub-tab.active').id : null);
    if (activeCsub === 'cst-series') renderSparklines();
    else if (activeCsub === 'cst-anomaly') renderAnomalyFeed();
  }
}, 8000);

// ── SPARKLINE RENDERER ───────────────────────────────────
function getSeriesOrdered(layerId) {
  if (!timeSeriesData[layerId]) return [];
  const arr  = timeSeriesData[layerId];
  const head = timeSeriesHead[layerId];
  const len  = SERIES_LEN;
  const out  = [];
  for (let i = 0; i < len; i++) {
    const v = arr[(head + i) % len];
    if (!isNaN(v)) out.push(v);
  }
  return out;
}

function drawSparkline(canvas, data, color, minVal, maxVal) {
  const W = canvas.offsetWidth || 262;
  const H = 52;
  canvas.width  = W * window.devicePixelRatio;
  canvas.height = H * window.devicePixelRatio;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  ctx.clearRect(0, 0, W, H);

  if (data.length < 2) {
    // Draw placeholder dash
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(0, H / 2);
    ctx.lineTo(W, H / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = '9px Space Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Collecting data...', W / 2, H / 2 + 4);
    return;
  }

  const dMin = Math.min(...data);
  const dMax = Math.max(...data);
  const range = dMax - dMin || 1;
  const pad = 6;

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 0.5;
  [0.25, 0.5, 0.75].forEach(f => {
    const y = pad + (1 - f) * (H - pad * 2);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  });

  // Mean line
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const meanY = pad + (1 - (mean - dMin) / range) * (H - pad * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.setLineDash([3, 5]);
  ctx.beginPath(); ctx.moveTo(0, meanY); ctx.lineTo(W, meanY); ctx.stroke();
  ctx.setLineDash([]);

  // Gradient fill under the line
  const grad = ctx.createLinearGradient(0, pad, 0, H);
  grad.addColorStop(0, color + '55');
  grad.addColorStop(1, color + '00');
  ctx.fillStyle = grad;

  const xStep = W / (data.length - 1);
  ctx.beginPath();
  data.forEach((v, i) => {
    const x = i * xStep;
    const y = pad + (1 - (v - dMin) / range) * (H - pad * 2);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.lineTo((data.length - 1) * xStep, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  // Line
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  data.forEach((v, i) => {
    const x = i * xStep;
    const y = pad + (1 - (v - dMin) / range) * (H - pad * 2);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Latest dot
  const lastV = data[data.length - 1];
  const lastX = (data.length - 1) * xStep;
  const lastY = pad + (1 - (lastV - dMin) / range) * (H - pad * 2);
  ctx.beginPath();
  ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#020810';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Axis labels
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.font = '7px Space Mono, monospace';
  ctx.textAlign = 'right';
  ctx.fillText(dMax.toFixed(1), W - 2, pad + 7);
  ctx.fillText(dMin.toFixed(1), W - 2, H - 2);
}

function getAnomalyLevel(data) {
  if (data.length < 4) return 'norm';
  const n = data.length - 1;
  const mu = data.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const sigma = Math.sqrt(data.slice(0, n).reduce((s, v) => s + (v - mu) ** 2, 0) / Math.max(n - 1, 1));
  if (sigma < 1e-10) return 'norm';  // constant series — no anomaly
  const last = data[data.length - 1];
  const z = (last - mu) / sigma;
  if (z > 1.8)  return 'high';
  if (z < -1.8) return 'low';
  return 'norm';
}

function renderSparklines() {
  const container = document.getElementById('sparklines-container');
  if (!container) return;
  const active = [...state.activeLayers];
  if (active.length === 0) {
    container.innerHTML = '<div class="no-charts">Activate layers to see<br>live time-series plots</div>';
    return;
  }

  // Re-use existing canvases if IDs match (avoid flicker)
  const existing = {};
  container.querySelectorAll('[data-spark-layer]').forEach(el => {
    existing[el.dataset.sparkLayer] = el;
  });

  const newActive = active.filter(id => !existing[id]);
  const toRemove  = Object.keys(existing).filter(id => !state.activeLayers.has(id));
  toRemove.forEach(id => existing[id].remove());

  // Add new sections
  newActive.forEach(id => {
    const meta = LAYER_META[id];
    if (!meta) return;
    const div = document.createElement('div');
    div.className = 'chart-section';
    div.dataset.sparkLayer = id;
    div.innerHTML = `
      <div class="chart-header">
        <span class="chart-label" style="color:${meta.color}">${meta.label}</span>
        <span id="spark-live-${id}" class="chart-value-live" style="color:${meta.color}">—</span>
      </div>
      <canvas class="sparkline" id="canvas-${id}"></canvas>
      <div class="chart-stat-row">
        <span id="spark-min-${id}">min —</span>
        <span id="spark-mean-${id}">avg —</span>
        <span id="spark-max-${id}">max —</span>
        <span id="spark-anom-${id}"></span>
      </div>`;
    container.appendChild(div);
  });

  // Draw all active sparklines
  active.forEach(id => {
    const meta = LAYER_META[id];
    if (!meta) return;
    pushSeriesPoint(id);
    const data = getSeriesOrdered(id);
    const canvas = document.getElementById('canvas-' + id);
    if (canvas) drawSparkline(canvas, data, meta.color, meta.min, meta.max);

    const liveEl = document.getElementById('spark-live-' + id);
    const minEl  = document.getElementById('spark-min-' + id);
    const meanEl = document.getElementById('spark-mean-' + id);
    const maxEl  = document.getElementById('spark-max-' + id);
    const anomEl = document.getElementById('spark-anom-' + id);

    if (data.length > 0) {
      const cur  = data[data.length - 1];
      const mn   = Math.min(...data);
      const mx   = Math.max(...data);
      const avg  = data.reduce((a, b) => a + b, 0) / data.length;
      const anom = getAnomalyLevel(data);
      if (liveEl)  liveEl.textContent  = cur.toFixed(2) + ' ' + meta.unit;
      if (minEl)   minEl.textContent   = 'min ' + mn.toFixed(1);
      if (meanEl)  meanEl.textContent  = 'avg ' + avg.toFixed(1);
      if (maxEl)   maxEl.textContent   = 'max ' + mx.toFixed(1);
      if (anomEl)  anomEl.innerHTML    = anom === 'norm' ? '' :
        '<span class="anomaly-badge anom-'+anom+'">'+(anom==='high'?'↑ HIGH':'↓ LOW')+'</span>';
    }
  });
}

// ── CORRELATION MATRIX ───────────────────────────────────
// Known pairwise correlations from literature (signed, -1 to +1)
const KNOWN_CORR = {
  'solar|geomagnetic':    +0.55,
  'solar|sst':            +0.62,
  'solar|cosmic':         -0.78,
  'solar|ionosphere':     +0.70,
  'solar|solarwind':      +0.60,
  'solar|schumann':       +0.35,
  'solar|volcanic':       +0.38,
  'geomagnetic|seismic':  +0.48,
  'geomagnetic|ionosphere':+0.72,
  'geomagnetic|schumann': +0.45,
  'geomagnetic|solarwind':+0.80,
  'geomagnetic|cosmic':   -0.65,
  'cosmic|sst':           -0.45,
  'cosmic|ionosphere':    +0.30,
  'cosmic|seismic':       +0.28,
  'seismic|tides':        +0.58,
  'seismic|volcanic':     +0.55,
  'seismic|geotherm':     +0.40,
  'seismic|gravity':      +0.32,
  'sst|ionosphere':       +0.50,
  'sst|seismic':          +0.32,
  'sst|wind':             +0.45,
  'tides|volcanic':       +0.42,
  'gravity|magnetic':     +0.55,
  'gravity|geotherm':     +0.60,
  'magnetic|geotherm':    +0.48,
  'schumann|ionosphere':  +0.65,
  'solarwind|ionosphere': +0.68,
  'solarwind|cosmic':     -0.70,
};

function getCorr(a, b) {
  if (a === b) return 1.0;
  const key1 = a + '|' + b;
  const key2 = b + '|' + a;
  return (KNOWN_CORR[key1] !== undefined ? KNOWN_CORR[key1] : (KNOWN_CORR[key2] !== undefined ? KNOWN_CORR[key2] : 0));
}

function renderCorrMatrix() {
  const canvas = document.getElementById('corr-matrix-canvas');
  if (!canvas) return;
  const layers = [...state.activeLayers];
  const n = layers.length;

  if (n < 2) {
    canvas.style.display = 'none';
    document.getElementById('matrix-key').textContent = 'Activate 2+ layers to build the matrix.';
    return;
  }
  canvas.style.display = 'block';

  const wrap = document.getElementById('corr-matrix-wrap');
  const panelW = wrap ? Math.max(220, wrap.offsetWidth - 28) : 280;
  const labelW = 52;
  const CELL = Math.max(16, Math.min(40, Math.floor((panelW - labelW) / n)));
  const W = labelW + n * CELL;
  const H = W; // square matrix
  canvas.width  = W * window.devicePixelRatio;
  canvas.height = H * window.devicePixelRatio;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  ctx.fillStyle = '#060f1a';
  ctx.fillRect(0, 0, W, H);

  const shortLabels = {
    seismic:'Seism',solar:'Solar',geomagnetic:'Geo-K',cosmic:'GCR',
    solarwind:'SW',volcanic:'Volc',gravity:'Grav',geotherm:'Heat',
    wind:'Wind',schumann:'Schum',ionosphere:'TEC',sst:'SST',
    magnetic:'Mag',tides:'Tides'
  };

  // Draw cells
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const corr = getCorr(layers[r], layers[c]);
      const x = labelW + c * CELL;
      const y = labelW + r * CELL;
      // Color: negative=red, zero=dark, positive=blue/cyan
      let fillColor;
      if (corr > 0) {
        const a = Math.round(corr * 200);
        fillColor = `rgba(0,${Math.round(180+corr*75)},255,${0.15 + corr * 0.7})`;
      } else if (corr < 0) {
        fillColor = `rgba(255,${Math.round(80 + (1+corr)*120)},0,${0.15 + Math.abs(corr) * 0.7})`;
      } else {
        fillColor = 'rgba(255,255,255,0.03)';
      }
      ctx.fillStyle = fillColor;
      ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);

      // Diagonal marker
      if (r === c) {
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
      }

      // Value label
      if (Math.abs(corr) > 0.01) {
        ctx.fillStyle = Math.abs(corr) > 0.4 ? '#fff' : 'rgba(255,255,255,0.5)';
        ctx.font = `${Math.min(9, CELL * 0.28)}px Space Mono, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(corr === 1 ? '1.0' : corr.toFixed(2), x + CELL / 2, y + CELL / 2);
      }
    }
  }

  // Row labels (left)
  ctx.font = Math.max(8, Math.min(10, CELL * 0.55)) + 'px Space Mono, monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  layers.forEach((id, r) => {
    const meta = LAYER_META[id];
    ctx.fillStyle = (meta && meta.color) || '#888';
    ctx.fillText(shortLabels[id] || id.slice(0,5), labelW - 4, labelW + r * CELL + CELL / 2);
  });

  // Column labels (top)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  layers.forEach((id, c) => {
    const meta = LAYER_META[id];
    ctx.fillStyle = (meta && meta.color) || '#888';
    ctx.save();
    ctx.translate(labelW + c * CELL + CELL / 2, labelW - 4);
    ctx.rotate(-Math.PI / 4);
    ctx.fillText(shortLabels[id] || id.slice(0,5), 0, 0);
    ctx.restore();
  });

  // Key text — top pairs with significance
  const pairs = [];
  for (let r = 0; r < n; r++) {
    for (let c = r + 1; c < n; c++) {
      const a = getSeriesOrdered(layers[r]);
      const b = getSeriesOrdered(layers[c]);
      const corr = getCorr(layers[r], layers[c]);
      // Compute live stats when enough session data; otherwise show precomputed r only
      const stats = (a.length >= 6 && b.length >= 6) ? pearsonStats(a, b) : { r: corr, n: a.length, p: null, sig: '?' };
      if (Math.abs(corr) > 0.3) {
        pairs.push({ a: layers[r], b: layers[c], corr, stats });
      }
    }
  }
  pairs.sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr));
  // Store for auto-interpretation
  window._lastCorrStats = pairs.map(function(p) {
    return { r: p.stats.r, n: p.stats.n, p: p.stats.p, sig: p.stats.sig,
             layerA: (LAYER_META[p.a]&&LAYER_META[p.a].label)||p.a,
             layerB: (LAYER_META[p.b]&&LAYER_META[p.b].label)||p.b };
  });
  const keyEl = document.getElementById('matrix-key');
  if (keyEl) {
    const nLabel = (stats) => stats.n >= 6
      ? '<span style="color:var(--text-dim);font-size:7px"> n=' + stats.n + (stats.p !== null ? ', p' + (stats.p < 0.001 ? '<0.001' : '=' + stats.p.toFixed(3)) + ' ' + stats.sig : '') + '</span>'
      : '<span style="color:var(--c-gold);font-size:7px"> (session: ' + stats.n + ' pts — need 6+)</span>';
    keyEl.innerHTML = (pairs.slice(0, 6).map(p =>
      '<div style="padding:2px 0;border-bottom:1px solid rgba(255,255,255,.04);"><span style="color:'+(p.corr>0?'#40c8ff':'#ff6d00')+'">'+(p.corr>0?'↑':'↓')+' r='+p.corr.toFixed(2)+'</span> &nbsp; <span style="color:rgba(255,255,255,.8)">'+((LAYER_META[p.a]&&LAYER_META[p.a].label)||p.a)+' ↔ '+((LAYER_META[p.b]&&LAYER_META[p.b].label)||p.b)+'</span>'+nLabel(p.stats)+'</div>'
    ).join('')) || '<div style="color:var(--text-dim)">No strong pairs. Lower threshold: activate more layers.</div>';
    keyEl.innerHTML += '<div style="color:rgba(255,255,255,.2);font-size:7px;margin-top:4px;letter-spacing:.08em;">r = precomputed literature value · stats from live session data · *** p&lt;0.001 ** p&lt;0.01 * p&lt;0.05 ns = not significant</div>';
  }
}

// ── ANOMALY DETECTION ────────────────────────────────────
function renderAnomalyFeed() {
  const listEl = document.getElementById('anomaly-list');
  if (!listEl) return;
  const active = [...state.activeLayers];
  if (active.length === 0) {
    listEl.innerHTML = '<div class="no-charts">Activate layers to detect anomalies</div>';
    return;
  }

  const anomalies = [];
  const s = getSystemState();

  // Physics-based anomaly checks
  if (state.activeLayers.has('geomagnetic') && s.kp > 5) {
    anomalies.push({
      title: 'Geomagnetic Storm Active',
      body: `Kp ${s.kp.toFixed(1)} exceeds storm threshold (Kp>5). Expected effects: radio blackouts at high latitudes, GPS positioning errors ±10m, aurora visible to ~${(90-s.kp*3.5).toFixed(0)}°N/S latitude, Schumann frequency shift +${(s.carr*0.35).toFixed(2)} Hz. Per Urata et al. — monitor M≥7.5 seismicity window in 27 days.`,
      color: '#ff3d3d', level: 'high', ts: new Date().toUTCString()
    });
  }
  if (state.activeLayers.has('tides') && s.syzygy > 0.82) {
    anomalies.push({
      title: 'Near-Syzygy Tidal Window',
      body: `${s.moonName} — syzygy index ${(s.syzygy*100).toFixed(0)}%. This is the highest-risk tidal window for seismic triggering per Cochran et al. (2004). Tidal stress adds ~0.001–0.01 MPa on shallow oceanic fault systems. Window persists ±2 days from lunar extreme.`,
      color: '#40c8ff', level: 'high', ts: new Date().toUTCString()
    });
  }
  if (state.activeLayers.has('cosmic') && s.crFlux > 1800) {
    anomalies.push({
      title: 'Elevated Cosmic Ray Flux',
      body: `GCR ${s.crFlux} cpm — above 1800 threshold. Solar minimum conditions. Svensmark mechanism predicts enhanced ion-nucleation of low-altitude clouds → increased global albedo → net cooling tendency. LAIC pathway active: elevated ionisation in boundary layer could amplify pre-seismic radon anomalies.`,
      color: '#ff4fa0', level: 'high', ts: new Date().toUTCString()
    });
  }
  if (state.activeLayers.has('solar') && Math.abs(s.decl) > 20) {
    anomalies.push({
      title: `Extreme Solar Declination (${s.decl.toFixed(1)}°)`,
      body: 'Near solstice. '+(s.decl>0?'Northern':'Southern')+' hemisphere receiving near-maximum insolation. SST response will peak in 1-3 months due to ocean thermal inertia. Ionospheric TEC will be asymmetrically elevated in the '+(s.decl>0?'N':'S')+' hemisphere dayside.',
      color: '#ffd600', level: 'med', ts: new Date().toUTCString()
    });
  }
  if (state.activeLayers.has('ionosphere') && s.tecPeak > 50) {
    anomalies.push({
      title: 'High Ionospheric TEC',
      body: `Peak TEC ${s.tecPeak} TECU — elevated. Could indicate: (1) geomagnetic storm enhancement, (2) near-solstice dayside peak, or (3) LAIC pre-seismic TEC anomaly per Pulinets & Ouzounov (2011) if spatially localised over a seismically active region.`,
      color: '#00ffc8', level: 'med', ts: new Date().toUTCString()
    });
  }
  if (state.activeLayers.has('schumann')) {
    const freq = (state.data.schumann && state.data.schumann.frequency);
    if (freq && (freq > 8.1 || freq < 7.6)) {
      anomalies.push({
        title: `Schumann Frequency Anomaly (${freq} Hz)`,
        body: (freq>8.1?'Above':'Below')+' normal range (7.6-8.1 Hz). Possible causes: '+(freq>8.1?'ionospheric compression from solar wind, elevated lightning activity, or cavity height reduction':'reduced lightning globally, ionospheric expansion, or cavity height increase from solar heating')+'.',
        color: '#ff6d00', level: 'med', ts: new Date().toUTCString()
      });
    }
  }

  // Series-based anomalies from collected data
  active.forEach(id => {
    const data = getSeriesOrdered(id);
    if (data.length < 5) return;
    const level = getAnomalyLevel(data);
    if (level === 'norm') return;
    const meta = LAYER_META[id];
    const cur = data[data.length - 1];
    const mean = data.slice(0, -1).reduce((a, b) => a + b, 0) / (data.length - 1);
    const pct = Math.abs(((cur - mean) / (mean || 1)) * 100).toFixed(1);
    anomalies.push({
      title: (meta&&meta.label?meta.label:'Layer')+' '+(level==='high'?'↑ Above':'↓ Below')+' Rolling Mean',
      body: 'Current: '+cur.toFixed(2)+' '+((meta&&meta.unit)||'')+' — '+pct+'% '+(level==='high'?'above':'below')+' 30-point rolling mean ('+mean.toFixed(2)+'). Sustained deviation may indicate a genuine environmental shift.',
      color: (meta && meta.color) || '#888', level, ts: new Date().toUTCString()
    });
  });

  if (anomalies.length === 0) {
    listEl.innerHTML = '<div class="no-charts" style="color:#00ff88">✓ All layers nominal<br><span style="opacity:.5">No anomalies detected</span></div>';
    return;
  }

  listEl.innerHTML = anomalies.map(a => `
    <div class="anomaly-item" style="border-left-color:${a.color}">
      <div class="anomaly-item-title" style="color:${a.color}">${a.title}</div>
      <div>${a.body}</div>
      <div class="anom-ts">${a.ts}</div>
    </div>`).join('');
}

// ── HOOK INTO toggleLayer to update charts ───────────────
const _origToggle = toggleLayer;
window.toggleLayer = function(id) {
  _origToggle(id);
  if (!state.activeLayers.has(id)) {
    delete timeSeriesData[id];
    delete timeSeriesHead[id];
    delete timeSeriesCount[id];
    // Hide SST mode bar when SST layer is deactivated
    if (id === 'sst') {
      var mb = document.getElementById('sst-mode-bar');
      if (mb) mb.style.display = 'none';
    }
    // Hide seismic filter bar + depth key + heatmap bar when seismic layer is deactivated
    if (id === 'seismic') {
      var sfb = document.getElementById('seismic-filter-bar');
      var sdk = document.getElementById('seismic-depth-key');
      var shb = document.getElementById('seismic-heatmap-bar');
      if (sfb) sfb.style.display = 'none';
      if (sdk) sdk.style.display = 'none';
      if (shb) shb.style.display = 'none';
      // Remove heatmap circles from map
      _seismHeatmapCircles.forEach(function(c) { try { _leafletMap.removeLayer(c); } catch(e){} });
    }
    if (id === 'precipitation') clearPrecipMarkers();
  } else {
    initSeries(id);
    setTimeout(() => pushSeriesPoint(id), 100);
    // Show SST mode bar when SST layer is activated
    if (id === 'sst') {
      var mb = document.getElementById('sst-mode-bar');
      if (mb) mb.style.display = 'flex';
    }
    // Show seismic filter bar + depth key + heatmap bar when seismic layer is activated
    if (id === 'seismic') {
      var sfb = document.getElementById('seismic-filter-bar');
      var sdk = document.getElementById('seismic-depth-key');
      var shb = document.getElementById('seismic-heatmap-bar');
      if (sfb) sfb.style.display = 'flex';
      if (sdk) sdk.style.display = 'block';
      if (shb) shb.style.display = 'block';
    }
  }
  var _histP2 = document.getElementById('rpanel-hist');
  if (_histP2 && _histP2.classList.contains('active') && _dockOpen && _dockOpen.charts) {
    const activeCsub = (document.querySelector('.csub-tab.active') ? document.querySelector('.csub-tab.active').id : null);
    if (!activeCsub || activeCsub === 'cst-series') renderSparklines();
    else if (activeCsub === 'cst-matrix')  requestAnimationFrame(renderCorrMatrix);
    else if (activeCsub === 'cst-anomaly') renderAnomalyFeed();
  }
};


// ════════════════════════════════════════════════════════
// DATA CACHING (Tier 4.7)
// localStorage TTL cache for API responses
// ════════════════════════════════════════════════════════

var ESO_CACHE_TTL = {
  'kp':        3600000,   // 1 hour
  'dst':       3600000,   // 1 hour
  'usgs':      300000,    // 5 min
  'dscovr':    300000,    // 5 min
  'proton':    900000,    // 15 min
  'pressure':  3600000,   // 1 hour
  'xray':      600000,    // 10 min
  'f107':      10800000,  // 3 hours (F10.7 is daily but check more often)
};

function cacheSet(key, data) {
  try {
    localStorage.setItem('eso-cache-' + key, JSON.stringify({ ts: Date.now(), data: data }));
  } catch(e) {} // storage full — ignore
}

function cacheGet(key) {
  try {
    var raw = localStorage.getItem('eso-cache-' + key);
    if (!raw) return null;
    var entry = JSON.parse(raw);
    var ttl = ESO_CACHE_TTL[key] || 600000;
    if (Date.now() - entry.ts > ttl) { localStorage.removeItem('eso-cache-' + key); return null; }
    return entry.data;
  } catch(e) { return null; }
}

function cacheClear() {
  Object.keys(localStorage).filter(k => k.startsWith('eso-cache-')).forEach(k => localStorage.removeItem(k));
}

// Warm up baseline items from cache on page load (before live data arrives)
(function warmCacheOnLoad() {
  // Kp
  var cachedKp = cacheGet('kp');
  if (cachedKp) {
    var kpEl = document.getElementById('bl-kp');
    if (kpEl && kpEl.textContent.trim() === '—') {
      kpEl.textContent = parseFloat(cachedKp).toFixed(1);
      kpEl.style.color = parseFloat(cachedKp) >= 5 ? 'var(--c-red)' : 'var(--c-green)';
      kpEl.classList.remove('eso-skeleton');
    }
  }
  // Dst
  var cachedDst = cacheGet('dst');
  if (cachedDst) {
    var dstEl = document.getElementById('bl-dst');
    if (dstEl && dstEl.textContent.trim() === '—') {
      dstEl.innerHTML = parseFloat(cachedDst).toFixed(0) + '<span style="font-size:10px;color:var(--text-dim)"> nT</span>';
      dstEl.classList.remove('eso-skeleton');
    }
  }
})();

// Patch fetchDst to save to cache
var _rawFetchDstForCache = window.fetchDst;
if (typeof _rawFetchDstForCache === 'function') {
  window.fetchDst = async function() {
    await _rawFetchDstForCache();
    if (typeof _dstCurrent !== 'undefined' && _dstCurrent !== null) {
      cacheSet('dst', _dstCurrent);
    }
  };
}


// ════════════════════════════════════════════════════════
// SHAREABLE URL STATE (Tier 3.7)
// Encode/decode active layers, active tab, map center/zoom
// ════════════════════════════════════════════════════════

function serializeStateToHash() {
  try {
    var layers = state && state.activeLayers ? Array.from(state.activeLayers).join(',') : '';
    var tab    = document.querySelector('.rpanel-tab.active') ? document.querySelector('.rpanel-tab.active').dataset.tab || '' : '';
    var zoom   = _leafletMap ? _leafletMap.getZoom() : 2;
    var center = _leafletMap ? _leafletMap.getCenter() : {lat:20,lng:0};
    var region = typeof _seismicRegion !== 'undefined' ? _seismicRegion : 'global';
    var params = [
      'l=' + encodeURIComponent(layers),
      't=' + encodeURIComponent(tab),
      'z=' + zoom,
      'lat=' + center.lat.toFixed(2),
      'lng=' + center.lng.toFixed(2),
      'r=' + region,
    ].join('&');
    history.replaceState(null, '', '#' + params);
  } catch(e) {}
}

function restoreStateFromHash() {
  try {
    var hash = window.location.hash.slice(1);
    if (!hash) return;
    var params = {};
    hash.split('&').forEach(function(p) {
      var kv = p.split('=');
      if (kv.length === 2) params[kv[0]] = decodeURIComponent(kv[1]);
    });
    // Restore layers
    if (params.l) {
      var layerIds = params.l.split(',').filter(Boolean);
      setTimeout(function() {
        layerIds.forEach(function(id) {
          var item = document.querySelector('[data-layer="' + id + '"]');
          if (item && typeof toggleLayer === 'function' && state && !state.activeLayers.has(id)) {
            toggleLayer(id);
          }
        });
      }, 1200);
    }
    // Restore map position
    if (params.lat && params.lng && params.z && _leafletMap) {
      setTimeout(function() {
        _leafletMap.setView([parseFloat(params.lat), parseFloat(params.lng)], parseInt(params.z, 10));
      }, 500);
    }
    // Restore region
    if (params.r && params.r !== 'global') {
      setTimeout(function() { setRegionFilter(params.r); }, 1400);
    }
    // Restore tab
    if (params.t) {
      setTimeout(function() {
        var tabBtn = document.querySelector('[data-tab="' + params.t + '"]');
        if (tabBtn && typeof switchTab === 'function') switchTab(params.t);
      }, 600);
    }
  } catch(e) {}
}

// Trigger hash update on state changes
(function patchForURLState() {
  var _origToggleLayer2 = window.toggleLayer;
  if (_origToggleLayer2) {
    window.toggleLayer = function(id) {
      _origToggleLayer2(id);
      setTimeout(serializeStateToHash, 100);
    };
  }
})();

// Restore on load
window.addEventListener('load', function() {
  setTimeout(restoreStateFromHash, 800);
  // Update hash when map moves
  if (typeof L !== 'undefined') {
    setTimeout(function() {
      if (_leafletMap) {
        _leafletMap.on('moveend zoomend', function() { setTimeout(serializeStateToHash, 200); });
      }
    }, 2000);
  }
});


// ════════════════════════════════════════════════════════
// SKELETON LOADING STATES — applied to baseline items (Tier 3.4)
// ════════════════════════════════════════════════════════

(function applySkeletonToBaseline() {
  // Apply skeleton shimmer to all value/sub elements that start as "—"
  // Note: some elements have unit <span> children, so we check startsWith('—') not exact match
  var valIds = ['bl-kp','bl-syz','bl-eq','bl-sfi','bl-sch','bl-quakes','bl-bvalue',
                'bl-dst','bl-swspd','bl-bz','bl-proton','bl-enso','bl-cme'];
  valIds.forEach(function(id) {
    var el = document.getElementById(id);
    var txt = el ? el.textContent.trim() : '';
    if (el && (txt === '—' || txt === '' || txt.startsWith('—'))) {
      el.classList.add('eso-skeleton');
      el.style.minWidth = '40px';
      el.style.minHeight = '14px';
      el.style.display   = 'inline-block';
    }
  });
  // Remove skeleton once real data arrives (MutationObserver)
  valIds.forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var obs = new MutationObserver(function() {
      var t = el.textContent.trim();
      if (t && t !== '—' && !t.startsWith('— ')) {
        el.classList.remove('eso-skeleton');
        el.style.minWidth = '';
        el.style.minHeight = '';
        el.style.display = '';
        obs.disconnect();
      }
    });
    obs.observe(el, { childList: true, subtree: true, characterData: true });
  });
})();


// ════════════════════════════════════════════════════════
// SEISMIC FILTER STATE (Tier 2.5 + 2.6)
// ════════════════════════════════════════════════════════

let _seismicMinMag     = 4.5;
let _seismicTimeWindow = '1d';

// Region bounding boxes [minLat, maxLat, minLon, maxLon] (Tier 2.2)
const REGION_BBOX = {
  global:   null,
  pacific:  [-60, 70, 100, -60],   // wraps dateline — handled specially
  americas: [-60, 75, -170, -30],
  europe:   [-10, 75, -25, 60],
  asia:     [-15, 75, 60, 180],
  atlantic: [-70, 75, -70, 20],
};
let _seismicRegion = 'global';

function setSeismicFilter(type, val) {
  if (type === 'mag') {
    _seismicMinMag = parseFloat(val);
    var magMap = [['3','3'],['4','4'],['45','4.5'],['5','5'],['6','6']];
    magMap.forEach(function(pair) {
      var btn = document.getElementById('eq-mag-' + pair[0]);
      if (!btn) return;
      var on = (pair[1] === val);
      btn.style.background   = on ? 'rgba(255,61,61,.25)' : 'none';
      btn.style.borderColor  = on ? 'rgba(255,61,61,.6)'  : 'rgba(255,255,255,.2)';
      btn.style.color        = on ? '#ff3d3d' : 'var(--text-dim)';
    });
  } else if (type === 'win') {
    _seismicTimeWindow = val;
    ['1d','7d','30d'].forEach(function(w) {
      var btn = document.getElementById('eq-win-' + w);
      if (!btn) return;
      var on = (w === val);
      btn.style.background   = on ? 'rgba(255,61,61,.25)' : 'none';
      btn.style.borderColor  = on ? 'rgba(255,61,61,.6)'  : 'rgba(255,255,255,.2)';
      btn.style.color        = on ? '#ff3d3d' : 'var(--text-dim)';
    });
  }
  fetchUSGSQuakes();
}

function setRegionFilter(id) {
  _seismicRegion = id || 'global';
  var ids = ['global','pacific','americas','europe','asia','atlantic'];
  ids.forEach(function(rid) {
    var btn = document.getElementById('rgn-' + rid);
    if (!btn) return;
    var on = (rid === _seismicRegion);
    btn.style.background  = on ? 'rgba(0,229,255,.2)'  : 'none';
    btn.style.borderColor = on ? 'rgba(0,229,255,.5)'  : 'rgba(255,255,255,.15)';
    btn.style.color       = on ? 'var(--c-cyan)' : 'var(--text-dim)';
  });
  // Pan map to region center if possible
  if (_leafletMap) {
    var centers = {
      global:  [20, 0,   2],  atlantic: [10, -30,  3],
      pacific: [0,  160, 2],  americas: [10, -90,  3],
      europe:  [50, 20,  4],  asia:     [30, 110,  3],
    };
    var c = centers[_seismicRegion];
    if (c) _leafletMap.setView([c[0], c[1]], c[2]);
  }
  fetchUSGSQuakes();
}

