// THESIS B: Tidal Triggering of Great Earthquakes — The Syzygy Question
// Load order: 7 (after thesis-a-solar-seismic.js)
// ════════════════════════════════════════════════════════════════════════
// Hypothesis: M7.5+ earthquakes on subduction zones occur at a
// statistically higher rate during high tidal stress windows
// (syzygy ±3 days) compared to the null expectation (~20.3%).
//
// Null hypothesis: M7.5+ events are temporally independent of the
// fortnightly tidal cycle (uniform distribution across lunar phase).
//
// Data sources:
//   - LIVE: Computed lunar phase (Meeus algorithm in JS)
//   - HISTORICAL: backfill-thesis-b.py output (thesis-b-backfill.json)
//   - SEISMIC: USGS FDSNWS M7.0+ (live monitoring)
// ════════════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  // ── CONSTANTS ─────────────────────────────────────────
  var THESIS_ID        = 'thesis-b-tidal-seismic';
  var PRIMARY_MAG      = 7.5;
  var QUAKE_MIN_MAG    = 7.0;    // fetch threshold (sweep goes higher)
  var SYZYGY_WINDOW_D  = 3;      // ±3 days
  var SYNODIC_MONTH    = 29.53058867; // days
  var ALPHA            = 0.01;   // pre-registered significance level
  var FALSIFY_N        = 20;     // min events for conclusion (prospective)
  var FALSIFY_P        = 0.01;   // p-value threshold

  // ── STATE ─────────────────────────────────────────────
  var _backfillDone = false;
  var _backfillData = null;

  // ══════════════════════════════════════════════════════
  // MEEUS LUNAR PHASE — JavaScript implementation
  // Identical algorithm to the Python backfill script.
  // Returns phase angle: 0° = new moon, 180° = full moon
  // ══════════════════════════════════════════════════════

  function _jd(date) {
    var y = date.getUTCFullYear();
    var m = date.getUTCMonth() + 1;
    var d = date.getUTCDate() + date.getUTCHours()/24 +
            date.getUTCMinutes()/1440 + date.getUTCSeconds()/86400;
    if (m <= 2) { y--; m += 12; }
    var A = Math.floor(y / 100);
    var B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  }

  function lunarPhaseAngle(date) {
    var jd = _jd(date);
    var T = (jd - 2451545.0) / 36525.0;

    var M_sun = (357.5291092 + 35999.0502909*T - 0.0001536*T*T) % 360;
    var M_moon = (134.9633964 + 477198.8675055*T + 0.0087414*T*T) % 360;
    var D = (297.8501921 + 445267.1114034*T - 0.0018819*T*T) % 360;
    var F = (93.2720950 + 483202.0175233*T - 0.0036539*T*T) % 360;

    var Mr = M_sun * Math.PI/180;
    var Mr2 = M_moon * Math.PI/180;
    var Dr = D * Math.PI/180;
    var Fr = F * Math.PI/180;

    var phase = D
      + 6.289 * Math.sin(Mr2)
      - 1.274 * Math.sin(2*Dr - Mr2)
      - 0.658 * Math.sin(2*Dr)
      + 0.214 * Math.sin(2*Mr2)
      - 0.186 * Math.sin(Mr)
      - 0.114 * Math.sin(2*Fr)
      + 0.059 * Math.sin(2*Dr - 2*Mr2)
      + 0.057 * Math.sin(2*Dr - Mr - Mr2);

    phase = phase % 360;
    if (phase < 0) phase += 360;
    return phase;
  }

  function phaseToCategory(phase, windowDays) {
    windowDays = windowDays || SYZYGY_WINDOW_D;
    var windowDeg = (windowDays / SYNODIC_MONTH) * 360;

    var distNew  = Math.min(phase, 360 - phase);
    var distFull = Math.abs(phase - 180);
    var distSyz  = Math.min(distNew, distFull);

    var distQ1 = Math.abs(phase - 90);
    var distQ3 = Math.abs(phase - 270);
    var distQuad = Math.min(distQ1, distQ3);

    if (distSyz <= windowDeg) {
      return { cat: 'syzygy', which: distNew <= distFull ? 'new_moon' : 'full_moon', dist: distSyz };
    } else if (distQuad <= windowDeg) {
      return { cat: 'quadrature', which: 'quarter', dist: distQuad };
    }
    return { cat: 'neutral', which: null, dist: Math.min(distSyz, distQuad) };
  }

  function syzygyFraction(windowDays) {
    windowDays = windowDays || SYZYGY_WINDOW_D;
    return Math.min(2 * (2 * windowDays / SYNODIC_MONTH), 1.0);
  }

  // Descriptive lunar phase name
  function phaseDescription(angle) {
    if (angle < 11.25 || angle >= 348.75) return 'New Moon';
    if (angle < 33.75)  return 'Waxing Crescent';
    if (angle < 56.25)  return 'Waxing Crescent';
    if (angle < 78.75)  return 'Waxing Crescent';
    if (angle < 101.25) return 'First Quarter';
    if (angle < 123.75) return 'Waxing Gibbous';
    if (angle < 146.25) return 'Waxing Gibbous';
    if (angle < 168.75) return 'Waxing Gibbous';
    if (angle < 191.25) return 'Full Moon';
    if (angle < 213.75) return 'Waning Gibbous';
    if (angle < 236.25) return 'Waning Gibbous';
    if (angle < 258.75) return 'Waning Gibbous';
    if (angle < 281.25) return 'Third Quarter';
    if (angle < 303.75) return 'Waning Crescent';
    if (angle < 326.25) return 'Waning Crescent';
    return 'Waning Crescent';
  }

  // Moon emoji for phase
  function phaseEmoji(angle) {
    if (angle < 22.5 || angle >= 337.5) return '🌑';
    if (angle < 67.5)  return '🌒';
    if (angle < 112.5) return '🌓';
    if (angle < 157.5) return '🌔';
    if (angle < 202.5) return '🌕';
    if (angle < 247.5) return '🌖';
    if (angle < 292.5) return '🌗';
    return '🌘';
  }

  // ── TRIGGER DETECTION (live monitoring) ───────────────
  // Fires when we're within ±SYZYGY_WINDOW_D days of syzygy
  // AND a M7.0+ earthquake occurs on a subduction zone.
  function detectTrigger(liveData) {
    if (!liveData || !liveData.ts) return null;

    var now = new Date(liveData.ts);
    var phase = lunarPhaseAngle(now);
    var catInfo = phaseToCategory(phase);

    // Only trigger during syzygy windows
    if (catInfo.cat !== 'syzygy') return null;

    // Check for recent M7.0+ subduction quake
    var recentQuake = null;
    if (liveData.eq && liveData.eq.quakes) {
      var cutoff = liveData.ts - 6*3600000; // last 6 hours
      for (var i = 0; i < liveData.eq.quakes.length; i++) {
        var q = liveData.eq.quakes[i];
        if (q.mag >= QUAKE_MIN_MAG && q.time >= cutoff) {
          // Check subduction zone
          if (typeof bathymetryLookup === 'function') {
            var lookup = bathymetryLookup(q.lat, q.lon);
            if (lookup.onSubductionZone) { recentQuake = q; break; }
          } else if (typeof SUBDUCTION_ZONES !== 'undefined') {
            for (var j = 0; j < SUBDUCTION_ZONES.length; j++) {
              var z = SUBDUCTION_ZONES[j];
              if (q.lat >= z[1] && q.lat <= z[2] && q.lon >= z[3] && q.lon <= z[4]) {
                recentQuake = q; break;
              }
            }
            if (recentQuake) break;
          }
        }
      }
    }

    return {
      ts: liveData.ts,
      values: {
        phase: phase,
        phaseDesc: phaseDescription(phase),
        phaseCat: catInfo.cat,
        phaseWhich: catInfo.which,
        distFromSyzygy: catInfo.dist,
        quake: recentQuake ? {
          mag: recentQuake.mag,
          place: recentQuake.place,
          lat: recentQuake.lat,
          lon: recentQuake.lon
        } : null
      },
      reason: phaseEmoji(phase) + ' Syzygy window (' + catInfo.which.replace('_',' ') + ', ' +
              Math.round(catInfo.dist) + '° from peak)' +
              (recentQuake ? ' + M' + recentQuake.mag.toFixed(1) : ''),
      hit: recentQuake !== null,
      resolved: true,
      outcome: recentQuake ? {
        hit: true,
        quakes: [recentQuake],
        count: 1,
        maxMag: recentQuake.mag
      } : {
        hit: false,
        quakes: [],
        count: 0,
        maxMag: 0
      }
    };
  }

  // ── OUTCOME MEASUREMENT ───────────────────────────────
  function measureOutcome(trigger) {
    // For Thesis B, triggers are immediately resolved (syzygy window
    // coincidence is the test, not a lagged outcome).
    // If already resolved by detection, return existing outcome.
    if (trigger.outcome) return trigger.outcome;
    return { hit: false, quakes: [], count: 0, maxMag: 0 };
  }

  // ── STATISTICAL TEST ──────────────────────────────────
  function computeStats(evidence) {
    var triggers = evidence.triggers || [];
    var resolved = triggers.filter(function(t) { return t.resolved; });
    if (resolved.length < 3) return { pValue: null, rateRatio: null, n: resolved.length };

    var hits = resolved.filter(function(t) { return t.outcome && t.outcome.hit; }).length;
    var n = resolved.length;
    var obsRate = hits / n;
    var expRate = syzygyFraction(SYZYGY_WINDOW_D);
    var rateRatio = expRate > 0 ? obsRate / expRate : 0;

    var pValue = _binomialTestOneSided(hits, n, expRate);

    return {
      pValue: pValue,
      rateRatio: rateRatio,
      observedRate: obsRate,
      baselineRate: expRate,
      hits: hits,
      n: n
    };
  }

  function _binomialTestOneSided(k, n, p) {
    if (n === 0) return 1;
    if (p <= 0) return k > 0 ? 0 : 1;
    if (p >= 1) return 1;
    if (n < 50) {
      var pVal = 0;
      for (var j = k; j <= n; j++) {
        pVal += Math.exp(_logChoose(n, j) + j*Math.log(p) + (n-j)*Math.log(1-p));
      }
      return Math.min(1, Math.max(0, pVal));
    }
    var mu = n*p, sigma = Math.sqrt(n*p*(1-p));
    if (sigma < 0.001) return k > mu ? 0 : 1;
    var z = (k - 0.5 - mu) / sigma;
    return 1 - _normalCDF(z);
  }

  function _logChoose(n, k) {
    if (k > n) return -Infinity;
    if (k === 0 || k === n) return 0;
    var r = 0;
    for (var i = 0; i < Math.min(k, n-k); i++) r += Math.log(n-i) - Math.log(i+1);
    return r;
  }

  function _normalCDF(z) {
    if (z < -8) return 0;
    if (z >  8) return 1;
    var t = 1/(1+0.2316419*Math.abs(z));
    var d = 0.3989422804014327;
    var p = d*Math.exp(-z*z/2)*t*(0.319381530+t*(-0.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));
    return z > 0 ? 1-p : p;
  }

  // ── BACKFILL (file picker, same as Thesis A) ──────────

  function pickBackfillFile() {
    var input = document.getElementById('thesis-b-backfill-input');
    if (!input) {
      input = document.createElement('input');
      input.type = 'file';
      input.id = 'thesis-b-backfill-input';
      input.accept = '.json';
      input.style.display = 'none';
      input.addEventListener('change', function(e) {
        var file = e.target.files && e.target.files[0];
        if (file) _loadBackfillFromFile(file);
        input.value = '';
      });
      document.body.appendChild(input);
    }
    input.click();
  }

  function _loadBackfillFromFile(file) {
    var statusEl = document.getElementById('thesis-b-backfill-status');
    if (statusEl) statusEl.textContent = 'Reading ' + file.name + '...';
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
    _backfillData = data;
    _backfillDone = true;

    // Populate evidence from results
    var ev = ThesisFramework.getEvidence(THESIS_ID);
    var liveTriggers = (ev && ev.triggers) ? ev.triggers.filter(function(t) { return !t.backfill; }) : [];
    if (ev) ev.triggers = liveTriggers;

    // Store the stats from the backfill
    if (ev && data.results && data.results.primary) {
      ev.stats = {
        pValue: data.results.primary.pValue,
        rateRatio: data.results.primary.rateRatio,
        observedRate: data.results.primary.observedFraction,
        baselineRate: data.results.primary.expectedFraction,
        hits: data.results.primary.syzygyCount,
        n: data.results.primary.n
      };
    }

    ThesisFramework.renderThesisPanel();

    var primary = (data.results && data.results.primary) || {};
    var msg = 'Backfill loaded: ' + (primary.n || 0) + ' earthquakes, ' +
              (primary.syzygyCount || 0) + ' in syzygy windows';
    if (primary.pValue !== undefined) msg += ' (p=' + primary.pValue + ')';
    if (statusEl) statusEl.textContent = msg;
  }

  // ── CUSTOM RENDER ─────────────────────────────────────

  function renderPanel(container, evidence, stats) {
    var resolved = evidence.triggers.filter(function(t) { return t.resolved; });
    var hits = resolved.filter(function(t) { return t.outcome && t.outcome.hit; });

    // Current lunar phase
    var now = new Date();
    var currentPhase = lunarPhaseAngle(now);
    var currentCat = phaseToCategory(currentPhase);
    var emoji = phaseEmoji(currentPhase);
    var desc = phaseDescription(currentPhase);

    var html = '';

    // ── Current lunar phase indicator
    html += '<div style="text-align:center;padding:8px;background:var(--bg2);border-radius:6px;margin-bottom:10px;border:1px solid var(--border);">';
    html += '<div style="font-size:28px;line-height:1;">' + emoji + '</div>';
    html += '<div style="font-size:9px;font-weight:700;color:var(--c-purple);margin-top:3px;">' + desc + '</div>';
    html += '<div style="font-size:7.5px;color:var(--text-dim);">Phase: ' + currentPhase.toFixed(1) + '°';
    if (currentCat.cat === 'syzygy') {
      html += ' · <span style="color:#00e676;font-weight:700;">SYZYGY WINDOW ACTIVE</span>';
    } else if (currentCat.cat === 'quadrature') {
      html += ' · <span style="color:var(--text-dim);">Quadrature (low tide)</span>';
    }
    html += '</div>';
    html += '</div>';

    // ── Hypothesis statements
    html += '<div class="thesis-statement">';
    html += '<div class="thesis-h-label">H\u2081 \u2014 HYPOTHESIS</div>';
    html += '<div class="thesis-h-text">M' + PRIMARY_MAG + '+ earthquakes on subduction zone megathrusts occur at a statistically higher rate during high tidal stress windows (syzygy \u00b1' + SYZYGY_WINDOW_D + ' days, ~' + (syzygyFraction()*100).toFixed(1) + '% of time) compared to uniform distribution.</div>';
    html += '</div>';

    html += '<div class="thesis-statement" style="border-left-color:#ff5252;">';
    html += '<div class="thesis-h-label" style="color:#ff5252;">H\u2080 \u2014 NULL</div>';
    html += '<div class="thesis-h-text" style="opacity:.75;">M' + PRIMARY_MAG + '+ subduction events are temporally independent of the fortnightly tidal cycle. Occurrence during syzygy windows is consistent with random sampling (p\u2080 = ' + syzygyFraction().toFixed(3) + ').</div>';
    html += '</div>';

    // ── Backfill results (if loaded)
    if (_backfillDone && _backfillData && _backfillData.results) {
      var r = _backfillData.results;
      var p = r.primary || {};

      // Evidence summary bar
      html += '<div class="thesis-evidence-bar">';
      html += '<div class="thesis-ev-stat"><span class="thesis-ev-num">' + (p.n || 0) + '</span><span class="thesis-ev-label">Earthquakes</span></div>';
      html += '<div class="thesis-ev-stat"><span class="thesis-ev-num">' + (p.syzygyCount || 0) + '</span><span class="thesis-ev-label">Syzygy</span></div>';
      html += '<div class="thesis-ev-stat"><span class="thesis-ev-num">' + (p.quadratureCount || 0) + '</span><span class="thesis-ev-label">Quadrature</span></div>';
      html += '<div class="thesis-ev-stat"><span class="thesis-ev-num">' + ((p.rateRatio || 0).toFixed(2)) + '\u00d7</span><span class="thesis-ev-label">Rate Ratio</span></div>';
      html += '</div>';

      // Stats row
      if (p.pValue !== undefined) {
        var pColor = p.pValue < 0.01 ? '#00e676' : p.pValue < 0.05 ? '#ffd600' : '#ff5252';
        html += '<div class="thesis-stats-row">';
        html += '<span>p-value: <strong style="color:' + pColor + ';">' + (p.pValue < 0.001 ? '<0.001' : p.pValue.toFixed(4)) + '</strong></span>';
        html += '<span>Observed: <strong>' + ((p.observedFraction || 0)*100).toFixed(1) + '%</strong></span>';
        html += '<span>Expected: <strong>' + ((p.expectedFraction || 0)*100).toFixed(1) + '%</strong></span>';
        html += '<span>95% CI: [' + ((p.ci95||[0,0])[0]*100).toFixed(1) + ', ' + ((p.ci95||[0,0])[1]*100).toFixed(1) + ']%</span>';
        html += '</div>';
      }

      // Magnitude sweep (dose-response)
      if (r.magnitudeSweep && r.magnitudeSweep.length > 0) {
        html += '<div style="margin-top:8px;padding:8px 10px;background:var(--bg2);border-radius:4px;border:1px solid var(--border);">';
        html += '<div style="font-size:8px;font-weight:700;color:var(--c-purple);margin-bottom:6px;">DOSE-RESPONSE (Magnitude Sweep)</div>';
        r.magnitudeSweep.forEach(function(m) {
          var barW = Math.max(2, Math.min(100, (m.rateRatio / 2) * 100));
          var barColor = m.pValue < (ALPHA / 4) ? '#00e676' : m.pValue < 0.05 ? '#ffd600' : 'var(--text-dim)';
          html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">';
          html += '<span style="font-size:7.5px;color:var(--text-dim);width:35px;">M' + m.magThreshold + '+</span>';
          html += '<div style="flex:1;background:var(--bg3);border-radius:2px;height:8px;overflow:hidden;">';
          html += '<div style="width:' + barW + '%;height:100%;background:' + barColor + ';border-radius:2px;"></div>';
          html += '</div>';
          html += '<span style="font-size:7px;color:var(--text-dim);width:85px;text-align:right;">' +
                  m.rateRatio.toFixed(2) + '\u00d7 (n=' + m.n + ', p=' + m.pValue.toFixed(3) + ')</span>';
          html += '</div>';
        });
        html += '</div>';
      }

      // Robustness
      if (r.robustExtended || r.robustAllSettings) {
        html += '<div style="margin-top:6px;padding:6px 10px;background:var(--bg2);border-radius:4px;border:1px solid var(--border);">';
        html += '<div style="font-size:8px;font-weight:700;color:var(--c-purple);margin-bottom:4px;">ROBUSTNESS CHECKS</div>';
        if (r.robustExtended) {
          html += '<div style="font-size:7.5px;color:var(--text-dim);">Extended decluster (1.5\u00d7): RR=' + r.robustExtended.rateRatio.toFixed(2) + '\u00d7 (p=' + r.robustExtended.pValue.toFixed(4) + ')</div>';
        }
        if (r.robustAllSettings) {
          html += '<div style="font-size:7.5px;color:var(--text-dim);">All tectonic settings: RR=' + r.robustAllSettings.rateRatio.toFixed(2) + '\u00d7 (p=' + r.robustAllSettings.pValue.toFixed(4) + ')</div>';
        }
        if (r.permutation) {
          html += '<div style="font-size:7.5px;color:var(--text-dim);">Permutation test (10k): p=' + r.permutation.pValue.toFixed(4) + '</div>';
        }
        if (r.temporalSplit) {
          html += '<div style="font-size:7.5px;color:var(--text-dim);">Pre-1990: RR=' + (r.temporalSplit.pre1990.rateRatio||0).toFixed(2) + '\u00d7 · Post-1990: RR=' + (r.temporalSplit.post1990.rateRatio||0).toFixed(2) + '\u00d7</div>';
        }
        html += '</div>';
      }

      // Syzygy vs Quadrature
      if (r.syzygyDetail) {
        html += '<div style="margin-top:6px;padding:6px 10px;background:var(--bg2);border-radius:4px;border:1px solid var(--border);">';
        html += '<div style="font-size:8px;font-weight:700;color:var(--c-purple);margin-bottom:4px;">SYZYGY vs QUADRATURE</div>';
        html += '<div style="font-size:7.5px;color:var(--text-dim);">';
        html += '\uD83C\uDF11 New moon hits: ' + r.syzygyDetail.newMoonHits + ' · ';
        html += '\uD83C\uDF15 Full moon hits: ' + r.syzygyDetail.fullMoonHits + ' · ';
        html += '\uD83C\uDF13 Quadrature: ' + r.syzygyDetail.quadratureCount;
        html += ' · Syz/Quad ratio: ' + r.syzygyDetail.ratio.toFixed(2);
        html += '</div></div>';
      }

      // Hit events
      if (r.hitEvents && r.hitEvents.length > 0) {
        html += '<details style="margin-top:6px;font-size:7.5px;color:var(--text-dim);">';
        html += '<summary style="cursor:pointer;color:var(--c-purple);font-size:8px;font-weight:700;">\uD83C\uDF0D Syzygy Hit Events (' + r.hitEvents.length + ')</summary>';
        html += '<div style="padding:4px 0;max-height:180px;overflow-y:auto;">';
        r.hitEvents.forEach(function(ev) {
          var moonIcon = ev.tidalType === 'new_moon' ? '\uD83C\uDF11' : '\uD83C\uDF15';
          html += '<div style="padding:2px 0;border-bottom:1px solid var(--border);">';
          html += moonIcon + ' <strong>M' + ev.mag.toFixed(1) + '</strong> ' + ev.date + ' \u2014 ' + ev.place;
          html += ' <span style="opacity:.6;">(phase=' + ev.phase + '\u00b0, ' + ev.zone + ')</span>';
          html += '</div>';
        });
        html += '</div></details>';
      }

    } else {
      // No backfill loaded — show evidence bar from live data
      html += '<div class="thesis-evidence-bar">';
      html += '<div class="thesis-ev-stat"><span class="thesis-ev-num">' + evidence.triggers.length + '</span><span class="thesis-ev-label">Events</span></div>';
      html += '<div class="thesis-ev-stat"><span class="thesis-ev-num">' + resolved.length + '</span><span class="thesis-ev-label">Resolved</span></div>';
      html += '<div class="thesis-ev-stat"><span class="thesis-ev-num">' + hits.length + '</span><span class="thesis-ev-label">Syzygy Hits</span></div>';
      html += '</div>';
    }

    // ── Falsification / conclusion status
    var fStatus, fColor;
    var primaryP = (_backfillData && _backfillData.results && _backfillData.results.primary) ?
                   _backfillData.results.primary.pValue : (stats ? stats.pValue : null);
    var primaryN = (_backfillData && _backfillData.results && _backfillData.results.primary) ?
                   _backfillData.results.primary.n : (stats ? stats.n : 0);

    if (primaryP === null || primaryP === undefined) {
      fStatus = 'AWAITING DATA — load backfill or collect live events';
      fColor = 'var(--text-dim)';
    } else if (primaryP < ALPHA) {
      fStatus = 'SIGNAL DETECTED — p=' + primaryP.toFixed(4) + ' < ' + ALPHA + ' (pre-registered alpha)';
      fColor = '#00e676';
    } else if (primaryP < 0.05) {
      fStatus = 'SUGGESTIVE — p=' + primaryP.toFixed(4) + ' (below 0.05 but above pre-registered ' + ALPHA + ')';
      fColor = '#ffd600';
    } else {
      fStatus = 'NOT SIGNIFICANT — p=' + primaryP.toFixed(3) + ' \u2265 ' + ALPHA;
      fColor = '#ff5252';
    }

    html += '<div class="thesis-falsification">';
    html += '<div style="font-size:7.5px;color:var(--text-dim);margin-bottom:3px;letter-spacing:.1em;">PRE-REGISTERED RESULT (\u03b1=' + ALPHA + ')</div>';
    html += '<div style="font-size:8px;color:' + fColor + ';font-weight:700;">' + fStatus + '</div>';
    html += '</div>';

    // ── Backfill load section
    html += '<div style="margin-top:12px;padding:8px 10px;background:var(--bg2);border-radius:4px;border:1px solid var(--border);">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
    html += '<div>';
    html += '<div style="font-size:8.5px;font-weight:700;color:var(--c-purple);">Historical Backfill</div>';
    html += '<div style="font-size:7.5px;color:var(--text-dim);">USGS M7.0+ catalog (1960\u2013present) + Meeus tidal phase</div>';
    html += '</div>';
    if (!_backfillDone) {
      html += '<button onclick="ThesisB.pickBackfillFile()" style="background:var(--c-purple);color:#fff;border:none;padding:4px 12px;border-radius:3px;font-size:8px;cursor:pointer;font-weight:700;">Load Backfill</button>';
    } else {
      html += '<span style="font-size:8px;color:#00e676;">\u2713 Loaded</span>';
    }
    html += '</div>';
    if (!_backfillDone) {
      html += '<div style="font-size:7.5px;color:var(--text-dim);margin-top:6px;line-height:1.6;">';
      html += '<strong>Step 1:</strong> Open a terminal in your ESO folder<br>';
      html += '<strong>Step 2:</strong> Run <code style="background:var(--bg3);padding:1px 4px;border-radius:2px;color:var(--c-purple);">python3 backfill-thesis-b.py</code><br>';
      html += '<strong>Step 3:</strong> Click <strong>Load Backfill</strong> above to import the results';
      html += '</div>';
    }
    html += '<div id="thesis-b-backfill-status" style="font-size:7.5px;color:var(--text-dim);margin-top:4px;"></div>';
    html += '</div>';

    // ── Research document link
    html += '<div style="margin-top:8px;padding:8px 10px;background:var(--bg2);border-radius:4px;border:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:8px;">';
    html += '<div style="flex:1;min-width:0;">';
    html += '<div style="font-size:8.5px;font-weight:700;color:var(--c-purple);">\uD83D\uDCC4 Research Design</div>';
    html += '<div style="font-size:7.5px;color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Thesis B \u2014 Tidal Triggering of Great Earthquakes \u2014 Research Design.pdf</div>';
    html += '</div>';
    html += '<a href="Thesis B \u2014 Tidal Triggering of Great Earthquakes \u2014 Research Design.pdf" target="_blank" style="flex-shrink:0;background:var(--c-purple);color:#fff;border:none;padding:4px 9px;border-radius:3px;font-size:7.5px;cursor:pointer;white-space:nowrap;text-decoration:none;font-weight:700;">\uD83D\uDC41 Open</a>';
    html += '</div>';

    // ── Methodology
    html += '<details style="margin-top:10px;font-size:7.5px;color:var(--text-dim);line-height:1.6;">';
    html += '<summary style="cursor:pointer;color:var(--c-purple);letter-spacing:.07em;outline:none;">\uD83D\uDCD0 Methodology</summary>';
    html += '<div style="padding:6px 0 2px;opacity:.85;">';
    html += '<b>Test type:</b> Exact binomial, one-sided (pre-registered)<br>';
    html += '<b>Magnitude threshold:</b> M' + PRIMARY_MAG + '+ (pre-registered, not adjustable)<br>';
    html += '<b>Syzygy window:</b> \u00b13 days from new or full moon (~' + (syzygyFraction()*100).toFixed(1) + '% of time)<br>';
    html += '<b>Null expectation:</b> p\u2080 = ' + syzygyFraction().toFixed(4) + '<br>';
    html += '<b>Significance:</b> \u03b1 = ' + ALPHA + ' (stricter than 0.05, justified by publication bias)<br>';
    html += '<b>Declustering:</b> Gardner-Knopoff (standard + 1.5\u00d7 extended)<br>';
    html += '<b>Tidal computation:</b> Meeus lunar elongation algorithm (sub-degree accuracy)<br>';
    html += '<b>Catalog:</b> USGS FDSNWS (1960\u2013present, modern instrumental era)<br>';
    html += '<b>Based on:</b> Ide, Yabe & Tanaka 2016 (Nature Geoscience)';
    html += '</div></details>';

    container.innerHTML = html;
  }

  // ── REGISTRATION ──────────────────────────────────────

  if (typeof ThesisFramework !== 'undefined') {
    ThesisFramework.register({
      id:             THESIS_ID,
      title:          'Tidal Triggering of Great Earthquakes',
      hypothesis:     'M' + PRIMARY_MAG + '+ earthquakes on subduction zones cluster near lunar syzygy (\u00b1' + SYZYGY_WINDOW_D + ' days)',
      nullHypothesis: 'M' + PRIMARY_MAG + '+ subduction events are temporally independent of the fortnightly tidal cycle.',
      metrics:        ['eq'],
      geography:      { type: 'subduction' },
      lagWindow:      { minH: 0, maxH: SYZYGY_WINDOW_D * 24 },
      triggerFn:      detectTrigger,
      outcomeFn:      measureOutcome,
      testFn:         computeStats,
      renderFn:       renderPanel,
      falsification:  { minTriggers: FALSIFY_N, pThreshold: FALSIFY_P },
      color:          '#b388ff',
      icon:           '\uD83C\uDF15'
    });
  }

  // ── PUBLIC API ────────────────────────────────────────

  window.ThesisB = {
    pickBackfillFile: pickBackfillFile,
    detectTrigger:    detectTrigger,
    measureOutcome:   measureOutcome,
    computeStats:     computeStats,
    lunarPhaseAngle:  lunarPhaseAngle,
    phaseToCategory:  phaseToCategory,
    phaseDescription: phaseDescription,
    phaseEmoji:       phaseEmoji,
    THESIS_ID:        THESIS_ID
  };

})();
