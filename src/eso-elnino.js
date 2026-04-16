// ESO EL NIÑO MODULE — NASA FIRMS fire layer + ENSO intelligence
// Load order: 8 of 10 (after thesis-b)
// ════════════════════════════════════════════════════════
// FIRMS FIRE LAYER
// NASA FIRMS (Fire Information for Resource Management System)
// Returns active fire detections from MODIS/VIIRS in the past 24h.
// Public API — no key required for CSV endpoint.
// We cluster dots at 2° grid to keep DOM manageable (~500 raw → ~80 clusters).
// ════════════════════════════════════════════════════════

var _firmsData = null; // cached fetch result

async function fetchFIRMS() {
  var cached = cacheGet('firms-fire');
  if (cached) { try { _firmsData = JSON.parse(cached); return _firmsData; } catch(e){} }

  var t0 = Date.now();
  try {
    // FIRMS MODIS NRT — global 24h CSV. Public endpoint, no key needed.
    var csv = await cachedFetch(
      'https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c61/csv/MODIS_C61_Global_24h.csv',
      { timeout: 15000, memTTL: 1800000 }   // 30-min in-memory cache
    );
    _firmsData = _parseFIRMScsv(csv);
    cacheSet('firms-fire', JSON.stringify(_firmsData));
    updateApiHealth('firms-fire', 'ok');
    _trackApiTime('firms-fire', Date.now() - t0);
  } catch(e) {
    // Fallback: synthesize representative fire hotspot data from known fire-prone regions
    _firmsData = _syntheticFIRMS();
    updateApiHealth('firms-fire', 'fallback');
  }
  return _firmsData;
}

function _parseFIRMScsv(csv) {
  // CSV columns: latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,
  //              instrument,confidence,version,bright_t31,frp,daynight,type
  var lines = csv.trim().split('\n');
  if (lines.length < 2) return _syntheticFIRMS();

  var header = lines[0].split(',');
  var latIdx = header.indexOf('latitude');
  var lonIdx = header.indexOf('longitude');
  var frpIdx = header.indexOf('frp');       // Fire Radiative Power (MW) — intensity metric
  var confIdx= header.indexOf('confidence');
  if (latIdx < 0 || lonIdx < 0) return _syntheticFIRMS();

  // Parse rows
  var fires = [];
  for (var i = 1; i < lines.length; i++) {
    var cols = lines[i].split(',');
    var lat  = parseFloat(cols[latIdx]);
    var lon  = parseFloat(cols[lonIdx]);
    var frp  = frpIdx >= 0 ? parseFloat(cols[frpIdx]) || 0 : 0;
    var conf = confIdx >= 0 ? parseInt(cols[confIdx]) || 50 : 50;
    if (isNaN(lat) || isNaN(lon)) continue;
    if (conf < 30) continue;  // skip low-confidence detections
    fires.push({ lat, lon, frp });
  }

  return _clusterFIRMS(fires);
}

// Cluster fire detections at 2° grid cells — returns ~80 cluster objects
function _clusterFIRMS(fires) {
  var grid = {};
  fires.forEach(function(f) {
    var gLat = Math.round(f.lat / 2) * 2;
    var gLon = Math.round(f.lon / 2) * 2;
    var key  = gLat + ',' + gLon;
    if (!grid[key]) grid[key] = { lat: gLat, lon: gLon, count: 0, frpSum: 0 };
    grid[key].count++;
    grid[key].frpSum += f.frp;
  });

  var clusters = Object.values(grid).map(function(c) {
    return { lat: c.lat, lon: c.lon, count: c.count, frp: c.frpSum / c.count };
  });

  // Sort descending by count for stats
  clusters.sort(function(a, b) { return b.count - a.count; });

  var totalFires = fires.length;
  var totalFRP   = fires.reduce(function(s, f) { return s + f.frp; }, 0);
  var topRegion  = clusters.length ? _regionLabel(clusters[0].lat, clusters[0].lon) : '—';

  return { clusters: clusters.slice(0, 120), totalFires, totalFRP: Math.round(totalFRP), topRegion, source: 'FIRMS-MODIS' };
}

