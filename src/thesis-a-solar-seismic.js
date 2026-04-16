// THESIS A: Solar Wind Transients → Subduction Zone Seismicity
// Load order: 6 (after eso-thesis.js)
// ════════════════════════════════════════════════════════
// Hypothesis: Elevated solar wind (speed >600 km/s OR Bz < -10 nT
// sustained 3+ hours) triggers increased M5.5+ seismicity on
// subduction zones within a 24–96 hour lag window.
//
// Null hypothesis: M5.5+ events on subduction zones are Poisson-
// distributed and independent of upstream solar wind state.
//
// Data sources:
//   - LIVE: DSCOVR plasma + mag (7-day, already in ESO)
//   - HISTORICAL: NASA OMNI hourly via OMNIWeb CGI (backfill)
//   - SEISMIC: USGS FDSNWS M5.5+ (arbitrary date range)
// ════════════════════════════════════════════════════════

(function() {
  'use strict';

  // ── CONSTANTS ─────────────────────────────────────────
  var THESIS_ID       = 'thesis-a-solar-seismic';
  var SW_SPEED_THRESH = 600;   // km/s
  var BZ_THRESH       = -10;   // nT (southward)
  var SUSTAIN_HOURS   = 3;     // trigger needs ~3h sustained
  var LAG_MIN_H       = 24;    // window start (hours after trigger)
  var LAG_MAX_H       = 96;    // window end
  var QUAKE_MIN_MAG   = 5.5;
  var FALSIFY_N       = 30;    // min trigger events for conclusion
  var FALSIFY_P       = 0.10;  // p-value threshold

  // ── HISTORICAL DATA CACHE ─────────────────────────────
  var _omniData    = null;     // [{ts, swspd, bz}, ...] hourly
  var _histQuakes  = null;     // [{ts, lat, lon, mag, place}, ...]
  var _backfillDone = false;
  var _backfillYears = 15;     // 15-year backfill (post-audit v2)

  // ── OMNI HISTORICAL FETCH ─────────────────────────────
  // NASA OMNIWeb provides hourly merged solar wind data.
  // We use the CGI interface which returns ASCII tables.
  // Variables: 24=SW speed (km/s), 25=SW density, 15=Bz GSM (nT)
  async function fetchOMNIHistorical() {
    if (_omniData) return _omniData;

    var endDate   = new Date();
    var startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - _backfillYears);

    var startStr = startDate.getFullYear() + String(startDate.getMonth()+1).padStart(2,'0') +
                   String(startDate.getDate()).padStart(2,'0');
    var endStr   = endDate.getFullYear() + String(endDate.getMonth()+1).padStart(2,'0') +
                   String(endDate.getDate()).padStart(2,'0');

    // OMNIWeb CGI returns ASCII. We parse it.
    // Vars: 24 = bulk speed, 15 = Bz GSM
    var url = 'https://omniweb.gsfc.nasa.gov/cgi/nx1.cgi?activity=retrieve' +
              '&spacecraft=omni2' +
              '&start_date=' + startStr +
              '&end_date=' + endStr +
              '&res_code=hour' +
              '&vars=24&vars=15' +
              '&output_type=1';

    try {
      var resp = await fetch(url);
      if (!resp.ok) throw new Error('OMNI fetch failed: ' + resp.status);
      var text = await resp.text();
      _omniData = _parseOMNI(text);
      return _omniData;
    } catch(e) {
      console.warn('[Thesis A] OMNI fetch failed, using DSCOVR 7-day only:', e.message);
      // Fallback: parse existing DSCOVR 7-day data
      _omniData = _parseDSCOVRFallback();
      return _omniData;
    }
  }

  function _parseOMNI(text) {
    // OMNIWeb ASCII format: lines starting with year DOY hour val1 val2 ...
    // Fill values: 9999.9 or 99999
    var lines = text.split('\n');
    var data = [];
    var inData = false;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      // Data lines start with a 4-digit year
      if (/^\d{4}\s+\d+\s+\d+/.test(line)) {
        inData = true;
        var parts = line.split(/\s+/);
        if (parts.length >= 4) {
          var year = parseInt(parts[0]);
          var doy  = parseInt(parts[1]);
          var hour = parseInt(parts[2]);
          var speed = parseFloat(parts[3]);
          var bz    = parts.length >= 5 ? parseFloat(parts[4]) : null;

          // Skip fill values
          if (speed > 9990) speed = null;
          if (bz !== null && (bz > 999 || bz < -999)) bz = null;

          // Convert year+DOY+hour to timestamp
          var dt = new Date(Date.UTC(year, 0, doy, hour, 0, 0));
          data.push({ ts: dt.getTime(), swspd: speed, bz: bz });
        }
      }
    }
    return data;
  }

  function _parseDSCOVRFallback() {
    // Use the 7-day DSCOVR data already in ESO
    // We'll pull from the raw JSON stored in state if available
    var data = [];
    try {
      if (typeof _dscovr_plasma_raw !== 'undefined' && _dscovr_plasma_raw) {
        _dscovr_plasma_raw.slice(1).forEach(function(row) {
          if (!row || !row[0]) return;
          var ts = new Date(row[0] + ' UTC').getTime();
          var speed = row[2] !== null ? Number(row[2]) : null;
          if (!isNaN(ts) && speed !== null) {
            data.push({ ts: ts, swspd: speed, bz: null });
          }
        });
      }
      // Merge Bz from mag data
      if (typeof _dscovr_mag_raw !== 'undefined' && _dscovr_mag_raw) {
        var bzMap = {};
        _dscovr_mag_raw.slice(1).forEach(function(row) {
          if (!row || !row[0] || row[3] === null) return;
          // Round to nearest hour for matching
          var ts = new Date(row[0] + ' UTC').getTime();
          var hr = Math.round(ts / 3600000) * 3600000;
          bzMap[hr] = Number(row[3]);
        });
        data.forEach(function(d) {
          var hr = Math.round(d.ts / 3600000) * 3600000;
          if (bzMap[hr] !== undefined) d.bz = bzMap[hr];
        });
      }
    } catch(e) { /* no raw data available */ }
    return data;
  }

  // ── HISTORICAL USGS SEISMICITY FETCH ──────────────────
  async function fetchHistoricalQuakes() {
    if (_histQuakes) return _histQuakes;

    var endDate   = new Date();
    var startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - _backfillYears);

    var url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson' +
              '&starttime=' + startDate.toISOString().slice(0,10) +
              '&endtime=' + endDate.toISOString().slice(0,10) +
              '&minmagnitude=' + QUAKE_MIN_MAG +
              '&orderby=time&limit=20000';

    try {
      var resp = await fetch(url);
      if (!resp.ok) throw new Error('USGS historical fetch: ' + resp.status);
      var json = await resp.json();
      _histQuakes = (json.features || []).map(function(f) {
        var p = f.properties;
        var c = f.geometry.coordinates;
        return {
          ts:    p.time,
          lat:   c[1],
          lon:   c[0],
          depth: c[2],
          mag:   p.mag,
          place: p.place || ''
        };
      });
      return _histQuakes;
    } catch(e) {
      console.warn('[Thesis A] Historical quakes fetch failed:', e.message);
      _histQuakes = [];
      return _histQuakes;
    }
  }

  // ── SUBDUCTION ZONE FILTER ────────────────────────────
  function isOnSubductionZone(lat, lon) {
    if (typeof bathymetryLookup === 'function') {
      var result = bathymetryLookup(lat, lon);
      return result.onSubductionZone;
    }
    // Fallback: use SUBDUCTION_ZONES directly
    if (typeof SUBDUCTION_ZONES === 'undefined') return false;
    for (var i = 0; i < SUBDUCTION_ZONES.length; i++) {
      var z = SUBDUCTION_ZONES[i];
      if (lat >= z[1] && lat <= z[2]) {
        var lonNorm = lon;
        while (lonNorm > 180) lonNorm -= 360;
        while (lonNorm < -180) lonNorm += 360;
        if (z[3] <= z[4]) {
          if (lonNorm >= z[3] && lonNorm <= z[4]) return true;
        } else {
          // Antimeridian crossing
          if (lonNorm >= z[3] || lonNorm <= z[4]) return true;
        }
      }
    }
    return false;
  }

  // ── TRIGGER DETECTION ─────────────────────────────────
  // Called by the framework every 5 minutes with live data.
  // Returns a trigger object if conditions are met, null otherwise.
  function detectTrigger(liveData) {
    if (!liveData) return null;
    var swspd = liveData.swspd;
    var bz    = liveData.bz;

    // Need at least one metric
    if (swspd === null && bz === null) return null;
    if (swspd === undefined && bz === undefined) return null;

    var speedTriggered = (swspd !== null && swspd !== undefined && swspd >= SW_SPEED_THRESH);
    var bzTriggered    = (bz !== null && bz !== undefined && bz <= BZ_THRESH);

    if (!speedTriggered && !bzTriggered) return null;

    // For sustained check in live mode, we use a simple heuristic:
    // if current reading exceeds threshold, assume it's been elevated
    // (proper sustained check runs on historical data with hourly resolution)
    return {
      ts: Date.now(),
      values: {
        swspd: swspd,
        bz: bz,
        kp: liveData.kp || null
      },
      reason: (speedTriggered ? 'SW≥' + SW_SPEED_THRESH + 'km/s' : '') +
              (speedTriggered && bzTriggered ? ' + ' : '') +
              (bzTriggered ? 'Bz≤' + BZ_THRESH + 'nT' : '')
    };
  }

  // ── OUTCOME MEASUREMENT ───────────────────────────────
  // After a trigger window closes, check if M5.5+ events
  // occurred on subduction zones during the lag window.
  function measureOutcome(trigger) {
    var windowStart = trigger.ts + (LAG_MIN_H * 3600000);
    var windowEnd   = trigger.windowEnd || (trigger.ts + (LAG_MAX_H * 3600000));

    // Check USGS quakes in state (live data)
    var quakesInWindow = [];

    // Try historical dataset first (if backfill done)
    var quakeSource = _histQuakes || [];

    // Also check live quakes from ESO state
    if (typeof state !== 'undefined' && state.data && state.data.seismic && state.data.seismic.quakes) {
      quakeSource = quakeSource.concat(state.data.seismic.quakes.map(function(q) {
        return { ts: q.time, lat: q.lat, lon: q.lon, mag: q.mag, place: q.place || '' };
      }));
    }

    quakeSource.forEach(function(q) {
      if (q.ts >= windowStart && q.ts <= windowEnd && q.mag >= QUAKE_MIN_MAG) {
        if (isOnSubductionZone(q.lat, q.lon)) {
          quakesInWindow.push(q);
        }
      }
    });

    return {
      hit:    quakesInWindow.length > 0,
      quakes: quakesInWindow,
      count:  quakesInWindow.length,
      maxMag: quakesInWindow.length > 0
        ? Math.max.apply(null, quakesInWindow.map(function(q){return q.mag;}))
        : 0
    };
  }

  // ── STATISTICAL TEST: POISSON RATE COMPARISON ─────────
  // H0: subduction M5.5+ rate during trigger windows = baseline rate
  // H1: rate is higher during trigger windows
  //
  // Method: compare observed hit rate to expected rate under Poisson null.
  // Expected rate = (baseline M5.5+ subduction events per hour) × (window duration in hours)
  function computeStats(evidence) {
    var triggers = evidence.triggers || [];
    var resolved = triggers.filter(function(t) { return t.resolved; });
    if (resolved.length < 3) return { pValue: null, rateRatio: null, effectSize: null, n: resolved.length };

    // Observed: how many trigger windows had M5.5+ subduction quake
    var hits = resolved.filter(function(t) { return t.outcome && t.outcome.hit; }).length;
    var n    = resolved.length;
    var observedRate = hits / n;

    // Baseline: estimate from historical catalog if available
    var baselineRate = _computeBaselineRate();

    // Poisson test: under null, probability of ≥hits successes in n trials
    // where each trial has probability = baselineRate
    // This is a binomial test (one-sided, testing if observed > expected)
    var pValue = _binomialTestOneSided(hits, n, baselineRate);

    var rateRatio = baselineRate > 0 ? observedRate / baselineRate : null;

    // Cohen's h effect size for proportions
    var effectSize = 2 * Math.asin(Math.sqrt(observedRate)) - 2 * Math.asin(Math.sqrt(baselineRate));

    return {
      pValue:       pValue,
      rateRatio:    rateRatio,
      effectSize:   Math.abs(effectSize),
      observedRate: observedRate,
      baselineRate: baselineRate,
      hits:         hits,
      n:            n
    };
  }

  function _computeBaselineRate() {
    // What fraction of random 72h windows (24–96h after any moment)
    // contain an M5.5+ subduction zone quake?
    //
    // Global M5.5+ rate: ~1200/year ≈ 3.3/day
    // Subduction zones account for ~80% of large earthquakes
    // So subduction M5.5+ ≈ 2.6/day
    // In a 72h window: expected count ≈ 7.8
    // P(at least 1 in window) ≈ 1 - e^(-7.8) ≈ 0.9996
    //
    // That's too high — nearly every window will have a hit.
    // We need to be more selective. Use M6.0+ or region-specific rates.
    //
    // With historical data available, compute empirically.
    if (_histQuakes && _histQuakes.length > 0) {
      // Count M5.5+ subduction quakes
      var subdQuakes = _histQuakes.filter(function(q) {
        return q.mag >= QUAKE_MIN_MAG && isOnSubductionZone(q.lat, q.lon);
      });
      var timeSpanMs = _backfillYears * 365.25 * 24 * 3600000;

      // Rate per hour
      var ratePerHour = subdQuakes.length / (timeSpanMs / 3600000);
      // Expected count in a 72h window
      var windowHours = LAG_MAX_H - LAG_MIN_H;
      var expectedCount = ratePerHour * windowHours;
      // P(at least 1) = 1 - P(0) = 1 - e^(-expectedCount)
      var pAtLeast1 = 1 - Math.exp(-expectedCount);

      return pAtLeast1;
    }

    // Fallback estimate: ~0.85 (most 72h windows have at least one M5.5+ subduction quake)
    // This is conservative — makes it harder to show significance
    return 0.85;
  }

  // ── BINOMIAL TEST (one-sided, P(X ≥ k)) ──────────────
  function _binomialTestOneSided(k, n, p) {
    // P(X ≥ k) where X ~ Binomial(n, p)
    // Using normal approximation for large n, exact for small n
    if (n < 30) {
      // Exact: sum P(X=j) for j=k..n
      var pVal = 0;
      for (var j = k; j <= n; j++) {
        pVal += _binomialPMF(j, n, p);
      }
      return Math.min(1, Math.max(0, pVal));
    } else {
      // Normal approximation with continuity correction
      var mu    = n * p;
      var sigma = Math.sqrt(n * p * (1-p));
      if (sigma < 0.001) return k > mu ? 0 : 1;
      var z = (k - 0.5 - mu) / sigma;
      return 1 - _normalCDF(z);
    }
  }

  function _binomialPMF(k, n, p) {
    // log(C(n,k)) + k*log(p) + (n-k)*log(1-p)
    var logC = _logChoose(n, k);
    var logP = k * Math.log(p) + (n-k) * Math.log(1-p);
    return Math.exp(logC + logP);
  }

  function _logChoose(n, k) {
    if (k > n) return -Infinity;
    if (k === 0 || k === n) return 0;
    var r = 0;
    for (var i = 0; i < k; i++) {
      r += Math.log(n - i) - Math.log(i + 1);
    }
    return r;
  }

  function _normalCDF(z) {
    // Abramowitz & Stegun approximation
    if (z < -8) return 0;
    if (z >  8) return 1;
    var t = 1 / (1 + 0.2316419 * Math.abs(z));
    var d = 0.3989422804014327; // 1/sqrt(2pi)
    var p = d * Math.exp(-z*z/2) *
            (t*(0.319381530 + t*(-0.356563782 + t*(1.781477937 + t*(-1.821255978 + t*1.330274429)))));
    return z > 0 ? 1 - p : p;
  }

  // ── BACKFILL: LOAD PRE-COMPUTED HISTORICAL ANALYSIS ────
  // The Python script backfill-thesis-a.py fetches 15 years of
  // OMNI + USGS data (no CORS restrictions), runs trigger detection
  // and outcome measurement, and saves thesis-a-backfill.json.
  // Uses a FileReader file-picker to avoid file:// protocol CORS blocks.

  function pickBackfillFile() {
    // Create or reuse a hidden file input — avoids fetch() CORS issues on file://
    var input = document.getElementById('thesis-backfill-file-input');
    if (!input) {
      input = document.createElement('input');
      input.type = 'file';
      input.id = 'thesis-backfill-file-input';
      input.accept = '.json';
      input.style.display = 'none';
      input.addEventListener('change', function(e) {
        var file = e.target.files && e.target.files[0];
        if (file) _loadBackfillFromFile(file);
        input.value = ''; // reset so same file can be re-selected
      });
      document.body.appendChild(input);
    }
    input.click();
  }

  function _loadBackfillFromFile(file) {
    var statusEl = document.getElementById('thesis-backfill-status');
    if (statusEl) statusEl.textContent = 'Reading ' + file.name + '…';
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var data = JSON.parse(e.target.result);
        _processBackfillData(data, statusEl);
      } catch(err) {
        if (statusEl) statusEl.innerHTML = '<span style="color:#ff5252;">JSON parse error: ' + err.message + '</span>';
      }
    };
    reader.onerror = function() {
      if (statusEl) statusEl.innerHTML = '<span style="color:#ff5252;">Could not read file.</span>';
    };
    reader.readAsText(file);
  }

  function _processBackfillData(data, statusEl) {
    if (!data.triggers || data.triggers.length === 0) {
      if (statusEl) statusEl.textContent = 'Backfill file loaded but contains no triggers.';
      return;
    }

    // Load triggers into evidence store
    var ev = ThesisFramework.getEvidence(THESIS_ID);
    // Clear existing backfill data (keep live triggers)
    var liveTriggers = (ev && ev.triggers) ? ev.triggers.filter(function(t) { return !t.backfill; }) : [];
    if (ev) { ev.triggers = liveTriggers; }

    // Add all backfill triggers (already resolved by Python script)
    data.triggers.forEach(function(t) {
      t.backfill = true;
      ThesisFramework.recordTrigger(THESIS_ID, t);
    });

    // Copy pre-computed stats if available
    ev = ThesisFramework.getEvidence(THESIS_ID);
    if (ev && data.stats) { ev.stats = data.stats; }

    _backfillDone = true;
    _backfillMeta = data.meta || {};

    ThesisFramework.renderThesisPanel();

    var resolved = data.triggers.filter(function(t){ return t.resolved; });
    var hits = resolved.filter(function(t){ return t.outcome && t.outcome.hit; });
    var msg = 'Backfill loaded: ' + resolved.length + ' trigger events, ' + hits.length + ' hits';
    if (data.stats && data.stats.pValue !== null) {
      msg += ' (p=' + data.stats.pValue + ')';
    }
    if (statusEl) statusEl.textContent = msg;
  }

  // Legacy alias kept for fetchHistoricalFn reference
  function runBackfill() { pickBackfillFile(); }

  var _backfillMeta = {};

  function _findHistoricalTriggers(omniData) {
    // Scan hourly OMNI data for sustained threshold exceedances
    var triggers = [];
    var i = 0;
    while (i < omniData.length) {
      var d = omniData[i];
      var speedOk = (d.swspd !== null && d.swspd >= SW_SPEED_THRESH);
      var bzOk    = (d.bz !== null && d.bz <= BZ_THRESH);

      if (speedOk || bzOk) {
        // Check if sustained for SUSTAIN_HOURS
        var sustained = 1;
        for (var j = 1; j < SUSTAIN_HOURS && (i+j) < omniData.length; j++) {
          var d2 = omniData[i+j];
          var s2 = (d2.swspd !== null && d2.swspd >= SW_SPEED_THRESH);
          var b2 = (d2.bz !== null && d2.bz <= BZ_THRESH);
          if (s2 || b2) sustained++;
        }

        if (sustained >= SUSTAIN_HOURS) {
          // Find peak values in the sustained window
          var peakSpeed = d.swspd || 0;
          var peakBz    = d.bz || 0;
          for (var k = 1; k < SUSTAIN_HOURS && (i+k) < omniData.length; k++) {
            var dk = omniData[i+k];
            if (dk.swspd !== null && dk.swspd > peakSpeed) peakSpeed = dk.swspd;
            if (dk.bz !== null && dk.bz < peakBz) peakBz = dk.bz;
          }

          triggers.push({
            ts: d.ts,
            windowEnd: d.ts + (LAG_MAX_H * 3600000),
            values: { swspd: peakSpeed, bz: peakBz },
            reason: (peakSpeed >= SW_SPEED_THRESH ? 'SW≥' + SW_SPEED_THRESH : '') +
                    ((peakSpeed >= SW_SPEED_THRESH && peakBz <= BZ_THRESH) ? ' + ' : '') +
                    (peakBz <= BZ_THRESH ? 'Bz≤' + BZ_THRESH : ''),
            sustained: sustained + 'h',
            backfill: true,
            resolved: false
          });

          // Skip ahead past this trigger + its window to avoid overlapping triggers
          i += Math.max(SUSTAIN_HOURS, 24); // minimum 24h between triggers
          continue;
        }
      }
      i++;
    }
    return triggers;
  }

  // ── CUSTOM RENDER ─────────────────────────────────────
  // Thesis A gets a custom panel with backfill button and methodology
  function renderPanel(container, evidence, stats) {
    var resolved = evidence.triggers.filter(function(t) { return t.resolved; });
    var hits     = resolved.filter(function(t) { return t.outcome && t.outcome.hit; });
    var open     = evidence.triggers.filter(function(t) { return !t.resolved; });
    var backfill = resolved.filter(function(t) { return t.backfill; });

    var html = '';

    // ── Hypothesis statements
    html += '<div class="thesis-statement">';
    html += '<div class="thesis-h-label">H₁ — HYPOTHESIS</div>';
    html += '<div class="thesis-h-text">Elevated solar wind speed (≥' + SW_SPEED_THRESH + ' km/s) or strongly southward IMF Bz (≤' + BZ_THRESH + ' nT), sustained for ' + SUSTAIN_HOURS + '+ hours, triggers increased M' + QUAKE_MIN_MAG + '+ seismicity on subduction zones within a ' + LAG_MIN_H + '–' + LAG_MAX_H + 'h lag window.</div>';
    html += '</div>';

    html += '<div class="thesis-statement" style="border-left-color:#ff5252;">';
    html += '<div class="thesis-h-label" style="color:#ff5252;">H₀ — NULL</div>';
    html += '<div class="thesis-h-text" style="opacity:.75;">M' + QUAKE_MIN_MAG + '+ events on subduction zones are Poisson-distributed and independent of upstream solar wind conditions. Any apparent clustering in post-trigger windows is due to chance.</div>';
    html += '</div>';

    // ── Evidence summary bar
    html += '<div class="thesis-evidence-bar">';
    html += '<div class="thesis-ev-stat"><span class="thesis-ev-num">' + evidence.triggers.length + '</span><span class="thesis-ev-label">Triggers</span></div>';
    html += '<div class="thesis-ev-stat"><span class="thesis-ev-num">' + resolved.length + '</span><span class="thesis-ev-label">Resolved</span></div>';
    html += '<div class="thesis-ev-stat"><span class="thesis-ev-num">' + hits.length + '</span><span class="thesis-ev-label">Hits</span></div>';
    html += '<div class="thesis-ev-stat"><span class="thesis-ev-num">' + open.length + '</span><span class="thesis-ev-label">Open</span></div>';
    html += '</div>';

    // ── Running statistics
    if (stats && stats.pValue !== null && stats.pValue !== undefined) {
      var pColor = stats.pValue < 0.05 ? '#00e676' : stats.pValue < 0.10 ? '#ffd600' : '#ff5252';
      html += '<div class="thesis-stats-row">';
      html += '<span>p-value: <strong style="color:' + pColor + ';">' + (stats.pValue < 0.001 ? '<0.001' : stats.pValue.toFixed(4)) + '</strong></span>';
      if (stats.rateRatio !== null) {
        html += '<span>Rate ratio: <strong>' + stats.rateRatio.toFixed(2) + '×</strong></span>';
      }
      html += '<span>Observed: <strong>' + (stats.observedRate * 100).toFixed(1) + '%</strong></span>';
      html += '<span>Baseline: <strong>' + (stats.baselineRate * 100).toFixed(1) + '%</strong></span>';
      html += '</div>';
    }

    // ── Falsification status
    var progress = Math.min(1, resolved.length / FALSIFY_N);
    var barWidth = Math.round(progress * 100);
    var fStatus, fColor;
    if (resolved.length < FALSIFY_N) {
      fStatus = 'COLLECTING — ' + resolved.length + '/' + FALSIFY_N + ' events needed';
      fColor = 'var(--text-dim)';
    } else if (stats && stats.pValue !== null && stats.pValue < FALSIFY_P) {
      fStatus = 'EVIDENCE SUPPORTS H₁ — p=' + stats.pValue.toFixed(4) + ' < ' + FALSIFY_P;
      fColor = '#00e676';
    } else if (stats && stats.pValue !== null) {
      fStatus = 'INSUFFICIENT EVIDENCE — p=' + stats.pValue.toFixed(3) + ' ≥ ' + FALSIFY_P + ' → cannot reject H₀';
      fColor = '#ff5252';
    } else {
      fStatus = 'AWAITING ANALYSIS';
      fColor = 'var(--text-dim)';
    }

    html += '<div class="thesis-falsification">';
    html += '<div style="font-size:7.5px;color:var(--text-dim);margin-bottom:3px;letter-spacing:.1em;">FALSIFICATION THRESHOLD</div>';
    html += '<div style="background:var(--bg2);border-radius:3px;height:6px;overflow:hidden;margin-bottom:4px;">';
    html += '<div style="width:' + barWidth + '%;height:100%;background:' + fColor + ';border-radius:3px;transition:width .3s;"></div>';
    html += '</div>';
    html += '<div style="font-size:8px;color:' + fColor + ';">' + fStatus + '</div>';
    html += '</div>';

    // ── Historical backfill section
    html += '<div style="margin-top:12px;padding:8px 10px;background:var(--bg2);border-radius:4px;border:1px solid var(--border);">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
    html += '<div>';
    html += '<div style="font-size:8.5px;font-weight:700;color:var(--c-cyan);">Historical Backfill</div>';
    html += '<div style="font-size:7.5px;color:var(--text-dim);">' + _backfillYears + ' years of NASA OMNI + USGS data</div>';
    html += '</div>';
    if (!_backfillDone) {
      html += '<button onclick="ThesisA.pickBackfillFile()" style="background:var(--c-cyan);color:#000;border:none;padding:4px 12px;border-radius:3px;font-size:8px;cursor:pointer;font-weight:700;">Load Backfill</button>';
    } else {
      html += '<span style="font-size:8px;color:#00e676;">✓ Loaded (' + backfill.length + ' events)</span>';
    }
    html += '</div>';
    if (!_backfillDone) {
      html += '<div style="font-size:7.5px;color:var(--text-dim);margin-top:6px;line-height:1.6;">';
      html += '<strong>Step 1:</strong> Open a terminal in your ESO folder<br>';
      html += '<strong>Step 2:</strong> Run <code style="background:var(--bg3);padding:1px 4px;border-radius:2px;color:var(--c-cyan);">python3 backfill-thesis-a.py</code><br>';
      html += '<strong>Step 3:</strong> Click <strong>Load Backfill</strong> above to import the results';
      html += '</div>';
    } else if (_backfillMeta && _backfillMeta.dateRange) {
      html += '<div style="font-size:7px;color:var(--text-dim);margin-top:4px;opacity:.6;">';
      html += 'Data range: ' + (_backfillMeta.dateRange.start || '').slice(0,10) + ' to ' + (_backfillMeta.dateRange.end || '').slice(0,10);
      html += ' · ' + (_backfillMeta.omniRecords || 0).toLocaleString() + ' OMNI records · ' + (_backfillMeta.totalQuakes || 0) + ' quakes';
      html += '</div>';
    }
    html += '<div id="thesis-backfill-status" style="font-size:7.5px;color:var(--text-dim);margin-top:4px;"></div>';
    html += '</div>';

    // ── Research document link
    html += '<div style="margin-top:8px;padding:8px 10px;background:var(--bg2);border-radius:4px;border:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:8px;">';
    html += '<div style="flex:1;min-width:0;">';
    html += '<div style="font-size:8.5px;font-weight:700;color:var(--c-cyan);">📄 Research Document</div>';
    html += '<div style="font-size:7.5px;color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="Thesis A — Severe Geomagnetic Storms and Subduction Zone Seismicity.pdf">Thesis A — Severe Geomagnetic Storms and Subduction Zone Seismicity.pdf</div>';
    html += '<div style="font-size:7px;color:var(--text-dim);margin-top:2px;opacity:.6;">Null: Bz≤−10 nT (p=0.663) &nbsp;·&nbsp; Finding: Bz≤−12 nT → M7+ (p=0.003, RR=3.6×)</div>';
    html += '</div>';
    html += '<a href="Thesis A \u2014 Severe Geomagnetic Storms and Subduction Zone Seismicity.pdf" target="_blank" title="Open research document" style="flex-shrink:0;background:var(--c-cyan);color:#000;border:none;padding:4px 9px;border-radius:3px;font-size:7.5px;cursor:pointer;white-space:nowrap;text-decoration:none;font-weight:700;">&#128065; Open</a>';
    html += '</div>';

    // ── Cumulative evidence chart
    html += '<div style="margin-top:10px;">';
    html += '<div style="font-size:8px;color:var(--text-dim);margin-bottom:4px;">Cumulative hit rate vs. baseline expectation</div>';
    html += '<canvas id="thesis-cumulative-canvas" width="560" height="120" style="width:100%;border:1px solid var(--border);border-radius:4px;"></canvas>';
    html += '</div>';

    // ── Prospective monitoring log (Bz ≤ −12 nT severe storm tracker)
    html += _renderProspectiveLog();

    // ── Methodology note
    html += '<details style="margin-top:10px;font-size:7.5px;color:var(--text-dim);line-height:1.6;">';
    html += '<summary style="cursor:pointer;color:var(--c-cyan);letter-spacing:.07em;outline:none;">📐 Methodology</summary>';
    html += '<div style="padding:6px 0 2px;opacity:.85;">';
    html += '<b>Trigger criteria:</b> Solar wind speed ≥' + SW_SPEED_THRESH + ' km/s OR Bz ≤' + BZ_THRESH + ' nT, sustained ' + SUSTAIN_HOURS + '+ consecutive hours. Minimum 24h between triggers to avoid overlap.<br>';
    html += '<b>Outcome window:</b> ' + LAG_MIN_H + '–' + LAG_MAX_H + 'h after trigger onset.<br>';
    html += '<b>Outcome criterion:</b> ≥1 M' + QUAKE_MIN_MAG + '+ earthquake on a named subduction zone (20 zones from ESO SUBDUCTION_ZONES table).<br>';
    html += '<b>Statistical test:</b> One-sided binomial test. H₀: hit rate = baseline rate (empirical Poisson estimate from ' + _backfillYears + '-year catalog). H₁: hit rate > baseline rate.<br>';
    html += '<b>Falsification:</b> After ' + FALSIFY_N + ' resolved trigger events, if p ≥ ' + FALSIFY_P + ', H₁ is not supported.<br>';
    html += '<b>Effect size:</b> Cohen\'s h for proportion comparison.<br>';
    html += '<b>Data sources:</b> NASA OMNI hourly (historical), NOAA DSCOVR (live), USGS FDSNWS (seismicity).';
    html += '</div></details>';

    // ── Recent trigger events
    html += '<div style="margin-top:10px;">';
    html += '<div style="font-size:8px;color:var(--text-dim);margin-bottom:4px;">Recent trigger events (newest first)</div>';
    html += '<div id="thesis-trigger-log" style="max-height:200px;overflow-y:auto;">';
    var recent = evidence.triggers.slice(-25).reverse();
    if (recent.length === 0) {
      html += '<div style="color:var(--text-dim);text-align:center;padding:15px 0;font-size:8px;opacity:.5;">No trigger events yet — activate thesis and wait for solar wind exceedance, or run historical backfill.</div>';
    } else {
      recent.forEach(function(t) {
        var statusBadge = '';
        if (t.resolved && t.outcome) {
          statusBadge = t.outcome.hit
            ? '<span style="color:#00e676;font-weight:700;">HIT</span> <span style="font-size:7px;opacity:.6;">(M' + (t.outcome.maxMag || '?') + ', n=' + (t.outcome.count || 0) + ')</span>'
            : '<span style="color:#ff5252;">MISS</span>';
        } else {
          var remaining = Math.max(0, Math.round((t.windowEnd - Date.now()) / 3600000));
          statusBadge = '<span style="color:#ffd600;">OPEN (' + remaining + 'h)</span>';
        }
        var dt = new Date(t.ts).toISOString().replace('T',' ').slice(0,16) + 'Z';
        var src = t.backfill ? '<span style="font-size:6.5px;opacity:.4;">HIST</span> ' : '';
        html += '<div class="thesis-trigger-entry">';
        html += '<span class="thesis-trigger-time">' + src + dt + '</span>';
        html += '<span class="thesis-trigger-vals">' + (t.reason || _fmtVals(t.values)) + '</span>';
        html += '<span class="thesis-trigger-status">' + statusBadge + '</span>';
        html += '</div>';
      });
    }
    html += '</div></div>';

    container.innerHTML = html;

    // Draw cumulative chart after DOM update
    setTimeout(function() { ThesisFramework.drawCumulativeChart(THESIS_ID); }, 50);
  }

  function _fmtVals(v) {
    if (!v) return '—';
    var p = [];
    if (v.swspd !== undefined && v.swspd !== null) p.push('SW:' + Math.round(v.swspd) + 'km/s');
    if (v.bz !== undefined && v.bz !== null)       p.push('Bz:' + v.bz.toFixed(1) + 'nT');
    return p.join(' · ') || '—';
  }

  // ════════════════════════════════════════════════════════
  // PROSPECTIVE MONITORING LOG — Bz ≤ −12 nT trigger logger
  // Records severe geomagnetic storm events in real time for
  // the pre-registered 2-3 year prospective replication study.
  // Pre-registration: 25+ new triggers over 2026-2028, same
  // Bz ≤ −12 nT / M7+ / 24-96h lag / subduction criteria.
  // ════════════════════════════════════════════════════════

  var BZ_SEVERE      = -12;    // nT threshold for severe storm (Thesis A exploratory)
  var PROSP_STORE    = 'eso-thesis-a-prospective-v1';
  var PROSP_CONCLUDED_TS = new Date('2026-04-02').getTime(); // Thesis A conclusion date
  var _prospLog      = [];     // [{triggerNum, date, ts, peakBz, sustainedHours, outcome}]
  var _bzBuffer      = [];     // rolling ~6-entry Bz history from DSCOVR refresh cycle

  function _loadProspLog() {
    try {
      var raw = localStorage.getItem(PROSP_STORE);
      if (raw) _prospLog = JSON.parse(raw);
    } catch(e) { _prospLog = []; }
  }

  function _saveProspLog() {
    try { localStorage.setItem(PROSP_STORE, JSON.stringify(_prospLog)); } catch(e) {}
  }

  // Called each time DSCOVR Bz updates (from the outer window._swBz global set by fetchDSCOVR).
  // Maintains a rolling buffer and fires a trigger when Bz ≤ −12 nT is sustained.
  function checkProspectiveBzTrigger() {
    var bz = (typeof _swBz !== 'undefined' && _swBz !== null) ? _swBz : null;
    if (bz === null) return;

    // Push to rolling 6-slot buffer (DSCOVR refreshes every 5 min; 6 slots ≈ 30 min window)
    _bzBuffer.push({ ts: Date.now(), bz: bz });
    if (_bzBuffer.length > 18) _bzBuffer.shift();  // ~90 min max buffer

    // Require Bz ≤ −12 nT in at least 10 of the last 18 readings (≈ 3h of 5-min data)
    var severeCount = _bzBuffer.filter(function(r) { return r.bz <= BZ_SEVERE; }).length;
    if (severeCount < 10) return;

    var peakBz = Math.min.apply(null, _bzBuffer.map(function(r) { return r.bz; }));

    // Enforce 10-day minimum gap between prospective triggers
    var tenDaysAgo = Date.now() - 10 * 86400000;
    var recentTrigger = _prospLog.find(function(t) { return t.ts > tenDaysAgo; });
    if (recentTrigger) return;

    // Only log triggers after Thesis A conclusion
    if (Date.now() < PROSP_CONCLUDED_TS) return;

    var entry = {
      triggerNum:     _prospLog.length + 1,
      ts:             Date.now(),
      date:           new Date().toISOString().split('T')[0],
      peakBz:         parseFloat(peakBz.toFixed(1)),
      sustainedSlots: severeCount,
      outcome:        null,  // filled in manually or via future backfill run
      hit:            null,
    };
    _prospLog.push(entry);
    _saveProspLog();
    // Refresh panel if Thesis A is currently rendered
    var container = document.getElementById('dst-thesis');
    if (container) {
      var evidence = (typeof ThesisFramework !== 'undefined')
        ? ThesisFramework.getEvidence(THESIS_ID) : null;
      if (evidence) renderPanel(container, evidence, evidence.stats || {});
    }
  }

  // Renders the prospective monitoring section — called from within renderPanel()
  function _renderProspectiveLog() {
    var html = '';
    html += '<div style="margin-top:12px;padding:8px 10px;background:var(--bg2);border-radius:4px;border:1px solid rgba(255,145,0,.35);">';
    html += '<div style="font-size:8.5px;font-weight:700;color:#ff9100;margin-bottom:4px;letter-spacing:.06em;">📡 PROSPECTIVE LOG — Bz ≤ −12 nT</div>';
    html += '<div style="font-size:7.5px;color:var(--text-dim);margin-bottom:6px;line-height:1.5;">';
    html += 'Pre-registered replication study: 25+ new triggers required over 2026–2028. ';
    html += 'Triggers auto-logged from live DSCOVR Bz. Outcomes recorded retrospectively.';
    html += '</div>';

    if (_prospLog.length === 0) {
      html += '<div style="font-size:7.5px;color:var(--text-dim);text-align:center;padding:8px 0;opacity:.5;">No severe storm triggers logged yet since 2026-04-02.</div>';
    } else {
      html += '<div style="font-size:7.5px;color:var(--text-dim);margin-bottom:4px;">' +
        _prospLog.length + ' trigger' + (_prospLog.length === 1 ? '' : 's') + ' logged · ' +
        _prospLog.filter(function(t){ return t.hit === true; }).length + ' hits · ' +
        _prospLog.filter(function(t){ return t.hit === false; }).length + ' misses · ' +
        _prospLog.filter(function(t){ return t.hit === null; }).length + ' pending</div>';
      html += '<div style="max-height:130px;overflow-y:auto;">';
      _prospLog.slice().reverse().forEach(function(t) {
        var hitCol = t.hit === true ? '#00e676' : t.hit === false ? '#ff5252' : '#ffd600';
        var hitLabel = t.hit === true ? 'HIT' : t.hit === false ? 'MISS' : 'PENDING';
        html += '<div style="display:flex;gap:6px;align-items:center;padding:2px 0;border-bottom:1px solid var(--border);font-size:7.5px;">';
        html += '<span style="color:var(--text-dim);min-width:20px;">#' + t.triggerNum + '</span>';
        html += '<span style="color:var(--c-cyan);min-width:78px;">' + t.date + '</span>';
        html += '<span style="color:#ff9100;min-width:55px;">Bz ' + t.peakBz + ' nT</span>';
        html += '<span style="color:' + hitCol + ';font-weight:700;">' + hitLabel + '</span>';
        html += '</div>';
      });
      html += '</div>';
    }
    html += '<div style="font-size:7px;color:var(--text-dim);margin-top:5px;opacity:.65;">';
    html += 'Outcomes must be verified manually (M7+ on subduction zone, 24–96h after storm onset) ';
    html += 'then re-run <code style="background:var(--bg3);padding:1px 3px;border-radius:2px;">backfill-thesis-a.py</code> to update.';
    html += '</div>';
    html += '</div>';
    return html;
  }

  // Initialise prospective log on module load
  _loadProspLog();

  // Poll the DSCOVR Bz every 5 minutes to check severe storm threshold
  setInterval(checkProspectiveBzTrigger, 5 * 60 * 1000);

  // ── REGISTER WITH FRAMEWORK ───────────────────────────
  if (typeof ThesisFramework !== 'undefined') {
    ThesisFramework.register({
      id:             THESIS_ID,
      title:          'Solar Wind → Subduction Seismicity',
      hypothesis:     'Elevated solar wind speed (≥' + SW_SPEED_THRESH + ' km/s) or strongly southward IMF Bz (≤' + BZ_THRESH + ' nT), sustained ' + SUSTAIN_HOURS + '+ hours, triggers increased M' + QUAKE_MIN_MAG + '+ seismicity on subduction zones within ' + LAG_MIN_H + '–' + LAG_MAX_H + 'h.',
      nullHypothesis: 'M' + QUAKE_MIN_MAG + '+ events on subduction zones are Poisson-distributed and statistically independent of upstream solar wind conditions.',
      metrics:        ['swspd', 'bz', 'eq'],
      geography:      { type: 'subduction' },
      lagWindow:      { minH: LAG_MIN_H, maxH: LAG_MAX_H },
      triggerFn:      detectTrigger,
      outcomeFn:      measureOutcome,
      testFn:         computeStats,
      renderFn:       renderPanel,
      falsification:  { minTriggers: FALSIFY_N, pThreshold: FALSIFY_P },
      color:          '#ff9100',
      icon:           '☀️',
      fetchHistoricalFn: runBackfill
    });
  }

  function copyDocPath() {
    var docPath = 'Thesis A \u2014 Severe Geomagnetic Storms and Subduction Zone Seismicity.pdf';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(docPath).then(function() {
        var btn = document.querySelector('[onclick="ThesisA.copyDocPath()"]');
        if (btn) { btn.textContent = '\u2713 Copied!'; setTimeout(function(){ btn.textContent = '\uD83D\uDCCB Copy path'; }, 1800); }
      }).catch(function() { _fallbackCopy(docPath); });
    } else { _fallbackCopy(docPath); }
  }
  function _fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch(e) {}
    document.body.removeChild(ta);
  }

  // ── EXPOSE FOR BUTTON ONCLICK ─────────────────────────
  window.ThesisA = {
    runBackfill:               runBackfill,
    pickBackfillFile:          pickBackfillFile,
    copyDocPath:               copyDocPath,
    detectTrigger:             detectTrigger,
    measureOutcome:            measureOutcome,
    computeStats:              computeStats,
    THESIS_ID:                 THESIS_ID,
    checkProspectiveBzTrigger: checkProspectiveBzTrigger,
    getProspLog:               function() { return _prospLog.slice(); },
  };

})();
