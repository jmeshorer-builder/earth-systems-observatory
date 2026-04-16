// ESO STATISTICS — pure math/stats functions (no DOM)
// Load order: 1 of 4
// ════════════════════════════════════════════════════════
// STATISTICAL UTILITIES
// ════════════════════════════════════════════════════════
function mean(arr) { return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0; }
function std(arr) {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s,v)=>s+(v-m)**2,0)/Math.max(arr.length-1,1));
}
function pearson(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;
  const ma=mean(a.slice(0,n)), mb=mean(b.slice(0,n));
  const sa=std(a.slice(0,n)), sb=std(b.slice(0,n));
  if (sa<1e-10||sb<1e-10) return 0;
  return a.slice(0,n).reduce((s,v,i)=>s+(v-ma)*(b[i]-mb),0)/((n-1)*sa*sb);
}

// Statistical significance for Pearson r
// Returns {r, n, t, p, sig} — uses normal approximation (accurate for n>10)
function pearsonStats(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 3) return { r: 0, n, t: 0, p: 1, sig: 'ns' };
  const r = pearson(a, b);
  const df = n - 2;
  const tStat = df > 0 ? r * Math.sqrt(df) / Math.sqrt(Math.max(1e-10, 1 - r*r)) : 0;
  // Two-tailed p-value via normal approximation (Abramowitz & Stegun 26.2.17)
  const absT = Math.abs(tStat);
  // Use t→z approximation: z ≈ t*(1 - 1/(4*df)) — accurate for df≥5
  const z = absT * (1 - 1/(4*df));
  const p0 = 0.2316419, b1=0.319381530, b2=-0.356563782, b3=1.781477937, b4=-1.821255978, b5=1.330274429;
  const tk = 1/(1 + p0*z);
  const norm = (1/Math.sqrt(2*Math.PI)) * Math.exp(-z*z/2) * ((((b5*tk+b4)*tk+b3)*tk+b2)*tk+b1)*tk;
  const p = Math.min(1, 2 * Math.max(0, norm));
  const sig = p < 0.001 ? '***' : p < 0.01 ? '**' : p < 0.05 ? '*' : 'ns';
  return { r, n, t: tStat, p, sig };
}
function normalise(arr) {
  if (!arr || arr.length === 0) return [];
  const mn=Math.min(...arr), mx=Math.max(...arr), r=mx-mn||1e-10;
  return arr.map(v=>(v-mn)/r);
}
function zScore(arr) {
  const m=mean(arr), s=std(arr)||1;
  return arr.map(v=>(v-m)/s);
}

// ── Cross-correlation at multiple lags ──────────────────
function crossCorr(a, b, maxLag) {
  const results = [];
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    const n = Math.min(a.length, b.length) - Math.abs(lag);
    if (n < 3) { results.push({lag,r:0}); continue; }
    const aSlice = lag >= 0 ? a.slice(0, n) : a.slice(-lag, n-lag);
    const bSlice = lag >= 0 ? b.slice(lag, lag+n) : b.slice(0, n);
    results.push({ lag, r: pearson(aSlice, bSlice) });
  }
  return results;
}

// ── Simplified FFT (Cooley-Tukey radix-2) ───────────────
function fft(re) {
  const n = re.length;
  if (n <= 1) return { re, im: new Float64Array(n) };
  const halfN = n >> 1;
  const evenRe = new Float64Array(halfN), oddRe = new Float64Array(halfN);
  for (let i = 0; i < halfN; i++) { evenRe[i]=re[2*i]; oddRe[i]=re[2*i+1]; }
  const E = fft(evenRe), O = fft(oddRe);
  const outRe = new Float64Array(n), outIm = new Float64Array(n);
  for (let k = 0; k < halfN; k++) {
    const angle = -2*Math.PI*k/n;
    const wr=Math.cos(angle), wi=Math.sin(angle);
    const tr=wr*O.re[k]-wi*O.im[k], ti=wr*O.im[k]+wi*O.re[k];
    outRe[k]=E.re[k]+tr; outIm[k]=E.im[k]+ti;
    outRe[k+halfN]=E.re[k]-tr; outIm[k+halfN]=E.im[k]-ti;
  }
  return { re:outRe, im:outIm };
}
function powerSpectrum(data) {
  // Pad to next power of 2
  let n = 1; while (n < data.length) n <<= 1;
  const re = new Float64Array(n);
  data.forEach((v,i) => re[i]=v);
  const { re:R, im:I } = fft(re);
  return Array.from({length:Math.floor(n/2)}, (_,k)=>Math.sqrt(R[k]**2+I[k]**2));
}