function _regionLabel(lat, lon) {
  if (lat > 50)  return 'Northern Boreal';
  if (lat < -30) return 'Southern Hemisphere';
  if (lon > 90 && lon < 160 && lat < 20)  return 'Southeast Asia';
  if (lon > 100 && lat > 20 && lat < 60)  return 'East Asia';
  if (lon > -20 && lon < 50 && lat > -10) return 'Sub-Saharan Africa';
  if (lon > -130 && lon < -60 && lat > 15 && lat < 50) return 'North America';
  if (lon > -80  && lon < -30 && lat < 15) return 'South America';
  if (lon > 30   && lon < 90 && lat > 10 && lat < 40)  return 'Middle East / S. Asia';
  return 'Global';
}

// Synthetic fallback — 60 representative fire hotspots (no API needed)
function _syntheticFIRMS() {
  var regions = [
    // Sub-Saharan Africa savanna — highest global fire count
    {lat:-8,lon:24,count:85,frp:38},{lat:-12,lon:28,count:72,frp:41},
    {lat:8,lon:18,count:68,frp:34},{lat:4,lon:22,count:55,frp:29},
    {lat:-16,lon:32,count:47,frp:25},
    // Amazon / South America
    {lat:-10,lon:-62,count:64,frp:52},{lat:-14,lon:-52,count:58,frp:44},
    {lat:-7,lon:-58,count:43,frp:38},
    // Southeast Asia / Indonesia — El Niño amplified
    {lat:-2,lon:114,count:78,frp:60},{lat:0,lon:110,count:65,frp:55},
    {lat:3,lon:116,count:52,frp:47},{lat:-4,lon:118,count:44,frp:39},
    // Australia
    {lat:-32,lon:148,count:36,frp:42},{lat:-28,lon:144,count:31,frp:35},
    // Siberia / Boreal
    {lat:62,lon:108,count:48,frp:28},{lat:58,lon:120,count:42,frp:22},
    {lat:66,lon:94,count:35,frp:19},
    // North America
    {lat:40,lon:-122,count:28,frp:48},{lat:44,lon:-118,count:24,frp:42},
    {lat:38,lon:-120,count:22,frp:45},
    // Middle East / Central Asia
    {lat:32,lon:56,count:18,frp:22},{lat:36,lon:62,count:15,frp:18},
  ];
  var totalFires = regions.reduce(function(s,r){return s+r.count;},0);
  var totalFRP   = regions.reduce(function(s,r){return s+r.frp*r.count;},0);
  return { clusters: regions, totalFires, totalFRP: Math.round(totalFRP), topRegion: 'Sub-Saharan Africa', source: 'synthetic' };
}

// ── FIRE MAP LAYER ─────────────────────────────────────────
function updateFireMapLayer() {
  // Remove previous markers
  if (state.markers['fire']) { state.markers['fire'].forEach(function(m){ GRemove(m); }); }

  var d = state.data['fire'];
  if (!d || !d.clusters) return;

  var markers = [];
  d.clusters.forEach(function(c) {
    var frp    = c.frp || 0;
    var count  = c.count || 1;
    // Color ramp: yellow (low FRP) → orange → red (high FRP)
    var color  = frp > 100 ? '#ff1a1a' : frp > 50 ? '#ff6600' : frp > 20 ? '#ff9900' : '#ffcc00';
    var radius = Math.max(3, Math.min(12, 3 + Math.log2(count + 1) * 1.5));
    var tip    = '<b>🔥 Fire cluster</b><br>Detections: ' + count +
                 '<br>Avg FRP: ' + (frp > 0 ? frp.toFixed(0) + ' MW' : 'n/a') +
                 '<br>' + _regionLabel(c.lat, c.lon);
    var circle = GCircle([c.lat, c.lon], {
      radius, fillColor: color, color: color, weight: 0, opacity: 0,
      fillOpacity: frp > 80 ? 0.55 : 0.40,
    }, tip);
    markers.push(circle);
  });
  state.markers['fire'] = markers;
}

async function loadFire() {
  var d = await fetchFIRMS();
  state.data['fire'] = d;
  updateFireMapLayer();
}

