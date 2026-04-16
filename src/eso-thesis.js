// ESO THESIS FRAMEWORK — research lens system
// Load order: 5 (after eso-ui.js)
// ════════════════════════════════════════════════════════
// Provides: ThesisFramework.register(), .activate(), .deactivate(),
//           .recordTrigger(), .recordOutcome(), .getEvidence(),
//           thesis-mode UI shell, evidence accumulator, persistence.
//
// Individual thesis modules (thesis-a-*.js etc) register themselves
// with ThesisFramework.register(config). The framework handles
// activation, data collection, persistence, and UI rendering.
// ════════════════════════════════════════════════════════

var ThesisFramework = (function() {
  'use strict';

  // ── STORAGE KEYS ──────────────────────────────────────
  var STORE_KEY   = 'ESO_THESIS_STORE';
  var ACTIVE_KEY  = 'ESO_THESIS_ACTIVE';

  // ── REGISTRY ──────────────────────────────────────────
  var _registry = {};        // id → thesis config object
  var _activeId = null;      // currently active thesis id (or null)
  var _evidence = {};        // id → { triggers:[], outcomes:[], stats:{} }
  var _checkInterval = null; // periodic checker handle

  // ── THESIS CONFIG SCHEMA ──────────────────────────────
  // Each thesis registers a config object:
  // {
  //   id:             'thesis-a',
  //   title:          'Solar Wind → Subduction Seismicity',
  //   hypothesis:     'Elevated solar wind ... (plain language)',
  //   nullHypothesis: 'M5.5+ events are Poisson-distributed ...',
  //   metrics:        ['swspd','bz','eq'],            // ESO layer keys
  //   geography:      { type:'subduction' },           // or {bbox:[...]}, etc
  //   lagWindow:      { minH:24, maxH:96 },            // hours
  //   triggerFn:      function(liveData) { ... },      // returns trigger object or null
  //   outcomeFn:      function(trigger, quakes) { },   // returns outcome object
  //   testFn:         function(evidence) { },          // returns stats object
  //   renderFn:       function(container, evidence, stats) { },
  //   falsification:  { minTriggers: 30, pThreshold: 0.10 },
  //   color:          '#ff9100',
  //   icon:           '☀️',
  //   fetchHistoricalFn: async function() { }          // optional: backfill
  // }

  // ── PERSISTENCE ───────────────────────────────────────
  function _save() {
    try {
      var payload = {};
      Object.keys(_evidence).forEach(function(id) {
        payload[id] = {
          triggers: _evidence[id].triggers.slice(-500),  // cap at 500
          outcomes: _evidence[id].outcomes.slice(-500),
          stats:    _evidence[id].stats || {}
        };
      });
      localStorage.setItem(STORE_KEY, JSON.stringify(payload));
      if (_activeId) localStorage.setItem(ACTIVE_KEY, _activeId);
      else localStorage.removeItem(ACTIVE_KEY);
    } catch(e) { /* quota */ }
  }

  function _restore() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        Object.keys(parsed).forEach(function(id) {
          _evidence[id] = parsed[id];
        });
      }
    } catch(e) { /* corrupted */ }
  }

  // ── EVIDENCE MANAGEMENT ───────────────────────────────
  function _ensureEvidence(id) {
    if (!_evidence[id]) _evidence[id] = { triggers: [], outcomes: [], stats: {} };
  }

  function recordTrigger(thesisId, trigger) {
    _ensureEvidence(thesisId);
    // trigger: { ts, values:{swspd, bz, ...}, windowEnd }
    trigger.ts = trigger.ts || Date.now();
    trigger.windowEnd = trigger.windowEnd || (trigger.ts + (_registry[thesisId].lagWindow.maxH * 3600000));
    trigger.resolved = false;
    _evidence[thesisId].triggers.push(trigger);
    _save();
    _updatePanel();
    return trigger;
  }

  function recordOutcome(thesisId, triggerIdx, outcome) {
    _ensureEvidence(thesisId);
    var t = _evidence[thesisId].triggers[triggerIdx];
    if (t) {
      t.resolved = true;
      t.outcome = outcome; // { hit: bool, quakes:[], maxMag, count }
    }
    // Re-run statistical test
    var cfg = _registry[thesisId];
    if (cfg && cfg.testFn) {
      _evidence[thesisId].stats = cfg.testFn(_evidence[thesisId]);
    }
    _save();
    _updatePanel();
  }

  // ── TRIGGER CHECKING (periodic) ───────────────────────
  function _checkTriggers() {
    if (!_activeId || !_registry[_activeId]) return;
    var cfg = _registry[_activeId];
    var ev  = _evidence[_activeId];
    if (!ev) return;

    // 1. Check for new trigger from live data
    if (cfg.triggerFn) {
      var liveData = _gatherLiveData(cfg.metrics);
      var newTrigger = cfg.triggerFn(liveData);
      if (newTrigger) {
        // Dedup: don't record if last trigger was < 6h ago
        var last = ev.triggers[ev.triggers.length - 1];
        if (!last || (Date.now() - last.ts) > 6 * 3600000) {
          recordTrigger(_activeId, newTrigger);
        }
      }
    }

    // 2. Resolve open triggers whose windows have passed
    if (cfg.outcomeFn) {
      var now = Date.now();
      ev.triggers.forEach(function(t, idx) {
        if (!t.resolved && now > t.windowEnd) {
          var outcome = cfg.outcomeFn(t);
          recordOutcome(_activeId, idx, outcome);
        }
      });
    }
  }

  function _gatherLiveData(metrics) {
    // Pull current values from ESO state globals
    var d = {};
    if (typeof _swSpeed   !== 'undefined') d.swspd   = _swSpeed;
    if (typeof _swBz      !== 'undefined') d.bz      = _swBz;
    if (typeof _swDensity !== 'undefined') d.swdens  = _swDensity;
    if (typeof state !== 'undefined' && state.data) {
      if (state.data.geomagnetic) d.kp = parseFloat(state.data.geomagnetic.kp) || 0;
      if (state.data.seismic)     d.eq = state.data.seismic;
    }
    d.ts = Date.now();
    return d;
  }

  // ── ACTIVATION / DEACTIVATION ─────────────────────────
  function activate(thesisId) {
    if (!_registry[thesisId]) return false;
    _activeId = thesisId;
    _ensureEvidence(thesisId);

    // Apply thesis lens to dashboard
    document.body.classList.add('eso-thesis-mode');
    document.body.setAttribute('data-thesis', thesisId);

    // Highlight relevant baseline metrics
    var cfg = _registry[thesisId];
    if (cfg.metrics) {
      document.querySelectorAll('.bl-item').forEach(function(el) {
        el.classList.add('thesis-dimmed');
      });
      cfg.metrics.forEach(function(m) {
        var el = document.getElementById('bl-' + m);
        if (el) el.classList.remove('thesis-dimmed');
      });
    }

    // Start periodic checking (every 5 min)
    if (_checkInterval) clearInterval(_checkInterval);
    _checkInterval = setInterval(_checkTriggers, 5 * 60 * 1000);
    _checkTriggers(); // immediate first check

    _save();
    _updatePanel();
    _updateSelector();
    return true;
  }

  function deactivate() {
    _activeId = null;
    document.body.classList.remove('eso-thesis-mode');
    document.body.removeAttribute('data-thesis');

    // Remove dimming
    document.querySelectorAll('.bl-item.thesis-dimmed').forEach(function(el) {
      el.classList.remove('thesis-dimmed');
    });

    if (_checkInterval) { clearInterval(_checkInterval); _checkInterval = null; }
    _save();
    _updatePanel();
    _updateSelector();
  }

  // ── UI RENDERING ──────────────────────────────────────
  function _updateSelector() {
    var sel = document.getElementById('thesis-selector');
    if (!sel) return;
    var ids = Object.keys(_registry);
    var html = '<option value="">— select a thesis —</option>';
    ids.forEach(function(id) {
      var cfg = _registry[id];
      var selected = (id === _activeId) ? ' selected' : '';
      html += '<option value="' + id + '"' + selected + '>' +
              (cfg.icon || '') + ' ' + cfg.title + '</option>';
    });
    sel.innerHTML = html;
  }

  function _updatePanel() {
    var container = document.getElementById('thesis-panel-content');
    if (!container) return;

    if (!_activeId || !_registry[_activeId]) {
      container.innerHTML = _renderNoThesis();
      return;
    }

    var cfg = _registry[_activeId];
    var ev  = _evidence[_activeId] || { triggers:[], outcomes:[], stats:{} };

    // Let thesis render itself if it has a custom renderFn
    if (cfg.renderFn) {
      cfg.renderFn(container, ev, ev.stats);
      return;
    }

    // Default rendering
    container.innerHTML = _renderDefaultPanel(cfg, ev);
  }

  function _renderNoThesis() {
    var ids = Object.keys(_registry);
    if (ids.length === 0) {
      return '<div style="color:var(--text-dim);text-align:center;padding:30px 10px;font-size:9px;">' +
             'No theses registered. Thesis modules will appear here when loaded.</div>';
    }
    return '<div style="color:var(--text-dim);text-align:center;padding:20px 10px;font-size:9px;">' +
           'Select a thesis above to enter focused research mode.<br>' +
           '<span style="opacity:.6;font-size:8px;">The dashboard will reconfigure as a research lens ' +
           'for your chosen hypothesis.</span></div>';
  }

  function _renderDefaultPanel(cfg, ev) {
    var resolved = ev.triggers.filter(function(t) { return t.resolved; });
    var hits     = resolved.filter(function(t) { return t.outcome && t.outcome.hit; });
    var open     = ev.triggers.filter(function(t) { return !t.resolved; });
    var stats    = ev.stats || {};

    var html = '';

    // Hypothesis statement
    html += '<div class="thesis-statement">';
    html += '<div class="thesis-h-label">HYPOTHESIS</div>';
    html += '<div class="thesis-h-text">' + _esc(cfg.hypothesis) + '</div>';
    html += '</div>';

    html += '<div class="thesis-statement" style="border-left-color:#ff5252;">';
    html += '<div class="thesis-h-label" style="color:#ff5252;">NULL</div>';
    html += '<div class="thesis-h-text" style="opacity:.75;">' + _esc(cfg.nullHypothesis) + '</div>';
    html += '</div>';

    // Evidence summary bar
    html += '<div class="thesis-evidence-bar">';
    html += '<div class="thesis-ev-stat"><span class="thesis-ev-num">' + ev.triggers.length + '</span><span class="thesis-ev-label">Triggers</span></div>';
    html += '<div class="thesis-ev-stat"><span class="thesis-ev-num">' + resolved.length + '</span><span class="thesis-ev-label">Resolved</span></div>';
    html += '<div class="thesis-ev-stat"><span class="thesis-ev-num">' + hits.length + '</span><span class="thesis-ev-label">Hits</span></div>';
    html += '<div class="thesis-ev-stat"><span class="thesis-ev-num">' + open.length + '</span><span class="thesis-ev-label">Open</span></div>';
    html += '</div>';

    // Running statistics
    if (stats.pValue !== undefined) {
      var pColor = stats.pValue < 0.05 ? '#00e676' : stats.pValue < 0.10 ? '#ffd600' : '#ff5252';
      html += '<div class="thesis-stats-row">';
      html += '<span>p-value: <strong style="color:' + pColor + ';">' + (stats.pValue < 0.001 ? '<0.001' : stats.pValue.toFixed(4)) + '</strong></span>';
      if (stats.rateRatio !== undefined) {
        html += '<span>Rate ratio: <strong>' + stats.rateRatio.toFixed(2) + '×</strong></span>';
      }
      if (stats.effectSize !== undefined) {
        html += '<span>Effect: <strong>' + stats.effectSize.toFixed(3) + '</strong></span>';
      }
      html += '</div>';
    }

    // Falsification status
    html += _renderFalsificationStatus(cfg, ev, stats);

    // Cumulative evidence canvas
    html += '<div style="margin-top:10px;">';
    html += '<div style="font-size:8px;color:var(--text-dim);margin-bottom:4px;">Cumulative evidence over time</div>';
    html += '<canvas id="thesis-cumulative-canvas" width="560" height="120" style="width:100%;border:1px solid var(--border);border-radius:4px;"></canvas>';
    html += '</div>';

    // Trigger event log (last 20)
    html += '<div style="margin-top:10px;">';
    html += '<div style="font-size:8px;color:var(--text-dim);margin-bottom:4px;">Recent trigger events</div>';
    html += '<div id="thesis-trigger-log" style="max-height:200px;overflow-y:auto;">';
    var recent = ev.triggers.slice(-20).reverse();
    if (recent.length === 0) {
      html += '<div style="color:var(--text-dim);text-align:center;padding:15px 0;font-size:8px;opacity:.5;">No trigger events recorded yet — collecting data…</div>';
    } else {
      recent.forEach(function(t) {
        var statusBadge = '';
        if (t.resolved && t.outcome) {
          statusBadge = t.outcome.hit
            ? '<span style="color:#00e676;font-weight:700;">HIT</span>'
            : '<span style="color:#ff5252;">MISS</span>';
        } else {
          var remaining = Math.max(0, Math.round((t.windowEnd - Date.now()) / 3600000));
          statusBadge = '<span style="color:#ffd600;">OPEN (' + remaining + 'h)</span>';
        }
        var dt = new Date(t.ts).toISOString().replace('T',' ').slice(0,16) + 'Z';
        html += '<div class="thesis-trigger-entry">';
        html += '<span class="thesis-trigger-time">' + dt + '</span>';
        html += '<span class="thesis-trigger-vals">' + _formatTriggerValues(t.values || {}) + '</span>';
        html += '<span class="thesis-trigger-status">' + statusBadge + '</span>';
        html += '</div>';
      });
    }
    html += '</div></div>';

    return html;
  }

  function _renderFalsificationStatus(cfg, ev, stats) {
    if (!cfg.falsification) return '';
    var f = cfg.falsification;
    var resolved = ev.triggers.filter(function(t) { return t.resolved; }).length;
    var progress = Math.min(1, resolved / (f.minTriggers || 30));
    var barWidth = Math.round(progress * 100);

    var status, statusColor;
    if (resolved < (f.minTriggers || 30)) {
      status = 'COLLECTING — ' + resolved + '/' + (f.minTriggers || 30) + ' events needed';
      statusColor = 'var(--text-dim)';
    } else if (stats.pValue !== undefined && stats.pValue < (f.pThreshold || 0.10)) {
      status = 'SUPPORTED — evidence exceeds threshold (p<' + (f.pThreshold || 0.10) + ')';
      statusColor = '#00e676';
    } else if (stats.pValue !== undefined) {
      status = 'NOT SUPPORTED — p=' + stats.pValue.toFixed(3) + ' > ' + (f.pThreshold || 0.10);
      statusColor = '#ff5252';
    } else {
      status = 'AWAITING TEST';
      statusColor = 'var(--text-dim)';
    }

    var html = '<div class="thesis-falsification">';
    html += '<div style="font-size:7.5px;color:var(--text-dim);margin-bottom:3px;">FALSIFICATION THRESHOLD</div>';
    html += '<div style="background:var(--bg2);border-radius:3px;height:6px;overflow:hidden;margin-bottom:4px;">';
    html += '<div style="width:' + barWidth + '%;height:100%;background:' + statusColor + ';border-radius:3px;transition:width .3s;"></div>';
    html += '</div>';
    html += '<div style="font-size:8px;color:' + statusColor + ';">' + status + '</div>';
    html += '</div>';
    return html;
  }

  function _formatTriggerValues(vals) {
    var parts = [];
    if (vals.swspd !== undefined) parts.push('SW:' + Math.round(vals.swspd) + 'km/s');
    if (vals.bz !== undefined)    parts.push('Bz:' + vals.bz.toFixed(1) + 'nT');
    if (vals.kp !== undefined)    parts.push('Kp:' + vals.kp.toFixed(1));
    return parts.join(' · ') || '—';
  }

  function _esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  // ── CUMULATIVE EVIDENCE CHART ─────────────────────────
  function drawCumulativeChart(thesisId) {
    var canvas = document.getElementById('thesis-cumulative-canvas');
    if (!canvas) return;
    var ev = _evidence[thesisId];
    if (!ev || ev.triggers.length === 0) return;

    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    var resolved = ev.triggers.filter(function(t) { return t.resolved; });
    if (resolved.length < 2) {
      ctx.fillStyle = 'rgba(255,255,255,.15)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Need 2+ resolved events to chart', W/2, H/2);
      return;
    }

    // Plot cumulative hit rate over time
    var cumHits = 0, cumTotal = 0;
    var points = [];
    resolved.forEach(function(t) {
      cumTotal++;
      if (t.outcome && t.outcome.hit) cumHits++;
      points.push({ ts: t.ts, rate: cumHits / cumTotal });
    });

    // Also compute expected rate under null (Poisson baseline)
    var cfg = _registry[thesisId];
    var nullRate = (ev.stats && ev.stats.baselineRate !== undefined)
      ? ev.stats.baselineRate : 0.3; // default expectation

    // Draw
    var tsMin = points[0].ts, tsMax = points[points.length-1].ts;
    var tsRange = Math.max(tsMax - tsMin, 1);

    // Background grid
    ctx.strokeStyle = 'rgba(255,255,255,.06)';
    ctx.lineWidth = 0.5;
    for (var g = 0; g <= 4; g++) {
      var gy = H - (g/4) * H;
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
    }

    // Null rate horizontal line
    ctx.strokeStyle = 'rgba(255,82,82,.4)';
    ctx.setLineDash([4,4]);
    ctx.beginPath();
    var nullY = H - nullRate * H;
    ctx.moveTo(0, nullY); ctx.lineTo(W, nullY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ff5252';
    ctx.font = '8px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('null: ' + (nullRate*100).toFixed(0) + '%', 4, nullY - 3);

    // Cumulative hit rate line
    ctx.strokeStyle = '#00e676';
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach(function(p, i) {
      var x = ((p.ts - tsMin) / tsRange) * (W - 20) + 10;
      var y = H - p.rate * H;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Dots
    ctx.fillStyle = '#00e676';
    points.forEach(function(p) {
      var x = ((p.ts - tsMin) / tsRange) * (W - 20) + 10;
      var y = H - p.rate * H;
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI*2); ctx.fill();
    });

    // Labels
    ctx.fillStyle = '#00e676';
    ctx.font = '8px monospace';
    ctx.textAlign = 'right';
    var lastPt = points[points.length-1];
    ctx.fillText('hit rate: ' + (lastPt.rate*100).toFixed(0) + '%', W-4, H - lastPt.rate*H - 5);

    // Axis labels
    ctx.fillStyle = 'rgba(255,255,255,.3)';
    ctx.font = '7px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('0%', 2, H-2);
    ctx.fillText('100%', 2, 10);
  }

  // ── THESIS SELECTOR CHANGE HANDLER ────────────────────
  function onSelectorChange(selectEl) {
    var val = selectEl.value;
    if (!val) {
      deactivate();
    } else {
      activate(val);
    }
  }

  // ── REGISTRATION ──────────────────────────────────────
  function register(config) {
    if (!config || !config.id) return;
    _registry[config.id] = config;
    _ensureEvidence(config.id);
    _updateSelector();
    // If this was the previously active thesis, re-activate
    try {
      var prev = localStorage.getItem(ACTIVE_KEY);
      if (prev === config.id && !_activeId) {
        activate(config.id);
      }
    } catch(e) {}
  }

  // ── INIT ──────────────────────────────────────────────
  function init() {
    _restore();
    _updateSelector();
    _updatePanel();

    // Restore previously active thesis
    try {
      var prev = localStorage.getItem(ACTIVE_KEY);
      if (prev && _registry[prev]) {
        activate(prev);
      }
    } catch(e) {}
  }

  // ── DISCOVERY TAB INTEGRATION ─────────────────────────
  // Called by switchDiscTab('thesis') in eso-ui.js
  function renderThesisPanel() {
    _updatePanel();
    // Draw cumulative chart after DOM update
    if (_activeId) {
      setTimeout(function() { drawCumulativeChart(_activeId); }, 50);
    }
  }

  // ── PUBLIC API ────────────────────────────────────────
  return {
    register:        register,
    activate:        activate,
    deactivate:      deactivate,
    recordTrigger:   recordTrigger,
    recordOutcome:   recordOutcome,
    getEvidence:     function(id) { return _evidence[id] || null; },
    getActive:       function() { return _activeId; },
    getConfig:       function(id) { return _registry[id] || null; },
    getAllIds:        function() { return Object.keys(_registry); },
    init:            init,
    renderThesisPanel: renderThesisPanel,
    onSelectorChange:  onSelectorChange,
    drawCumulativeChart: drawCumulativeChart,
    checkTriggers:   _checkTriggers
  };
})();