// ── Null MI distribution (permutation test) ─────────────
// Compute null MI distribution via permutation test (N shuffles)
// N=200 gives stable p95 with <5% variance
function nullMI(a, bins, N) {
  N = N || 200;
  bins = bins || 8;
  var results = [];
  var arr = a.slice();
  for (var i = 0; i < N; i++) {
    // Fisher-Yates shuffle
    var shuffled = arr.slice();
    for (var j = shuffled.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var tmp = shuffled[j]; shuffled[j] = shuffled[k]; shuffled[k] = tmp;
    }
    results.push(mutualInfo(arr, shuffled, bins));
  }
  results.sort(function(a, b) { return a - b; });
  var mean = results.reduce(function(s, v) { return s + v; }, 0) / results.length;
  var p95  = results[Math.floor(results.length * 0.95)] || results[results.length - 1];
  return { mean: mean, p95: p95 };
}

// ── Mutual Information via histogram ────────────────────
function mutualInfo(a, b, bins=8) {
  const n=Math.min(a.length,b.length);
  if(n<6) return 0;
  const an=normalise(a.slice(0,n)), bn=normalise(b.slice(0,n));
  const hist2d=Array.from({length:bins},()=>new Float64Array(bins));
  const histA=new Float64Array(bins), histB=new Float64Array(bins);
  for(let i=0;i<n;i++){
    const ai=Math.min(bins-1,Math.floor(an[i]*bins));
    const bi=Math.min(bins-1,Math.floor(bn[i]*bins));
    hist2d[ai][bi]++; histA[ai]++; histB[bi]++;
  }
  let mi=0;
  for(let a=0;a<bins;a++) for(let b=0;b<bins;b++){
    const pab=hist2d[a][b]/n, pa=histA[a]/n, pb=histB[b]/n;
    if(pab>0&&pa>0&&pb>0) mi+=pab*Math.log(pab/(pa*pb));
  }
  return Math.max(0,mi);
}

// ── Shannon entropy ──────────────────────────────────────
function entropy(arr, bins=10) {
  if(arr.length<2) return 0;
  const mn=Math.min(...arr), mx=Math.max(...arr), r=mx-mn||1;
  const hist=new Float64Array(bins);
  arr.forEach(v=>{const b=Math.min(bins-1,Math.floor((v-mn)/r*bins));hist[b]++;});
  let H=0;
  hist.forEach(c=>{const p=c/arr.length;if(p>0)H-=p*Math.log2(p);});
  return H;
}

// ════════════════════════════════════════════════════════
// BENJAMINI-HOCHBERG FALSE DISCOVERY RATE CORRECTION
// ════════════════════════════════════════════════════════
// Replaces conservative Bonferroni for correlated tests (e.g. Discovery Log).
// Returns array in ORIGINAL order: [{p, rank, threshold, rejected}, ...]
// alpha: target FDR level (default 0.05 = 5% expected false discoveries among rejections)
function bhFDR(pValues, alpha) {
  alpha = alpha || 0.05;
  var m = pValues.length;
  if (m === 0) return [];
  // Sort by p ascending, keep original index
  var sorted = pValues.map(function(p, i) { return { p: p, i: i }; });
  sorted.sort(function(a, b) { return a.p - b.p; });
  // Find largest k where p(k) ≤ (k/m)*alpha
  var lastReject = -1;
  for (var k = 0; k < m; k++) {
    if (sorted[k].p <= ((k + 1) / m) * alpha) lastReject = k;
  }
  var criticalThreshold = lastReject >= 0 ? sorted[lastReject].p : 0;
  // Build result array in original order
  var result = new Array(m);
  sorted.forEach(function(item, rank) {
    result[item.i] = {
      p: item.p,
      rank: rank + 1,
      threshold: ((rank + 1) / m) * alpha,   // BH threshold for this rank
      critical: criticalThreshold,
      rejected: rank <= lastReject            // true = statistically significant after FDR
    };
  });
  return result;
}