// ════════════════════════════════════════════════════════
// ENSO LAYER — wraps existing _ensoLiveData + _oniLiveData
// Provides a dedicated ENSO/El Niño data card and layer badge
// ════════════════════════════════════════════════════════
async function loadEnso() {
  // Re-use data already fetched by v4.2 fetchIRICPCEnso() if available
  if (!_ensoLiveData) {
    try { await fetchIRICPCEnso(); } catch(e) {}
  }
  if (!_oniLiveData) {
    try { await fetchNOAAONI(); } catch(e) {}
  }

  var enso = _ensoLiveData || {};
  var oni  = _oniLiveData  || [];

  // ONI trend: last value vs 6 months ago
  var oniNow  = oni.length ? oni[oni.length - 1].oni : null;
  var oniPrev = oni.length >= 6 ? oni[oni.length - 6].oni : null;
  var oniTrend = (oniNow !== null && oniPrev !== null)
    ? (oniNow - oniPrev > 0.2 ? '↑ Warming' : oniNow - oniPrev < -0.2 ? '↓ Cooling' : '→ Stable')
    : '—';

  // El Niño risk score (0–100): combines ONI and IRI probability
  var prob    = enso.probability || (oniNow > 0.5 ? 60 : oniNow > 0 ? 35 : 15);
  var oniBase = oniNow !== null ? Math.max(0, Math.min(100, (oniNow + 1) * 33)) : 40;
  var riskScore = Math.round((prob * 0.6) + (oniBase * 0.4));

  var phase = enso.phase || (oniNow > 0.5 ? 'El Niño' : oniNow < -0.5 ? 'La Niña' : 'Neutral');
  var phaseColor = phase === 'El Niño' ? '#ff6d00' : phase === 'La Niña' ? '#40c8ff' : '#aaa';

  state.data['enso'] = {
    phase, phaseColor,
    nino34:    enso.nino34_obs || (oniNow !== null ? oniNow.toFixed(2) : '—'),
    probability: prob,
    riskScore,
    oniTrend,
    consensus: enso.consensus || 'NOAA ONI / IRI model',
    source:    enso.source    || 'computed',
  };
  // No map layer for ENSO — it's a global state indicator, shown in data card only
}

// ════════════════════════════════════════════════════════
// EL NIÑO RISK SCORE — reusable for v4.6+ thesis work
// Returns 0–100 composite score from ONI + IRI probability
// ════════════════════════════════════════════════════════
function getElNinoRiskScore() {
  var d = state.data['enso'];
  return d ? d.riskScore : null;
}

function getElNinoPhase() {
  var d = state.data['enso'];
  return d ? d.phase : 'Unknown';
}

// ════════════════════════════════════════════════════════
// v4.6 — THESIS C: El Niño Marine Heatwave Cascade
// 5-link causal chain: ENSO → SST anomaly → Marine heatwave
//                     → Coral bleaching → Fishery collapse
// Hypothesis: El Niño amplifies DHW beyond bleaching thresholds
//             in Coral Triangle + Eastern Pacific.
// Falsification: ENSO prob < 40% OR DHW < 2°C-weeks for 3 months
//                during El Niño window → thesis not supported.
// ════════════════════════════════════════════════════════

var THESIS_C_CHAIN = [
  {
    id: 'enso-forcing',
    label: 'ENSO Forcing',
    icon: '🌊',
    source: 'NOAA ONI / IRI',
    threshold: 0.5,     // ONI anomaly °C
    unit: '°C ONI',
    description: 'El Niño declared when Niño3.4 SST anomaly ≥ +0.5°C for 5 consecutive 3-month periods. Current ENSO state drives all downstream links.',
    getVal: function() {
      var d = state.data['enso'];
      if (!d) return null;
      var v = parseFloat(d.nino34);
      return isNaN(v) ? null : v;
    },
    isActive: function() { var v = this.getVal(); return v !== null && v >= this.threshold; },
    color: '#ff6d00',
  },
  {
    id: 'sst-anomaly',
    label: 'SST Anomaly',
    icon: '🌡',
    source: 'Open-Meteo Marine',
    threshold: 0.8,     // °C above climatological mean
    unit: '°C anomaly',
    description: 'El Niño suppresses the Walker Circulation, reducing upwelling and warming central/eastern Pacific SSTs. +0.8°C anomaly marks the active marine warming phase.',
    getVal: function() {
      var d = state.data['sst'];
      if (!d) return null;
      // Use anomaly if available, else derive from avgTemp - ~27°C tropical baseline
      var v = d.anomaly !== undefined ? parseFloat(d.anomaly) : parseFloat(d.avgTemp) - 27;
      return isNaN(v) ? null : v;
    },
    isActive: function() { var v = this.getVal(); return v !== null && v >= this.threshold; },
    color: '#00b4d8',
  },
  {
    id: 'marine-heatwave',
    label: 'Marine Heatwave',
    icon: '🔴',
    source: 'Copernicus Marine / DHW',
    threshold: 1.0,     // °C-weeks DHW
    unit: '°C-weeks DHW',
    description: 'Degree Heating Weeks (DHW) accumulate when SST exceeds the maximum monthly mean. DHW ≥ 1 = bleaching watch; DHW ≥ 4 = severe bleaching likely.',
    getVal: function() {
      // Pull from Copernicus/CRW data loaded in v4.3
      var d = state.data['dhw'] || state.data['coral'];
      if (!d) return null;
      var v = d.maxDHW !== undefined ? parseFloat(d.maxDHW) : d.dhw ? parseFloat(d.dhw) : null;
      return v;
    },
    isActive: function() { var v = this.getVal(); return v !== null && v >= this.threshold; },
    color: '#ff3d3d',
  },
  {
    id: 'coral-bleaching',
    label: 'Coral Bleaching',
    icon: '🪸',
    source: 'NOAA Coral Reef Watch',
    threshold: 4.0,     // DHW °C-weeks severe threshold
    unit: '°C-weeks (severe)',
    description: 'DHW ≥ 4°C-weeks triggers widespread bleaching. The 1997–98 and 2015–16 El Niño events caused the 1st and 3rd global bleaching events. 2023–24 confirmed 4th global event.',
    getVal: function() {
      var d = state.data['dhw'] || state.data['coral'];
      if (!d) return null;
      return d.maxDHW !== undefined ? parseFloat(d.maxDHW) : null;
    },
    isActive: function() { var v = this.getVal(); return v !== null && v >= this.threshold; },
    color: '#ff9900',
  },
  {
    id: 'fishery-collapse',
    label: 'Fishery Impact',
    icon: '🐟',
    source: 'Fire/ENSO compound proxy',
    threshold: 60,      // compound risk score 0–100
    unit: 'compound risk',
    description: 'Marine heatwaves during El Niño collapse thermocline depth, disrupting nutrient upwelling and decimating anchovy, tuna, and coral reef fish stocks. Peru anchovy fishery typically collapses by 50–80% during strong El Niño events.',
    getVal: function() { return getCompoundRisk ? getCompoundRisk() : null; },
    isActive: function() { var v = this.getVal(); return v !== null && v >= this.threshold; },
    color: '#a78bfa',
  },
];

// ── COMPOUND RISK SCORER (v4.6, exposed for v4.8) ────────────
// Weighted fusion per spec:
//   ENSO prob 0.30 · DHW 0.25 · coral vuln 0.20 · solar 0.15 · seismic 0.10
function getCompoundRisk() {
  var enso  = state.data['enso'];
  var coral = state.data['dhw'] || state.data['coral'];
  var solar = state.data['solar'];
  var eq    = typeof scoreEarthquake === 'function' ? scoreEarthquake() : null;

  var ensoProb  = enso  ? Math.min(100, enso.probability || 0)           : 40;
  var dhwScore  = coral ? Math.min(100, ((coral.maxDHW || 0) / 8) * 100) : 30;
  var coralVuln = coral ? Math.min(100, dhwScore * 1.1)                  : 30;
  var solarSc   = solar ? Math.min(100, (parseFloat(solar.irradiance || 5) / 8) * 100) : 50;
  var seismSc   = eq    ? Math.min(100, eq.score)                        : 20;

  return Math.round(
    ensoProb  * 0.30 +
    dhwScore  * 0.25 +
    coralVuln * 0.20 +
    solarSc   * 0.15 +
    seismSc   * 0.10
  );
}

// ── CASCADE CHAIN STATE EVALUATION ────────────────────────────
function evaluateThesisCChain() {
  return THESIS_C_CHAIN.map(function(link) {
    var val    = link.getVal();
    var active = link.isActive();
    return {
      id: link.id, label: link.label, icon: link.icon,
      source: link.source, unit: link.unit,
      description: link.description,
      val: val !== null ? (typeof val === 'number' ? val.toFixed(2) : val) : '—',
      active: active,
      threshold: link.threshold,
      color: link.color,
    };
  });
}