// ════════════════════════════════════════════════════════
// MORLET WAVELET COHERENCE
// ════════════════════════════════════════════════════════
// Continuous Wavelet Transform using Morlet mother wavelet (ω₀=6)
// Returns {coherence, periods, times, xPower, yPower}
// coherence[scaleIdx][timeIdx] ∈ [0,1]
// Optimised for ESO's typical N=40-60 sample series (daily/hourly aggregates)

function _morletCWT(signal, dt) {
  var N = signal.length;
  var omega0 = 6;                // Morlet parameter (good frequency localisation)
  var piSqrt  = Math.pow(Math.PI, -0.25);

  // Choose dyadic scales: 2¹ to 2^(log2(N/2)) in 8 sub-octave steps
  var J = Math.floor(Math.log2(N / 2) * 8);
  J = Math.max(J, 8);
  var scales = [];
  for (var j = 0; j <= J; j++) {
    scales.push(2 * dt * Math.pow(2, j / 8));
  }

  // Time-domain convolution (O(N²·S) — fine for N≤60, S≤24)
  var W = scales.map(function(s) {
    var row = [];
    for (var t = 0; t < N; t++) {
      var re = 0, im = 0;
      for (var tau = 0; tau < N; tau++) {
        var x = (tau - t) * dt / s;
        var gauss = piSqrt * Math.exp(-0.5 * x * x);
        re += signal[tau] * gauss * Math.cos(omega0 * x);
        im += signal[tau] * gauss * Math.sin(-omega0 * x);
      }
      var norm = 1 / Math.sqrt(s);
      row.push({ re: re * norm, im: im * norm });
    }
    return row;
  });
  return { W: W, scales: scales, dt: dt, N: N, omega0: omega0 };
}

function waveletCoherence(x, y) {
  // Sanitise inputs
  if (!x || !y || x.length < 8 || y.length < 8) return null;
  var N = Math.min(x.length, y.length);
  x = x.slice(0, N); y = y.slice(0, N);

  // Normalise both series to zero mean / unit variance
  var xn = zScore(x), yn = zScore(y);
  var dt = 1;  // unit time step; scales are in same units

  var Wx = _morletCWT(xn, dt);
  var Wy = _morletCWT(yn, dt);
  var scales = Wx.scales;
  var S = scales.length;

  // Gaussian smoothing kernel width (half-power point ~ 2 samples)
  function smooth(arr) {
    var w = [0.25, 0.5, 0.25];
    return arr.map(function(v, i) {
      if (i === 0 || i === arr.length - 1) return v;
      return w[0]*arr[i-1] + w[1]*arr[i] + w[2]*arr[i+1];
    });
  }

  var coherence = [];
  var xPower    = [];
  var yPower    = [];
  var periods   = scales.map(function(s) { return s / (Wx.omega0 / (2 * Math.PI)); });

  for (var si = 0; si < S; si++) {
    var rowXX = [], rowYY = [], rowXYre = [], rowXYim = [];
    for (var t = 0; t < N; t++) {
      var wx = Wx.W[si][t], wy = Wy.W[si][t];
      rowXX.push(wx.re * wx.re + wx.im * wx.im);
      rowYY.push(wy.re * wy.re + wy.im * wy.im);
      // Cross-spectrum: Wx * conj(Wy)
      rowXYre.push(wx.re * wy.re + wx.im * wy.im);
      rowXYim.push(wx.im * wy.re - wx.re * wy.im);
    }
    var sXX = smooth(rowXX), sYY = smooth(rowYY);
    var sXYre = smooth(rowXYre), sXYim = smooth(rowXYim);
    var cohRow = [], xPowRow = [], yPowRow = [];
    for (var t = 0; t < N; t++) {
      var denom = Math.max(1e-12, sXX[t] * sYY[t]);
      cohRow.push((sXYre[t]*sXYre[t] + sXYim[t]*sXYim[t]) / denom);
      xPowRow.push(sXX[t]);
      yPowRow.push(sYY[t]);
    }
    coherence.push(cohRow);
    xPower.push(xPowRow);
    yPower.push(yPowRow);
  }

  return {
    coherence: coherence,   // [scale][time] ∈ [0,1]
    periods:   periods,     // period in dt-units for each scale
    times:     Array.from({length:N}, function(_,i){return i;}),
    xPower:    xPower,
    yPower:    yPower,
    N:         N,
    S:         S
  };
}