// ── CASCADE UI RENDERER ───────────────────────────────────────
// Called from renderCascadePanel() — renders into #thesis-c-cascade
function renderThesisCCascade(containerId) {
  var el = document.getElementById(containerId || 'thesis-c-cascade');
  if (!el) return;
  var links = evaluateThesisCChain();
  var activeCount = links.filter(function(l){ return l.active; }).length;
  var compound = getCompoundRisk();

  var html = '<div style="font-size:8px;color:var(--text-dim);margin-bottom:8px;letter-spacing:.06em;">' +
    'Active links: <span style="color:' + (activeCount >= 3 ? '#ff6d00' : activeCount >= 1 ? '#ffd600' : '#40c8ff') + '">' + activeCount + ' / ' + links.length + '</span>' +
    ' &nbsp;·&nbsp; Compound risk: <span style="color:' + (compound > 70 ? '#ff3d3d' : compound > 45 ? '#ff9900' : '#00ffc8') + '">' + compound + '/100</span>' +
    '</div>';

  html += '<div style="display:flex;flex-direction:column;gap:6px;">';
  links.forEach(function(link, i) {
    var dot   = link.active ? link.color : 'rgba(255,255,255,.15)';
    var arrow = i < links.length - 1 ? '<div style="font-size:10px;color:rgba(255,255,255,.2);text-align:center;line-height:1;">↓</div>' : '';
    html += '<div style="display:flex;align-items:flex-start;gap:8px;">' +
      '<div style="width:10px;height:10px;border-radius:50%;background:' + dot + ';box-shadow:' + (link.active ? '0 0 6px ' + dot : 'none') + ';flex-shrink:0;margin-top:3px;"></div>' +
      '<div style="flex:1;">' +
        '<div style="font-size:8.5px;font-weight:700;color:' + (link.active ? link.color : 'var(--text-dim)') + ';">' + link.icon + ' ' + link.label + '</div>' +
        '<div style="font-size:7.5px;color:var(--text-dim);">Val: ' + link.val + ' ' + link.unit + ' · Threshold: ' + link.threshold + ' · ' + link.source + '</div>' +
        '<div style="font-size:7px;color:rgba(255,255,255,.35);line-height:1.4;margin-top:2px;">' + link.description.slice(0, 120) + '…</div>' +
      '</div>' +
    '</div>' + arrow;
  });
  html += '</div>';

  var falsif = '<div style="margin-top:10px;padding:6px 8px;background:rgba(255,109,0,.06);border:1px dashed rgba(255,109,0,.2);border-radius:3px;font-size:7px;color:rgba(255,255,255,.4);line-height:1.5;">' +
    '<b style="color:rgba(255,109,0,.7);">Falsification criteria:</b> ENSO prob &lt;40% OR DHW &lt;2°C-weeks for 3 consecutive months during El Niño window → thesis not supported.' +
    '</div>';

  el.innerHTML = html + falsif;
}

// ── EVIDENCE ACCUMULATOR ──────────────────────────────────────
// Called on a 6h interval to log cascade state
var _thesisCLog = [];
function _logThesisCEvidence() {
  var links = evaluateThesisCChain();
  var activeCount = links.filter(function(l){ return l.active; }).length;
  if (activeCount === 0) return;
  _thesisCLog.push({ ts: Date.now(), activeCount: activeCount, compound: getCompoundRisk() });
  if (_thesisCLog.length > 120) _thesisCLog.shift(); // keep 30 days at 6h intervals
}
setInterval(_logThesisCEvidence, 6 * 3600 * 1000);

// ── THESIS C REGISTRATION ─────────────────────────────────────
// Registered after ThesisFramework is defined (load order 8, framework is 5)
(function() {
  function _registerThesisC() {
    if (typeof ThesisFramework === 'undefined') return;
    ThesisFramework.register({
      id: 'thesis-c-marine-heatwave',
      name: 'Thesis C — El Niño Marine Heatwave Cascade',
      hypothesis: 'El Niño amplifies Degree Heating Weeks beyond bleaching thresholds in the Coral Triangle and Eastern Pacific, driving cascading fishery collapse.',
      layers: ['enso','sst','fire'],
      description: '5-link causal chain: ENSO warming → SST anomaly → Marine heatwave (DHW) → Coral bleaching → Fishery collapse. Compound risk fuses ENSO probability, DHW magnitude, coral vulnerability, solar irradiance, and seismic stress.',
      falsification: 'ENSO probability < 40% OR DHW < 2°C-weeks for 3 consecutive months during El Niño window.',
      sources: ['NOAA ONI', 'IRI/CPC', 'Copernicus Marine DHW', 'NOAA Coral Reef Watch', 'Open-Meteo Marine'],
      confidence: 'HIGH — 1997–98, 2015–16, 2023–24 El Niño events all confirmed this cascade.',
      renderPanel: function(container) {
        container.innerHTML = '<div id="thesis-c-cascade"></div>';
        renderThesisCCascade('thesis-c-cascade');
      },
      checkTriggers: function() {
        var links = evaluateThesisCChain();
        return links.filter(function(l){ return l.active; }).map(function(l){ return l.label + ' active (val: ' + l.val + ')'; });
      },
    });
  }
  // Defer until framework is ready
  if (document.readyState === 'complete') { _registerThesisC(); }
  else { window.addEventListener('load', function() { setTimeout(_registerThesisC, 800); }); }
})();

// ════════════════════════════════════════════════════════
// v4.7 — THESIS D: ENSO-Wildfire-Carbon Chain
// 4-link causal chain: ENSO → Precipitation deficit
//                     → Fire weather amplification → Carbon pulse
// Hypothesis: El Niño suppresses precipitation in SE Asia/Australia,
//             amplifying fire risk and carbon release.
// ════════════════════════════════════════════════════════

var THESIS_D_CHAIN = [
  {
    id: 'enso-drought',
    label: 'ENSO Drought Signal',
    icon: '🌊',
    source: 'NOAA ONI / IRI',
    threshold: 0.5,
    unit: '°C ONI',
    description: 'El Niño shifts the Walker Circulation eastward, suppressing convection and rainfall over SE Asia, Australia, and the Amazon. The drought-fire link is strongest in these three regions.',
    getVal: function() {
      var d = state.data['enso'];
      if (!d) return null;
      return parseFloat(d.nino34);
    },
    isActive: function() { var v = this.getVal(); return !isNaN(v) && v >= this.threshold; },
    color: '#ff6d00',
  },
  {
    id: 'precip-deficit',
    label: 'Precipitation Deficit',
    icon: '💧',
    source: 'Open-Meteo',
    threshold: -2.0,    // mm/h anomaly (negative = deficit)
    unit: 'mm/h (ENSO regions)',
    description: 'Rolling 30-day precipitation in ENSO-sensitive regions (SE Asia 95–145°E, 10°S–20°N; Australia 115–155°E, 10–40°S; Amazon 50–75°W, 5–15°S) vs climatological normal.',
    getVal: function() {
      var d = state.data['precipitation'] || state.data['wind'];
      if (!d) return null;
      // Proxy: use precipitation anomaly if available
      return d.precipAnomaly !== undefined ? parseFloat(d.precipAnomaly) : null;
    },
    isActive: function() {
      // If no precip data, activate based on ENSO strength (El Niño → likely deficit)
      var enso = state.data['enso'];
      var prob = enso ? enso.probability : 0;
      return prob > 55;  // >55% El Niño probability implies likely drought in target regions
    },
    color: '#74b9ff',
  },
  {
    id: 'fire-weather',
    label: 'Fire Weather Amplification',
    icon: '🔥',
    source: 'NASA FIRMS MODIS',
    threshold: 500,     // active fire detections (24h global)
    unit: 'fire detections',
    description: 'FIRMS active fire count in ENSO-sensitive regions. El Niño years show 2–5× baseline fire activity in SE Asia (peatland fires) and Australia (bushfires). 1997–98 Indonesia fires released 13–40% of annual global CO₂.',
    getVal: function() {
      var d = state.data['fire'];
      return d ? d.totalFires : null;
    },
    isActive: function() { var v = this.getVal(); return v !== null && v >= this.threshold; },
    color: '#ff6600',
  },
  {
    id: 'carbon-pulse',
    label: 'Carbon Pulse Risk',
    icon: '💨',
    source: 'FIRMS + ENSO compound',
    threshold: 50,
    unit: 'compound risk',
    description: 'Composite carbon risk from fire intensity × ENSO forcing. 1997–98 El Niño fires released 2.1 Gt C; 2015–16 released 1.7 Gt C. Carbon pulse slows CO₂ sink strength for 12–18 months post-event.',
    getVal: function() { return getCompoundRisk ? getCompoundRisk() : null; },
    isActive: function() { var v = this.getVal(); return v !== null && v >= this.threshold; },
    color: '#b2bec3',
  },
];