// ════════════════════════════════════════════════════════
// ROLLING Z-SCORE ANOMALY DETECTOR
// ════════════════════════════════════════════════════════
// Maintains a rolling buffer for each baseline metric.
// Returns z-score of current value relative to the recent baseline.
// Call pushRollingMetric() each data refresh; getRollingAnomaly() to get z-score + label.

var _rollingBuffers = {};  // metricId → Float64Array ring buffer
var _rollingPtr     = {};  // metricId → next write index
var _rollingCount   = {};  // metricId → number of entries written
var ROLLING_LEN     = 30;  // ~30 refreshes ≈ 30 days at daily refresh cadence

function pushRollingMetric(metricId, value) {
  if (value === null || value === undefined || isNaN(value)) return;
  if (!_rollingBuffers[metricId]) {
    _rollingBuffers[metricId] = new Float64Array(ROLLING_LEN);
    _rollingPtr[metricId]     = 0;
    _rollingCount[metricId]   = 0;
  }
  var ptr = _rollingPtr[metricId];
  _rollingBuffers[metricId][ptr] = value;
  _rollingPtr[metricId]  = (ptr + 1) % ROLLING_LEN;
  _rollingCount[metricId]++;
}

function getRollingAnomaly(metricId, currentValue) {
  var count = _rollingCount[metricId] || 0;
  if (count < 5 || currentValue === null || currentValue === undefined) return null;
  var buf = Array.from(_rollingBuffers[metricId]).slice(0, Math.min(count, ROLLING_LEN));
  var m = mean(buf), s = std(buf);
  if (s < 1e-10) return null;
  var z = (currentValue - m) / s;
  var label = '';
  var color = '';
  if      (z >  2.5) { label = '▲ ' + z.toFixed(1) + 'σ'; color = '#ff3d3d'; }
  else if (z >  1.5) { label = '▲ ' + z.toFixed(1) + 'σ'; color = '#ffd600'; }
  else if (z < -2.5) { label = '▼ ' + Math.abs(z).toFixed(1) + 'σ'; color = '#40c8ff'; }
  else if (z < -1.5) { label = '▼ ' + Math.abs(z).toFixed(1) + 'σ'; color = '#00ffc8'; }
  else               { label = ''; color = ''; }
  return { z: z, label: label, color: color, n: Math.min(count, ROLLING_LEN) };
}

// Persist rolling buffers to localStorage (call periodically)
function persistRollingBuffers() {
  try {
    var snapshot = {};
    Object.keys(_rollingBuffers).forEach(function(id) {
      snapshot[id] = {
        buf: Array.from(_rollingBuffers[id]),
        ptr: _rollingPtr[id],
        count: _rollingCount[id]
      };
    });
    localStorage.setItem('eso-rolling-v1', JSON.stringify(snapshot));
  } catch(e) {}
}

function restoreRollingBuffers() {
  try {
    var raw = localStorage.getItem('eso-rolling-v1');
    if (!raw) return;
    var snapshot = JSON.parse(raw);
    Object.keys(snapshot).forEach(function(id) {
      var s = snapshot[id];
      _rollingBuffers[id] = new Float64Array(ROLLING_LEN);
      for (var i = 0; i < Math.min(s.buf.length, ROLLING_LEN); i++) {
        _rollingBuffers[id][i] = s.buf[i];
      }
      _rollingPtr[id]   = s.ptr || 0;
      _rollingCount[id] = s.count || 0;
    });
  } catch(e) {}
}