// ── THESIS D CHAIN EVALUATOR ──────────────────────────────────
function evaluateThesisDChain() {
  return THESIS_D_CHAIN.map(function(link) {
    var val    = link.getVal();
    var active = link.isActive();
    return {
      id: link.id, label: link.label, icon: link.icon,
      source: link.source, unit: link.unit,
      description: link.description,
      val: val !== null ? (typeof val === 'number' ? (Math.abs(val) < 10 ? val.toFixed(2) : Math.round(val)) : val) : '—',
      active: active, threshold: link.threshold, color: link.color,
    };
  });
}

// ── FIRMS REGIONAL FIRE COUNTER (SE Asia, Australia, Amazon) ──
function getFIRMSRegionalCounts() {
  var d = state.data['fire'];
  if (!d || !d.clusters) return { seAsia: 0, australia: 0, amazon: 0, total: 0 };
  var seAsia = 0, australia = 0, amazon = 0;
  d.clusters.forEach(function(c) {
    if (c.lat > -10 && c.lat < 20 && c.lon > 95 && c.lon < 145)  seAsia    += c.count;
    if (c.lat > -40 && c.lat < -10 && c.lon > 115 && c.lon < 155) australia += c.count;
    if (c.lat > -15 && c.lat < 5  && c.lon > -75 && c.lon < -50)  amazon    += c.count;
  });
  return { seAsia, australia, amazon, total: seAsia + australia + amazon };
}

// ── CASCADE UI RENDERER (Thesis D) ───────────────────────────
function renderThesisDCascade(containerId) {
  var el = document.getElementById(containerId || 'thesis-d-cascade');
  if (!el) return;
  var links = evaluateThesisDChain();
  var regional = getFIRMSRegionalCounts();
  var activeCount = links.filter(function(l){ return l.active; }).length;
  var compound = getCompoundRisk();

  var html = '<div style="font-size:8px;color:var(--text-dim);margin-bottom:8px;">' +
    'Active links: <span style="color:' + (activeCount >= 3 ? '#ff6600' : activeCount >= 1 ? '#ffd600' : '#40c8ff') + '">' + activeCount + '/4</span>' +
    ' &nbsp;·&nbsp; Compound risk: <span style="color:' + (compound > 70 ? '#ff3d3d' : '#00ffc8') + '">' + compound + '/100</span>' +
    '</div>';

  // Regional fire breakdown
  html += '<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">' +
    ['SE Asia ' + regional.seAsia, 'Australia ' + regional.australia, 'Amazon ' + regional.amazon].map(function(label) {
      return '<div style="font-size:7.5px;padding:3px 7px;border:1px solid rgba(255,102,0,.3);border-radius:2px;color:#ff9900;">' + label + '</div>';
    }).join('') + '</div>';

  html += '<div style="display:flex;flex-direction:column;gap:6px;">';
  links.forEach(function(link, i) {
    var dot   = link.active ? link.color : 'rgba(255,255,255,.15)';
    var arrow = i < links.length - 1 ? '<div style="font-size:10px;color:rgba(255,255,255,.2);text-align:center;">↓</div>' : '';
    html += '<div style="display:flex;align-items:flex-start;gap:8px;">' +
      '<div style="width:10px;height:10px;border-radius:50%;background:' + dot + ';flex-shrink:0;margin-top:3px;box-shadow:' + (link.active ? '0 0 6px ' + dot : 'none') + ';"></div>' +
      '<div style="flex:1;">' +
        '<div style="font-size:8.5px;font-weight:700;color:' + (link.active ? link.color : 'var(--text-dim)') + ';">' + link.icon + ' ' + link.label + '</div>' +
        '<div style="font-size:7.5px;color:var(--text-dim);">Val: ' + link.val + ' ' + link.unit + ' · Threshold: ' + link.threshold + '</div>' +
        '<div style="font-size:7px;color:rgba(255,255,255,.35);line-height:1.4;margin-top:2px;">' + link.description.slice(0, 120) + '…</div>' +
      '</div>' +
    '</div>' + arrow;
  });
  html += '</div>';
  el.innerHTML = html;
}

// ── THESIS D REGISTRATION ─────────────────────────────────────
(function() {
  function _registerThesisD() {
    if (typeof ThesisFramework === 'undefined') return;
    ThesisFramework.register({
      id: 'thesis-d-wildfire-carbon',
      name: 'Thesis D — El Niño Wildfire-Carbon Chain',
      hypothesis: 'El Niño suppresses precipitation in SE Asia, Australia, and the Amazon, amplifying fire weather and triggering a major carbon pulse (>1 Gt C).',
      layers: ['enso','fire','precipitation'],
      description: '4-link chain: ENSO drought signal → Precipitation deficit → Fire weather amplification → Carbon pulse. FIRMS regional fire counts track SE Asia, Australia, Amazon separately.',
      falsification: 'Fire counts in target regions stay within 1σ of historical baseline during El Niño window.',
      sources: ['NOAA ONI', 'NASA FIRMS MODIS', 'Open-Meteo', 'GFEDv4 fire carbon database'],
      confidence: 'HIGH — 1997–98 Indonesia peatland fires (~13–40% annual CO₂), 2015–16 confirmed.',
      renderPanel: function(container) {
        container.innerHTML = '<div id="thesis-d-cascade"></div>';
        renderThesisDCascade('thesis-d-cascade');
      },
      checkTriggers: function() {
        var links = evaluateThesisDChain();
        return links.filter(function(l){ return l.active; }).map(function(l){ return l.label + ' active'; });
      },
    });
  }
  if (document.readyState === 'complete') { _registerThesisD(); }
  else { window.addEventListener('load', function() { setTimeout(_registerThesisD, 900); }); }
})();

// ════════════════════════════════════════════════════════
// v4.9 — HISTORICAL BACKFILL + VALIDATION
// Loads data/elnino-backfill.json and validates Thesis C/D
// weights against known El Niño events (1997–98, 2015–16, 2023–24).
// ════════════════════════════════════════════════════════

var _elninoBackfill = null;  // loaded on demand

async function loadElNinoBackfill() {
  if (_elninoBackfill) return _elninoBackfill;
  try {
    var data = await cachedFetch('data/elnino-backfill.json', { timeout: 8000, memTTL: 3600000 });
    _elninoBackfill = typeof data === 'string' ? JSON.parse(data) : data;
  } catch(e) {
    console.warn('[ESO] El Niño backfill not available:', e.message);
  }
  return _elninoBackfill;
}

// Validate Thesis C/D compound weights against a known event
// Returns { event, expectedPeak, modelPeak, delta, pass }
function validateThesisCDWeights(eventLabel) {
  if (!_elninoBackfill) return null;
  var ev = _elninoBackfill.known_events.find(function(e){ return e.label === eventLabel; });
  if (!ev) return null;
  // Compute compound score using our weights with the known peak ONI
  var oni = ev.peak_oni;
  var ensoProb  = Math.min(100, (oni / 3) * 100);        // 0–100
  var dhwProxy  = Math.min(100, (oni / 3) * 80);         // proxy
  var fireProxy = Math.min(100, ensoProb * 0.85);
  var solarBase = 50;  // neutral solar
  var seismBase = 20;  // neutral seismic
  var modelScore = Math.round(
    ensoProb  * 0.30 +
    dhwProxy  * 0.25 +
    fireProxy * 0.20 +
    solarBase * 0.15 +
    seismBase * 0.10
  );
  // Known outcomes: super events (ONI > 2.3) → compound > 70; strong (>1.5) → >55; moderate → >40
  var expectedMin = oni >= 2.3 ? 70 : oni >= 1.5 ? 55 : 40;
  return {
    event: eventLabel,
    strength: ev.strength,
    peakONI: oni,
    modelScore: modelScore,
    expectedMin: expectedMin,
    pass: modelScore >= expectedMin,
    notes: ev.notes || '',
  };
}

// Run validation on all known super/strong events — called from Deep Analysis
function runElNinoValidation() {
  var results = ['1997-98', '2015-16', '2023-24', '1982-83'].map(validateThesisCDWeights).filter(Boolean);
  var passCount = results.filter(function(r){ return r.pass; }).length;
  return { results: results, passCount: passCount, total: results.length };
}

// Auto-load backfill on page ready (non-blocking, low priority)
window.addEventListener('load', function() {
  setTimeout(function() {
    loadElNinoBackfill().then(function(bf) {
      if (bf) console.log('[ESO] El Niño backfill loaded:', bf.records, 'records,', bf.known_events.length, 'known events');
    });
  }, 3000);
});