// ════════════════════════════════════════════════════════
// SUBDUCTION ZONE + OCEAN BASIN LOOKUP (Bathymetry Proxy)
// ════════════════════════════════════════════════════════
// A lightweight alternative to full GEBCO bathymetry.
// Returns { inOcean, onSubductionZone, zoneName, tsunamigenic } for a lat/lon pair.
// Used to refine tsunami risk scoring beyond simple heuristics.

var SUBDUCTION_ZONES = [
  // [name, latMin, latMax, lonMin, lonMax, tsunamigenicWeight]
  ['Cascadia Subduction Zone',       40,  52, -132, -122, 1.4],
  ['Alaska-Aleutian Trench',         50,  64, -175, -140, 1.5],
  ['Japan Trench',                   30,  45,  138,  148, 1.5],
  ['Ryukyu Trench',                  22,  32,  124,  135, 1.3],
  ['Philippines Trench',              5,  22,  124,  132, 1.3],
  ['Mariana Trench',                  9,  24,  142,  148, 1.1],
  ['Tonga-Kermadec Trench',         -40,  -5,  172, -175, 1.5],
  ['Hikurangi Subduction Zone',      -47, -36,  168,  180, 1.3],
  ['New Hebrides Trench',            -24,  -8,  165,  175, 1.4],
  ['Chile Trench',                   -55, -20,  -82,  -68, 1.5],
  ['Peru-Chile Trench (N)',          -20,   5,  -82,  -75, 1.4],
  ['Central America Trench',           6,  18,  -95,  -82, 1.3],
  ['Caribbean Subduction',            14,  20,  -67,  -58, 1.2],
  ['Sunda (Java-Sumatra) Trench',    -12,   6,   92,  115, 1.5],
  ['Makran Subduction Zone',          22,  28,   56,   68, 1.2],
  ['Hellenic-Cyprus Trench',          32,  38,   20,   32, 1.2],
  ['Calabrian Arc',                   37,  42,   12,   21, 1.1],
  ['South Sandwich Trench',          -62, -52,  -30,  -20, 1.2],
  ['Middle America Trench',           12,  22,  -95,  -85, 1.3],
  ['Aleutian Trench (W)',             50,  58,  165,  180, 1.4],
];

// Approximate ocean basin bounding boxes (lat, lon) — coarse but effective
var OCEAN_BASINS = [
  // [name, latMin, latMax, lonMin, lonMax]
  ['Pacific Ocean Central',         -50,  50, -180, -80],
  ['Pacific Ocean W',               -50,  50,  120,  180],
  ['Atlantic Ocean N',               10,  65,  -70,  -10],
  ['Atlantic Ocean S',              -60,  10,  -55,   20],
  ['Indian Ocean',                  -65,  25,   30,  115],
  ['Southern Ocean',                -70, -50, -180,  180],
  ['Arctic Ocean',                   70,  90, -180,  180],
  ['Caribbean Sea',                  10,  25,  -90,  -55],
  ['Gulf of Mexico',                 18,  31,  -98,  -80],
  ['Mediterranean Sea',              30,  47,  -10,   42],
  ['Red Sea',                        12,  30,   31,   45],
  ['Arabian Sea',                     0,  25,   50,   75],
  ['Bay of Bengal',                   0,  25,   80, 100],
  ['South China Sea',                 2,  24,  105,  122],
  ['Philippine Sea',                  5,  30,  125,  145],
  ['Coral Sea',                     -30,  -5,  145,  170],
  ['Bering Sea',                     50,  65,  165,  190],
  ['Sea of Japan',                   32,  52,  128,  142],
];

function bathymetryLookup(lat, lon) {
  // Normalise longitude to [-180, 180]
  while (lon > 180)  lon -= 360;
  while (lon < -180) lon += 360;

  var inOcean = false, onSubductionZone = false, zoneName = '', weight = 1.0;

  // Check ocean basins
  for (var i = 0; i < OCEAN_BASINS.length; i++) {
    var b = OCEAN_BASINS[i];
    if (lat >= b[1] && lat <= b[2] && lon >= b[3] && lon <= b[4]) {
      inOcean = true;
      break;
    }
  }

  // Check subduction zones
  for (var i = 0; i < SUBDUCTION_ZONES.length; i++) {
    var z = SUBDUCTION_ZONES[i];
    var zLon0 = z[3], zLon1 = z[4];
    // Handle antimeridian crossing (e.g. Aleutians span -175 to 180)
    var inLon = zLon0 < zLon1 ? (lon >= zLon0 && lon <= zLon1)
                              : (lon >= zLon0 || lon <= zLon1);
    if (lat >= z[1] && lat <= z[2] && inLon) {
      onSubductionZone = true;
      zoneName = z[0];
      weight = z[5];
      break;
    }
  }

  return {
    inOcean:          inOcean,
    onSubductionZone: onSubductionZone,
    zoneName:         zoneName,
    tsunamigenicWeight: onSubductionZone ? weight : (inOcean ? 1.1 : 0.6),
    tsunamigenic:     onSubductionZone || inOcean
  };
}

// ════════════════════════════════════════════════════════
// B-VALUE TIME SERIES TRACKER
// ════════════════════════════════════════════════════════
// Stores b-value snapshots with timestamps so trend can be shown.
// A declining b-value over weeks is one of the few defensible seismic precursor signals.

var _bValueHistory = [];       // [{ts, b, n, Mc}]
var B_HISTORY_MAX  = 20;       // keep last 20 snapshots

function recordBValueSnapshot(bObj) {
  if (!bObj || bObj.b === null) return;
  _bValueHistory.push({ ts: Date.now(), b: bObj.b, n: bObj.n, Mc: bObj.Mc });
  if (_bValueHistory.length > B_HISTORY_MAX) _bValueHistory.shift();
  try { localStorage.setItem('eso-bvalue-hist', JSON.stringify(_bValueHistory)); } catch(e) {}
}

function restoreBValueHistory() {
  try {
    var raw = localStorage.getItem('eso-bvalue-hist');
    if (raw) _bValueHistory = JSON.parse(raw).slice(-B_HISTORY_MAX);
  } catch(e) {}
}

function getBValueTrend() {
  if (_bValueHistory.length < 3) return { trend: 'stable', slope: 0, label: '' };
  // Simple linear regression on last entries
  var n = Math.min(_bValueHistory.length, 10);
  var recent = _bValueHistory.slice(-n);
  var xs = recent.map(function(_, i) { return i; });
  var ys = recent.map(function(e) { return e.b; });
  var xm = mean(xs), ym = mean(ys);
  var num = 0, den = 0;
  for (var i = 0; i < n; i++) {
    num += (xs[i] - xm) * (ys[i] - ym);
    den += (xs[i] - xm) * (xs[i] - xm);
  }
  var slope = den > 1e-10 ? num / den : 0;
  var trend = Math.abs(slope) < 0.01 ? 'stable'
            : slope < 0 ? 'declining' : 'rising';
  var label = trend === 'declining' ? '↓ declining (precursor watch)'
            : trend === 'rising'    ? '↑ rising (stress release)'
            : '→ stable';
  return { trend: trend, slope: slope, label: label };
}

// Draw mini b-value trend sparkline on a canvas element
function drawBValueSparkline(canvas, history) {
  if (!canvas || history.length < 2) return;
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  var vals = history.map(function(e) { return e.b; });
  var mn = Math.min.apply(null, vals) - 0.05;
  var mx = Math.max.apply(null, vals) + 0.05;
  var range = mx - mn || 0.1;
  ctx.strokeStyle = '#00e5ff';
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  history.forEach(function(e, i) {
    var x = (i / (history.length - 1)) * W;
    var y = H - ((e.b - mn) / range) * H;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();
  // Mark trend direction
  var trend = getBValueTrend();
  ctx.fillStyle = trend.trend === 'declining' ? '#ff3d3d'
                : trend.trend === 'rising'    ? '#00ff88' : '#ffd600';
  ctx.fillRect(W - 3, 0, 3, H);
}

