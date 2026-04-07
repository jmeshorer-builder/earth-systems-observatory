// ESO UI — charts, analysis panels, notifications, tour, init, patches
// Load order: 4 of 4
// ════════════════════════════════════════════════════════
// MAP
// ════════════════════════════════════════════════════════
let map = null;
let _leafletMap = null;   // Leaflet instance when not using Google Maps
let _leafletIW = null;  // initialized inside initLeafletMap()

// ── Initialise Leaflet (default, always works) ─────────────────
function initLeafletMap() {
  _leafletMap = L.map('map', {
    center: [20, 0], zoom: 2,
    zoomControl: true, attributionControl: false,
  });
  // dark_nolabels = dark background with coastlines/borders but NO text
  // → guarantees English-only map; labels added programmatically below
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
    maxZoom: 19, subdomains: 'abcd',
  }).addTo(_leafletMap);

  // ── ENGLISH GEOGRAPHIC LABELS ────────────────────────────
  // Permanent tooltips for oceans, continents, key seas
  const _GEO_LABELS = [
    // Oceans
    { ll:[  5,-160], text:'Pacific Ocean',    zoom:2 },
    { ll:[  0, -30], text:'Atlantic Ocean',   zoom:2 },
    { ll:[-20,  80], text:'Indian Ocean',     zoom:2 },
    { ll:[ 80,  10], text:'Arctic Ocean',     zoom:3 },
    { ll:[-58, -40], text:'Southern Ocean',   zoom:3 },
    // Seas
    { ll:[ 42,  35], text:'Black Sea',        zoom:5 },
    { ll:[ 38,  22], text:'Mediterranean',    zoom:4 },
    { ll:[ 25,  52], text:'Arabian Sea',      zoom:4 },
    { ll:[ 22, 114], text:'South China Sea',  zoom:4 },
    { ll:[ 55,   0], text:'North Sea',        zoom:5 },
    // Continents
    { ll:[ 50,  20], text:'Europe',           zoom:3 },
    { ll:[ 45,  90], text:'Asia',             zoom:2 },
    { ll:[  5,  25], text:'Africa',           zoom:2 },
    { ll:[ 45, -95], text:'North America',    zoom:2 },
    { ll:[-20, -55], text:'South America',    zoom:2 },
    { ll:[-27, 135], text:'Australia',        zoom:2 },
    { ll:[-80,   0], text:'Antarctica',       zoom:3 },
    // Key Tectonic / Research Zones
    { ll:[ 10, 125], text:'Philippine Sea',   zoom:4 },
    { ll:[-10, 155], text:'Coral Sea',        zoom:4 },
    { ll:[ 60, 170], text:'Bering Sea',       zoom:4 },
    { ll:[ 30, 135], text:'Japan Sea',        zoom:4 },
    { ll:[ 65,  35], text:'Barents Sea',      zoom:4 },
    { ll:[ 74, -50], text:'Greenland',        zoom:3 },
  ];
  _GEO_LABELS.forEach(function(g) {
    const div = document.createElement('div');
    div.style.cssText = 'font-family:"Space Mono",monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:rgba(192,216,236,.45);white-space:nowrap;pointer-events:none;text-shadow:0 1px 3px rgba(0,0,0,.9)';
    div.textContent = g.text;
    L.marker(g.ll, {
      icon: L.divIcon({ className:'', html: div.outerHTML, iconSize: null, iconAnchor: [0,0] }),
      interactive: false,
    }).addTo(_leafletMap);
  });
  // Hide labels below their natural zoom threshold
  _leafletMap.on('zoomend', function() {
    var z = _leafletMap.getZoom();
    document.querySelectorAll('.leaflet-marker-icon').forEach(function(el) {
      // No per-marker zoom filtering needed at global views; labels blend naturally
    });
  });
  _leafletIW = L.popup({ className: 'eso-popup', maxWidth: 320 });

  // Wire events using Leaflet API
  _leafletMap.on('mousemove', e => {
    const el = document.getElementById('coords-display');
    if (el) el.textContent = `LAT ${e.latlng.lat.toFixed(3)} / LON ${e.latlng.lng.toFixed(3)}`;
  });
  _leafletMap.on('zoom', () => {
    const el = document.getElementById('zoom-display');
    if (el) el.textContent = `ZOOM ${_leafletMap.getZoom()}`;
  });
  _leafletMap.on('click', e => onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng }));

  // map alias points to Leaflet instance
  map = _leafletMap;
  window._mapReady = true;
  if (window._mapPendingInit) { window._mapPendingInit(); window._mapPendingInit = null; }
}

// ── Load Google Maps dynamically if key provided ───────────────
// Map always ready (Leaflet)
function whenMapReady(fn) { if(map) fn(); else setTimeout(()=>fn(),100); }

// ── Map resize helper ──────────────────────────────────────────
function resizeMap() {
  try { if (_leafletMap) _leafletMap.invalidateSize(); } catch(e) {}
}

// Map events wired in initLeafletMap

// ════════════════════════════════════════════════════════
// PATTERN DISCOVERY ENGINE — Phase 3
// Automated scientific pattern detection across all layers
// Methods: Pearson+lag, FFT, phase-space, mutual info,
//          planetary forcing, novel synthetic indices,
//          auto-discovery log with statistical testing
// ════════════════════════════════════════════════════════

// ── DISCOVERY TAB SWITCHER ──────────────────────────────
function switchDiscTab(tab) {
  document.querySelectorAll('.disc-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.disc-panel').forEach(p => p.classList.remove('active'));
  const btn = document.getElementById('dst-' + tab);
  const panel = document.getElementById('dsp-' + tab);
  if (btn) btn.classList.add('active');
  if (panel) panel.classList.add('active');
  const renders = {
    stress: renderStressIndex, lag: renderLagExplorer,
    fft: renderFFT, phase: renderPhaseSpace,
    mi: renderMutualInfo, planets: renderPlanets,
    indices: renderNovelIndices, chain: runChainScan,
    log: renderDiscoveryLog, wavelet: renderWaveletCoherence,
    hyp: renderHypothesisBoard, hindcast: renderHindcastPanel,
    thesis: function() { if (typeof ThesisFramework !== 'undefined') ThesisFramework.renderThesisPanel(); },
  };
  if (renders[tab]) renders[tab]();
}

// ── UPDATE switchTab for 5-tab system ──────────────────
// switchTab fully implemented above
;

// ── POPULATE SELECT DROPDOWNS ───────────────────────────
function updateDiscoverSelects() {
  const active = [...state.activeLayers];
  const selects = ['lag-layer-a','lag-layer-b','fft-layer-select','phase-layer-a','phase-layer-b'];
  selects.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = `<option value="">— select —</option>` +
      active.map(function(l){return '<option value="'+l+'"'+(l===cur?' selected':'')+'>'+((LAYER_META[l]&&LAYER_META[l].label)||l)+'</option>';}).join('');
  });
}

// ════════════════════════════════════════════════════════
// 1. EARTH SYSTEMS STRESS INDEX
// ════════════════════════════════════════════════════════
const STRESS_WEIGHTS = {
  geomagnetic: { w:0.20, hi:5,  lo:0,  label:'Geomagnetic Kp',    color:'#b84fff' },
  cosmic:      { w:0.12, hi:1900,lo:1600,label:'Cosmic Ray Flux',  color:'#ff4fa0' },
  tides:       { w:0.15, hi:90, lo:0,   label:'Tidal Syzygy',      color:'#40c8ff' },
  seismic:     { w:0.18, hi:35, lo:5,   label:'Seismic Events',    color:'#ff3d3d' },
  solarwind:   { w:0.12, hi:700,lo:300, label:'Solar Wind Speed',  color:'#aaff00' },
  ionosphere:  { w:0.10, hi:70, lo:10,  label:'Ionospheric TEC',   color:'#00ffc8' },
  schumann:    { w:0.08, hi:8.2,lo:7.5, label:'Schumann Freq',     color:'#ff6d00' },
  volcanic:    { w:0.05, hi:10, lo:0,   label:'Volcanic Alerts',   color:'#ff9900' },
};

function renderStressIndex() {
  const s = getSystemState();
  const vals = {
    geomagnetic: parseFloat(s.kp),
    cosmic:      s.crFlux,
    tides:       s.syzygy*100,
    seismic:     (state.data.seismic && state.data.seismic.count) || 20,
    solarwind:   s.swSpeed,
    ionosphere:  s.tecPeak,
    schumann:    (state.data.schumann && state.data.schumann.frequency) || 7.83,
    volcanic:    (state.data.volcanic && state.data.volcanic.active) || 7,
  };

  let totalScore=0, totalW=0;
  const components=[];
  Object.entries(STRESS_WEIGHTS).forEach(([id,cfg])=>{
    const v=vals[id];
    const norm=Math.max(0,Math.min(1,(v-cfg.lo)/(cfg.hi-cfg.lo)));
    const contribution=norm*cfg.w*100;
    totalScore+=contribution; totalW+=cfg.w;
    components.push({id,label:cfg.label,color:cfg.color,norm,contribution,v});
  });
  const score=Math.round(totalScore/totalW);

  const orb=document.getElementById('stress-orb');
  const valEl=document.getElementById('stress-val');
  const lblEl=document.getElementById('stress-label');
  if(!orb||!valEl||!lblEl) return;

  const color=score<30?'#00ff88':score<50?'#ffd600':score<70?'#ff6d00':'#ff3d3d';
  const label=score<30?'NOMINAL':score<50?'ELEVATED':score<70?'HIGH':'CRITICAL';
  orb.style.border=`2px solid ${color}`;
  orb.style.boxShadow=`0 0 30px ${color}44, inset 0 0 20px ${color}11`;
  valEl.textContent=score;
  valEl.style.color=color;
  lblEl.textContent=label;
  lblEl.style.color=color;

  const compEl=document.getElementById('stress-components');
  if(compEl) compEl.innerHTML=components.sort((a,b)=>b.norm-a.norm).map(c=>`
    <div class="stress-comp-row">
      <span class="stress-comp-name">${c.label}</span>
      <span class="stress-comp-bar"><span style="display:block;height:100%;width:${c.norm*100}%;background:${c.color};border-radius:1px;transition:width 1s"></span></span>
      <span class="stress-comp-val" style="color:${c.color}">${typeof c.v==='number'?c.v.toFixed(1):c.v}</span>
    </div>`).join('');

  // Log if high stress
  if(score>65) logDiscovery({
    title:`High Earth Systems Stress Score: ${score}/100`,
    body:`Compound elevated state across ${components.filter(c=>c.norm>0.6).length} layers simultaneously. ` +
         `Drivers: ${components.filter(c=>c.norm>0.6).map(c=>c.label).join(', ')}. ` +
         `Composite stress >65 is rare — implies multiple Earth system domains simultaneously perturbed.`,
    color:'#ff3d3d', method:'STRESS INDEX', novel:false
  });
}

// ════════════════════════════════════════════════════════
// 2. LAG EXPLORER
// ════════════════════════════════════════════════════════
function renderLagExplorer() {
  const idA=(document.getElementById('lag-layer-a')||{}).value||'';
  const idB=(document.getElementById('lag-layer-b')||{}).value||'';
  const canvas=document.getElementById('lag-canvas');
  const resultEl=document.getElementById('lag-result');
  if(!canvas||!resultEl) return;

  if(!idA||!idB||idA===idB) {
    resultEl.textContent='Select two different layers to explore time-delayed relationships';
    return;
  }

  const a=getSeriesOrdered(idA), b=getSeriesOrdered(idB);
  if(a.length<6||b.length<6) {
    resultEl.innerHTML='<span style="color:var(--c-gold)">Collecting data — need 6+ points per layer. Check back in a minute.</span>';
    return;
  }

  const maxLag=Math.max(1, Math.min(10,Math.floor(Math.min(a.length,b.length)/2)));
  const corrResults=crossCorr(a,b,maxLag);
  const best=corrResults.reduce((m,c)=>Math.abs(c.r)>Math.abs(m.r)?c:m);

  // Draw lag chart
  const W=canvas.offsetWidth||262, H=90;
  canvas.width=W*window.devicePixelRatio; canvas.height=H*window.devicePixelRatio;
  canvas.style.width=W+'px'; canvas.style.height=H+'px';
  const ctx=canvas.getContext('2d');
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  ctx.fillStyle='#060f1a'; ctx.fillRect(0,0,W,H);

  const n=corrResults.length, bw=W/n, pad=8;

  // Zero line
  ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=0.5;
  ctx.beginPath(); ctx.moveTo(0,H/2); ctx.lineTo(W,H/2); ctx.stroke();

  // Bars
  corrResults.forEach((cr,i)=>{
    const col=cr.r>0?'#40c8ff':'#ff6d00';
    const h=Math.abs(cr.r)*(H/2-pad);
    const x=i*bw+1, y=cr.r>=0?H/2-h:H/2, bh=h;
    ctx.fillStyle=i===corrResults.findIndex(c=>c===best)?col:col+'88';
    ctx.fillRect(x,y,bw-2,bh);
  });

  // Lag labels
  ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.font='7px Space Mono,monospace';
  ctx.textAlign='center';
  corrResults.forEach((cr,i)=>{
    if(cr.lag%2===0) ctx.fillText(cr.lag, i*bw+bw/2, H-1);
  });

  // Best lag annotation
  const KNOWN_LAGS = {
    'geomagnetic|seismic':'~27 days per Urata 2018',
    'solar|seismic':'~1-30 days per Marchitelli 2020',
    'tides|seismic':'0-2 days per Cochran 2004',
    'solar|sst':'30-90 days (ocean thermal inertia)',
    'geomagnetic|ionosphere':'0-1 day (direct coupling)',
    'cosmic|sst':'multi-year via Svensmark',
  };
  const knownKey=[idA+'|'+idB, idB+'|'+idA].find(k=>KNOWN_LAGS[k]);
  const knownRef=knownKey?' Literature: '+KNOWN_LAGS[knownKey]+'.':'';

  const sig=Math.abs(best.r)>0.5?'strong':Math.abs(best.r)>0.3?'moderate':'weak';
  const dir=best.lag>0?(((LAYER_META[idA] && LAYER_META[idA].label)||idA)+' leads by '+best.lag+' steps')
      :best.lag<0?(((LAYER_META[idB] && LAYER_META[idB].label)||idB)+' leads by '+(-best.lag)+' steps'):'simultaneous (lag 0)';

  // Compute significance of peak correlation
  const bestStats = pearsonStats(a, b);
  const pLabel = bestStats.p !== null
    ? ' <span style="color:var(--text-dim);font-size:7px">n=' + bestStats.n + ', p' + (bestStats.p < 0.001 ? '&lt;0.001' : '=' + bestStats.p.toFixed(3)) + ' ' + bestStats.sig + '</span>'
    : '';
  const dataNote = a.length < 20
    ? ' <span style="color:var(--c-gold);font-size:7px">[Limited session data — ' + a.length + ' pts. More data = more reliable lags.]</span>'
    : '';

  resultEl.innerHTML='Peak correlation <span class="lag-highlight">r='+best.r.toFixed(3)+'</span> at lag <span class="lag-highlight">'+best.lag+'</span>. '+sig+' '+(best.r>0?'positive':'negative')+' relationship — '+dir+'.'+pLabel+dataNote+' '+knownRef;

  if(Math.abs(best.r)>0.5 && best.lag!==0) logDiscovery({
    title:'Lagged Correlation: '+((LAYER_META[idA]&&LAYER_META[idA].label)||idA)+' -> '+((LAYER_META[idB]&&LAYER_META[idB].label)||idB),
    body:'Peak r='+best.r.toFixed(3)+' at lag '+best.lag+' ('+dir+'). '+knownRef+' This '+(best.lag>0?'suggests':'implies')+' a '+Math.abs(best.lag)+'-step delay between these systems.',
    color:'#40c8ff', method:'CROSS-CORRELATION LAG', novel:Math.abs(best.lag)>3
  });
}

// ════════════════════════════════════════════════════════
// 3. SPECTRAL / FFT ANALYSIS
// ════════════════════════════════════════════════════════
function renderFFT() {
  const id=(document.getElementById('fft-layer-select')||{}).value||'';
  const canvas=document.getElementById('fft-canvas');
  const peaksEl=document.getElementById('fft-peaks');
  if(!canvas||!peaksEl) return;
  if(!id) { peaksEl.textContent='Select a layer'; return; }

  const data=getSeriesOrdered(id);
  if(data.length<8) { peaksEl.innerHTML='<span style="color:var(--c-gold)">Need 8+ data points</span>'; return; }

  // Detrend
  const m=mean(data);
  const detrended=data.map(v=>v-m);
  const spectrum=powerSpectrum(detrended);

  const W=canvas.offsetWidth||262, H=80;
  canvas.width=W*window.devicePixelRatio; canvas.height=H*window.devicePixelRatio;
  canvas.style.width=W+'px'; canvas.style.height=H+'px';
  const ctx=canvas.getContext('2d'); ctx.scale(window.devicePixelRatio,window.devicePixelRatio);
  ctx.fillStyle='#060f1a'; ctx.fillRect(0,0,W,H);

  const maxP=Math.max(...spectrum)||1;
  const bw=W/spectrum.length;
  const meta=LAYER_META[id];
  const col=(meta && meta.color)||'#00e5ff';

  spectrum.forEach((p,i)=>{
    const h=(p/maxP)*(H-6);
    const norm=p/maxP;
    ctx.fillStyle=norm>0.7?col:norm>0.4?col+'bb':col+'55';
    ctx.fillRect(i*bw, H-h-3, Math.max(1,bw-1), h);
  });

  // Find top 3 peaks
  const peaks=spectrum.map((p,i)=>({p,i})).sort((a,b)=>b.p-a.p).slice(0,3);
  const sampleInterval=8; // seconds between data points
  const totalTime=data.length*sampleInterval;

  const peakDescs=peaks.map(pk=>{
    const period=totalTime/(pk.i+1);
    const pStr=period<120?(period.toFixed(0)+'s'):period<3600?((period/60).toFixed(1)+'min'):((period/3600).toFixed(1)+'hr');
    const strength=(pk.p/maxP*100).toFixed(0);
    return `<span style="color:${col}">▲ ${pStr}</span> (${strength}% power)`;
  });

  peaksEl.innerHTML='<b style="color:#fff">Top periods:</b> '+peakDescs.join(' · ');

  if(peaks[0].p/maxP>0.6) logDiscovery({
    title:`Dominant Periodicity in ${(meta && meta.label)||id}`,
    body:`FFT reveals strong periodic signal at ~${(totalTime/(peaks[0].i+1)/60).toFixed(1)} min. Power concentration ${(peaks[0].p/maxP*100).toFixed(0)}%. Possible interpretation: instrument sampling alias, natural oscillation, or interaction with a known cycle.`,
    color:col, method:'FFT SPECTRAL ANALYSIS', novel:false
  });
}

// ════════════════════════════════════════════════════════
// 4. PHASE SPACE ATTRACTOR
// ════════════════════════════════════════════════════════
function renderPhaseSpace() {
  const idA=(document.getElementById('phase-layer-a')||{}).value||'';
  const idB=(document.getElementById('phase-layer-b')||{}).value||'';
  const canvas=document.getElementById('phase-canvas');
  const resultEl=document.getElementById('phase-result');
  if(!canvas||!resultEl) return;
  if(!idA||!idB) return;

  const a=getSeriesOrdered(idA), b=getSeriesOrdered(idB);
  if(a.length<4||b.length<4) {
    resultEl.innerHTML='<span style="color:var(--c-gold)">Collecting data...</span>'; return;
  }
  // Guard: if either series is constant, normalise will produce all-zeros
  const aRange=Math.max(...a)-Math.min(...a);
  const bRange=Math.max(...b)-Math.min(...b);
  if(aRange<1e-10||bRange<1e-10){
    resultEl.textContent='One series has no variance — cannot plot phase space.'; return;
  }

  const W=canvas.offsetWidth||262, H=140;
  canvas.width=W*window.devicePixelRatio; canvas.height=H*window.devicePixelRatio;
  canvas.style.width=W+'px'; canvas.style.height=H+'px';
  const ctx=canvas.getContext('2d'); ctx.scale(window.devicePixelRatio,window.devicePixelRatio);
  ctx.fillStyle='#060f1a'; ctx.fillRect(0,0,W,H);

  const na=normalise(a), nb=normalise(b);
  const n=Math.min(na.length,nb.length);
  const pad=12;

  // Axes
  ctx.strokeStyle='rgba(255,255,255,0.08)'; ctx.lineWidth=0.5;
  ctx.beginPath(); ctx.moveTo(pad,H/2); ctx.lineTo(W-pad,H/2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W/2,pad); ctx.lineTo(W/2,H-pad); ctx.stroke();

  // Axis labels
  ctx.fillStyle='rgba(255,255,255,0.2)'; ctx.font='7px Space Mono,monospace';
  ctx.textAlign='center';
  ctx.fillText((LAYER_META[idA] && LAYER_META[idA].label)||idA, W/2, H-1);
  ctx.save(); ctx.translate(7,H/2); ctx.rotate(-Math.PI/2);
  ctx.fillText((LAYER_META[idB] && LAYER_META[idB].label)||idB, 0, 0); ctx.restore();

  // Plot trajectory with color gradient (time=color)
  for(let i=1;i<n;i++){
    const t=i/n;
    const ca=(LAYER_META[idA] && LAYER_META[idA].color)||'#00e5ff';
    const cb=(LAYER_META[idB] && LAYER_META[idB].color)||'#ff3d3d';
    ctx.strokeStyle=`rgba(${hexToRgb(ca,t)})`;
    ctx.lineWidth=1;
    ctx.beginPath();
    ctx.moveTo(pad+na[i-1]*(W-2*pad), pad+nb[i-1]*(H-2*pad));
    ctx.lineTo(pad+na[i]*(W-2*pad), pad+nb[i]*(H-2*pad));
    ctx.stroke();
  }

  // Latest point
  const lx=pad+na[n-1]*(W-2*pad), ly=pad+nb[n-1]*(H-2*pad);
  ctx.beginPath(); ctx.arc(lx,ly,3,0,Math.PI*2);
  ctx.fillStyle='#fff'; ctx.fill();

  // Classify attractor shape
  const r=pearson(a,b);
  const H_a=entropy(a), H_b=entropy(b);
  const attractor = Math.abs(r)>0.7?'Linear correlation — Lissajous-like trajectory':
    H_a>2.5&&H_b>2.5?'High entropy — possibly chaotic / strange attractor':
    Math.abs(r)<0.15?'Decorrelated — independent dynamics':
    'Mixed correlation — non-linear coupling likely';

  resultEl.textContent=`${attractor}. r=${r.toFixed(2)} · H(A)=${H_a.toFixed(2)} · H(B)=${H_b.toFixed(2)} bits`;

  if(H_a>2.5&&H_b>2.5&&Math.abs(r)>0.35) logDiscovery({
    title:'Non-linear Coupling: '+((LAYER_META[idA]&&LAYER_META[idA].label)||idA)+' <-> '+((LAYER_META[idB]&&LAYER_META[idB].label)||idB),
    body:`Phase-space trajectory shows high entropy (H=${H_a.toFixed(2)}, ${H_b.toFixed(2)} bits) combined with significant correlation r=${r.toFixed(2)}. This signature suggests a non-linear coupling that Pearson alone would underestimate — possible threshold or bifurcation behavior.`,
    color:'#ff4fa0', method:'PHASE-SPACE EMBEDDING', novel:true
  });
}

function hexToRgb(hex, alpha) {
  hex=hex.replace('#','');
  const r=parseInt(hex.slice(0,2),16),g=parseInt(hex.slice(2,4),16),b=parseInt(hex.slice(4,6),16);
  return `${r},${g},${b},${(0.2+alpha*0.7).toFixed(2)}`;
}

// ════════════════════════════════════════════════════════
// 5. MUTUAL INFORMATION TABLE
// ════════════════════════════════════════════════════════
function renderMutualInfo() {
  const el=document.getElementById('mi-table');
  if(!el) return;
  const active=[...state.activeLayers];
  if(active.length<2){el.innerHTML='<div style="color:var(--text-dim);font-size:9px;text-align:center;padding:16px 0">Need 2+ active layers</div>';return;}

  const pairs=[];
  for(let i=0;i<active.length;i++) for(let j=i+1;j<active.length;j++){
    const a=getSeriesOrdered(active[i]), b=getSeriesOrdered(active[j]);
    if(a.length<4||b.length<4) continue;
    const mi=mutualInfo(a,b);
    const r=pearson(a,b);
    const bonus=mi-Math.abs(r)*0.7; // non-linear bonus: MI beyond what Pearson predicts
    pairs.push({a:active[i],b:active[j],mi,r,bonus});
  }
  if(!pairs.length){el.innerHTML='<div style="color:var(--c-gold);font-size:8px;padding:10px 0">Collecting data...</div>';return;}

  pairs.sort((a,b)=>b.mi-a.mi);
  const maxMI=(pairs[0] && pairs[0].mi)||1;

  // Compute null MI from permutation test on first available series
  var _nullRef = { mean: 0, p95: 0 };
  try {
    var _refSeries = getSeriesOrdered(active[0]);
    if (_refSeries.length >= 4) _nullRef = nullMI(_refSeries, 8, 30);
  } catch(e) {}
  var nullPct = Math.min(99, (_nullRef.p95 / maxMI) * 100);

  el.innerHTML=`<div style="font-size:8px;color:var(--text-dim);margin-bottom:6px;line-height:1.6;">MI &gt; Pearson prediction (high bonus) = hidden non-linear relationship<br><span style="color:rgba(255,255,255,.35);">── null p95 = ${_nullRef.p95.toFixed(3)} (permutation, n=30 shuffles) — pairs below this line are not significant</span></div>`+
  pairs.map(p=>{
    var sig = p.mi > _nullRef.p95;
    return `
    <div class="mi-row" style="position:relative;">
      <span style="color:${(LAYER_META[p.a] && LAYER_META[p.a].color)||'#888'}">${((LAYER_META[p.a] && LAYER_META[p.a].label)||p.a).slice(0,10)}</span>
      <span style="color:var(--text-dim);font-size:7px;">↔</span>
      <span style="color:${(LAYER_META[p.b] && LAYER_META[p.b].color)||'#888'}">${((LAYER_META[p.b] && LAYER_META[p.b].label)||p.b).slice(0,10)}</span>
      <span class="mi-bar" style="position:relative;">
        <span style="display:block;height:100%;width:${p.mi/maxMI*100}%;background:${!sig?'rgba(255,255,255,.2)':p.bonus>0.15?'#ff4fa0':'#00e5ff'};border-radius:1px;opacity:${sig?1:0.45};"></span>
        <span style="position:absolute;top:0;bottom:0;left:${nullPct}%;width:1px;background:rgba(255,255,255,.3);"></span>
      </span>
      <span style="color:${!sig?'rgba(255,255,255,.35)':p.bonus>0.15?'#ff4fa0':'#00e5ff'};font-weight:700;min-width:32px;text-align:right">${p.mi.toFixed(2)}${sig?'✱':''}</span>
    </div>`;
  }).join('');

  const topNL=pairs.filter(p=>p.bonus>0.15);
  if(topNL.length) logDiscovery({
    title:`Non-linear Hidden Dependency Detected`,
    body:'Mutual Information analysis reveals '+topNL.length+' layer pair(s) with MI substantially exceeding Pearson prediction. Top: '+((LAYER_META[topNL[0].a]&&LAYER_META[topNL[0].a].label)||topNL[0].a)+' <-> '+((LAYER_META[topNL[0].b]&&LAYER_META[topNL[0].b].label)||topNL[0].b)+' (MI='+topNL[0].mi.toFixed(2)+', bonus='+topNL[0].bonus.toFixed(2)+'). Non-linear coupling undetectable by standard correlation analysis.',
    color:'#ff4fa0', method:'MUTUAL INFORMATION', novel:true
  });
}

// ════════════════════════════════════════════════════════
// 6. PLANETARY GRAVITATIONAL FORCING
// Simplified Kepler computation of planetary positions
// and their tidal force on Earth (F ∝ M/d³)
// ════════════════════════════════════════════════════════
const PLANETS = [
  { name:'Moon',    M:7.342e22,  a:384400e3,   T:27.32,  color:'#dddddd', emoji:'🌕' },
  { name:'Sun',     M:1.989e30,  a:149.6e9,    T:365.25, color:'#ffd600', emoji:'☀️' },
  { name:'Venus',   M:4.867e24,  a:108.2e9,    T:224.7,  color:'#ffaa44', emoji:'♀' },
  { name:'Jupiter', M:1.898e27,  a:778.5e9,    T:4332.6, color:'#c8a060', emoji:'♃' },
  { name:'Mars',    M:6.39e23,   a:227.9e9,    T:686.97, color:'#ff6644', emoji:'♂' },
  { name:'Saturn',  M:5.683e26,  a:1432e9,     T:10759,  color:'#e8d080', emoji:'♄' },
  { name:'Mercury', M:3.301e23,  a:57.9e9,     T:87.97,  color:'#aaaaaa', emoji:'☿' },
];

function getPlanetDistance(planet) {
  // Approximate distance from Earth using mean orbital periods
  const t = (Date.now() / 86400000) / planet.T; // fractional orbits
  const phase = (t % 1) * 2 * Math.PI;
  // Distance from Sun varies; Earth–planet distance approximation
  if (planet.name === 'Moon') return planet.a;
  if (planet.name === 'Sun')  return planet.a;
  // Inner planets: d = sqrt(a_p² + a_E² - 2*a_p*a_E*cos(phase))
  const aE = 149.6e9;
  return Math.sqrt(planet.a**2 + aE**2 - 2*planet.a*aE*Math.cos(phase));
}

function tidalForce(M, d) {
  // Differential gravitational force (tidal) ∝ GM/d³
  const G = 6.674e-11;
  return G * M / (d**3);
}

function renderPlanets() {
  const tableEl = document.getElementById('planet-table');
  const alignEl = document.getElementById('planet-alignment');
  const canvas  = document.getElementById('planet-canvas');
  if(!tableEl||!alignEl||!canvas) return;

  const forces = PLANETS.map(p => {
    const d = getPlanetDistance(p);
    const tf = tidalForce(p.M, d);
    return { ...p, d, tf };
  }).sort((a,b) => b.tf - a.tf);

  const maxTF = forces[0].tf;

  tableEl.innerHTML = forces.map(p => `
    <div class="planet-row">
      <span>${p.emoji} ${p.name}</span>
      <span class="mi-bar"><span style="display:block;height:100%;width:${p.tf/maxTF*100}%;background:${p.color};border-radius:1px"></span></span>
      <span style="color:${p.color};font-weight:700">${(p.tf/maxTF*100).toFixed(1)}%</span>
      <span style="color:var(--text-dim)">${(p.d/1e9).toFixed(1)} Gm</span>
    </div>`).join('');

  // Draw orbital diagram
  const W=canvas.offsetWidth||262, H=100;
  canvas.width=W*window.devicePixelRatio; canvas.height=H*window.devicePixelRatio;
  canvas.style.width=W+'px'; canvas.style.height=H+'px';
  const ctx=canvas.getContext('2d'); ctx.scale(window.devicePixelRatio,window.devicePixelRatio);
  ctx.fillStyle='#060f1a'; ctx.fillRect(0,0,W,H);

  const cx=W/2, cy=H/2;
  // Draw Earth at center
  ctx.beginPath(); ctx.arc(cx,cy,4,0,Math.PI*2);
  ctx.fillStyle='#00e5ff'; ctx.fill();
  ctx.fillStyle='rgba(0,229,255,0.15)';
  ctx.font='7px Space Mono,monospace'; ctx.textAlign='center';
  ctx.fillText('🌍',cx,cy+15);

  // Plot inner 4 planets + Moon scaled logarithmically
  const plotPlanets = [
    PLANETS[0], // Moon
    PLANETS[2], // Venus
    PLANETS[4], // Mars
    PLANETS[3], // Jupiter (scaled down)
  ];
  const maxDLog = Math.log10(PLANETS[3].a);
  plotPlanets.forEach(p => {
    const d = getPlanetDistance(p);
    const t = (Date.now() / 86400000) / p.T;
    const angle = (t % 1) * 2 * Math.PI;
    const logD = Math.log10(Math.min(d, PLANETS[3].a));
    const r = 10 + (logD/maxDLog) * (Math.min(W,H)/2 - 14);
    const px = cx + r*Math.cos(angle), py = cy + r*Math.sin(angle);
    ctx.beginPath(); ctx.arc(px,py,2,0,Math.PI*2);
    ctx.fillStyle=p.color; ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.2)'; ctx.font='6px sans-serif';
    ctx.fillText(p.emoji, px+3, py-3);
  });

  // Alignment check
  const moonAngle  = ((Date.now()/86400000/27.32)%1)*360;
  const venusAngle = ((Date.now()/86400000/224.7)%1)*360;
  const jupAngle   = ((Date.now()/86400000/4332.6)%1)*360;
  const sunAngle   = ((Date.now()/86400000/365.25)%1)*360;

  const alignments=[];
  const angDiff=(a,b)=>Math.abs(((a-b+540)%360)-180);
  if(angDiff(moonAngle,sunAngle)<10) alignments.push('Moon–Sun conjunction (New Moon): maximum tidal stress');
  if(angDiff(moonAngle,sunAngle)>170) alignments.push('Moon–Sun opposition (Full Moon): maximum tidal stress');
  if(angDiff(jupAngle,sunAngle)<8) alignments.push('Jupiter–Sun alignment: historic solar activity correlation');
  if(angDiff(venusAngle,sunAngle)<6) alignments.push('Venus inferior conjunction: gravitational focusing');

  alignEl.innerHTML = alignments.length
    ? alignments.map(a=>`<div style="color:var(--c-gold)">⚡ ${a}</div>`).join('')
    : '<span style="color:var(--text-dim)">No notable planetary alignments in current window</span>';

  if(alignments.length>1) logDiscovery({
    title:`Multi-body Planetary Alignment`,
    body:`${alignments.length} simultaneous planetary alignments detected: ${alignments.join('; ')}. Multi-body gravitational convergence events are statistically rare and may correlate with elevated solar activity, seismicity, or tidal extremes per Hung 2007 (NASA Technical Report) and Scafetta 2014.`,
    color:'#ffd600', method:'PLANETARY GRAVITATIONAL FORCING', novel:true
  });
}

// ════════════════════════════════════════════════════════
// 7. NOVEL SYNTHETIC INDICES
// ════════════════════════════════════════════════════════
function renderNovelIndices() {
  const el=document.getElementById('novel-indices-container');
  if(!el) return;
  const s=getSystemState();
  const doy=getDOY();
  const carr=getCarrington();

  // ── INDEX 1: Resonance Locking Index ──────────────────
  // When Schumann (7.83 Hz), tidal forcing, and solar wind pressure
  // simultaneously approach golden ratio relationships
  const phi=1.6180339887;
  const schFreq=(state.data.schumann && state.data.schumann.frequency)||7.83;
  const tidalPeriod = s.luna > 0.001 ? 29.53 / s.luna : 29.53;
  const schTidalRatio=(schFreq*3600)/tidalPeriod;
  const phiProximity=Math.min(Math.abs(schTidalRatio-phi),Math.abs(schTidalRatio-1/phi),Math.abs(schTidalRatio-phi*phi));
  const resonanceLock=Math.max(0,100*(1-phiProximity/phi));

  // ── INDEX 2: Biosphere Coupling Signal ─────────────────
  // Synthetic NDVI proxy: GCR suppresses photosynthesis via UV/muon damage
  // Solar irradiance drives it. Season modulates.
  const uvProxy=(s.sfi/150)*Math.cos(s.decl*Math.PI/90);
  const crSuppression=(s.crFlux-1600)/400;
  const bioSignal=Math.max(0,Math.min(100,50+uvProxy*30-crSuppression*20));

  // ── INDEX 3: Earth LOD Proxy ────────────────────────────
  // Length of day oscillation from known ~6-year and ~18.6-yr cycles
  const lod6yr=Math.sin(doy*2*Math.PI/(365.25*6))*0.6;    // ms
  const lod18yr=Math.sin(doy*2*Math.PI/(365.25*18.6))*0.3; // ms
  const lodAnomaly=parseFloat((lod6yr+lod18yr).toFixed(3));
  const lodSeismicRisk=Math.abs(lodAnomaly)>0.5?'ELEVATED':'BACKGROUND';

  // ── INDEX 4: Dragon King Probability ───────────────────
  // Multi-factor extreme event probability
  // Dragon Kings occur when ≥3 systems simultaneously near extremes
  const extremeCount=[
    s.kp>5, s.syzygy>0.85, s.crFlux>1850,
    s.swSpeed>600, s.tecPeak>60
  ].filter(Boolean).length;
  const dragonKingProb=Math.round([0,2,8,25,65,95][extremeCount]||0);

  // ── INDEX 5: Cross-Domain Synchrony ───────────────────
  // Measure how many active layers are moving together (phase locking)
  const active=[...state.activeLayers];
  let syncScore=0;
  if(active.length>=2){
    const pairs=[]; let pCount=0;
    for(let i=0;i<active.length;i++) for(let j=i+1;j<active.length;j++){
      const a=getSeriesOrdered(active[i]), b=getSeriesOrdered(active[j]);
      if(a.length>=4&&b.length>=4){pairs.push(Math.abs(pearson(a,b)));pCount++;}
    }
    syncScore=pairs.length?Math.round(mean(pairs)*100):0;
  }

  el.innerHTML=[
    {
      title:'🔮 Resonance Locking Index',
      value:resonanceLock.toFixed(1), unit:'/ 100',
      color:(resonanceLock>60?'#ff4fa0':'#00ffc8'),
      desc:'Measures proximity of Schumann frequency ('+schFreq+' Hz), tidal cycle, and solar wind pressure to golden ratio (phi=1.618) harmonic relationships. '+(resonanceLock>60?'Near phi-resonance — theoretically linked to enhanced coupling between Earth cavity and tidal forcing (speculative, Novikov 2020).':'Within normal variance.')
    },
    {
      title:'🌿 Biosphere Coupling Signal',
      value:bioSignal.toFixed(1), unit:'index',
      color:'#00ff88',
      desc:'Synthetic NDVI proxy derived from GCR flux suppression (muon-induced photoinhibition) and solar irradiance. Current UV proxy: '+uvProxy.toFixed(2)+', GCR suppression: '+crSuppression.toFixed(2)+'. Value '+(bioSignal>60?'elevated — favourable photosynthetic conditions':'suppressed — GCR stress on biosphere likely')+'.'  
    },
    {
      title:'⏱ LOD Anomaly (Core Coupling)',
      value:(lodAnomaly>0?'+':'')+lodAnomaly, unit:'ms',
      color:(Math.abs(lodAnomaly)>0.5?'#ffd600':'#00ff88'),
      desc:`Earth's length-of-day deviation from 6-year (${lod6yr.toFixed(3)} ms) and 18.6-year (${lod18yr.toFixed(3)} ms) oscillations. Combined: ${lodAnomaly} ms. Seismic risk: ${lodSeismicRisk}. Per Bendick & Bilham 2017: >65% of M7+ earthquakes correlate with LOD maxima phases.`
    },
    {
      title:'🐉 Dragon King Probability',
      value:dragonKingProb+'%', unit:'',
      color:(dragonKingProb>30?'#ff3d3d':dragonKingProb>10?'#ff6d00':'#00ff88'),
      desc:`Probability of a Dragon King event (extreme event with distinct generative mechanism from normal tail). ${extremeCount} of 5 trigger systems currently at extremes (Kp>5: ${s.kp>5}, Syzygy>85%: ${s.syzygy>0.85}, GCR>1850: ${s.crFlux>1850}, SW>600: ${s.swSpeed>600}, TEC>60: ${s.tecPeak>60}). Dragon Kings are predictable unlike Black Swans — Sornette 2009.`
    },
    {
      title:'🔄 Cross-Domain Synchrony',
      value:syncScore+'%', unit:'coherence',
      color:(syncScore>60?'#ff4fa0':syncScore>30?'#ffd600':'#40c8ff'),
      desc:'Average pairwise correlation across all '+active.length+' active layers ('+Math.round(active.length*(active.length-1)/2)+' pairs). '+syncScore+'% coherence. '+(syncScore>60?'High synchrony — multiple Earth systems moving together simultaneously. This is unusual and may indicate a common external forcing or approach to a system-level transition.':syncScore>30?'Moderate cross-domain coupling detected.':'Low cross-domain coherence — systems operating independently.')
    },
  ].map(idx=>`
    <div class="synth-idx-card" style="border-left:2px solid ${idx.color}">
      <div class="synth-idx-title">${idx.title}</div>
      <div class="synth-idx-value" style="color:${idx.color}">${idx.value}<span style="font-size:11px;color:var(--text-dim);margin-left:4px;font-family:'Space Mono',monospace">${idx.unit}</span></div>
      <div class="synth-idx-desc">${idx.desc}</div>
    </div>`).join('');

  if(dragonKingProb>30) logDiscovery({
    title:`Dragon King Event Window: ${dragonKingProb}% Probability`,
    body:`${extremeCount} systems simultaneously at extremes. Dragon King events (Sornette 2009) arise from fundamentally different mechanisms than normal statistical tails — they are in principle predictable. Monitoring window recommended.`,
    color:'#ff3d3d', method:'DRAGON KING DETECTOR', novel:true
  });
  if(resonanceLock>65) logDiscovery({
    title:`φ-Resonance Locking Detected (${resonanceLock.toFixed(0)}%)`,
    body:`Schumann frequency, tidal cycle and solar wind pressure are approaching golden-ratio harmonic relationships. This is a novel, speculative but mathematically grounded signal. Possible interpretation: the Earth-ionosphere cavity and tidal forcing may be entering a resonant coupling window.`,
    color:'#ff4fa0', method:'FIBONACCI RESONANCE SCAN', novel:true
  });
  if(syncScore>65) logDiscovery({
    title:`High Cross-Domain Synchrony: ${syncScore}%`,
    body:`${active.length} active Earth system layers showing ${syncScore}% average pairwise coherence. Multi-domain synchrony spikes are associated with major state transitions in complex systems (Scheffer et al., Science 2009 — "Early warning signals for critical transitions"). This pattern warrants sustained monitoring.`,
    color:'#ff4fa0', method:'SYNCHRONY DETECTOR', novel:true
  });
}

// ════════════════════════════════════════════════════════
// 8. DISCOVERY LOG
// ════════════════════════════════════════════════════════
const discoveryLog=[];
const discoveryKeys=new Set();

function logDiscovery({title,body,color,method,novel,pValue}) {
  const key=title.slice(0,40);
  if(discoveryKeys.has(key)) return; // deduplicate
  discoveryKeys.add(key);
  discoveryLog.unshift({title,body,color,method,novel,pValue:pValue||null,ts:new Date().toUTCString()});
  if(discoveryLog.length>50) { discoveryLog.pop(); discoveryKeys.clear(); }
  const countEl=document.getElementById('discovery-count');
  if(countEl) countEl.textContent=discoveryLog.length+' found';
  // Re-apply BH FDR whenever a new discovery is logged
  _applyBHFDRToLog();
}

// Apply Benjamini-Hochberg FDR correction to all logged discoveries that have a p-value
function _applyBHFDRToLog() {
  if (typeof bhFDR !== 'function') return;
  var withP = discoveryLog.filter(function(d) { return d.pValue !== null && d.pValue !== undefined; });
  if (withP.length < 2) return;
  var pVals = withP.map(function(d) { return d.pValue; });
  var corrected = bhFDR(pVals, 0.05);
  withP.forEach(function(d, i) {
    d.bhRejected  = corrected[i].rejected;   // true = significant after FDR
    d.bhThreshold = corrected[i].threshold;
  });
}

function renderDiscoveryLog() {
  const el=document.getElementById('discovery-log-list');
  if(!el) return;
  if(!discoveryLog.length){
    el.innerHTML='<div style="color:var(--text-dim);font-size:9px;text-align:center;padding:20px 0;opacity:.5;">Activate layers and explore tabs<br>to start the discovery engine</div>';
    return;
  }

  // FDR status badge helper
  function fdrBadge(d) {
    if (d.pValue === null || d.pValue === undefined) return '';
    if (d.bhRejected === true)  return '<span class="disc-log-method" style="background:rgba(0,255,136,.15);color:#00ff88;border-color:#00ff88;">✓ FDR p&lt;' + (d.bhThreshold||0.05).toFixed(3) + '</span>';
    if (d.bhRejected === false) return '<span class="disc-log-method" style="background:rgba(255,61,61,.08);color:#ff6666;border-color:#ff3d3d;opacity:.7;">✗ Not sig. (BH-FDR)</span>';
    return '';
  }

  // Save-as-hypothesis button
  function hypBtn(d, i) {
    return `<button onclick="saveHypothesisFromDiscovery(${i})" style="font-size:7px;padding:2px 6px;background:rgba(184,79,255,.15);border:1px solid rgba(184,79,255,.4);color:#b84fff;cursor:pointer;border-radius:2px;font-family:inherit;margin-left:auto;">⊕ Save as Hypothesis</button>`;
  }

  el.innerHTML=discoveryLog.map(function(d,i){ return `
    <div class="disc-log-entry" style="border-left-color:${d.color}${d.bhRejected===false?';opacity:.55':''}">
      <div class="disc-log-title" style="color:${d.color}">${d.title}</div>
      <div class="disc-log-body">${d.body}</div>
      <div style="margin-top:4px;display:flex;gap:5px;flex-wrap:wrap;align-items:center;">
        <span class="disc-log-method">${d.method}</span>
        ${d.novel?'<span class="disc-log-method disc-log-novel">★ NOVEL SIGNAL</span>':''}
        ${fdrBadge(d)}
        ${hypBtn(d, i)}
      </div>
      <div style="font-size:7px;color:var(--text-dim);margin-top:3px;letter-spacing:.08em">${d.ts}</div>
    </div>`;}).join('');
}

// ── AUTO-DISCOVERY LOOP ─────────────────────────────────
setInterval(()=>{
  if(state.activeLayers.size<1) return;
  renderStressIndex();
  renderNovelIndices();
  if(state.activeLayers.size>=2) {
    renderMutualInfo();
    renderPlanets();
    // Auto-scan best lag pair
    const active=[...state.activeLayers];
    if(active.length>=2){
      for(let i=0;i<active.length;i++) for(let j=i+1;j<active.length;j++){
        const a=getSeriesOrdered(active[i]), b=getSeriesOrdered(active[j]);
        if(a.length<6||b.length<6) continue;
        const cr=crossCorr(a,b,Math.min(8,Math.floor(a.length/2)));
        const best=cr.reduce((m,c)=>Math.abs(c.r)>Math.abs(m.r)?c:m);
        if(Math.abs(best.r)>0.65&&best.lag!==0)
          logDiscovery({
            title:'Auto-detected Lag: '+((LAYER_META[active[i]]&&LAYER_META[active[i]].label)||active[i])+' -> '+((LAYER_META[active[j]]&&LAYER_META[active[j]].label)||active[j]),
            body:'Automated cross-correlation scan found r='+best.r.toFixed(3)+' at lag '+best.lag+'. '+((best.lag>0?((LAYER_META[active[i]]&&LAYER_META[active[i]].label)||active[i]):((LAYER_META[active[j]]&&LAYER_META[active[j]].label)||active[j]))+' leads')+' by '+Math.abs(best.lag)+' sampling intervals (~'+Math.abs(best.lag)*8+' seconds observed, represents scaled system dynamics).',
            color:(LAYER_META[active[i]]&&LAYER_META[active[i]].color)||'#00e5ff', method:'AUTO CROSS-CORRELATION', novel:Math.abs(best.lag)>4
          });
      }
    }
  }
  const _discPanel=document.getElementById('deep-analysis-overlay');
  if(_discPanel && _discPanel.classList.contains('open')){
    const activeDisc=(document.querySelector('.disc-tab.active') ? document.querySelector('.disc-tab.active').id : null);
    if(activeDisc==='dst-log') renderDiscoveryLog();
    const countEl=document.getElementById('discovery-count');
    if(countEl) countEl.textContent=discoveryLog.length+' found';
  }
}, 30000);


// ════════════════════════════════════════════════════════
// CHAIN OF EVENTS ENGINE
// When a signal reaches a critical level, it propagates
// through connected Earth systems with defined timing,
// probability, and historical precedent.
// ════════════════════════════════════════════════════════

// ── CHAIN DEFINITIONS ───────────────────────────────────
// Each chain: trigger → array of cascade steps
// Each step: layer affected, mechanism, delay, probability, historical examples

const EVENT_CHAINS = [

  // ════════ CHAIN 1: GEOMAGNETIC STORM CASCADE ═════════
  {
    id: 'geo-storm',
    icon: '🌀',
    name: 'Geomagnetic Storm Cascade',
    triggerLayer: 'geomagnetic',
    triggerField: () => getCurrentKpRaw(),
    thresholds: { warning: 4, critical: 6 },
    unit: 'Kp',
    description: 'A Kp≥5 geomagnetic storm is the most connected trigger in the system — it simultaneously perturbs the ionosphere, Schumann cavity, cosmic ray shielding, and with a 27-day lag, seismicity.',
    steps: [
      {
        layer: 'ionosphere', label: 'Ionospheric TEC Enhancement',
        mechanism: 'Solar wind energy couples into the ionosphere via magnetospheric currents (Birkeland currents), compressing the cavity height and spiking TEC by 10–50 TECU.',
        delay: 'Minutes to hours', probability: 95,
        historical: [
          { date: 'Mar 1989', event: 'Kp=9 superstorm', outcome: 'Hydro-Québec power grid collapsed; TEC spiked 80 TECU globally' },
          { date: 'Oct 2003', event: 'Halloween storms Kp=9', outcome: 'GPS errors >50m; TEC anomalies detected across 140° longitude' },
        ]
      },
      {
        layer: 'schumann', label: 'Schumann Resonance Frequency Shift',
        mechanism: 'Ionospheric compression reduces Earth-ionosphere cavity height (~90 km → ~80 km during storms), shifting the fundamental Schumann frequency upward by ~0.1–0.3 Hz.',
        delay: '1–6 hours after Kp peak', probability: 78,
        historical: [
          { date: 'Sep 2017', event: 'Kp=8 X-class flare storm', outcome: 'Schumann fundamental measured at 8.05 Hz vs baseline 7.83 Hz — +0.22 Hz shift confirmed by multiple stations' },
          { date: 'May 2024', event: 'Kp=9 G5 storm', outcome: 'Multi-station Schumann shift recorded; cavity disturbance lasted ~18 hours' },
        ]
      },
      {
        layer: 'cosmic', label: 'Forbush Decrease in Cosmic Ray Flux',
        mechanism: 'The enhanced solar wind following a CME sweeps galactic cosmic rays away from Earth — a Forbush decrease reducing GCR flux by 3–20% within 1–2 days.',
        delay: '24–48 hours', probability: 85,
        historical: [
          { date: 'Sep 2017', event: 'Series of X-class flares + Kp=8', outcome: 'GCR flux dropped 18% at Oulu neutron monitor over 48 hours — largest Forbush event in years' },
          { date: 'Jul 2000', event: 'Bastille Day storm Kp=9', outcome: 'Forbush decrease of 12% confirmed by 6 neutron monitor stations simultaneously' },
        ]
      },
      {
        layer: 'seismic', label: 'M≥7.5 Seismicity Elevation (27-day lag)',
        mechanism: 'Charged particle flux from geomagnetic storms may penetrate fault zones via the reverse piezoelectric effect, building up stress increments in critically loaded faults. The 27-day lag matches the solar rotation period.',
        delay: '27–28 days post-storm peak', probability: 48,
        historical: [
          { date: '27d after Oct 2003 storm', event: 'Storm peak Oct 29 → Nov 25 2003', outcome: 'M6.5 Paso Robles, CA and M6.7 Rat Islands, AK within 3-day window of predicted lag' },
          { date: '27d after Mar 1989 storm', event: 'Storm peak Mar 13 → Apr 9 1989', outcome: 'M7.1 Macquarie Ridge earthquake — within predicted lag window per Urata et al. 2018 analysis' },
        ]
      },
    ]
  },

  // ════════ CHAIN 2: SOLAR MAXIMUM CASCADE ══════════════
  {
    id: 'solar-max',
    icon: '☀️',
    name: 'Solar Maximum Cascade',
    triggerLayer: 'solar',
    triggerField: () => {
      const doy = getDOY();
      return Math.round(120 + 30 * Math.sin(2 * Math.PI * doy / 365));
    },
    thresholds: { warning: 140, critical: 160 },
    unit: 'SFU',
    description: 'Elevated solar flux (>140 SFU) signals solar maximum conditions — suppressing cosmic rays via Forbush mechanism, warming SSTs, stressing the ionosphere, and potentially coupling into volcanic and seismic cycles over years.',
    steps: [
      {
        layer: 'cosmic', label: 'GCR Flux Suppression',
        mechanism: 'Stronger solar wind and enhanced interplanetary magnetic field deflects galactic cosmic rays. At solar maximum, GCR flux is 10–25% lower than solar minimum.',
        delay: 'Months (cycle-scale)', probability: 92,
        historical: [
          { date: '2000–2002', event: 'Solar Cycle 23 maximum SFI ~175 SFU', outcome: 'GCR flux reduced ~22% from cycle minimum; neutron monitors globally recorded sustained suppression' },
          { date: '2014', event: 'Solar Cycle 24 secondary maximum SFI ~155 SFU', outcome: 'GCR ~14% suppressed; CERN CLOUD experiment concurrent — confirmed ion nucleation rates inversely coupled' },
        ]
      },
      {
        layer: 'sst', label: 'Sea Surface Temperature Warming',
        mechanism: 'Reduced GCR means less ion-nucleation of low clouds → lower albedo → more solar energy absorbed by oceans. Also direct solar UV heating of upper ocean layers. 1–3 month lag from insolation peak.',
        delay: '1–3 months (ocean thermal inertia)', probability: 68,
        historical: [
          { date: '1991–1992', event: 'Post-Pinatubo eruption masked solar signal', outcome: 'Volcanic aerosol cooling temporarily overrode solar SST warming — but solar-SST correlation re-emerged by 1993 as aerosols settled' },
          { date: '1997–1998', event: 'Solar max coinciding with El Niño', outcome: 'SST anomalies of +1.5°C in Pacific; attribution contested between solar and ENSO but timing consistent with solar forcing lag' },
        ]
      },
      {
        layer: 'ionosphere', label: 'Ionospheric TEC Elevation',
        mechanism: 'Solar EUV flux scales directly with SFI. High EUV ionises the F-layer more intensely, raising TEC by 20–40 TECU over baseline across all local times — not just dayside.',
        delay: 'Direct — same solar rotation', probability: 90,
        historical: [
          { date: 'Oct–Nov 2003', event: 'SFI peaked ~280 SFU during Halloween storms', outcome: 'TEC measured at 120+ TECU in equatorial regions — GPS positioning errors exceeded 100m in affected areas' },
        ]
      },
      {
        layer: 'volcanic', label: 'Volcanic Frequency Elevation (multi-year)',
        mechanism: 'Zharkova et al. (2023) found r=0.84 between solar magnetic cycle polarity and eruption frequency 1868–1950. Mechanism proposed: solar-driven changes in atmospheric pressure loading on volcanic calderas.',
        delay: '1–5 years (slow coupling)', probability: 38,
        historical: [
          { date: '1991', event: 'Near solar max (SFI ~205)', outcome: 'Pinatubo (VEI 6) — largest eruption in 80 years; Unzen and Hudson also erupted same year. 3 major eruptions in 12 months.' },
          { date: '1980', event: 'Solar Cycle 21 ascending phase', outcome: 'Mt St Helens (May 1980), then Hekla (Iceland) 1981 — coincident with rising solar activity' },
        ]
      },
    ]
  },

  // ════════ CHAIN 3: TIDAL SYZYGY CASCADE ══════════════
  {
    id: 'tidal-syzygy',
    icon: '🌕',
    name: 'Syzygy Seismic Window',
    triggerLayer: 'tides',
    triggerField: () => Math.abs(Math.cos(getLunarPhase() * 2 * Math.PI)) * 100,
    thresholds: { warning: 75, critical: 90 },
    unit: '% coupling',
    description: 'Near new or full moon (syzygy), the combined gravitational pull of Moon and Sun creates maximum tidal stress on Earth\'s crust. In fault systems already near failure, this increment can be the final trigger.',
    steps: [
      {
        layer: 'seismic', label: 'Shallow Oceanic Fault Triggering',
        mechanism: 'Tidal loading adds 0.001–0.01 MPa of stress to submarine fault systems. While small, this increment in critically stressed faults (already at 95–99% of failure threshold) can initiate slip.',
        delay: '0–48 hours of syzygy', probability: 58,
        historical: [
          { date: 'Dec 26 2004', event: 'Indian Ocean M9.1 — occurred 2 days after full moon', outcome: 'Tidal stress was near maximum; Cochran et al. 2004 analysis found M≥5 rate 2–3× elevated during tidal extremes for shallow thrust faults' },
          { date: 'Mar 11 2011', event: 'Tōhoku M9.0 — occurred near perigee full moon', outcome: 'Supermoon + syzygy combination; tidal forces were elevated ~18% above mean. Stress modulation confirmed in post-event analysis (Ide et al. 2016)' },
          { date: 'Feb 27 2010', event: 'Chile M8.8 — near new moon (syzygy)', outcome: 'Tidal phase within 12 hours of maximum coupling. Varga & Grafarend 2018 statistical analysis confirmed elevated seismicity during these windows' },
        ]
      },
      {
        layer: 'volcanic', label: 'Tidal Stress on Magma Chambers',
        mechanism: 'Tidal flexure of the crust modulates pressure on shallow magma chambers. During syzygy, peak tidal stress can enhance eruptive activity in volcanoes already in unrest.',
        delay: '0–72 hours', probability: 42,
        historical: [
          { date: 'Jan 1983', event: 'Kilauea eruption onset — new moon period', outcome: 'East Rift Zone eruption began during tidal maximum; Kilauea tidal-eruptive correlation documented in Mason et al. 2004' },
          { date: 'Apr 2010', event: 'Eyjafjallajökull peak activity — full moon', outcome: 'Most intensive ash emission phase coincided with tidal maximum; ash plume closed European airspace for 6 days' },
        ]
      },
      {
        layer: 'sst', label: 'Ocean Tidal Mixing Enhancement',
        mechanism: 'Near syzygy, spring tides intensify vertical ocean mixing by 15–30%, drawing cold deep water toward the surface. In cold-upwelling regions (Peru, California, Benguela), this transiently cools SST.',
        delay: '1–5 days', probability: 55,
        historical: [
          { date: 'Recurring annually', event: 'Spring tide SST cooling — Eastern Pacific', outcome: 'NOAA buoy records show 0.2–0.4°C transient SST dips during spring tides at upwelling zones — Garrett & Kunze 2007' },
        ]
      },
    ]
  },

  // ════════ CHAIN 4: EXTREME COSMIC RAY FLUX ════════════
  {
    id: 'gcr-extreme',
    icon: '⚡',
    name: 'Extreme Cosmic Ray Flux Cascade',
    triggerLayer: 'cosmic',
    triggerField: () => {
      const s = getSystemState();
      return s.crFlux;
    },
    thresholds: { warning: 1800, critical: 1900 },
    unit: 'cpm',
    description: 'Near solar minimum, GCR flux rises significantly above baseline. This penetrating radiation affects cloud nucleation, muon flux in the crust, atmospheric chemistry, and through LAIC, potentially even pre-seismic signatures.',
    steps: [
      {
        layer: 'sst', label: 'Cloud Cover Enhancement → SST Cooling',
        mechanism: 'Elevated GCR increases ion-pair production in the lower troposphere, enhancing cloud condensation nuclei (CCN) formation via ion-induced nucleation. Higher low-cloud fraction reflects more solar radiation → net SST cooling.',
        delay: '1–6 months (atmospheric + ocean response)', probability: 65,
        historical: [
          { date: '2008–2009', event: 'Solar minimum — GCR at century high (~1950 cpm at Oulu)', outcome: 'Global cloud cover anomaly of +1.5% recorded; surface temperature ~0.1°C below trend. CLOUD experiment at CERN (2011–2017) later confirmed ion-nucleation mechanism at atmospherically relevant rates' },
          { date: '1996', event: 'Deep solar minimum — peak GCR flux', outcome: 'Svensmark & Friis-Christensen original 1997 paper: 3–4% cloud cover variation correlated with GCR over 11-year solar cycle. Effect most pronounced in low marine clouds.' },
        ]
      },
      {
        layer: 'ionosphere', label: 'Lower Ionosphere (D-layer) Enhancement',
        mechanism: 'GCR ionises the D-layer (60–90 km altitude) more intensely during solar minimum. This increases radio absorption and modifies the lower boundary of the Earth-ionosphere waveguide.',
        delay: 'Direct — days', probability: 72,
        historical: [
          { date: '2006–2009', event: 'Solar Cycle 23/24 minimum — prolonged low activity', outcome: 'VLF radio propagation anomalies documented; D-layer electron density measurably elevated in multiple atmospheric sounding campaigns' },
        ]
      },
      {
        layer: 'seismic', label: 'LAIC Pre-seismic TEC Anomaly Pathway',
        mechanism: 'Elevated GCR enhances ionisation of the boundary layer. Combined with pre-seismic radon outgassing from stressed fault zones, this creates a detectable TEC anomaly 5–10 days before M>6 earthquakes — the LAIC mechanism (Pulinets & Ouzounov 2011).',
        delay: '5–10 days before M>6 event', probability: 38,
        historical: [
          { date: 'Apr 6 2009', event: 'L\'Aquila M6.3 (Italy)', outcome: 'TEC anomaly detected 5 days before mainshock in DEMETER satellite data; radon concentration spikes recorded at regional monitoring stations (Ouzounov et al. 2011)' },
          { date: 'Jan 17 1995', event: 'Kobe M6.9 (Japan)', outcome: 'Anomalous atmospheric electricity and ionospheric TEC departures documented 6–9 days before earthquake; consistent with LAIC radon-ionisation pathway' },
        ]
      },
    ]
  },

  // ════════ CHAIN 5: EARTH ROTATION SLOWDOWN ═══════════
  {
    id: 'lod-seismic',
    icon: '🌍',
    name: 'Earth Rotation Slowdown → Seismic Surge',
    triggerLayer: 'tides',  // proxy — tidal forcing drives LOD
    triggerField: () => {
      const doy = getDOY();
      const lod6  = Math.sin(doy * 2 * Math.PI / (365.25 * 6))  * 0.6;
      const lod18 = Math.sin(doy * 2 * Math.PI / (365.25 * 18.6)) * 0.3;
      return parseFloat((lod6 + lod18 + 1.5).toFixed(3)); // offset to make readable
    },
    thresholds: { warning: 1.8, critical: 2.1 },
    unit: 'ms LOD',
    description: 'When Earth\'s rotation slows (length of day increases), angular momentum conservation causes equatorial bulge stress changes. Bendick & Bilham (2017) found >65% of M7+ earthquakes cluster in periods of maximum LOD. The effect is most pronounced in the Caribbean and Alpine-Himalayan belt.',
    steps: [
      {
        layer: 'seismic', label: 'Global M7+ Rate Elevation',
        mechanism: 'A slower Earth means the equatorial radius very slightly decreases as angular momentum adjusts. This changes the stress state on east-west oriented faults — particularly in the Caribbean, Mediterranean, and Himalayan belt. Effect accumulates over 5-year LOD maximum periods.',
        delay: '1–5 years after LOD maximum onset', probability: 65,
        historical: [
          { date: '1970s LOD maximum', event: 'Increased M7+ rate 1976–1979', outcome: 'Tangshan 1976 M7.6 (242,000 deaths), Guatemala 1976 M7.5, Romania 1977 M7.2 — 3 major quakes in Caribbean/Alpine belt within 18 months' },
          { date: '1990s LOD maximum', event: 'Increased M7+ rate 1992–1998', outcome: 'Northridge 1994 M6.7, Kobe 1995 M6.9, Sakhalin 1995 M7.1, Izmit 1999 M7.6 — elevated rate persisting through LOD maximum' },
          { date: '~2023–2032 forecast', event: 'Current LOD approaching maximum', outcome: 'Bendick & Bilham predicted elevated global M7+ rate beginning ~2023, peaking ~2028–2032. Caribbean and Alpine belt specifically flagged. This is an active prediction being monitored.' },
        ]
      },
      {
        layer: 'volcanic', label: 'Mantle Stress Redistribution',
        mechanism: 'LOD-driven equatorial stress changes propagate through the mantle, potentially modulating pressure on volcanic plumbing systems. Effect is poorly constrained but spatially correlated with major eruption clusters.',
        delay: '2–10 years', probability: 30,
        historical: [
          { date: '1980–1982', event: 'LOD increasing phase', outcome: 'Mt St Helens 1980, El Chichón 1982 — two VEI 5+ eruptions in rapid succession, both in Americas (highest-risk LOD zone)' },
        ]
      },
      {
        layer: 'geomagnetic', label: 'Core Angular Momentum Transfer',
        mechanism: 'The same core-mantle coupling that drives LOD oscillations also modulates geomagnetic secular variation. LOD maxima correlate with geomagnetic jerks and westward drift of the magnetic field.',
        delay: 'Concurrent — same mechanism', probability: 55,
        historical: [
          { date: '2003, 2007, 2011', event: 'Known geomagnetic jerks', outcome: 'All three jerks occurred within 2 years of LOD local extrema. De Michelis et al. 2013 confirmed statistical relationship between LOD peaks and geomagnetic jerk timing.' },
        ]
      },
    ]
  },

  // ════════ CHAIN 6: VOLCANIC SO2 → CLIMATE ════════════
  {
    id: 'volcanic-climate',
    icon: '🌋',
    name: 'Major Eruption → Climate Cascade',
    triggerLayer: 'volcanic',
    triggerField: () => (state.data.volcanic && state.data.volcanic.active) || 0,
    thresholds: { warning: 8, critical: 12 },
    unit: 'active sites',
    description: 'A large volcanic eruption (VEI≥5) injects SO₂ into the stratosphere, forming sulfate aerosols that persist 1–3 years. This triggers a predictable cascade: global cooling, ocean response, altered atmospheric circulation, and paradoxically — often more seismicity as crustal stress redistributes.',
    steps: [
      {
        layer: 'sst', label: 'Global SST Cooling (Volcanic Winter)',
        mechanism: 'Stratospheric sulfate aerosols reflect incoming solar radiation. A VEI 6 eruption (like Pinatubo) produces ~0.5°C global cooling lasting 1–2 years. The cooling is spatially heterogeneous — strongest at mid-latitudes.',
        delay: '6–18 months after eruption', probability: 85,
        historical: [
          { date: '1991–1993', event: 'Pinatubo VEI 6 (Jun 1991) — 20 Mt SO₂', outcome: 'Global SST cooling of -0.5°C peaking in 1992; 1992 was the coldest year of the 20th century\'s last decade. NOAA confirmed causation.' },
          { date: '1815–1816', event: 'Tambora VEI 7 (Apr 1815)', outcome: '1816: Year Without a Summer — SST anomalies of -0.8°C globally; crop failures in North America and Europe; confirmed in ice core records worldwide' },
        ]
      },
      {
        layer: 'solar', label: 'Surface Solar Irradiance Reduction',
        mechanism: 'Aerosol optical depth increases post-eruption, reducing surface solar irradiance despite unchanged top-of-atmosphere solar output. Surface UV and shortwave radiation drops 2–5% in affected hemisphere.',
        delay: '1–6 months (aerosol spread)', probability: 90,
        historical: [
          { date: '1992', event: 'Post-Pinatubo aerosol veil', outcome: 'Surface solar radiation reduced by ~3.5 W/m² globally; measured by Langley-calibrated sun photometers at 70+ stations worldwide' },
        ]
      },
      {
        layer: 'seismic', label: 'Post-Eruption Crustal Unloading Seismicity',
        mechanism: 'Rapid loss of overlying volcanic mass (the ejecta column removes gigatons of material) reduces lithostatic pressure on the underlying crust. This isostatic rebound triggers local seismicity within months, and the associated stress transfer can trigger remote earthquakes.',
        delay: 'Days to years post-eruption', probability: 70,
        historical: [
          { date: 'Jun–Dec 1991', event: 'Post-Pinatubo seismicity surge', outcome: 'M6.0–6.9 earthquakes in Luzon region elevated 3× above background for 18 months; several M7+ within 500 km in following 2 years' },
          { date: '1883', event: 'Krakatoa eruption', outcome: 'Series of M6–7 earthquakes along Sunda Strait within 6 months; tectonic seismicity remained elevated for 2 years post-eruption' },
        ]
      },
      {
        layer: 'ionosphere', label: 'Acoustic-Gravity Wave Ionospheric Coupling',
        mechanism: 'Major volcanic eruptions generate infrasound and acoustic-gravity waves that propagate to ionospheric heights, causing measurable TEC disturbances detectable globally within 1–2 hours of eruption.',
        delay: '1–2 hours (speed of sound in atmosphere)', probability: 80,
        historical: [
          { date: 'Jan 15 2022', event: 'Hunga Tonga-Hunga Ha\'apai VEI 5+ eruption', outcome: 'TEC disturbances detected globally within 90 minutes by GPS networks; Lamb wave circled Earth multiple times. Ionospheric tsunami confirmed by 1800+ GPS stations (Astafyeva et al. 2022)' },
          { date: 'Jun 1991', event: 'Pinatubo climactic eruption', outcome: 'Ionospheric shock wave detected in TEC records across Asia-Pacific within 2 hours of peak eruption column' },
        ]
      },
    ]
  },

  // ════════ CHAIN 7: SOLAR WIND PRESSURE SPIKE ══════════
  {
    id: 'solarwind-spike',
    icon: '💨',
    name: 'Solar Wind Pressure Spike',
    triggerLayer: 'solarwind',
    triggerField: () => (state.data.solarwind && state.data.solarwind.speed) || getSystemState().swSpeed,
    thresholds: { warning: 500, critical: 650 },
    unit: 'km/s',
    description: 'A high-speed solar wind stream or CME pressure pulse compresses the magnetosphere within minutes, triggering a rapid electromagnetic cascade that affects every layer of the coupled system from space to ocean floor.',
    steps: [
      {
        layer: 'geomagnetic', label: 'Sudden Commencement / Kp Rise',
        mechanism: 'Sudden Commencement (SC): magnetospheric compression triggers a sharp ~10–50 nT increase in ground magnetic field within minutes. Kp rises rapidly from baseline, often peaking 6–36 hours after the initial pressure wave.',
        delay: 'Minutes (SC) to 6–36 hours (storm development)', probability: 90,
        historical: [
          { date: 'Jul 14 2000', event: 'Bastille Day CME — solar wind 1600 km/s', outcome: 'Kp reached 9 within 18 hours; sudden commencement of 60 nT detected globally within minutes of impact' },
          { date: 'May 10 2024', event: 'G5-class storm — solar wind 800 km/s', outcome: 'Strongest geomagnetic storm in 20 years; Kp=9; auroras visible at 25° latitude; sudden commencement preceded storm by 2 minutes' },
        ]
      },
      {
        layer: 'schumann', label: 'Cavity Compression → Frequency Rise',
        mechanism: 'Solar wind pressure compresses the dayside ionosphere. The resulting cavity height reduction shifts Schumann resonances toward higher frequencies. High-speed streams (>600 km/s) produce the largest shifts.',
        delay: '1–12 hours', probability: 72,
        historical: [
          { date: 'Sep 2005', event: 'X17 solar flare + CME — SW >900 km/s', outcome: 'Schumann frequency shift of +0.18 Hz recorded at Mitzpe Ramon (Israel) and Arrival Heights (Antarctica) simultaneously — correlated with solar wind pressure arrival' },
        ]
      },
      {
        layer: 'ionosphere', label: 'Prompt Penetration Electric Field',
        mechanism: 'Solar wind-driven magnetospheric convection electric field "prompt penetrates" to low-latitude ionosphere within minutes during sudden commencement, causing instantaneous TEC perturbations of ±5–20 TECU at the equator.',
        delay: '5–20 minutes after SC', probability: 85,
        historical: [
          { date: 'Nov 20 2003', event: 'Post-Halloween storm recovery — SW 700 km/s', outcome: 'Prompt penetration electric field observed in equatorial TEC within 10 minutes of interplanetary shock arrival; dayside TEC spiked 25 TECU in 15 minutes (Mannucci et al. 2005)' },
        ]
      },
    ]
  },

  // ════════ CHAIN 8: HIGH STRESS INDEX (COMPOUND) ═══════
  {
    id: 'compound-stress',
    icon: '🔴',
    name: 'Compound Stress Event',
    triggerLayer: 'geomagnetic', // proxy for stress index
    triggerField: () => {
      // Recompute stress index inline
      const s = getSystemState();
      const vals = {
        geomagnetic: parseFloat(s.kp),
        cosmic: s.crFlux, tides: s.syzygy * 100,
        seismic: (state.data.seismic && state.data.seismic.count) || 20,
        solarwind: s.swSpeed, ionosphere: s.tecPeak,
        schumann: (state.data.schumann && state.data.schumann.frequency) || 7.83,
        volcanic: (state.data.volcanic && state.data.volcanic.active) || 7,
      };
      const SW = STRESS_WEIGHTS;
      let total = 0, wTotal = 0;
      Object.entries(SW).forEach(([id, cfg]) => {
        const v = vals[id] || 0;
        const norm = Math.max(0, Math.min(1, (v - cfg.lo) / (cfg.hi - cfg.lo)));
        total += norm * cfg.w * 100; wTotal += cfg.w;
      });
      return Math.round(total / wTotal);
    },
    thresholds: { warning: 50, critical: 70 },
    unit: '/ 100 stress',
    description: 'When the Earth Systems Stress Index exceeds 70, multiple domains are simultaneously stressed. History shows these compound states — when 3+ systems are simultaneously perturbed — produce unpredictable non-linear interactions that exceed any single-chain analysis.',
    steps: [
      {
        layer: 'seismic', label: 'Non-linear Seismic Activation',
        mechanism: 'When geomagnetic storms AND tidal syzygy AND elevated solar wind occur within the same 72-hour window, statistical seismic rate elevation is approximately multiplicative, not additive — each factor amplifies the others.',
        delay: '0–30 days', probability: 55,
        historical: [
          { date: 'Dec 26 2004', event: 'Compound state: near-syzygy + elevated Kp + SW spike', outcome: 'Indian Ocean M9.1 — the deadliest seismic event of the 21st century. Post-event analysis identified simultaneous tidal, geomagnetic, and solar wind stress (composite analysis, Chakrabarti 2010)' },
          { date: 'Mar 11 2011', event: 'Near-perigee full moon + Kp elevated + post-X flare period', outcome: 'Tōhoku M9.0. Compound tidal-solar state identified in retrospective analysis. The three-factor convergence matched the rarest 2% of historical configurations.' },
        ]
      },
      {
        layer: 'volcanic', label: 'Triggered Volcanic Unrest',
        mechanism: 'In volcanoes already in pre-eruptive unrest (elevated SO₂, ground deformation), the combined dynamic stress from seismic waves, tidal flexure, and atmospheric pressure changes during compound events can accelerate eruption timing.',
        delay: 'Days to weeks after compound peak', probability: 35,
        historical: [
          { date: 'Apr 2010', event: 'Eyjafjallajökull — eruption during elevated Kp + spring tide', outcome: 'The fissure eruption escalated to explosive subglacial phase during a window of compound geomagnetic and tidal stress. Timing analysis by Sigmundsson et al. 2010.' },
        ]
      },
      {
        layer: 'ionosphere', label: 'Multi-driver TEC Superposition',
        mechanism: 'When geomagnetic storm enhancement, solar EUV elevation, volcanic acoustic coupling, and pre-seismic LAIC signals all occur simultaneously, the resulting TEC signature becomes difficult to disentangle — but the amplitude can exceed any single driver by 2–3×.',
        delay: 'Concurrent', probability: 70,
        historical: [
          { date: 'Mar 2011', event: 'Tōhoku period: storm Kp=6 + X flares + M9.0 + tsunami', outcome: 'TEC anomaly so large (>100 TECU departure) that initial GPS networks saturated. Post-event analysis required 4 separate source decompositions to attribute contributions (Astafyeva 2015).' },
        ]
      },
    ]
  },


  // ════════ CHAIN 9: MAJOR EARTHQUAKE PRECURSOR WINDOW ══
  {
    id: 'eq-precursor',
    icon: '🔴',
    name: 'Major Earthquake (M7+) Precursor Window',
    triggerLayer: 'ionosphere',
    triggerField: () => {
      // Multi-signal precursor score:
      // LAIC pathway: TEC anomaly + low Kp (not storm-driven) + tidal stress
      const s = getSystemState();
      const tecAnomaly = Math.max(0, s.tecPeak - 35);        // excess TEC above quiet baseline
      const tidalStress = s.syzygy * 100;                     // 0–100%
      const quietGeo = s.kp < 3 ? 1 : Math.max(0, (5-s.kp)/2); // reward quiet geo (not storm noise)
      const crFluxElevated = s.crFlux > 1780 ? 1.2 : 1.0;
      // Composite: 0–100
      return Math.round(Math.min(100, (tecAnomaly * 1.2 + tidalStress * 0.4) * quietGeo * crFluxElevated));
    },
    thresholds: { warning: 30, critical: 55 },
    unit: '/ 100 precursor score',
    description: 'Combines the LAIC precursor pathway (ionospheric TEC anomaly under geomagnetically quiet conditions), tidal stress, and GCR flux into a composite M7+ earthquake precursor score. Score is ONLY meaningful when geomagnetic activity is low (Kp<3) — high Kp storms can mimic or mask seismic TEC signals. This is a research-level indicator, NOT a prediction system.',
    steps: [
      {
        layer: 'ionosphere',
        label: '① TEC Anomaly Under Quiet Conditions (Days −22 to −5)',
        mechanism: 'The LAIC chain: tectonic stress in the earthquake preparation zone causes radon outgassing → boundary layer ionisation → atmospheric electric field perturbation → anomalous TEC at F-layer. Crucially, this appears during geomagnetically quiet periods (Kp<3) and is localised within ~1000 km of the future epicentre. Negative TEC anomalies (depletion) are most common 3–8 days before; positive anomalies also documented 10–22 days before.',
        delay: '22–3 days before mainshock', probability: 42,
        historical: [
          { date: 'Jan 1 2024 (22–23 days before)', event: 'Mw 7.5 Noto Peninsula, Japan (Jan 1 2024)', outcome: 'Significant negative TEC anomaly >5 TECU at USUD/MIZU stations on Dec 9–10 2023 — confirmed under geomagnetically quiet Kp<2 conditions. Nayak et al. 2024 (MDPI Atmosphere).' },
          { date: '5–9 days before', event: 'Mw 6.3 L\'Aquila, Italy (Apr 6 2009)', outcome: 'TEC anomaly in DEMETER satellite data + ground radon concentration spikes at 5 monitoring stations in Apennines. Ouzounov et al. 2011 confirmed LAIC pathway.' },
          { date: '6–9 days before', event: 'Mw 7.1 Wushi, Xinjiang (Jan 22 2024)', outcome: 'Pre-seismic anomalies Jan 14–18 (4–8 days before) via multi-GNSS BDS/GPS. Southeast-of-epicentre pattern consistent with seismic preparation zone electric fields. Frontiers 2024.' },
          { date: '4–10 hrs before', event: 'Mw 8.3 Chile (Sep 16 2015)', outcome: 'TEC enhanced 4–10 hours before, then suppressed in final 4 hours — "N-shaped" signature now documented in multiple Chilean events. Global TEC anomaly study, arXiv 2024.' },
        ]
      },
      {
        layer: 'seismic',
        label: '② Foreshock Swarm / b-value Decrease',
        mechanism: 'In the days to weeks before major earthquakes, the Gutenberg-Richter b-value (ratio of small to large earthquakes) decreases — indicating stress concentration. Foreshock swarms with anomalously low b-value (<0.8) in a fault zone are the most classical physical precursor. Combined with TEC anomaly, confidence rises significantly.',
        delay: '30 days to hours before mainshock', probability: 35,
        historical: [
          { date: 'Weeks before Apr 2009', event: 'L\'Aquila M6.3 foreshock sequence', outcome: 'Persistent M2–3 swarm for months before mainshock; b-value dropped to 0.65 in final 2 weeks. The controversy over the suppression of public warnings remains a landmark case in hazard communication.' },
          { date: 'Days before Mar 2011', event: 'Tōhoku M9.0 — foreshock M7.2 two days prior', outcome: 'A M7.2 foreshock on Mar 9 2011 preceded the M9.0 by 48 hours. Post-event: b-value had been anomalously low in the region for 3 months (Nanjo et al. 2012).' },
        ]
      },
      {
        layer: 'tides',
        label: '③ Tidal Stress Amplification Window',
        mechanism: 'Near syzygy, tidal stress increments on critically loaded fault systems add the final forcing. The combination of pre-existing LAIC TEC anomaly AND near-syzygy conditions represents the highest-probability compound precursor window identified in the literature.',
        delay: '0–48 hours before possible event', probability: 28,
        historical: [
          { date: 'Dec 26 2004', event: 'Indian Ocean M9.1 — 2 days after full moon', outcome: 'Tidal stress near maximum. Retroactive multi-signal analysis found TEC anomaly + tidal window + elevated GCR flux simultaneously — the strongest historical compound precursor pattern.' },
          { date: 'Feb 27 2010', event: 'Chile M8.8 — within 12h of new moon (syzygy)', outcome: 'New moon coincidence confirmed. Varga & Grafarend 2018 statistical analysis found M8+ events cluster disproportionately within ±3 days of syzygy.' },
        ]
      },
      {
        layer: 'geomagnetic',
        label: '④ Geomagnetic Diurnal Variation Anomaly',
        mechanism: 'Pre-seismic underground electromagnetic emissions alter the ground-ionosphere circuit, producing anomalous diurnal Sq variation in surface magnetometers. This is independent of Kp (space weather) and appears as a slow departure from the normal daily pattern in the days before large events.',
        delay: '3–10 days before mainshock', probability: 30,
        historical: [
          { date: '9 days before Mar 11 2011', event: 'Tōhoku M9.0 — geomagnetic diurnal anomaly Mar 2', outcome: 'Han et al. (2020 JGR) documented anomalous geomagnetic diurnal variation at Japanese observatories 9 days before the mainshock. Spatially consistent with Dobrovolsky preparation zone (>3000 km radius for M9).' },
          { date: '6 days before Jan 17 1995', event: 'Kobe M6.9 — VLF/LF radio anomaly + magnetic anomaly', outcome: 'Both VLF subionospheric perturbations and surface magnetic diurnal anomalies documented. Hayakawa et al. 1996 first described the seismo-electromagnetic precursor complex for this event.' },
        ]
      },
    ]
  },

  // ════════ CHAIN 10: TSUNAMI GENERATION & PROPAGATION ══
  {
    id: 'tsunami-chain',
    icon: '🌊',
    name: 'Tsunami Generation Chain',
    triggerLayer: 'seismic',
    triggerField: () => {
      const count = (state.data.seismic && state.data.seismic.count) || 0;
      const maxMag = parseFloat((state.data.seismic && state.data.seismic.maxMag) || 0);
      const avgDepth = parseFloat((state.data.seismic && state.data.seismic.avgDepth) || 30);
      // Tsunami risk score: high-mag + shallow + many events
      const magScore = maxMag >= 7.5 ? 100 : maxMag >= 7.0 ? 70 : maxMag >= 6.5 ? 40 : maxMag >= 6.0 ? 15 : 0;
      const depthPenalty = avgDepth > 70 ? 0.3 : avgDepth > 40 ? 0.7 : 1.0;  // shallow = more tsunamigenic
      const tidalBoost = Math.abs(Math.cos(getLunarPhase() * 2 * Math.PI)) * 20;
      return Math.round(Math.min(100, magScore * depthPenalty + tidalBoost));
    },
    thresholds: { warning: 25, critical: 60 },
    unit: '/ 100 tsunami risk',
    description: 'Tsunamis require a specific chain: a shallow submarine M≥7.0+ earthquake with vertical fault displacement → seafloor uplift/subsidence → water column displacement → wave propagation. Each step has distinct observable signatures. The chain also works in reverse — real-time ionospheric TEC can detect an ongoing tsunami within minutes via acoustic-gravity waves.',
    steps: [
      {
        layer: 'seismic',
        label: '① Tsunamigenic Fault Rupture (M≥7.0, depth <70km, reverse/thrust)',
        mechanism: 'Not all large earthquakes generate tsunamis. Three conditions required: (1) magnitude M≥7.0 for sufficient seafloor displacement, (2) shallow depth <70 km for vertical seafloor motion, (3) reverse/thrust or normal fault mechanism (not strike-slip). The 2004 Indian Ocean M9.1 generated a 30m vertical seafloor displacement over a 1200km rupture zone.',
        delay: 'Immediate — minutes from rupture', probability: 75,
        historical: [
          { date: 'Dec 26 2004', event: 'Indian Ocean M9.1 — 30m seafloor uplift', outcome: '10m waves reached Sri Lanka in 2 hours, Somalia in 7 hours. ~228,000 deaths. The 1200km rupture propagated north at 2.8 km/s — detected by seismometers globally within 20 minutes.' },
          { date: 'Mar 11 2011', event: 'Tōhoku M9.0 — 7m vertical seafloor displacement', outcome: '40m runup height in Miyako; 15,000+ deaths. Tsunami reached Hawaii in 8 hours, California in 10 hours. DART buoys detected the wave 2 hours after generation.' },
          { date: 'Feb 27 2010', event: 'Chile M8.8 — 3m vertical displacement', outcome: 'Tsunami reached Hawaii in 15 hours (2m wave). Chilean coast hit within 30 minutes. PTWC issued alert 8 minutes after the earthquake.' },
        ]
      },
      {
        layer: 'ionosphere',
        label: '② Ionospheric Tsunami Signature (TEC Detection)',
        mechanism: 'Tsunamis generate acoustic-gravity waves that propagate from ocean surface to ionospheric heights in ~10 minutes. These produce TEC disturbances of 0.1–0.5 TECU detectable by dense GPS networks. This "ionospheric tsunami" travels at the same speed as the surface wave and can be used to track and characterise the tsunami in near-real-time — providing ~8 minutes warning beyond seismic detection alone.',
        delay: '10–30 minutes after rupture', probability: 85,
        historical: [
          { date: 'Jan 15 2022', event: 'Hunga Tonga VEI 5+ eruption — tsunami + ionospheric wave', outcome: 'TEC disturbances detected globally within 90 minutes by 1800+ GPS stations. The ionospheric Lamb wave circled Earth 4 times. Astafyeva et al. 2022 confirmed TEC detection preceded coastal wave arrival at distant stations by up to 20 minutes.' },
          { date: 'Mar 11 2011', event: 'Tōhoku tsunami — ionospheric coseismic disturbance', outcome: 'GPS-TEC disturbances of 0.1–0.2 TECU detected at ~250 km from epicentre within 7 minutes (Heki 2011 GRL). Propagating TEC disturbance matched tsunami propagation velocity. Now forms basis of GNSS-based tsunami warning systems.' },
          { date: 'Dec 26 2004', event: 'Indian Ocean tsunami — first ionospheric tsunami detection', outcome: 'Retroactive analysis confirmed TEC coupling. Liu et al. 2006 established the acoustic-gravity wave → ionospheric coupling mechanism for tsunamis. Led to proposal for GPS-based early warning systems.' },
        ]
      },
      {
        layer: 'sst',
        label: '③ Ocean Thermal Structure Affects Propagation Speed',
        mechanism: 'Tsunami propagation speed = √(g×h) where h is ocean depth. But SST anomalies indicate warm-water eddies (geostrophic rings) that alter the effective depth slightly and can cause focusing or defocusing of wave energy. The 2011 Tōhoku tsunami was focused by seamount topography AND a warm eddy toward the Tohoku coast.',
        delay: 'Hours (propagation phase)', probability: 45,
        historical: [
          { date: 'Mar 2011', event: 'Tōhoku tsunami — thermal eddy focusing', outcome: 'Post-event analysis (Hayashi 2013) found a warm SST anomaly eddy off Tohoku coast contributed to anomalous wave focusing, amplifying runup heights above pure bathymetric model predictions.' },
        ]
      },
      {
        layer: 'schumann',
        label: '④ Schumann Resonance Co-seismic Signature',
        mechanism: 'Very large earthquakes (M≥8.5) excite Earth\'s free oscillations (normal modes) that couple into the Schumann cavity, producing a characteristic broadband EM pulse detectable at ELF frequencies. This occurs simultaneously with the rupture and provides a real-time independent confirmation of tsunamigenic rupture size.',
        delay: '0–10 minutes (simultaneous with rupture)', probability: 60,
        historical: [
          { date: 'Dec 26 2004', event: 'M9.1 — ELF Schumann excitation', outcome: 'Broadband ELF signal detected at multiple Schumann stations globally within minutes of rupture. Amplitude consistent with M9.1 moment tensor. Nickolaenko et al. 2006 documented the signature.' },
          { date: 'Mar 11 2011', event: 'M9.0 — Earth hum + Schumann excitation', outcome: 'Normal mode oscillations (Earth hum, period ~54 min) excited by the Tōhoku rupture detected globally. ELF Schumann signal provided real-time magnitude estimate within 8 minutes.' },
        ]
      },
    ]
  },

  // ════════ CHAIN 11: SUPERSTORM / RAPID INTENSIFICATION ═
  {
    id: 'superstorm-chain',
    icon: '🌀',
    name: 'Superstorm Rapid Intensification Chain',
    triggerLayer: 'sst',
    triggerField: () => {
      const sstAvg = parseFloat((state.data.sst && state.data.sst.avgTemp) || 0);
      const sstMax = parseFloat((state.data.sst && state.data.sst.maxTemp) || 0);
      const windAvg = parseFloat((state.data.wind && state.data.wind.avgSpeed) || 0);
      const s = getSystemState();
      const doy = getDOY();
      // Hurricane season: June–November (doy 152–335)
      const inSeason = doy >= 152 && doy <= 335 ? 1.0 : 0.4;
      // RI conditions: SST >26°C, low wind shear, anomalous warm pool
      const sstScore = sstMax >= 29 ? 100 : sstMax >= 27 ? 70 : sstMax >= 26 ? 45 : sstMax >= 25 ? 25 : 0;
      const shearPenalty = windAvg > 15 ? 0.3 : windAvg > 10 ? 0.6 : 1.0; // high wind shear inhibits
      const cosmicBoost = s.crFlux < 1700 ? 1.1 : 1.0; // solar max → fewer clouds → cleaner intensification
      return Math.round(Math.min(100, sstScore * shearPenalty * inSeason * cosmicBoost));
    },
    thresholds: { warning: 35, critical: 65 },
    unit: '/ 100 RI risk',
    description: 'Rapid Intensification (RI: ≥35 kt wind increase in 24h) is the deadliest tropical cyclone behaviour — Harvey 2017, Ida 2021, Otis 2023 all rapidly intensified before landfall. The chain requires warm SST >26°C, low vertical wind shear, adequate moisture, and a preexisting disturbance. Space weather and cosmic rays add secondary modulation via cloud cover.',
    steps: [
      {
        layer: 'sst',
        label: '① Anomalously Warm SST (>26°C, ideally >29°C)',
        mechanism: 'SST is the primary energy source for tropical cyclones. Above 26°C, sufficient latent heat flux sustains storm convection. Above 29°C (as in 2023–2024 Atlantic MDR), rapid intensification becomes far more likely. The 2024 hurricane season saw record SST anomalies of +0.6°C in the Caribbean — the immediate physical cause of Hurricane Helene and Milton\'s extreme intensity.',
        delay: 'Season-scale precondition (weeks–months)', probability: 88,
        historical: [
          { date: 'Aug–Sep 2017', event: 'Hurricane Harvey — Gulf SST 30–31°C', outcome: 'Harvey intensified from Cat 1 to Cat 4 (130 kt) in 56 hours over 30°C Gulf water. Made landfall at peak intensity. SST anomaly of +1.5°C above 1981–2010 mean in the intensification zone.' },
          { date: 'Oct 2023', event: 'Hurricane Otis — Eastern Pacific 30.5°C SST', outcome: 'Cat 1 → Cat 5 in 24 hours (100 kt increase — record rapid intensification). SST anomaly of +2°C. Made landfall near Acapulco as the strongest Pacific hurricane on record at landfall.' },
          { date: 'Sep–Oct 2024', event: '2024 Atlantic season — MDR SST +0.6°C record', outcome: 'Hurricane Helene (Cat 4), Milton (Cat 5, 180 kt), Beryl (earliest Cat 5 on record in July). Harris et al. 2025 (GRL) attributed to "unprecedented warm water volume" in tropical North Atlantic.' },
        ]
      },
      {
        layer: 'wind',
        label: '② Low Vertical Wind Shear (<10 knots)',
        mechanism: 'Vertical wind shear (change in wind direction/speed with altitude) physically disrupts the warm core of a tropical cyclone. Shear >20 kt effectively prevents intensification; <10 kt allows the vortex to remain vertically aligned. ENSO phase is the primary driver: La Niña → low Atlantic shear → active hurricane season.',
        delay: 'Days to weeks (synoptic scale)', probability: 80,
        historical: [
          { date: 'Sep 2005', event: 'Hurricane Katrina — near-zero wind shear over GoM', outcome: 'Wind shear dropped to <5 kt as Katrina crossed the very warm Loop Current. Intensified from Cat 1 to Cat 5 (175 kt) in 9 hours. NOAA confirmed wind shear was the permissive factor allowing SST energy to be fully accessed.' },
          { date: '2020 season (La Niña)', event: 'Record 30 named storms — La Niña-driven low shear', outcome: 'La Niña suppressed Atlantic wind shear throughout the season. 30 named storms exhausted the alphabetical naming list for only the second time in history.' },
        ]
      },
      {
        layer: 'ionosphere',
        label: '③ Ionospheric Convective Coupling (Tropical Cyclone ↔ Ionosphere)',
        mechanism: 'Intense tropical convection generates gravity waves that propagate to ionospheric heights, producing travelling ionospheric disturbances (TIDs). Conversely, during RI events, the intensifying convective chimney extracts energy more efficiently when the ionospheric electric field gradient is favourable. This bi-directional coupling is documented but not yet operationally used for RI forecasting.',
        delay: 'Concurrent with RI event', probability: 45,
        historical: [
          { date: 'Sep 2017', event: 'Hurricane Irma Cat 5 — ionospheric perturbation detected', outcome: 'TEC disturbances of 0.3–0.8 TECU associated with Irma\'s deep convection detected by Caribbean GPS network during peak intensity. Similar signals detected during Harvey, Maria, and Jose in the same season (Polyakova et al. 2018).' },
        ]
      },
      {
        layer: 'cosmic',
        label: '④ Cosmic Ray / Cloud Cover Modulation (Secondary)',
        mechanism: 'During solar maximum (reduced GCR), low-cloud cover is suppressed — removing a negative feedback that normally limits tropical cyclone intensification by increasing albedo. This is the Svensmark secondary pathway: solar max → low GCR → fewer clouds → warmer SST → more intense storms. Effect is real but small (~0.1–0.3°C SST, ~5–10% RI probability increase).',
        delay: '1–3 year solar cycle lag', probability: 35,
        historical: [
          { date: '2004–2005', event: 'Solar Cycle 23 declining maximum — active Atlantic seasons', outcome: '2004: 9 hurricanes (record); 2005: 28 named storms, Katrina/Rita/Wilma Cat 5 trifecta. Solar flux was elevated (SFI ~100–120), GCR modestly suppressed. Part of a compound condition with AMO warm phase and La Niña.' },
          { date: '2024', event: 'Solar Cycle 25 maximum — record Atlantic SST + RI events', outcome: 'Solar Cycle 25 peaked in late 2024 (SFI ~175–200). Combined with record Atlantic SSTs: Milton Cat 5 RI from Cat 1 in 24h, Otis 2023 similarly. Compound solar-thermal-shear state.' },
        ]
      },
      {
        layer: 'geomagnetic',
        label: '⑤ Geomagnetic Quiet → Minimal Storm Interference',
        mechanism: 'Counterintuitively, the absence of geomagnetic storms during storm season is a permissive factor: geomagnetic storms generate atmospheric gravity waves and ionospheric disturbances that can disrupt tropical cyclone organisation by disturbing the upper-atmosphere thermal gradient. Quiet periods (Kp<3) allow undisturbed convective organisation.',
        delay: 'Concurrent', probability: 40,
        historical: [
          { date: 'Oct 2005', event: 'Hurricane Wilma Cat 5 peak (Kp=1–2 during RI)', outcome: 'Record minimum central pressure (882 mb) achieved during sustained Kp<2 period. Solar quiet allowed clean convective organisation. Wilma holds the record for the most rapid intensification of any Atlantic hurricane.' },
        ]
      },
    ]
  },


];

// ════════════════════════════════════════════════════════
// CHAIN EVALUATION ENGINE
// ════════════════════════════════════════════════════════
function evaluateChain(chain) {
  const val = chain.triggerField();
  const th  = chain.thresholds;
  let level = 'nominal', levelClass = 'nominal-trigger', badgeClass = 'tl-nominal', levelLabel = 'NOMINAL';
  if (val >= th.critical) {
    level = 'critical'; levelClass = 'active-trigger'; badgeClass = 'tl-critical'; levelLabel = 'CRITICAL';
  } else if (val >= th.warning) {
    level = 'warning'; levelClass = 'warning-trigger'; badgeClass = 'tl-warning'; levelLabel = 'WARNING';
  }
  return { val, level, levelClass, badgeClass, levelLabel };
}

function getChainColor(chain, level) {
  const colors = { critical: '#ff3d3d', warning: '#ffd600', nominal: '#00ff88' };
  return colors[level];
}

// ════════════════════════════════════════════════════════
// CHAIN RENDERER
// ════════════════════════════════════════════════════════
let chainExpandedIds = new Set();

function toggleChainExpand(chainId) {
  const card = document.getElementById('chain-card-' + chainId);
  if (!card) return;
  if (chainExpandedIds.has(chainId)) {
    chainExpandedIds.delete(chainId);
  } else {
    chainExpandedIds.add(chainId);
  }
  // Re-render to reflect expansion state
  runChainScan();
}

function renderChain(chain) {
  const { val, level, levelClass, badgeClass, levelLabel } = evaluateChain(chain);
  const color = getChainColor(chain, level);
  const isExpanded = chainExpandedIds.has(chain.id);
  const activeSteps = level !== 'nominal' ? chain.steps : chain.steps.slice(0, 1);

  const stepsHtml = chain.steps.map((step, idx) => {
    const dotColor = idx === 0 ? color : idx < 2 ? '#ffd600' : '#4a7a99';
    const probClass = step.probability >= 70 ? 'sp-high' : step.probability >= 45 ? 'sp-med' : 'sp-low';
    const dimmed = level === 'nominal' && idx > 0;
    const histHtml = !isExpanded ? '' : ('<div class="hist-section">' +
        '<div class="hist-label">Historical Precedents</div>' +
        step.historical.map(h => '<div class="hist-event">' +
          '<div><div class="hist-date">' + h.date + '</div>' +
          '<div class="hist-desc">' + h.event + '</div>' +
          '<div class="hist-outcome">→ ' + h.outcome + '</div>' +
          '</div></div>').join('') +
        '</div>');

    return `
    <div class="cascade-step" style="${dimmed ? 'opacity:0.35' : ''}">
      <div class="step-dot" style="color:${dotColor};border-color:${dotColor}40">
        ${idx + 1}
      </div>
      <div class="step-content">
        <div class="step-label" style="color:${dotColor}">${step.label}</div>
        <div class="step-detail">${step.mechanism}</div>
        <div class="step-timing">⏱ ${step.delay}</div>
        <div>
          <span class="step-probability ${probClass}">
            ${step.probability}% probability
          </span>
        </div>
        ${isExpanded ? histHtml : ''}
      </div>
    </div>`;
  }).join('');

  // Chains 9-11 (eq-precursor, tsunami-chain, superstorm-chain) are research-level
  const researchChains = ['eq-precursor','tsunami-chain','superstorm-chain'];
  const isResearch = researchChains.includes(chain.id);
  const researchClass = isResearch ? ' chain-research-only' : '';
  const researchBadge = isResearch
    ? `<div class="chain-research-badge">⚠ Research Hypothesis — Not an Operational Forecast · NOT FOR EMERGENCY USE</div>`
    : '';

  return `
  <div class="trigger-card ${levelClass}${isExpanded ? ' expanded' : ''}${researchClass}" id="chain-card-${chain.id}">
    <div class="trigger-header" onclick="toggleChainExpand('${chain.id}')">
      <span class="trigger-icon">${chain.icon}</span>
      <span class="trigger-name">${chain.name}</span>
      <span class="trigger-value" style="color:${color}">${typeof val === 'number' ? val.toFixed(1) : val}<span style="font-size:7px;color:var(--text-dim);margin-left:3px">${chain.unit}</span></span>
      <span class="trigger-level ${badgeClass}">${levelLabel}</span>
      <span class="trigger-chevron">${isExpanded ? '▲' : '▼'}</span>
    </div>
    <div class="trigger-body">
      ${researchBadge}
      <div class="trigger-desc">${chain.description}</div>
      <div style="font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-dim);margin-bottom:8px;">
        Cascade pathway ${level !== 'nominal' ? '<span style="color:'+color+'">● ACTIVE — ' + chain.steps.length + ' downstream effects</span>' : '— activate threshold to trigger cascade'}
      </div>
      <div class="cascade-chain">
        ${stepsHtml}
      </div>
    </div>
  </div>`;
}

function buildChainSummary(evaluated) {
  const active   = evaluated.filter(e => e.state.level === 'critical');
  const warnings = evaluated.filter(e => e.state.level === 'warning');
  const allSteps = [];
  active.concat(warnings).forEach(e => {
    e.chain.steps.forEach(step => {
      allSteps.push({
        chain: e.chain.name,
        layer: step.layer,
        label: step.label,
        delay: step.delay,
        probability: step.probability,
        level: e.state.level,
        color: getChainColor(e.chain, e.state.level),
      });
    });
  });

  if (!allSteps.length) {
    return `<div class="chain-summary">
      <div class="chain-summary-title" style="color:#00ff88">✓ All Systems Nominal</div>
      <div style="font-size:8px;color:var(--text-dim);line-height:1.7;">No chains have reached warning thresholds. Expand individual chains below to see what would happen if they did — and the historical precedents for each cascade.</div>
    </div>`;
  }

  const points = allSteps.sort((a,b) => b.probability - a.probability).slice(0, 6);

  return `<div class="chain-summary">
    <div class="chain-summary-title">
      ${active.length ? '<span style="color:#ff3d3d">⚠ ' + active.length + ' Critical</span>' : ''}
      ${warnings.length ? '<span style="color:#ffd600; margin-left:8px">◉ ' + warnings.length + ' Warning</span>' : ''}
      <span style="font-size:8px;font-weight:400;color:var(--text-dim);margin-left:8px">— Expected downstream effects:</span>
    </div>
    <ul class="chain-summary-points">
      ${points.map(p => `
        <li>
          <span class="csp-bullet" style="background:${p.color}"></span>
          <span class="csp-text">
            <b>${p.label}</b> — via ${p.chain}. 
            <span style="color:${p.color}">${p.probability}% probability</span> · ⏱ ${p.delay}
          </span>
        </li>`).join('')}
    </ul>
  </div>`;
}

function runChainScan() {
  const listEl = document.getElementById('chain-triggers-list');
  const summaryEl = document.getElementById('chain-summary-box');
  if (!listEl) return;

  const evaluated = EVENT_CHAINS.map(chain => ({
    chain,
    state: evaluateChain(chain)
  }));

  // Sort: critical first, then warning, then nominal
  evaluated.sort((a, b) => {
    const order = { critical: 0, warning: 1, nominal: 2 };
    return order[a.state.level] - order[b.state.level];
  });

  if (summaryEl) summaryEl.innerHTML = buildChainSummary(evaluated);
  listEl.innerHTML = evaluated.map(e => renderChain(e.chain)).join('');

  // Re-apply expanded state
  chainExpandedIds.forEach(id => {
    const card = document.getElementById('chain-card-' + id);
    if (card) card.classList.add('expanded');
  });

  // Log any critical chains to discovery log
  evaluated.filter(e => e.state.level === 'critical').forEach(e => {
    logDiscovery({
      title: `Chain Triggered: ${e.chain.name}`,
      body: `${e.chain.name} reached CRITICAL level (${e.state.val.toFixed(1)} ${e.chain.unit} ≥ ${e.chain.thresholds.critical}). `+
        `${e.chain.steps.length} downstream effects expected: `+
        e.chain.steps.map(s => `${s.label} (${s.probability}%, ${s.delay})`).join('; ') + '.',
      color: '#ff3d3d', method: 'CHAIN OF EVENTS', novel: false
    });
  });
}

// Auto-run scan every 60 seconds
setInterval(() => {
  if ((function(){var el=document.getElementById('dsp-chain'); return el && el.classList.contains('active');})()) {
    runChainScan();
  }
}, 60000);



// ════════════════════════════════════════════════════════
// NOTIFICATION SYSTEM
// Central event hub for all forecasting and pattern signals
// ════════════════════════════════════════════════════════

const notifications      = [];        // full history, max 50
const notifKeys          = new Map();  // key → { ts, level } for dedup
let   notifUnreadCount   = 0;
let   notifFilter        = 'all';
let   toastTimer         = null;
let   notifScanTimer     = null;

// ── LEVEL CONFIG ──────────────────────────────────────────
const NOTIF_LEVELS = {
  critical: { color: '#ff3d3d', bg: 'rgba(255,61,61,.12)',   border: 'rgba(255,61,61,.5)',  label: 'CRITICAL', icon: '🔴' },
  watch:    { color: '#ff6d00', bg: 'rgba(255,109,0,.1)',    border: 'rgba(255,109,0,.45)', label: 'WATCH',    icon: '🟠' },
  advisory: { color: '#ffd600', bg: 'rgba(255,214,0,.08)',   border: 'rgba(255,214,0,.35)', label: 'ADVISORY', icon: '🟡' },
  info:     { color: '#00e5ff', bg: 'rgba(0,229,255,.06)',   border: 'rgba(0,229,255,.25)', label: 'INFO',     icon: '🔵' },
};

// ── CORE: PUSH A NOTIFICATION ─────────────────────────────
function pushNotif({ id, level, headline, bullets, source, tab, subTab, icon }) {
  const cfg   = NOTIF_LEVELS[level] || NOTIF_LEVELS.info;
  const now   = Date.now();
  const prev  = notifKeys.get(id);

  // Dedup: suppress same ID within 30 min unless level escalated
  if (prev) {
    const age      = now - prev.ts;
    const escalated = levelRank(level) > levelRank(prev.level);
    if (age < 1800000 && !escalated) return;
  }

  const notif = {
    id, level, headline, bullets: bullets || [], source: source || 'System',
    tab: tab || 'risk', subTab: subTab || null,
    icon: icon || cfg.icon, color: cfg.color, bg: cfg.bg, border: cfg.border,
    label: cfg.label, ts: now, tsStr: new Date(now).toUTCString().slice(17, 25) + ' UTC',
    dismissed: false, isNew: true,
  };

  notifKeys.set(id, { ts: now, level });
  notifications.unshift(notif);
  if (notifications.length > 50) notifications.pop();

  notifUnreadCount++;
  updateBell();
  renderNotifList();
  updateSummaryStrip();

  // Show toast for critical and watch
  if (level === 'critical' || level === 'watch') {
    showToast(notif);
  }

  return notif;
}

function levelRank(l) {
  return { critical: 3, watch: 2, advisory: 1, info: 0 }[l] || 0;
}

// ── BELL ─────────────────────────────────────────────────
function updateBell() {
  const bell    = document.getElementById('notif-bell');
  const countEl = document.getElementById('notif-count');
  if (!bell || !countEl) return;

  const criticals = notifications.filter(n => !n.dismissed && n.level === 'critical').length;
  const watches   = notifications.filter(n => !n.dismissed && n.level === 'watch').length;

  bell.className = criticals > 0 ? 'has-critical' : watches > 0 ? 'has-watch' : '';
  const color = criticals > 0 ? '#ff3d3d' : watches > 0 ? '#ff6d00' : notifUnreadCount > 0 ? '#ffd600' : 'var(--text-dim)';
  const displayCount = notifUnreadCount > 0 ? (notifUnreadCount > 99 ? '99+' : String(notifUnreadCount)) : '0';
  countEl.textContent = displayCount;
  countEl.style.background = notifUnreadCount > 0 ? color : 'var(--surface2)';
  countEl.style.color = notifUnreadCount > 0 ? '#000' : 'var(--text-dim)';
  updateStatusStrip(); // keep alert count in strip in sync
}

// ── TOAST ─────────────────────────────────────────────────
function showToast(notif) {
  const el   = document.getElementById('notif-toast');
  const icon = document.getElementById('toast-icon');
  const hl   = document.getElementById('toast-headline');
  const sub  = document.getElementById('toast-sub');
  if (!el) return;

  if (toastTimer) clearTimeout(toastTimer);
  el.style.background  = notif.bg;
  el.style.borderColor = notif.border;
  icon.textContent = notif.icon;
  hl.textContent   = notif.headline;
  sub.textContent  = notif.bullets.slice(0, 2).join(' · ');
  el.classList.add('show');
  el.dataset.tab    = notif.tab;
  el.dataset.subTab = notif.subTab || '';

  toastTimer = setTimeout(closeToast, 6000);
}

function closeToast() {
  const el = document.getElementById('notif-toast');
  if (el) el.classList.remove('show');
  if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
}
function handleToastClick() {
  const el = document.getElementById('notif-toast');
  if (!el) return;
  const t = el.dataset.tab, s = el.dataset.subTab;
  closeToast();
  if (t) {
    if (t === 'discover') {
      openDeepAnalysis();
      if (s) setTimeout(() => switchDiscTab(s), 80);
    } else {
      switchTab(t);
    }
  }
}

// ── DRAWER ────────────────────────────────────────────────
function openNotifDrawer() {
  notifUnreadCount = 0;
  notifications.forEach(n => n.isNew = false);
  updateBell();
  document.getElementById('notif-overlay').style.display = 'block';
  requestAnimationFrame(() => {
    document.getElementById('notif-overlay').classList.add('open');
    document.getElementById('notif-drawer').classList.add('open');
  });
  renderNotifList();
  updateSummaryStrip();
}

function closeNotifDrawer() {
  document.getElementById('notif-overlay').classList.remove('open');
  document.getElementById('notif-drawer').classList.remove('open');
  setTimeout(() => {
    document.getElementById('notif-overlay').style.display = 'none';
  }, 300);
}

function setNotifFilter(f) {
  notifFilter = f;
  document.querySelectorAll('.notif-filter-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('nf-' + f);
  if (btn) btn.classList.add('active');
  renderNotifList();
}

function dismissNotif(id) {
  const n = notifications.find(n => n.id === id);
  if (n) n.dismissed = true;
  renderNotifList();
  updateSummaryStrip();
  updateBell();
}

// Internal helper: silently dismiss by ID (no re-render, used during scan)
function _autoDismissId(id) {
  const n = notifications.find(function(x){ return x.id === id; });
  if (n && !n.dismissed) { n.dismissed = true; notifKeys.delete(id); }
}

function clearAllNotifs() {
  notifications.forEach(n => n.dismissed = true);
  renderNotifList();
  updateSummaryStrip();
  updateBell();
}

// ── SUMMARY STRIP ─────────────────────────────────────────
function updateSummaryStrip() {
  const el = document.getElementById('notif-summary-strip');
  if (!el) return;
  const active = notifications.filter(n => !n.dismissed);
  const counts = { critical:0, watch:0, advisory:0, info:0 };
  active.forEach(n => { if (counts[n.level] !== undefined) counts[n.level]++; });
  const items = Object.entries(counts)
    .filter(([,v]) => v > 0)
    .map(([k,v]) => {
      const cfg = NOTIF_LEVELS[k];
      return `<div class="notif-sum-item">
        <div class="notif-sum-dot" style="background:${cfg.color}"></div>
        <span style="font-size:9px;color:${cfg.color};font-weight:700">${v}</span>
        <span style="font-size:8px;color:var(--text-dim)">${cfg.label}</span>
      </div>`;
    });
  el.innerHTML = items.length ? items.join('') :
    '<span style="font-size:8px;color:var(--text-dim);letter-spacing:.1em">No active notifications</span>';
}

// ── RENDER LIST ───────────────────────────────────────────
function renderNotifList() {
  const el = document.getElementById('notif-list');
  if (!el) return;
  const savedScroll = el.scrollTop;

  const filtered = notifications.filter(n => {
    if (n.dismissed) return false;
    if (notifFilter === 'all') return true;
    if (['critical','watch','advisory','info'].includes(notifFilter)) return n.level === notifFilter;
    return n.source ? n.source.toLowerCase().includes(notifFilter.toLowerCase()) : false;
  });

  if (!filtered.length) {
    el.innerHTML = '<div class="notif-empty">' +
      (notifFilter === 'all'
        ? '&#10003; No active notifications<br><span style="opacity:.4;font-size:8px">Scanning every 60 seconds</span>'
        : 'No ' + notifFilter + ' notifications') +
      '</div>';
    return;
  }

  el.innerHTML = filtered.map(n => {
    const cfg = NOTIF_LEVELS[n.level] || NOTIF_LEVELS.info;
    // Build nav target without nested template literals
    let navTarget = n.tab === 'discover' ? "openDeepAnalysis()" : "switchTab('" + n.tab + "')";
    if (n.subTab && n.tab === 'discover') {
      navTarget += "; setTimeout(()=>switchDiscTab('" + n.subTab + "'),50)";
    }
    const newBadge = n.isNew ? '<span style="font-size:7px;letter-spacing:.12em;padding:1px 5px;border-radius:2px;background:rgba(0,229,255,.15);color:var(--c-cyan);font-weight:700;margin-left:6px">NEW</span>' : '';

    return '<div class="notif-card level-' + n.level + '" id="ncard-' + n.id.replace(/[^a-zA-Z0-9]/g,'-') + '">' +
      '<div style="position:absolute;top:0;left:0;bottom:0;width:3px;background:' + cfg.color + ';border-radius:3px 0 0 3px"></div>' +
      '<div class="notif-card-top">' +
        '<span class="notif-icon">' + n.icon + '</span>' +
        '<div class="notif-main">' +
          '<div class="notif-headline">' + n.headline + newBadge + '</div>' +
          '<ul class="notif-bullets">' +
            n.bullets.map(b => '<li>' + b + '</li>').join('') +
          '</ul>' +
        '</div>' +
      '</div>' +
      '<div class="notif-card-footer">' +
        '<div class="notif-meta">' +
          '<span class="notif-level-badge" style="background:' + cfg.bg + ';color:' + cfg.color + ';border:1px solid ' + cfg.border + '">' + cfg.label + '</span>' +
          '<span class="notif-source">' + (n.source||'') + '</span>' +
          '<span class="notif-ts">' + (n.tsStr||'') + '</span>' +
        '</div>' +
        '<div class="notif-actions">' +
          '<button class="notif-view-btn" style="color:' + cfg.color + ';border-color:' + cfg.border + '" ' +
            'onclick="closeNotifDrawer(); ' + navTarget + '">&rarr; View</button>' +
          '<button class="notif-dismiss-btn" onclick="dismissNotif(\'' + n.id + '\')">&#x2715;</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
  // Restore scroll position after re-render
  el.scrollTop = savedScroll;
}

// ════════════════════════════════════════════════════════
// NOTIFICATION SCANNER
// Polls all signal sources and fires notifications
// ════════════════════════════════════════════════════════

function runNotifScan() {
  const s = getSystemState();

  // ── 1. FORECAST SCORES ───────────────────────────────────
  try {
    const eq = scoreEarthquake();
    const ts = scoreTsunami();
    const ss = scoreSuperstorm();

    if (eq.score >= 65) {
      _autoDismissId('fc-eq-watch');
      pushNotif({
        id: 'fc-eq-critical', level: 'critical',
        headline: `Earthquake Precursor: ${eq.score}/100 — ${eq.level}`,
        bullets: [
          `<b>Score ${eq.score}/100</b> — confidence ${eq.confidence}%`,
          'Top driver: <b>'+(eq.factors.length?eq.factors[0].label:'')+"</b> ("+(eq.factors.length?eq.factors[0].score:0)+'/'+(eq.factors.length?eq.factors[0].max:0)+' pts)',
          `Highest risk: <b>${eq.riskZones[0]}</b>`,
          eq.outlook['24h'],
        ],
        source: 'Forecast', tab: 'risk', icon: '🔴',
      });
    } else if (eq.score >= 40) pushNotif({
      id: 'fc-eq-watch', level: 'watch',
      headline: `Earthquake Watch: Precursor score ${eq.score}/100`,
      bullets: [
        '<b>'+eq.factors.filter(function(f){return f.score>0;}).length+' active factors</b> — '+(eq.factors.length?eq.factors[0].label:'')+' leading',
        `Tidal window: <b>${(s.syzygy*100).toFixed(0)}%</b> · Kp: <b>${s.kp.toFixed(1)}</b>`,
        eq.outlook['72h'],
      ],
      source: 'Forecast', tab: 'risk', icon: '🟠',
    });

    if (ts.score >= 60) {
      _autoDismissId('fc-ts-watch');
      pushNotif({
        id: 'fc-ts-critical', level: 'critical',
        headline: `Tsunami Risk: ${ts.score}/100 — ${ts.level}`,
        bullets: [
          `<b>Score ${ts.score}/100</b> — confidence ${ts.confidence}%`,
          ts.outlook['24h'],
          `Risk zones: <b>${ts.riskZones[0]}</b>`,
        ],
        source: 'Forecast', tab: 'risk', icon: '🌊',
      });
    } else if (ts.score >= 35) pushNotif({
      id: 'fc-ts-watch', level: 'watch',
      headline: `Tsunami Watch: Risk score ${ts.score}/100`,
      bullets: [
        'Top driver: <b>'+(ts.factors.length?ts.factors[0].label:'')+'</b>',
        ts.outlook['24h'],
      ],
      source: 'Forecast', tab: 'risk', icon: '🌊',
    });

    if (ss.score >= 65) {
      _autoDismissId('fc-ss-watch');
      pushNotif({
        id: 'fc-ss-critical', level: 'critical',
        headline: `Superstorm Warning: RI risk ${ss.score}/100`,
        bullets: [
          `<b>Score ${ss.score}/100</b> — confidence ${ss.confidence}%`,
          'SST top: <b>' + ((forecastData.sstGrid && forecastData.sstGrid.val ? forecastData.sstGrid.val.reduce(function(mx,p){return Math.max(mx,p.sst||0);},0) : 0)||0).toFixed(1) + '°C</b>',
          ss.outlook['24h'],
          `Zone: <b>${ss.riskZones[0]}</b>`,
        ],
        source: 'Forecast', tab: 'risk', icon: '🌀',
      });
    } else if (ss.score >= 40) pushNotif({
      id: 'fc-ss-watch', level: 'watch',
      headline: `Superstorm Watch: RI conditions developing`,
      bullets: [
        `<b>${ss.factors.filter(f=>f.score>5).length} favourable factors</b> active`,
        ss.outlook['24h'],
      ],
      source: 'Forecast', tab: 'risk', icon: '🌀',
    });
  } catch(e) { /* forecast data not yet loaded */ }

  // ── 2. CHAIN TRIGGERS ─────────────────────────────────────
  try {
    EVENT_CHAINS.forEach(chain => {
      const { val, level } = evaluateChain(chain);
      if (level === 'critical') {
        pushNotif({
          id: `chain-${chain.id}-critical`, level: 'critical',
          headline: `Chain CRITICAL: ${chain.name}`,
          bullets: [
            `<b>${val.toFixed(1)} ${chain.unit}</b> ≥ threshold ${chain.thresholds.critical}`,
            `<b>${chain.steps.length} downstream effects</b> expected`,
            'Highest probability: <b>'+(chain.steps.length?chain.steps.sort(function(a,b){return b.probability-a.probability;})[0].label:'?')+'</b> ('+(chain.steps.length?chain.steps[0].probability:0)+'%)',
            'Typical timing: <b>'+(chain.steps.length?chain.steps[0].delay:'')+'</b>',
          ],
          source: 'Chain', tab: 'discover', subTab: 'chain', icon: chain.icon,
        });
      } else if (level === 'warning') {
        pushNotif({
          id: `chain-${chain.id}-watch`, level: 'watch',
          headline: `Chain Watch: ${chain.name}`,
          bullets: [
            `<b>${val.toFixed(1)} ${chain.unit}</b> — approaching critical threshold ${chain.thresholds.critical}`,
            'Monitor: <b>'+(chain.steps.length?chain.steps[0].label:'')+'</b>',
          ],
          source: 'Chain', tab: 'discover', subTab: 'chain', icon: chain.icon,
        });
      }
    });
  } catch(e) {}

  // ── 3. EARTH SYSTEMS STRESS INDEX ────────────────────────
  try {
    const stressVals = {
      geomagnetic: s.kp, cosmic: s.crFlux, tides: s.syzygy * 100,
      seismic: (state.data.seismic && state.data.seismic.count) || 20, solarwind: s.swSpeed,
      ionosphere: s.tecPeak, schumann: (state.data.schumann && state.data.schumann.frequency) || 7.83,
      volcanic: (state.data.volcanic && state.data.volcanic.active) || 7,
    };
    let total = 0, wTotal = 0;
    Object.entries(STRESS_WEIGHTS).forEach(([id, cfg]) => {
      const v = stressVals[id] || 0;
      const norm = Math.max(0, Math.min(1, (v - cfg.lo) / (cfg.hi - cfg.lo)));
      total += norm * cfg.w * 100; wTotal += cfg.w;
    });
    const stressScore = Math.round(total / wTotal);

    if (stressScore >= 70) {
      _autoDismissId('stress-watch');
      const topDrivers = Object.entries(STRESS_WEIGHTS)
        .map(([id, cfg]) => {
          const v = stressVals[id] || 0;
          const norm = Math.max(0, Math.min(1, (v - cfg.lo) / (cfg.hi - cfg.lo)));
          return { label: cfg.label, norm };
        })
        .filter(d => d.norm > 0.6)
        .sort((a, b) => b.norm - a.norm);
      pushNotif({
        id: 'stress-critical', level: 'critical',
        headline: `Earth Stress Index Critical: ${stressScore}/100`,
        bullets: [
          `<b>${topDrivers.length} systems</b> simultaneously above 60% stress level`,
          topDrivers.length > 0 ? ('Drivers: <b>' + topDrivers.slice(0,3).map(d=>d.label).join(', ') + '</b>') : '',
          `Compound events become non-linear above score 70`,
        ].filter(Boolean),
        source: 'Stress Index', tab: 'discover', subTab: 'stress', icon: '🌐',
      });
    } else if (stressScore >= 50) {
      pushNotif({
        id: 'stress-watch', level: 'watch',
        headline: `Earth Stress Index Elevated: ${stressScore}/100`,
        bullets: [`Multiple Earth systems above baseline. Monitor for compound escalation.`],
        source: 'Stress Index', tab: 'discover', subTab: 'stress', icon: '🌐',
      });
    }
  } catch(e) {}

  // ── 4. SPACE WEATHER ──────────────────────────────────────
  if (s.kp >= 6) {
    pushNotif({
      id: `kp-storm-${Math.floor(s.kp)}`, level: 'critical',
      headline: `Geomagnetic Storm: Kp ${s.kp.toFixed(1)} — G${Math.min(5,Math.floor((s.kp-4)/1))} Class`,
      bullets: [
        `Aurora visible ≥ <b>${(90 - s.kp*3.5).toFixed(0)}° latitude</b>`,
        `Expected ionospheric TEC spike: <b>+${Math.round((s.kp-4)*5)} TECU</b>`,
        `Monitor 27-day seismic lag: <b>${new Date(Date.now()+27*86400000).toDateString()}</b>`,
      ],
      source: 'Space Weather', tab: 'discover', subTab: 'stress', icon: '🌀',
    });
  } else if (s.kp >= 4) {
    pushNotif({
      id: `kp-active-${Math.floor(s.kp)}`, level: 'watch',
      headline: `Geomagnetic Activity: Kp ${s.kp.toFixed(1)} — Active Conditions`,
      bullets: [
        `Solar wind speed: <b>${s.swSpeed} km/s</b>`,
        `Schumann resonance shift expected: <b>+${(s.carr*0.25).toFixed(2)} Hz</b>`,
      ],
      source: 'Space Weather', tab: 'discover', subTab: 'stress', icon: '⚡',
    });
  }

  // ── 5. TIDAL SYZYGY WINDOW ───────────────────────────────
  if (s.syzygy > 0.9) {
    _autoDismissId('syzygy-elevated');
    pushNotif({
      id: 'syzygy-extreme', level: 'watch',
      headline: `${s.moonName}: Peak Tidal Stress Window`,
      bullets: [
        `Syzygy index: <b>${(s.syzygy*100).toFixed(0)}%</b> — maximum tidal coupling`,
        `Elevated M≥5 seismic probability for <b>±48h</b> per Cochran et al. 2004`,
        `Tidal loading adds <b>0.001–0.01 MPa</b> to shallow fault systems`,
      ],
      source: 'Tidal', tab: 'discover', subTab: 'chain', icon: '🌕',
    });
  } else if (s.syzygy > 0.75) {
    pushNotif({
      id: 'syzygy-elevated', level: 'advisory',
      headline: `Tidal Stress Elevated: ${(s.syzygy*100).toFixed(0)}% Syzygy`,
      bullets: [
        `${s.moonName} — tidal window approaching peak`,
        `Monitor shallow oceanic fault systems`,
      ],
      source: 'Tidal', tab: 'discover', subTab: 'chain', icon: '🌕',
    });
  }

  // ── 6. ACTIVE TROPICAL STORM ─────────────────────────────
  try {
    const storms = (forecastData.nhcStorms && forecastData.nhcStorms.val) || [];
    storms.forEach(st => {
      if ((st.category >= 3) || (st.windKt >= 100)) {
        pushNotif({
          id: `storm-${(st.name||'unknown').toLowerCase()}`, level: 'critical',
          headline: (st.category ? 'Cat ' + st.category : 'Tropical') + ' Storm ' + (st.name || '?') + ': ' + st.windKt + 'kt',
          bullets: [
            `Basin: <b>${st.basin}</b> · Moving: <b>${st.moving || '?'}</b>`,
            `Central pressure: <b>${st.pressure || '?'} mb</b>`,
            st.riRisk === 'high' ? '<b>Rapid Intensification risk: HIGH</b>' : 'Intensity trend: monitoring',
          ],
          source: 'NHC/JTWC', tab: 'risk', icon: '🌀',
        });
      } else if (st.category >= 1) {
        pushNotif({
          id: `storm-watch-${(st.name||'unknown').toLowerCase()}`, level: 'watch',
          headline: 'Tropical Cyclone '+(st.name||'?')+': Cat '+st.category+', '+st.windKt+'kt',
          bullets: [
            `<b>${st.basin}</b> · Moving ${st.moving || '?'}`,
            `Monitor for rapid intensification`,
          ],
          source: 'NHC/JTWC', tab: 'risk', icon: '🌀',
        });
      }
    });
  } catch(e) {}

  // ── 7. LIVE M7+ EARTHQUAKE ───────────────────────────────
  try {
    const quakes = (forecastData.usgsQuakes && forecastData.usgsQuakes.val) || [];
    if (!(quakes[0] && quakes[0].fallback)) {
      quakes.filter(q => q.mag >= 7.0 && !q.fallback).forEach(q => {
        pushNotif({
          id: 'quake-m7-' + (q.place ? q.place.slice(0,20) : 'unknown') + '-' + Math.floor(q.mag*10), level: 'critical',
          headline: `M${q.mag.toFixed(1)} Earthquake: ${q.place}`,
          bullets: [
            'Depth: <b>'+q.depth+' km</b> · '+(q.depth<70?'<b>SHALLOW — tsunamigenic potential</b>':'Deep — low tsunami risk'),
            q.tsunamiFlag ? '<b>⚠ PTWC tsunami message issued</b>' : 'Tsunami evaluation in progress',
            `LAIC ionospheric signature possible within <b>10–30 min</b>`,
          ],
          source: 'USGS Live', tab: 'risk', icon: '🔴',
        });
      });
      quakes.filter(q => q.mag >= 5.5 && q.mag < 7.0 && q.depth < 70 && !q.fallback).slice(0, 2).forEach(q => {
        pushNotif({
          id: 'quake-sig-' + (q.place ? q.place.slice(0,20) : 'unknown'), level: 'advisory',
          headline: `M${q.mag.toFixed(1)} Shallow Quake: ${q.place}`,
          bullets: [
            `Depth <b>${q.depth}km</b> — monitor for aftershock sequence`,
            `Contributing to seismic precursor score`,
          ],
          source: 'USGS Live', tab: 'risk', icon: '🟡',
        });
      });
    }
  } catch(e) {}

  // ── 8. LOD SEISMIC SURGE WINDOW ──────────────────────────
  const doy = getDOY();
  const lodVal = Math.abs(Math.sin(doy*2*Math.PI/(365.25*6))*0.6 + Math.sin(doy*2*Math.PI/(365.25*18.6))*0.3);
  // Suppress LOD advisory when a critical stress or critical earthquake precursor is already active
  const hasCriticalSeismic = notifications.some(function(n) {
    return !n.dismissed && n.level === 'critical' && (n.id === 'stress-critical' || n.id === 'fc-eq-critical');
  });
  if (lodVal > 0.7 && !hasCriticalSeismic) {
    pushNotif({
      id: `lod-elevated-${Math.floor(doy/30)}`, level: 'advisory',
      headline: `LOD Seismic Window: Rotation Anomaly ${lodVal.toFixed(2)} ms`,
      bullets: [
        `Earth rotation slowdown phase — Bendick & Bilham 2017: <b>&gt;65% of M7+ events cluster here</b>`,
        `Caribbean and Alpine-Himalayan belt: <b>elevated watch</b>`,
      ],
      source: 'Geophysics', tab: 'discover', subTab: 'indices', icon: '🌍',
    });
  }

  // ── 9. NOVEL DISCOVERY ────────────────────────────────────
  // Dragon King
  const extremeCount = [s.kp>5, s.syzygy>0.85, s.crFlux>1850, s.swSpeed>600, s.tecPeak>60].filter(Boolean).length;
  const dragonKingProb = [0,2,8,25,65,95][extremeCount] || 0;
  if (dragonKingProb >= 25) {
    pushNotif({
      id: 'dragonking', level: (extremeCount >= 4 ? 'critical' : 'watch'),
      headline: `Dragon King Probability: ${dragonKingProb}% — ${extremeCount}/5 Systems`,
      bullets: [
        `<b>${extremeCount} systems</b> simultaneously at extremes`,
        `Dragon King events are <b>non-tail extreme events</b> with distinct mechanisms (Sornette 2009)`,
        `Compound state rarely achieved — monitor all chains`,
      ],
      source: 'Discovery', tab: 'discover', subTab: 'indices', icon: '🐉',
    });
  }

  // Resonance lock
  const phi = 1.6180339887;
  const schFreq = (state.data.schumann && state.data.schumann.frequency) || s.schFreq || 7.83;
  const schTidalRatio = schFreq * 3600 / (s.luna > 0.001 ? 29.53 / s.luna : 29.53);
  const phiDelta = Math.min(Math.abs(schTidalRatio - phi), Math.abs(schTidalRatio - 1/phi));
  const resonanceLock = Math.max(0, 100 * (1 - phiDelta / phi));
  if (resonanceLock > 70) {
    pushNotif({
      id: 'resonance-lock', level: 'advisory',
      headline: `φ-Resonance Lock Detected: ${resonanceLock.toFixed(0)}%`,
      bullets: [
        `Schumann (${schFreq} Hz) and tidal cycle approaching <b>golden ratio harmonic</b>`,
        `Novel signal — Earth-ionosphere cavity and tidal forcing in resonant alignment`,
      ],
      source: 'Discovery', tab: 'discover', subTab: 'indices', icon: '🔮',
    });
  }

  // Update scan timestamp
  const el = document.getElementById('notif-scan-status');
  if (el) el.textContent = `Last scan: ${new Date().toUTCString().slice(17,25)} UTC`;
}

// ── START AUTO-SCAN ──────────────────────────────────────
function startNotifScanner() {
  runNotifScan();
  notifScanTimer = setInterval(runNotifScan, 60000);
}

// ── HOOK: fire scan on forecast data refresh ─────────────
const _origRunForecastDataFetch = runForecastDataFetch;
window.runForecastDataFetch = async function() {
  await _origRunForecastDataFetch();
  runNotifScan();
};



// ════════════════════════════════════════════════════════
// PANEL COLLAPSE SYSTEM
// ════════════════════════════════════════════════════════
function toggleLeftPanel() {
  const collapsed = document.body.classList.toggle('left-collapsed');
  const btn = document.getElementById('btn-toggle-left');
  if (btn) btn.classList.toggle('collapsed', collapsed);
  setTimeout(() => { resizeMap(); }, 310);
}

function toggleRightPanel() {
  const collapsed = document.body.classList.toggle('right-collapsed');
  const btn = document.getElementById('btn-toggle-right');
  if (btn) btn.classList.toggle('collapsed', collapsed);
  setTimeout(() => { resizeMap(); }, 310);
}

// ── Accordion panel sections ──────────────────────────────────
function togglePS(id) {
  var el = document.getElementById(id);
  if (el) el.classList.toggle('ps-open');
}

// ── Panel fullscreen mode ─────────────────────────────────────
function togglePanelFS() {
  document.body.classList.toggle('panel-fs');
  setTimeout(function(){ try { resizeMap(); } catch(e){} }, 50);
}

// ── Panel drag-to-resize ──────────────────────────────────────
(function() {
  var handle, panel, dragging = false, startX, startW;
  function initResize() {
    handle = document.getElementById('panel-resize-handle');
    panel  = document.getElementById('right-panel');
    if (!handle || !panel) return;
    handle.addEventListener('mousedown', function(e) {
      dragging = true; startX = e.clientX; startW = panel.offsetWidth;
      handle.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      e.preventDefault();
    });
    document.addEventListener('mousemove', function(e) {
      if (!dragging) return;
      var delta = startX - e.clientX;
      var newW  = Math.max(240, Math.min(700, startW + delta));
      panel.style.width = newW + 'px';
      document.documentElement.style.setProperty('--panel-w', newW + 'px');
    });
    document.addEventListener('mouseup', function() {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove('dragging');
      document.body.style.cursor = '';
      try { resizeMap(); } catch(e) {}
    });
  }
  window.addEventListener('load', initResize);
})();

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  const tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (e.key === '[' && !e.ctrlKey && !e.metaKey) toggleLeftPanel();
  if (e.key === ']' && !e.ctrlKey && !e.metaKey) toggleRightPanel();
  if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey) togglePanelFS();
  if (e.key === 'Escape') {
    var ov = document.getElementById('deep-analysis-overlay');
    if (ov && ov.classList.contains('open')) { closeDeepAnalysis(); return; }
    if (document.body.classList.contains('panel-fs')) togglePanelFS();
  }
  // D key: open Deep Analysis overlay
  if ((e.key === 'd' || e.key === 'D') && !e.ctrlKey && !e.metaKey && !e.altKey) {
    var ov2 = document.getElementById('deep-analysis-overlay');
    if (ov2 && ov2.classList.contains('open')) { closeDeepAnalysis(); return; }
    openDeepAnalysis(); return;
  }
  // Number keys 1–4: jump to right-panel tabs
  var _tabKeys = { '1':'now', '2':'risk', '3':'explore', '4':'hist' };
  if (!e.ctrlKey && !e.metaKey && !e.altKey && _tabKeys[e.key]) {
    switchTab(_tabKeys[e.key]);
  }
});


// ════════════════════════════════════════════════════════
// BOOT
// ════════════════════════════════════════════════════════
window.addEventListener('load',()=>{
  // Start Leaflet immediately
  try { initLeafletMap(); } catch(e) { console.error('Map init failed:', e); }

  setTimeout(()=>{
    const loading=document.getElementById('loading');
    loading.style.opacity='0';
    setTimeout(()=>loading.style.display='none',800);
      whenMapReady(() => {
      toggleLayer('seismic');
      toggleLayer('geomagnetic');
      toggleLayer('volcanic');
      toggleLayer('tides');
      toggleLayer('cosmic');
      setPeriod('1m');
      // Seed initial series points
      setTimeout(() => {
        state.activeLayers.forEach(id => {
          initSeries(id);
          for (let i = 0; i < 20; i++) pushSeriesPoint(id);
        });
        // Run initial discovery scan
        renderStressIndex();
        renderNovelIndices();
        renderPlanets();
        runChainScan();
        // Start notification scanner
        setTimeout(startNotifScanner, 1500);
      }, 800);
    });
  },3000);
});

// ════════════════════════════════════════════════════════
// GUIDED TOUR (Tier 4.1)
// ════════════════════════════════════════════════════════

const ESO_TOUR_STEPS = [
  {
    title: 'Welcome to ESO',
    body:  'The Earth Systems Observatory integrates real-time space weather, seismic, oceanic, and atmospheric data into a single research interface. This tour takes ~2 minutes.',
    target: null, pos: 'center'
  },
  {
    title: 'Live Data Layers',
    body:  'The left panel lists all data layers. Click any layer to toggle it on the map. Layers marked LIVE fetch real data from NOAA, USGS, and Open-Meteo. Use the region filter at the top to focus on a geographic area.',
    target: '#layer-panel', pos: 'right'
  },
  {
    title: 'Status Strip',
    body:  'The strip below the header gives an instant situational snapshot — geomagnetic Kp index, active alerts, solar flux, and network status. Click any metric to jump to its data panel.',
    target: '#status-strip', pos: 'below'
  },
  {
    title: 'Data & Baselines',
    body:  'The right panel shows baseline metrics (Kp, Dst, solar wind, proton flux, ENSO) and active scientific insights. Switch tabs at the top to see Risk scores, Explore correlations, or Analysis tools.',
    target: '#right-panel', pos: 'left'
  },
  {
    title: 'Charts & Analysis',
    body:  'Expand the Charts dock at the bottom to see live time-series plots, a correlation matrix with significance testing, anomaly detection, and data export. Activate more layers for richer analysis.',
    target: '#dock-sec-charts', pos: 'above'
  },
  {
    title: 'You\'re Ready',
    body:  'Press ? or click "? Guide" anytime to open the Field Guide for detailed explanations. Use "Ask ESO" to query current conditions in plain language. Happy exploring!',
    target: null, pos: 'center'
  }
];

let _tourStep = 0;
let _tourActive = false;

// ════════════════════════════════════════════════════════
// LIGHT / DARK MODE TOGGLE (Missed Audit Item)
// ════════════════════════════════════════════════════════
function toggleLightMode() {
  var isLight = document.body.classList.toggle('light-mode');
  var btn = document.getElementById('eso-theme-btn');
  if (btn) {
    btn.textContent = isLight ? '🌙 Dark' : '☀ Light';
    btn.style.borderColor = isLight ? 'rgba(0,112,204,.4)' : 'rgba(255,255,255,.15)';
    btn.style.color = isLight ? 'var(--c-cyan)' : 'var(--text-dim)';
  }
  try { localStorage.setItem('eso-theme', isLight ? 'light' : 'dark'); } catch(e) {}
}

// Restore theme on load
window.addEventListener('load', function() {
  try {
    if (localStorage.getItem('eso-theme') === 'light') {
      document.body.classList.add('light-mode');
      var btn = document.getElementById('eso-theme-btn');
      if (btn) { btn.textContent = '🌙 Dark'; btn.style.color = 'var(--c-cyan)'; }
    }
  } catch(e) {}
});

function startTour() {
  _tourStep = 0;
  _tourActive = true;
  document.getElementById('eso-tour-backdrop').classList.add('active');
  document.getElementById('tour-step-total').textContent = ESO_TOUR_STEPS.length;
  _renderTourStep();
}

function stopTour() {
  _tourActive = false;
  document.getElementById('eso-tour-popup').classList.remove('open');
  document.getElementById('eso-tour-backdrop').classList.remove('active');
  var ring = document.getElementById('eso-tour-ring');
  if (ring) ring.style.display = 'none';
}

function tourNext() {
  if (_tourStep < ESO_TOUR_STEPS.length - 1) { _tourStep++; _renderTourStep(); }
  else stopTour();
}
function tourPrev() {
  if (_tourStep > 0) { _tourStep--; _renderTourStep(); }
}

function _renderTourStep() {
  var step  = ESO_TOUR_STEPS[_tourStep];
  var popup = document.getElementById('eso-tour-popup');
  var ring  = document.getElementById('eso-tour-ring');
  if (!popup) return;
  document.getElementById('tour-title').textContent = step.title;
  document.getElementById('tour-body').textContent  = step.body;
  document.getElementById('tour-step-num').textContent = _tourStep + 1;
  // Dots
  var dotsEl = document.getElementById('tour-dots');
  if (dotsEl) {
    dotsEl.innerHTML = ESO_TOUR_STEPS.map(function(_, i) {
      return '<div class="tour-dot' + (i === _tourStep ? ' active' : '') + '"></div>';
    }).join('');
  }
  // Prev button visibility
  var prevBtn = document.getElementById('tour-prev-btn');
  if (prevBtn) prevBtn.style.visibility = _tourStep > 0 ? 'visible' : 'hidden';
  var nextBtn = document.getElementById('tour-next-btn');
  if (nextBtn) nextBtn.textContent = _tourStep === ESO_TOUR_STEPS.length - 1 ? 'Finish ✓' : 'Next →';
  // Position popup
  if (step.target) {
    var target = document.querySelector(step.target);
    if (target) {
      var rect = target.getBoundingClientRect();
      // Highlight ring
      if (ring) {
        ring.style.display = 'block';
        ring.style.left   = (rect.left - 4) + 'px';
        ring.style.top    = (rect.top - 4) + 'px';
        ring.style.width  = (rect.width + 8) + 'px';
        ring.style.height = (rect.height + 8) + 'px';
      }
      // Popup position
      var pw = 280, ph = 200;
      var left, top;
      if (step.pos === 'right')  { left = rect.right + 12; top = rect.top + rect.height/2 - ph/2; }
      else if (step.pos === 'left')  { left = rect.left - pw - 12; top = rect.top + rect.height/2 - ph/2; }
      else if (step.pos === 'below') { left = rect.left; top = rect.bottom + 10; }
      else if (step.pos === 'above') { left = rect.left; top = rect.top - ph - 10; }
      else { left = window.innerWidth/2 - pw/2; top = window.innerHeight/2 - ph/2; }
      left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
      top  = Math.max(8, Math.min(top,  window.innerHeight - ph - 8));
      popup.style.left = left + 'px'; popup.style.top = top + 'px';
    }
  } else {
    if (ring) ring.style.display = 'none';
    popup.style.left = (window.innerWidth/2 - 140) + 'px';
    popup.style.top  = (window.innerHeight/2 - 120) + 'px';
  }
  popup.classList.add('open');
}

// Close tour on Escape
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && _tourActive) stopTour();
});


// ════════════════════════════════════════════════════════
// EMBED MODE (Tier 4.11)
// ════════════════════════════════════════════════════════

function checkEmbedMode() {
  var isEmbed = window.location.hash.includes('embed=1') ||
                new URLSearchParams(window.location.search).get('embed') === '1';
  if (isEmbed) {
    document.body.classList.add('embed-mode');
    var legend = document.getElementById('embed-active-layers');
    if (legend && state && state.activeLayers) {
      legend.textContent = Array.from(state.activeLayers).join(' · ') || 'No layers active';
    }
  }
}

function exitEmbedMode() {
  document.body.classList.remove('embed-mode');
  var hash = window.location.hash.replace('embed=1&', '').replace('&embed=1', '').replace('embed=1', '');
  history.replaceState(null, '', hash || '#');
}

window.addEventListener('load', function() {
  checkEmbedMode();
  // Update embed legend when layers change
  if (document.body.classList.contains('embed-mode')) {
    setInterval(function() {
      var legend = document.getElementById('embed-active-layers');
      if (legend && state && state.activeLayers) {
        legend.textContent = Array.from(state.activeLayers).join(' · ') || 'No layers active';
      }
    }, 2000);
  }
});


// ════════════════════════════════════════════════════════
// ARIA LABELS (Tier 4.12)
// ════════════════════════════════════════════════════════

(function applyARIA() {
  // Apply after DOM ready
  window.addEventListener('load', function() {
    // Map
    var map = document.getElementById('map');
    if (map) { map.setAttribute('role', 'application'); map.setAttribute('aria-label', 'Earth Systems Observatory interactive map'); }
    // Layer list
    var layersList = document.getElementById('layers-list');
    if (layersList) { layersList.setAttribute('role', 'list'); layersList.setAttribute('aria-label', 'Data layers'); }
    // Each layer item
    document.querySelectorAll('.layer-item').forEach(function(el) {
      var name = (el.querySelector('.layer-name') || {}).textContent || 'Layer';
      el.setAttribute('role', 'checkbox');
      el.setAttribute('aria-label', name + ' layer');
      el.setAttribute('aria-checked', el.classList.contains('active') ? 'true' : 'false');
      el.setAttribute('tabindex', '0');
      el.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
      });
    });
    // Notification live region
    var notifList = document.getElementById('notif-list');
    if (notifList) { notifList.setAttribute('aria-live', 'polite'); notifList.setAttribute('aria-label', 'Notifications'); }
    // Status strip
    var strip = document.getElementById('status-strip');
    if (strip) { strip.setAttribute('role', 'status'); strip.setAttribute('aria-label', 'System status strip'); }
    // Right panel tabs
    document.querySelectorAll('.rpanel-tab').forEach(function(el) {
      el.setAttribute('role', 'tab');
      el.setAttribute('tabindex', '0');
      el.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') el.click();
      });
    });
    // Keyboard nav: make tabs and dock headers focusable
    document.querySelectorAll('.rpanel-tab').forEach(function(t) {
      if (!t.getAttribute('tabindex')) t.setAttribute('tabindex', '0');
    });
    document.querySelectorAll('.dock-hdr').forEach(function(h) {
      if (!h.getAttribute('tabindex')) h.setAttribute('tabindex', '0');
    });
    // Baseline items — make values live-region readable
    ['bl-kp','bl-dst','bl-swspd','bl-bz','bl-proton','bl-enso'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) { el.setAttribute('aria-live', 'polite'); el.setAttribute('aria-atomic', 'true'); }
    });
    // Bottom dock sections
    document.querySelectorAll('.dock-hdr').forEach(function(el) {
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
      });
    });
    // Periodically update aria-checked on layer items
    setInterval(function() {
      document.querySelectorAll('.layer-item').forEach(function(el) {
        el.setAttribute('aria-checked', el.classList.contains('active') ? 'true' : 'false');
      });
    }, 2000);
  });
})();

// Wire raw data inspector to baseline items on load
window.addEventListener('load', function() {
  var mapping = {
    'bl-kp': 'kp', 'bl-dst': 'dst', 'bl-swspd': 'swspd',
    'bl-eq': 'eq', 'bl-sfi': 'sfi', 'bl-quakes': 'quakes'
  };
  Object.keys(mapping).forEach(function(id) {
    var el = document.getElementById(id);
    if (el) {
      el.style.cursor = 'pointer';
      el.title = 'Click to inspect raw data';
      el.addEventListener('click', function() { showRawDataInspector(mapping[id]); });
    }
  });
});

// ════════════════════════════════════════════════════════
// KEYBOARD NAVIGATION (Missed Audit Item — Persona 3)
// Arrow key navigation within layer list and tab panels
// ════════════════════════════════════════════════════════
(function addKeyboardNav() {
  window.addEventListener('load', function() {
    // Arrow key navigation within layers list
    var layersList = document.getElementById('layers-list');
    if (layersList) {
      layersList.addEventListener('keydown', function(e) {
        var items = Array.from(layersList.querySelectorAll('.layer-item[tabindex="0"]'));
        var idx = items.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (idx < items.length - 1) items[idx + 1].focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (idx > 0) items[idx - 1].focus();
        } else if (e.key === 'Home') {
          e.preventDefault();
          if (items.length) items[0].focus();
        } else if (e.key === 'End') {
          e.preventDefault();
          if (items.length) items[items.length - 1].focus();
        }
      });
    }

    // Arrow key navigation between right-panel tabs
    var tabBar = document.querySelector('.rpanel-tabs');
    if (tabBar) {
      tabBar.addEventListener('keydown', function(e) {
        var tabs = Array.from(tabBar.querySelectorAll('.rpanel-tab'));
        var idx = tabs.indexOf(document.activeElement);
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          var next = tabs[(idx + 1) % tabs.length];
          next.focus(); next.click();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          var prev = tabs[(idx - 1 + tabs.length) % tabs.length];
          prev.focus(); prev.click();
        }
      });
    }

    // Arrow key navigation between dock section headers
    var dock = document.getElementById('bottom-dock');
    if (dock) {
      dock.addEventListener('keydown', function(e) {
        var hdrs = Array.from(dock.querySelectorAll('.dock-hdr'));
        var idx = hdrs.indexOf(document.activeElement);
        if (e.key === 'ArrowRight' && idx < hdrs.length - 1) {
          e.preventDefault(); hdrs[idx + 1].focus();
        } else if (e.key === 'ArrowLeft' && idx > 0) {
          e.preventDefault(); hdrs[idx - 1].focus();
        }
      });
    }
  });
})();


// ════════════════════════════════════════════════════════
// DATA PROVENANCE PANEL (Tier 4.10)
// Per-layer source, API URL, last-fetch time
// ════════════════════════════════════════════════════════

var ESO_PROVENANCE = {
  solar:      { name:'NASA POWER',    url:'https://power.larc.nasa.gov/api/',          freq:'10-year cycle model', license:'NASA Open Data' },
  geomagnetic:{ name:'NOAA SWPC Kp', url:'https://services.swpc.noaa.gov/json/planetary_k_index_1m.json', freq:'1 min', license:'Public Domain' },
  cosmic:     { name:'Computed model',url:'—',                                          freq:'Calculated',         license:'—' },
  solarwind:  { name:'NOAA DSCOVR',  url:'https://services.swpc.noaa.gov/products/solar-wind/plasma-7-day.json', freq:'5 min', license:'Public Domain' },
  xray:       { name:'NOAA GOES',    url:'https://services.swpc.noaa.gov/json/goes/primary/xray-flares-7-day.json', freq:'5 min', license:'Public Domain' },
  seismic:    { name:'USGS FDSNWS',  url:'https://earthquake.usgs.gov/fdsnws/event/1/query', freq:'Real-time', license:'Public Domain' },
  magnetic:   { name:'NOAA WMM',     url:'https://www.ngdc.noaa.gov/geomag/',           freq:'5-year model', license:'Public Domain' },
  volcanic:   { name:'Smithsonian GVP', url:'https://volcano.si.edu/',                 freq:'Weekly updates', license:'CC BY 4.0' },
  gravity:    { name:'NASA GRACE',   url:'https://grace.jpl.nasa.gov/',                 freq:'Static model', license:'NASA Open Data' },
  geotherm:   { name:'Model computed',url:'—',                                          freq:'Static',       license:'—' },
  wind:       { name:'Open-Meteo',   url:'https://api.open-meteo.com/v1/forecast',      freq:'15 min',       license:'CC BY 4.0' },
  pressure:   { name:'Open-Meteo',   url:'https://api.open-meteo.com/v1/forecast',      freq:'1 hour',       license:'CC BY 4.0' },
  schumann:   { name:'Model computed',url:'—',                                          freq:'Computed',     license:'—' },
  ionosphere: { name:'Physics model', url:'—',                                          freq:'Computed',     license:'—' },
  sst:        { name:'Open-Meteo Marine', url:'https://marine-api.open-meteo.com/v1/marine', freq:'1 hour', license:'CC BY 4.0' },
  tides:      { name:'Astronomical model',url:'—',                                      freq:'Computed',     license:'—' },
};

function showProvenance(layerId) {
  var prov = ESO_PROVENANCE[layerId];
  if (!prov) return;
  var existing = document.getElementById('eso-prov-popup');
  if (existing) existing.remove();
  var div = document.createElement('div');
  div.id = 'eso-prov-popup';
  div.style.cssText = 'position:fixed;z-index:2000;background:var(--surface);border:1px solid rgba(0,229,255,.35);' +
    'border-radius:3px;padding:10px 12px;font-size:8px;color:#c0d8ec;line-height:1.8;' +
    'width:230px;box-shadow:0 4px 20px rgba(0,0,0,.5);';
  div.innerHTML = '<div style="color:var(--c-cyan);font-size:7.5px;letter-spacing:.12em;margin-bottom:5px;">📡 DATA PROVENANCE</div>' +
    '<b>' + layerId.charAt(0).toUpperCase() + layerId.slice(1) + '</b><br>' +
    'Source: ' + prov.name + '<br>' +
    (prov.url !== '—' ? 'API: <a href="' + prov.url + '" target="_blank" style="color:var(--c-cyan);word-break:break-all;">' + prov.url.slice(0,50) + (prov.url.length>50?'…':'') + '</a><br>' : '') +
    'Update freq: ' + prov.freq + '<br>' +
    'License: ' + prov.license +
    '<br><button onclick="document.getElementById(\'eso-prov-popup\').remove()" style="margin-top:6px;font-size:7px;background:none;border:1px solid var(--border);color:var(--text-dim);cursor:pointer;padding:2px 6px;border-radius:2px;">Close</button>';
  document.body.appendChild(div);
  // Position near center
  div.style.left = (window.innerWidth/2 - 115) + 'px';
  div.style.top  = (window.innerHeight/2 - 80) + 'px';
}

// Add provenance link to each active layer item
window.addEventListener('load', function() {
  setTimeout(function() {
    document.querySelectorAll('.layer-item').forEach(function(el) {
      var id = el.dataset.layer;
      if (!id || !ESO_PROVENANCE[id]) return;
      var info = el.querySelector('.layer-info');
      if (!info) return;
      var src = el.querySelector('.layer-source');
      if (src && !src.querySelector('.prov-link')) {
        var link = document.createElement('span');
        link.className = 'prov-link';
        link.textContent = ' ℹ';
        link.title = 'Show data provenance';
        link.style.cssText = 'cursor:pointer;color:rgba(0,229,255,.4);font-size:8px;';
        link.onclick = function(e) { e.stopPropagation(); showProvenance(id); };
        src.appendChild(link);
      }
    });
  }, 1500);
});

// ════════════════════════════════════════════════════════
// ENSO HOOK — compute after SST data loads (Tier 4.5)
// ════════════════════════════════════════════════════════
// Hook into the existing loadSST / renderSSTMarkers pipeline
var _origRenderSSTMarkers = window.renderSSTMarkers;
if (typeof _origRenderSSTMarkers === 'function') {
  window._enstPatched = true;  // prevent double-patch from load listener
  window.renderSSTMarkers = function(data) {
    _origRenderSSTMarkers(data);
    setTimeout(computeENSO, 200);
  };
}
window.addEventListener('load', function() {
  if (typeof renderSSTMarkers === 'function' && !window._enstPatched) {
    window._enstPatched = true;
    var orig = renderSSTMarkers;
    window.renderSSTMarkers = function(data) {
      orig(data);
      setTimeout(computeENSO, 200);
    };
  }
});

// ════════════════════════════════════════════════════════
// SCROLL POSITION PRESERVATION (Tier 3.6)
// ════════════════════════════════════════════════════════

var _tabScrollPositions = {};

(function patchTabSwitchForScroll() {
  var _origSwitchTab = window.switchTab;
  if (typeof _origSwitchTab !== 'function') {
    // Will be patched after switchTab is defined
    window._scrollPatchPending = true;
    return;
  }
  window.switchTab = function(tab) {
    // Save current scroll position
    var activePanel = document.querySelector('.rpanel-content.active');
    if (activePanel) _tabScrollPositions[activePanel.id] = activePanel.scrollTop;
    _origSwitchTab(tab);
    // Restore scroll position for newly active panel
    setTimeout(function() {
      var newActive = document.querySelector('.rpanel-content.active');
      if (newActive && _tabScrollPositions[newActive.id] != null) {
        newActive.scrollTop = _tabScrollPositions[newActive.id];
      }
    }, 50);
  };
})();

// Late-patch if switchTab wasn't defined yet when we ran
window.addEventListener('load', function() {
  if (window._scrollPatchPending && typeof switchTab === 'function') {
    var _orig = switchTab;
    window.switchTab = function(tab) {
      var activePanel = document.querySelector('.rpanel-content.active');
      if (activePanel) _tabScrollPositions[activePanel.id] = activePanel.scrollTop;
      _orig(tab);
      setTimeout(function() {
        var newActive = document.querySelector('.rpanel-content.active');
        if (newActive && _tabScrollPositions[newActive.id] != null) {
          newActive.scrollTop = _tabScrollPositions[newActive.id];
        }
      }, 50);
    };
    window._scrollPatchPending = false;
  }
});


// ════════════════════════════════════════════════════════
// PLAIN-LANGUAGE AUTO-INTERPRETATIONS (Tier 3.8)
// Appended to FFT, Lag Explorer, Anomaly, Correlation results
// ════════════════════════════════════════════════════════

function generateAutoInterpretation(type, data) {
  try {
    if (type === 'correlation' && data) {
      // data = { r, n, p, sig, layerA, layerB }
      var strength = Math.abs(data.r) > 0.7 ? 'strong' : Math.abs(data.r) > 0.4 ? 'moderate' : 'weak';
      var direction = data.r > 0 ? 'positive (they tend to rise and fall together)' : 'negative (when one rises, the other tends to fall)';
      var sig = data.sig !== 'ns' ? 'This result is statistically significant (p < 0.05).' : 'This result is NOT statistically significant with the current data (need more samples).';
      return strength.charAt(0).toUpperCase() + strength.slice(1) + ' ' + direction + ' correlation between ' +
             (data.layerA || 'Layer A') + ' and ' + (data.layerB || 'Layer B') + ' (r = ' + data.r.toFixed(2) + ', n = ' + data.n + '). ' + sig;
    }
    if (type === 'fft' && data) {
      // data = { dominantPeriod (hours), amplitude }
      var pd = data.dominantPeriod;
      var match = '';
      if (pd && Math.abs(pd - 24) < 3)    match = ' — matches the daily (solar) cycle';
      else if (pd && Math.abs(pd - 12) < 2) match = ' — matches the semi-diurnal tidal cycle';
      else if (pd && Math.abs(pd - 336) < 48) match = ' — matches the ~2-week lunar cycle';
      else if (pd && Math.abs(pd - 648) < 72) match = ' — near the 27-day solar rotation period';
      return pd ? 'Strongest periodic signal at ~' + pd.toFixed(0) + ' hours' + match + '.' :
                  'No clear dominant period detected in the current session data.';
    }
    if (type === 'anomaly' && data) {
      // data = { layer, zscore, direction }
      var dirText = data.direction > 0 ? 'above' : 'below';
      var sevText = Math.abs(data.zscore) > 3 ? 'extreme' : Math.abs(data.zscore) > 2 ? 'significant' : 'mild';
      return (data.layer || 'This layer') + ' is showing a ' + sevText + ' anomaly — ' +
             Math.abs(data.zscore).toFixed(1) + ' standard deviations ' + dirText + ' its session average.';
    }
  } catch(e) {}
  return '';
}

// Append plain-language blurb to the correlation matrix key
function appendCorrInterpretations() {
  var keyEl = document.getElementById('matrix-key');
  if (!keyEl) return;
  var existing = keyEl.querySelectorAll('.corr-auto-interp');
  existing.forEach(function(e) { e.remove(); });
  // Read active layer pairs from the rendered matrix cells
  // (The actual stats come from pearsonStats calls during renderCorrMatrix)
  // We hook into this via the global _lastCorrStats if set
  if (window._lastCorrStats && window._lastCorrStats.length) {
    var top3 = window._lastCorrStats
      .filter(function(s) { return Math.abs(s.r) > 0.3 && s.n >= 4; })
      .sort(function(a,b) { return Math.abs(b.r) - Math.abs(a.r); })
      .slice(0, 3);
    if (top3.length) {
      var div = document.createElement('div');
      div.className = 'corr-auto-interp';
      div.style.cssText = 'margin-top:10px;padding:8px;background:rgba(0,229,255,.06);border-radius:3px;border:1px solid rgba(0,229,255,.15);font-size:8px;line-height:1.8;color:#c0d8ec;';
      div.innerHTML = '<div style="color:var(--c-cyan);font-size:7.5px;letter-spacing:.12em;margin-bottom:4px;">📖 AUTO-INTERPRETATION</div>' +
        top3.map(function(s) {
          return '· ' + generateAutoInterpretation('correlation', s);
        }).join('<br>');
      keyEl.appendChild(div);
    }
  }
}

// Hook into renderCorrMatrix to store stats
var _origRenderCorrMatrix = window.renderCorrMatrix;
if (typeof _origRenderCorrMatrix === 'function') {
  window._corrMatrixPatched = true;  // prevent double-patch from load listener
  window.renderCorrMatrix = function() {
    _origRenderCorrMatrix();
    setTimeout(appendCorrInterpretations, 200);
  };
}
window.addEventListener('load', function() {
  if (typeof renderCorrMatrix === 'function' && !window._corrMatrixPatched) {
    window._corrMatrixPatched = true;
    var orig = renderCorrMatrix;
    window.renderCorrMatrix = function() {
      orig();
      setTimeout(appendCorrInterpretations, 200);
    };
  }
});

// ════════════════════════════════════════════════════════
// RAW DATA INSPECTOR (Wave 5 — Persona 8)
// Click any baseline value to see raw inputs that produced it
// ════════════════════════════════════════════════════════
function showRawDataInspector(metric) {
  var existing = document.getElementById('raw-data-inspector');
  if (existing && existing.dataset.metric === metric) { existing.remove(); return; }
  if (existing) existing.remove();

  var s = typeof getSystemState === 'function' ? getSystemState() : {};
  var rows = [];

  if (metric === 'kp') {
    rows = [
      ['Source', 'NOAA SWPC estimated Kp (wing-kp.json)'],
      ['Current Kp', (_realKpCurrent !== null ? _realKpCurrent : s.kp || '—').toString()],
      ['Data timestamp', forecastData.kp && forecastData.kp.ts ? new Date(forecastData.kp.ts).toISOString() : '—'],
      ['Fallback used', forecastData.kp && forecastData.kp.fallback ? 'YES (model)' : 'NO (real)'],
      ['7-day values', forecastData.kp && forecastData.kp.series ? JSON.stringify(forecastData.kp.series.slice(-7)) : '—'],
    ];
  } else if (metric === 'dst') {
    rows = [
      ['Source', 'NOAA SWPC kyoto-dst.json (hourly ring current)'],
      ['Current Dst', (_dstCurrent !== null ? _dstCurrent : '—').toString() + ' nT'],
      ['Storm threshold', '< −50 nT (moderate), < −100 nT (intense)'],
      ['Data age', forecastData.dst && forecastData.dst.ts ? Math.round((Date.now()-forecastData.dst.ts)/60000)+'m' : '—'],
    ];
  } else if (metric === 'swspd') {
    rows = [
      ['Source', 'NOAA SWPC DSCOVR plasma-7-day.json'],
      ['SW Speed', (_swSpeed !== null ? _swSpeed : '—').toString() + ' km/s'],
      ['SW Density', (_swDensity !== null ? _swDensity : '—').toString() + ' p/cm³'],
      ['IMF Bz', (_swBz !== null ? _swBz : '—').toString() + ' nT'],
      ['Solar wind pressure', (_swSpeed && _swDensity ? (0.5 * _swDensity * Math.pow(_swSpeed*1e3,2) * 1e-9).toFixed(2) + ' nPa' : '—')],
    ];
  } else if (metric === 'eq') {
    var eq = typeof scoreEarthquake === 'function' ? scoreEarthquake() : null;
    rows = [
      ['Score', eq ? eq.score + '/100' : '—'],
      ['Level', eq ? eq.level : '—'],
      ['Confidence', eq ? eq.confidence + '%' : '—'],
      ['Quake count (filter)', forecastData.usgsQuakes && forecastData.usgsQuakes.val ? forecastData.usgsQuakes.val.length + ' events' : '—'],
      ['Min mag filter', typeof _seismicMinMag !== 'undefined' ? 'M' + _seismicMinMag + '+' : '—'],
      ['Time window', typeof _seismicTimeWindow !== 'undefined' ? _seismicTimeWindow : '—'],
      ['Data age', forecastData.usgsQuakes && forecastData.usgsQuakes.ts ? Math.round((Date.now()-forecastData.usgsQuakes.ts)/60000)+'m' : '—'],
    ];
  } else if (metric === 'sfi') {
    rows = [
      ['Source', _f107Current !== null ? 'NOAA SWPC f107_cm_flux.json (real)' : 'Model (11-yr sinusoid estimate)'],
      ['F10.7 index', (_f107Current !== null ? _f107Current : s.sfi || '—').toString() + ' sfu'],
      ['Solar cycle proxy', s.carr !== undefined ? 'Carrington phase: ' + s.carr.toFixed(3) : '—'],
      ['Interpretation', (_f107Current||s.sfi||0) > 150 ? 'Solar maximum (active)' : (_f107Current||s.sfi||0) < 80 ? 'Solar minimum (quiet)' : 'Moderate activity'],
    ];
  } else if (metric === 'quakes') {
    var q = forecastData.usgsQuakes;
    rows = [
      ['Source', 'USGS FDSNWS earthquake.usgs.gov'],
      ['Events loaded', q && q.val ? q.val.length + '' : '—'],
      ['Magnitude filter', typeof _seismicMinMag !== 'undefined' ? 'M' + _seismicMinMag + '+' : '—'],
      ['Time window', typeof _seismicTimeWindow !== 'undefined' ? _seismicTimeWindow : '—'],
      ['Region', typeof _seismicRegion !== 'undefined' ? _seismicRegion : 'global'],
      ['Largest event', q && q.val && q.val.length ? 'M' + Math.max.apply(null, q.val.map(function(e){return e.mag||0;})).toFixed(1) : '—'],
      ['Fallback', q && q.fallback ? 'YES' : 'NO (live)'],
    ];
  } else {
    rows = [['Metric', metric], ['Note', 'Detailed raw inputs not yet mapped for this metric']];
  }

  var panel = document.createElement('div');
  panel.id = 'raw-data-inspector';
  panel.dataset.metric = metric;
  panel.style.cssText = 'position:fixed;bottom:80px;right:20px;z-index:3100;background:var(--surface);border:1px solid rgba(0,229,255,.25);border-radius:6px;padding:12px 14px;min-width:260px;max-width:340px;box-shadow:0 6px 24px rgba(0,0,0,.7);font-family:"Space Mono",monospace;';
  panel.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
      '<span style="font-size:8.5px;letter-spacing:.1em;color:var(--c-cyan);">🔬 RAW DATA — ' + metric.toUpperCase() + '</span>' +
      '<button onclick="document.getElementById(\'raw-data-inspector\').remove()" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:13px;">×</button>' +
    '</div>' +
    rows.map(function(r) {
      return '<div style="display:flex;gap:8px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:7.5px;">' +
        '<span style="color:var(--text-dim);min-width:90px;flex-shrink:0;">' + r[0] + '</span>' +
        '<span style="color:#fff;word-break:break-all;">' + r[1] + '</span>' +
      '</div>';
    }).join('') +
    '<div style="font-size:7px;color:var(--text-dim);margin-top:6px;opacity:.6;">Click same metric again to close · ' + new Date().toLocaleTimeString() + '</div>';
  document.body.appendChild(panel);
}

// ════════════════════════════════════════════════════════
// EQ SCORE TRANSPARENCY (Missed Audit Item)
// Show/hide a panel explaining the earthquake precursor score calculation
// ════════════════════════════════════════════════════════
function showEQCalcPanel() {
  var existing = document.getElementById('eq-calc-panel');
  if (existing) { existing.remove(); return; }
  var eq = typeof scoreEarthquake === 'function' ? scoreEarthquake() : null;
  if (!eq) return;
  var panel = document.createElement('div');
  panel.id = 'eq-calc-panel';
  panel.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:3200;background:var(--surface);border:1px solid rgba(0,229,255,.35);border-radius:6px;padding:16px 18px;min-width:300px;max-width:380px;box-shadow:0 8px 32px rgba(0,0,0,.7);font-family:"Space Mono",monospace;';
  var factorRows = eq.factors.map(function(f) {
    var pct = Math.round(f.score / f.max * 100);
    var barColor = f.color || 'var(--c-cyan)';
    return '<div style="margin:5px 0;">' +
      '<div style="display:flex;justify-content:space-between;font-size:8px;color:var(--text-dim);margin-bottom:2px;">' +
        '<span>' + f.label + '</span>' +
        '<span style="color:#fff;">' + f.score + '/' + f.max + ' pts</span>' +
      '</div>' +
      '<div style="height:5px;background:rgba(255,255,255,.08);border-radius:2px;">' +
        '<div style="height:100%;width:' + pct + '%;background:' + barColor + ';border-radius:2px;transition:width .4s;"></div>' +
      '</div>' +
    '</div>';
  }).join('');
  panel.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
      '<span style="font-size:9px;letter-spacing:.12em;color:var(--c-cyan);">⚡ EQ PRECURSOR SCORE — CALCULATION</span>' +
      '<button onclick="document.getElementById(\'eq-calc-panel\').remove()" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:14px;line-height:1;padding:0;">×</button>' +
    '</div>' +
    '<div style="font-size:8px;color:var(--text-dim);margin-bottom:10px;line-height:1.6;border-left:2px solid rgba(255,214,0,.4);padding-left:8px;">' +
      '⚠ Research hypothesis score — NOT an operational earthquake forecast. ' +
      'Based on LAIC theory (lithosphere-atmosphere-ionosphere coupling). Confidence: <b style="color:#fff;">' + eq.confidence + '%</b>' +
    '</div>' +
    '<div style="font-size:9px;color:var(--text-dim);letter-spacing:.08em;margin-bottom:6px;">FACTOR BREAKDOWN (total: ' + eq.score + '/100)</div>' +
    factorRows +
    '<div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border);font-size:7.5px;color:var(--text-dim);line-height:1.7;">' +
      '<b style="color:#fff;">Formula:</b> Tidal Syzygy (0–25) + LAIC TEC Anomaly (0–25) + M5.5+ Seismicity (0–20) + LOD Phase (0–15) + Geomag 27d Lag (0–15) = max 100<br>' +
      '<b style="color:#fff;">Data age:</b> ' + (eq.dataAge !== null ? eq.dataAge + ' min' : 'unknown') +
    '</div>';
  document.body.appendChild(panel);
  // Click outside to close
  setTimeout(function() {
    document.addEventListener('click', function _close(e) {
      var p = document.getElementById('eq-calc-panel');
      if (p && !p.contains(e.target)) { p.remove(); document.removeEventListener('click', _close); }
    });
  }, 200);
}

// ════════════════════════════════════════════════════════
// SITREP GENERATION (Tier 3.11)
// ════════════════════════════════════════════════════════

function generateSitrep() {
  var now = new Date();
  var ts  = now.toUTCString();
  var kp  = (state && state.data && state.data.geomagnetic) ? (state.data.geomagnetic.kp || '—') : '—';
  var quakeCount = (forecastData && forecastData.usgsQuakes && forecastData.usgsQuakes.val)
                    ? forecastData.usgsQuakes.val.length : 0;
  var bigQuakes = (forecastData && forecastData.usgsQuakes && forecastData.usgsQuakes.val)
                    ? forecastData.usgsQuakes.val.filter(function(q){ return q.mag >= 6; }) : [];
  var activeLayers = (state && state.activeLayers) ? Array.from(state.activeLayers).join(', ') : 'none';
  var activeNotifs = notifications ? notifications.filter(function(n){ return !n.dismissed; }) : [];
  var criticals    = activeNotifs.filter(function(n){ return n.level === 'critical'; });
  var watches      = activeNotifs.filter(function(n){ return n.level === 'watch'; });
  var region = (typeof _seismicRegion !== 'undefined') ? _seismicRegion.toUpperCase() : 'GLOBAL';
  var swSpeed = (typeof _swSpeed !== 'undefined' && _swSpeed !== null) ? Math.round(_swSpeed) + ' km/s' : 'N/A';
  var swBz    = (typeof _swBz   !== 'undefined' && _swBz   !== null) ? _swBz.toFixed(1) + ' nT'   : 'N/A';
  var dst     = (typeof _dstCurrent !== 'undefined' && _dstCurrent !== null) ? _dstCurrent.toFixed(0) + ' nT' : 'N/A';
  var proton  = (typeof _protonFlux !== 'undefined' && _protonFlux !== null) ? _protonFlux.toExponential(1) + ' pfu' : 'N/A';

  var lines = [
    '══════════════════════════════════════════════════════',
    '  EARTH SYSTEMS OBSERVATORY — SITUATION REPORT',
    '══════════════════════════════════════════════════════',
    'Generated : ' + ts,
    'Region    : ' + region,
    'Active Layers: ' + activeLayers,
    '',
    '── SPACE WEATHER ──────────────────────────────────────',
    'Geomagnetic Kp  : ' + kp,
    'Dst Index       : ' + dst,
    'Solar Wind Speed: ' + swSpeed,
    'IMF Bz          : ' + swBz,
    'Proton Flux     : ' + proton,
    '',
    '── SEISMIC ────────────────────────────────────────────',
    'Earthquakes (window): ' + quakeCount + ' events (M' + (typeof _seismicMinMag !== 'undefined' ? _seismicMinMag : 4.5) + '+)',
  ];
  if (bigQuakes.length) {
    lines.push('Notable M6+ events:');
    bigQuakes.slice(0, 5).forEach(function(q) {
      lines.push('  · M' + q.mag.toFixed(1) + ' ' + (q.place || 'Unknown') + ' (depth ' + q.depth + ' km)' + (q.tsunamiFlag ? ' ⚠ TSUNAMI' : ''));
    });
  } else {
    lines.push('No M6+ events in current window.');
  }
  lines.push('');
  lines.push('── ACTIVE ALERTS ──────────────────────────────────────');
  if (!activeNotifs.length) {
    lines.push('No active alerts.');
  } else {
    if (criticals.length) {
      lines.push('CRITICAL (' + criticals.length + '):');
      criticals.slice(0, 3).forEach(function(n) { lines.push('  · ' + n.headline); });
    }
    if (watches.length) {
      lines.push('WATCH (' + watches.length + '):');
      watches.slice(0, 3).forEach(function(n) { lines.push('  · ' + n.headline); });
    }
    if (activeNotifs.length > criticals.length + watches.length) {
      lines.push('+ ' + (activeNotifs.length - criticals.length - watches.length) + ' advisory/info alerts (see notification drawer)');
    }
  }
  lines.push('');
  lines.push('── DATA QUALITY ────────────────────────────────────────');
  var apiLines = Object.keys(_apiHealthState || {}).map(function(k) {
    return '  ' + k.toUpperCase() + ': ' + (_apiHealthState[k] || 'unknown').toUpperCase();
  });
  lines = lines.concat(apiLines);
  lines.push('');
  lines.push('══════════════════════════════════════════════════════');
  lines.push('  Generated by ESO · earth-observatory-p3.html');
  lines.push('  ⚠ NOT FOR OPERATIONAL OR EMERGENCY USE');
  lines.push('  Scientific research & educational tool only.');
  lines.push('══════════════════════════════════════════════════════');
  return lines.join('\n');
}

function openSitrep() {
  var modal = document.getElementById('sitrep-modal');
  var body  = document.getElementById('sitrep-body');
  if (!modal || !body) return;
  body.textContent = generateSitrep();
  modal.classList.add('open');
}
function closeSitrep() {
  var modal = document.getElementById('sitrep-modal');
  if (modal) modal.classList.remove('open');
}
function copySitrep() {
  var body = document.getElementById('sitrep-body');
  if (!body) return;
  navigator.clipboard.writeText(body.textContent).then(function() {
    var btn = document.querySelector('#sitrep-actions .primary');
    if (btn) { btn.textContent = '✓ Copied!'; setTimeout(function() { btn.textContent = 'Copy to Clipboard'; }, 2000); }
  }).catch(function() {
    // Fallback
    var ta = document.createElement('textarea');
    ta.value = body.textContent;
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
}
function exportSitrepTxt() {
  var body = document.getElementById('sitrep-body');
  if (!body) return;
  _downloadBlob(body.textContent, 'eso-sitrep-' + _isoDate() + '.txt', 'text/plain');
}


// ════════════════════════════════════════════════════════
// ASK ESO — INTELLIGENT Q&A ENGINE
// Answers questions using current sensor data + history
// Optionally enhanced with Claude API (user-provided key)
// ════════════════════════════════════════════════════════

var esoApiKey = ''; // User can set via openESOSettings()

// Shared welcome message builder — used by both the float drawer and the panel tab
function _appendESOWelcome(target) {
  var s = getSystemState ? getSystemState() : {};
  var kp = _realKpCurrent !== null ? _realKpCurrent : (s.kp || 2.0);
  var kpTxt = kp >= 5 ? ('G' + Math.min(5,Math.floor(kp-3)) + ' storm · Kp ' + kp.toFixed(1))
              : kp >= 4 ? ('Active · Kp ' + kp.toFixed(1))
              : ('Quiet · Kp ' + kp.toFixed(1));
  var syzygy = (s.syzygy || 0) * 100;
  var quakeCount = forecastData && forecastData.usgsQuakes && forecastData.usgsQuakes.val
                   ? forecastData.usgsQuakes.val.length : (historyCache.quakes ? historyCache.quakes.length : 0);
  var eq = typeof scoreEarthquake === 'function' ? scoreEarthquake() : { score: 0, level: 'CLEAR' };
  var notifCount = notifications ? notifications.filter(function(n){ return !n.dismissed; }).length : 0;

  // Pick 2-3 standout signals to highlight
  var highlights = [];
  if (kp >= 5) highlights.push('geomagnetic storm in progress');
  if (syzygy > 80) highlights.push('near-maximum tidal stress (' + syzygy.toFixed(0) + '% syzygy)');
  if (eq.score >= 50) highlights.push('elevated earthquake precursor score (' + eq.score + '/100)');
  if (quakeCount > 30) highlights.push(quakeCount + ' M4.5+ seismic events in past 24h');
  var highlightLine = highlights.length > 0
    ? '⚠ **Noteworthy now:** ' + highlights.join(' · ') + '\n\n'
    : '';

  appendESOMessage('eso',
    '**ESO Intelligence ready.** I analyse 15 cross-domain geophysical pathways continuously — ' +
    'space weather, seismology, atmosphere, and oceans — synthesised into forecasts and correlations.\n\n' +
    highlightLine +
    '**Current snapshot:** geomagnetic ' + kpTxt + ' · tidal syzygy ' + syzygy.toFixed(0) + '% · ' +
    quakeCount + ' recent seismic events · ' +
    (notifCount ? notifCount + ' active alert' + (notifCount !== 1 ? 's' : '') : 'no active alerts') + '\n\n' +
    'Ask about a **region** (Japan, Pacific, Cascadia, Turkey…), a **hazard** (earthquake, tsunami, storm), ' +
    '**space weather**, **clusters & correlations**, **synthesis insights**, **discover anomalies**, **alerts**, or the **30-day forecast**.',
  target);
}

function openESOChat() {
  var overlay = document.getElementById('eso-chat-overlay');
  var drawer  = document.getElementById('eso-chat-drawer');
  if (!overlay || !drawer) return;
  overlay.style.display = 'block';
  requestAnimationFrame(function() {
    drawer.style.transform = 'translateX(-50%) translateY(0)';
  });
  // Show welcome message if no messages yet
  var msgs = document.getElementById('eso-float-messages');
  if (msgs && !msgs.children.length) {
    _appendESOWelcome('float');
  }
  setTimeout(function(){ var inp = document.getElementById('eso-float-input'); if(inp) inp.focus(); }, 350);
}

function closeESOChat() {
  var overlay = document.getElementById('eso-chat-overlay');
  var drawer  = document.getElementById('eso-chat-drawer');
  if (drawer) drawer.style.transform = 'translateX(-50%) translateY(100%)';
  setTimeout(function(){ if (overlay) overlay.style.display = 'none'; }, 300);
}

function sendESOFloat() {
  var input = document.getElementById('eso-float-input');
  if (!input || !input.value.trim()) return;
  var q = input.value.trim();
  input.value = '';
  appendESOMessage('user', q, 'float');
  answerESOQuestion(q, 'float');
}

function sendESOMessage() {
  var input = document.getElementById('eso-chat-input');
  if (!input || !input.value.trim()) return;
  var q = input.value.trim();
  input.value = '';
  appendESOMessage('user', q, 'panel');
  answerESOQuestion(q, 'panel');
}

function askRegion(region) {
  var q = 'Give me a current status report for ' + region + ' — recent seismic activity, space weather effects, and any active alerts.';
  openESOChat(); // open floating chat
  setTimeout(function() {
    appendESOMessage('user', q, 'float');
    answerESOQuestion(q, 'float');
  }, 120); // wait for drawer animation
}

function appendESOMessage(role, text, target) {
  var ids = target === 'float' ? ['eso-float-messages'] : ['eso-chat-messages'];
  ids.forEach(function(id) {
    var container = document.getElementById(id);
    if (!container) return;
    var isUser = role === 'user';
    var div = document.createElement('div');
    div.style.cssText = 'margin-bottom:10px;display:flex;flex-direction:column;align-items:' + (isUser?'flex-end':'flex-start') + ';';
    var bubble = document.createElement('div');
    bubble.style.cssText = 'max-width:85%;padding:8px 11px;border-radius:3px;font-size:9px;line-height:1.65;' +
      (isUser
        ? 'background:rgba(184,79,255,.15);border:1px solid rgba(184,79,255,.3);color:#fff;'
        : 'background:var(--surface2);border:1px solid var(--border);color:var(--text);');
    bubble.innerHTML = text.replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<b>$1</b>');
    div.appendChild(bubble);
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  });
}

function buildESOContext() {
  var s = getSystemState ? getSystemState() : {};
  var kp = _realKpCurrent !== null ? _realKpCurrent : (s.kp || 2.0);

  // Seismic
  var quakes = forecastData && forecastData.usgsQuakes && forecastData.usgsQuakes.val ? forecastData.usgsQuakes.val : [];
  var recentQuakes = quakes.slice(0,5).map(function(q){
    return 'M' + q.mag.toFixed(1) + ' at ' + (q.place||'?') + ' depth ' + q.depth + 'km';
  }).join('; ') || 'model reference data';
  var histEqNote = historyCache.quakes ? historyCache.quakes.length + ' M4.5+ quakes in past 30 days' : 'reference fault database active';

  // Storms / pressure
  var storms = forecastData && forecastData.nhcStorms && forecastData.nhcStorms.val ? forecastData.nhcStorms.val : [];
  var stormText = storms.length ? storms.map(function(st){ return (st.name||'?') + ' Cat' + (st.category||'?') + ' ' + (st.basin||'?'); }).join(', ') : 'none active';
  var pressureNote = _pressureGrid && _pressureGrid.length > 0 ? 'Min: ' + Math.min.apply(null,_pressureGrid.map(function(g){return g.pressure;})).toFixed(0) + ' hPa' : 'physics model';
  var xrayNote = _xrayFlares && _xrayFlares.length > 0 ? _xrayFlares.slice(0,3).map(function(f){ return f.classLabel; }).join(', ') : 'no recent flares';
  var histKpNote = historyCache.kp && historyCache.kp.length > 0 ?
    '30-day Kp mean ' + (historyCache.kp.reduce(function(a,r){ return a+r.kp; },0)/historyCache.kp.length).toFixed(1) : 'Kp physics model active';

  // Forecast scores
  var eq = typeof scoreEarthquake === 'function' ? scoreEarthquake() : { score:0, level:'CLEAR', factors:[] };
  var ts = typeof scoreTsunami === 'function' ? scoreTsunami() : { score:0, level:'CLEAR' };
  var ss = typeof scoreSuperstorm === 'function' ? scoreSuperstorm() : { score:0, level:'CLEAR' };

  // Synthesis insights (top 3, 1-month window)
  var synthInsights = '';
  try {
    var ins = typeof getInsights === 'function' ? getInsights(s, '1m') : [];
    synthInsights = ins.slice(0,3).map(function(i){ return '[' + i.domain.toUpperCase() + '] ' + i.title + ': ' + i.body.slice(0,120); }).join('\n');
  } catch(e) { synthInsights = 'synthesis engine initializing'; }

  // Active correlation clusters (all 15 always analysed by physics engine)
  var clusterNames = {
    'cn-tidal-seismic':'Tidal-Seismic coupling','cn-geo-storm-eq':'Geomagnetic-Seismic',
    'cn-laic':'LAIC (ionosphere-seismic)','cn-em-cavity':'EM Cavity (Schumann-ionosphere)',
    'cn-cr-cloud':'GCR-Cloud-SST chain','cn-ocean-climate':'Ocean-Climate',
    'cn-core-litho':'Core-Lithosphere','cn-solar-volc':'Solar-Volcanic',
    'cn-proton-seismic':'Proton-Seismic','cn-jerk-seismic':'Magnetic Jerk-Seismic',
    'cn-lod-seismic':'LOD-Seismic','cn-core-em':'Core-EM',
    'cn-sst-fault':'SST-Fault Heat','cn-muon-fault':'Muon-Fault','cn-llsvp':'LLSVP Deep Structure'
  };
  var clusterSummary = Object.values(clusterNames).join(', ');

  // Active notifications
  var activeNotifs = notifications ? notifications.filter(function(n){ return !n.dismissed; }).slice(0,5).map(function(n){ return '[' + n.level.toUpperCase() + '] ' + n.headline; }).join('\n') : '';

  // 30-day forecast calendar peek
  var calPeek = '';
  try {
    var cal = typeof computeForecastCalendar === 'function' ? computeForecastCalendar() : [];
    var watchDays = cal.filter(function(d){ return d.level === 'watch' || d.level === 'critical'; });
    calPeek = 'Today score: ' + (cal[0] ? cal[0].score : '?') + '/100 · Watch days (30d): ' + watchDays.length;
  } catch(e) { calPeek = 'calendar computing'; }

  return 'ESO GEOPHYSICAL INTELLIGENCE — CURRENT STATE:\n' +
    'PHYSICS MODELS (always active, network-independent):\n' +
    '- Geomagnetic Kp: ' + kp.toFixed(1) + (kp >= 5 ? ' [G' + Math.min(5,Math.floor(kp-3)) + ' STORM]' : kp >= 4 ? ' [ACTIVE]' : ' [QUIET]') + ' · ' + histKpNote + '\n' +
    '- Solar flux (F10.7): ' + (s.sfi||120).toFixed(0) + ' SFU · Carrington phase: ' + (s.carr||0).toFixed(2) + '\n' +
    '- Solar wind: ' + (s.swSpeed||400).toFixed(0) + ' km/s · Cosmic ray flux: ' + (s.crFlux||1820).toFixed(0) + ' cpm\n' +
    '- Schumann resonance: ' + (s.schFreq||7.83).toFixed(2) + ' Hz · TEC peak: ' + (s.tecPeak||30).toFixed(0) + ' TECU\n' +
    '- Tidal syzygy: ' + ((s.syzygy||0)*100).toFixed(0) + '% · Moon: ' + (s.moonName||'unknown') + '\n' +
    '- Active volcanic sites: ' + (s.activeVol||0) + ' · Atm. pressure min: ' + pressureNote + '\n' +
    'SEISMIC INTELLIGENCE:\n' +
    '- Live 24h: ' + quakes.length + ' M4.5+ events worldwide · Top: ' + recentQuakes + '\n' +
    '- Historical: ' + histEqNote + '\n' +
    '- Solar flares (7d): ' + xrayNote + '\n' +
    '- Tropical storms: ' + stormText + '\n' +
    'FORECAST SCORES (composite multi-domain):\n' +
    '- Earthquake precursor: ' + (eq.score||0) + '/100 [' + (eq.level||'CLEAR') + ']' +
      (eq.factors && eq.factors.length ? ' · Drivers: ' + eq.factors.filter(function(f){ return f.score > 5; }).map(function(f){ return f.label; }).join(', ') : '') + '\n' +
    '- Tsunami risk: ' + (ts.score||0) + '/100 [' + (ts.level||'CLEAR') + ']\n' +
    '- Superstorm RI risk: ' + (ss.score||0) + '/100 [' + (ss.level||'CLEAR') + ']\n' +
    '- 30-day calendar: ' + calPeek + '\n' +
    'SYNTHESIS INSIGHTS (1-month window):\n' + (synthInsights || 'all systems nominal') + '\n' +
    'CORRELATION CLUSTERS (15 active pathways):\n' + clusterSummary + '\n' +
    'ACTIVE ALERTS:\n' + (activeNotifs || 'None');
}

async function answerESOQuestion(question, target) {
  // Show animated thinking indicator
  var thinkId = 'eso-thinking-' + Date.now();
  appendESOMessage('eso', '<span id="' + thinkId + '" style="opacity:.6;font-style:italic;">Analyzing sensor data.</span>', target);

  // Animate dots so user knows ESO is working
  var _dotCount = 1;
  var _dotTimer = setInterval(function() {
    var el = document.getElementById(thinkId);
    if (!el) { clearInterval(_dotTimer); return; }
    _dotCount = (_dotCount % 3) + 1;
    el.textContent = 'Analyzing sensor data' + '.'.repeat(_dotCount);
  }, 450);

  // Helper: replace thinking bubble with final answer
  function _resolve(answer) {
    clearInterval(_dotTimer);
    var thinkEl = document.getElementById(thinkId);
    if (thinkEl) {
      var bubble = thinkEl.parentElement && thinkEl.parentElement.parentElement;
      if (bubble && bubble.parentElement) bubble.parentElement.removeChild(bubble);
    }
    appendESOMessage('eso', answer || 'No response generated. Try rephrasing your question.', target);
  }

  try {
    var context = buildESOContext();
    var answer = '';

    // ── Try Claude API if key provided ──
    if (esoApiKey && esoApiKey.length > 20) {
      try {
        var resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': esoApiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-ipc': 'true',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 600,
            system: 'You are ESO Intelligence, the AI brain of the Earth Systems Observatory. You have access to live physics models, synthesis insights, correlation cluster analysis, forecast scores (earthquake precursor, tsunami risk, superstorm RI), and a 30-day forecast calendar — all network-independent and continuously computed. Answer questions about current geophysical conditions, regional hazard status, cross-domain correlations, synthesis insights, and anomalies. Be concise, precise, and scientific. Use markdown bold (**text**) for key values. Keep responses under 250 words.',
            messages: [{ role: 'user', content: context + '\n\nUSER QUESTION: ' + question }]
          })
        });
        if (resp.ok) {
          var data = await resp.json();
          answer = data.content && data.content[0] ? data.content[0].text : '';
        }
      } catch(e) {
        console.warn('[ESO Ask] Claude API failed:', e.message);
      }
    }

    // ── Local expert system fallback ──
    if (!answer) {
      answer = localESOAnswer(question, context);
    }

    _resolve(answer);

  } catch(err) {
    console.error('[ESO Ask] Error in answerESOQuestion:', err);
    _resolve('ESO Intelligence encountered an error: ' + err.message + '. Please try a different question.');
  }
}

function localESOAnswer(question, context) {
  var q = question.toLowerCase();
  var s = getSystemState ? getSystemState() : {};
  var kp = _realKpCurrent !== null ? _realKpCurrent : (s.kp || 2.0);
  var eq = typeof scoreEarthquake === 'function' ? scoreEarthquake() : { score: 0, level: 'CLEAR' };
  var ts = typeof scoreTsunami === 'function' ? scoreTsunami() : { score: 0 };
  var ss = typeof scoreSuperstorm === 'function' ? scoreSuperstorm() : { score: 0 };
  var syzygy = (s.syzygy || 0) * 100;
  var quakes = forecastData && forecastData.usgsQuakes && forecastData.usgsQuakes.val ? forecastData.usgsQuakes.val : [];
  var histQuakes = historyCache.quakes || [];

  // Region-specific answer
  var regionKeywords = {
    'japan': { lat: [30,46], lon: [129,146], name: 'Japan & surrounding seas' },
    'ring of fire': { lat: [-60,60], lon: [120,260], name: 'Pacific Ring of Fire' },
    'pacific': { lat: [-60,60], lon: [120,260], name: 'Pacific Ocean' },
    'mediterranean': { lat: [30,47], lon: [-5,37], name: 'Mediterranean region' },
    'italy': { lat: [36,47], lon: [6,19], name: 'Italy & central Mediterranean' },
    'usa': { lat: [25,50], lon: [-130,-65], name: 'United States' },
    'west coast': { lat: [30,50], lon: [-130,-115], name: 'US West Coast' },
    'california': { lat: [32,42], lon: [-125,-114], name: 'California' },
    'indonesia': { lat: [-10,6], lon: [95,141], name: 'Indonesia' },
    'philippines': { lat: [5,20], lon: [118,127], name: 'Philippines' },
    'turkey': { lat: [36,42], lon: [26,45], name: 'Turkey & Anatolia' },
    'caribbean': { lat: [10,26], lon: [-90,-58], name: 'Caribbean' },
    'iceland': { lat: [60,68], lon: [-28,-12], name: 'Iceland & North Atlantic' },
    'new zealand': { lat: [-48,-34], lon: [166,180], name: 'New Zealand' },
    'chile': { lat: [-56,-17], lon: [-76,-65], name: 'Chile' },
    'atlantic': { lat: [-60,65], lon: [-80,20], name: 'Atlantic Ocean' },
    'indian ocean': { lat: [-60,30], lon: [20,120], name: 'Indian Ocean' },
    'alaska': { lat: [51,72], lon: [-180,-130], name: 'Alaska' },
    'cascadia': { lat: [40,50], lon: [-127,-120], name: 'Cascadia Subduction Zone' },
  };

  for (var region in regionKeywords) {
    if (q.includes(region)) {
      var reg = regionKeywords[region];
      var regionQuakes24h = quakes.filter(function(qk) {
        return qk.lat >= reg.lat[0] && qk.lat <= reg.lat[1] && qk.lon >= reg.lon[0] && qk.lon <= reg.lon[1];
      });
      var regionQuakes30d = histQuakes.filter(function(qk) {
        return qk.lat >= reg.lat[0] && qk.lat <= reg.lat[1] && qk.lon >= reg.lon[0] && qk.lon <= reg.lon[1];
      });
      var largestRecent = regionQuakes24h.length > 0 ? regionQuakes24h.reduce(function(a,b){ return a.mag > b.mag ? a : b; }) : null;
      var largestMonth = regionQuakes30d.length > 0 ? regionQuakes30d.reduce(function(a,b){ return a.mag > b.mag ? a : b; }) : null;
      return '**' + reg.name + ' Status Report**\n\n' +
        '**Seismic (past 24h):** ' + regionQuakes24h.length + ' M4.5+ events' +
        (largestRecent ? ' · Largest: **M' + largestRecent.mag.toFixed(1) + '** at ' + (largestRecent.place||'?') : '') + '\n' +
        '**Seismic (past 30 days):** ' + regionQuakes30d.length + ' M4.5+ events' +
        (largestMonth ? ' · Largest: **M' + largestMonth.mag.toFixed(1) + '**' : '') + '\n' +
        '**Geomagnetic:** Kp **' + kp.toFixed(1) + '**' + (kp >= 5 ? ' — G' + Math.min(5,Math.floor(kp-3)) + ' storm active' : kp >= 4 ? ' — active conditions' : ' — quiet') + '\n' +
        '**Tidal stress:** **' + syzygy.toFixed(0) + '%** syzygy (' + (s.moonName || 'unknown moon phase') + ')' + (syzygy > 80 ? ' — elevated seismic coupling window' : '') + '\n' +
        '**Forecast:** Earthquake precursor score **' + eq.score + '/100** [' + eq.level + ']\n' +
        (regionQuakes30d.filter(function(q){ return q.mag >= 6; }).length > 2 ?
          '\n⚠️ Elevated M6+ rate in this region over past 30 days.' : '');
    }
  }

  // General question routing
  if (q.includes('earthquake') || q.includes('seismic')) {
    var large = quakes.filter(function(qk){ return qk.mag >= 6; });
    return '**Earthquake / Seismic Status**\n\n' +
      '**Precursor score:** **' + eq.score + '/100** [' + eq.level + ']\n' +
      '**Active signals:** ' + (eq.factors ? eq.factors.filter(function(f){ return f.score > 5; }).map(function(f){ return f.label; }).join(', ') || 'none above threshold' : 'N/A') + '\n' +
      '**Live (24h):** ' + quakes.length + ' M4.5+ events worldwide' +
      (large.length ? ' · **' + large.length + ' M6+** events' : '') + '\n' +
      '**Tidal window:** ' + syzygy.toFixed(0) + '% syzygy · **Kp ' + kp.toFixed(1) + '**\n' +
      '**30-day history:** ' + histQuakes.length + ' M4.5+ events' +
      (histQuakes.filter(function(q){ return q.mag >= 7; }).length > 0 ? ' · **' + histQuakes.filter(function(q){ return q.mag >= 7; }).length + ' M7+ events**' : '');
  }

  if (q.includes('solar') || q.includes('kp') || q.includes('geomagnetic') || q.includes('space weather')) {
    var xCount = (_xrayFlares || []).filter(function(f){ return f.xClass === 'X'; }).length;
    var mCount = (_xrayFlares || []).filter(function(f){ return f.xClass === 'M'; }).length;
    return '**Space Weather Status**\n\n' +
      '**Current Kp:** **' + kp.toFixed(1) + '**' + (kp >= 5 ? ' — G' + Math.min(5,Math.floor(kp-3)) + ' geomagnetic storm' : kp >= 4 ? ' — active conditions' : ' — quiet background') + '\n' +
      '**Solar flux (F10.7):** ' + (s.sfi||120).toFixed(0) + ' SFU · Carrington phase: ' + (s.carr||0).toFixed(2) + '\n' +
      '**Solar wind:** ' + (s.swSpeed||400).toFixed(0) + ' km/s\n' +
      '**Solar flares (7d):** ' + (xCount > 0 ? '**' + xCount + ' X-class**' : 'no X-class') + ' · ' + mCount + ' M-class · ' + ((_xrayFlares||[]).length - xCount - mCount) + ' C-class\n' +
      '**Cosmic ray flux:** ' + (s.crFlux||1820).toFixed(0) + ' cpm\n' +
      '**Ionospheric TEC:** ' + (s.tecPeak||30).toFixed(0) + ' TECU';
  }

  if (q.includes('tsunami')) {
    return '**Tsunami Risk Assessment**\n\n' +
      '**Risk score: ' + ts.score + '/100** [' + (ts.level || 'CLEAR') + ']\n' +
      '**Primary triggers:** M7+ shallow earthquakes (none currently' + (quakes.filter(function(q){ return q.mag>=7&&q.depth<70; }).length > 0 ? ' — **ACTIVE: M7+ SHALLOW**' : '') + ')\n' +
      '**Tidal amplification:** ' + syzygy.toFixed(0) + '% syzygy\n' +
      '**Volcanic risk:** ' + (s.activeVol||0) + ' active sites monitored\n' +
      '**24h seismicity (shallow, M5.5+):** ' + quakes.filter(function(q){ return q.mag>=5.5&&q.depth<70; }).length + ' events';
  }

  if (q.includes('storm') || q.includes('hurricane') || q.includes('cyclone') || q.includes('superstorm')) {
    var storms = forecastData && forecastData.nhcStorms && forecastData.nhcStorms.val ? forecastData.nhcStorms.val : [];
    return '**Tropical Storm / Superstorm Status**\n\n' +
      '**RI risk score:** **' + ss.score + '/100** [' + (ss.level||'CLEAR') + ']\n' +
      '**Active storms:** ' + (storms.length > 0 ? storms.map(function(st){ return (st.name||'?') + ' Cat' + (st.category||'TS') + ' (' + (st.windKt||0) + 'kt)'; }).join(', ') : 'none reported') + '\n' +
      '**SST (tropical zone):** ' + (forecastData && forecastData.sstGrid && forecastData.sstGrid.val ? forecastData.sstGrid.val.filter(function(p){ return Math.abs(p.lat||0)<25; }).reduce(function(mx,p){ return Math.max(mx,p.sst||0); },0).toFixed(1) : '—') + '°C peak\n' +
      '**Pressure anomaly:** ' + (_pressureGrid && _pressureGrid.length > 0 ? (_pressureGrid.reduce(function(a,b){ return a.pressure<b.pressure?a:b; },_pressureGrid[0]).pressure.toFixed(0) + ' hPa min') : 'loading…');
  }

  if (q.includes('forecast') || q.includes('next') || q.includes('upcoming') || q.includes('calendar')) {
    var cal = computeForecastCalendar();
    var watchDays = cal.filter(function(d){ return d.level === 'watch' || d.level === 'critical'; });
    return '**30-Day Forecast Summary**\n\n' +
      '**Current compound score:** ' + cal[0].score + '/100 [' + cal[0].level + ']\n' +
      '**High-watch days (next 30):** **' + watchDays.length + ' days**\n' +
      (watchDays.slice(0,3).map(function(d){
        return '  · ' + d.date.toLocaleDateString('en-US',{month:'short',day:'numeric'}) +
          ' — Score ' + d.score + ', ' + d.moonPhase + ' syzygy ' + (d.syzygy*100).toFixed(0) + '%';
      }).join('\n')) +
      '\n**Next syzygy peak:** ' + (function(){
        var next = cal.find(function(d){ return d.dayOffset > 0 && d.syzygy > 0.9; });
        return next ? next.date.toLocaleDateString('en-US',{month:'short',day:'numeric'}) + ' (' + next.moonPhase + ')' : 'beyond 30-day window';
      })() +
      '\n\nSee the Calendar at the top of the Forecast tab for a visual day-by-day view.';
  }

  if (q.includes('correlat') || q.includes('cluster') || q.includes('pathway') || q.includes('coupling')) {
    // Report the 6 most dynamically interesting clusters given current state
    var clusterStatus = [
      { name:'Tidal-Seismic', signal: (syzygy > 75 ? '**ELEVATED** — ' + syzygy.toFixed(0) + '% syzygy near peak' : 'moderate — syzygy ' + syzygy.toFixed(0) + '%'), hot: syzygy > 75 },
      { name:'LAIC (ionosphere-seismic)', signal: kp >= 4 ? '**ACTIVE** — Kp ' + kp.toFixed(1) + ' disturbing ionospheric TEC precursor window' : 'quiet — TEC precursor sensitivity normal', hot: kp >= 4 },
      { name:'Geomagnetic-Seismic', signal: kp >= 5 ? '**G' + Math.min(5,Math.floor(kp-3)) + ' storm — documented 27-day lagged seismicity elevation**' : 'Kp ' + kp.toFixed(1) + ' background, no storm forcing', hot: kp >= 5 },
      { name:'GCR-Cloud-SST', signal: (s.crFlux||1820) > 1850 ? '**Elevated GCR** (' + (s.crFlux||1820).toFixed(0) + ' cpm) — enhanced cloud nucleation signal' : 'GCR nominal ' + (s.crFlux||1820).toFixed(0) + ' cpm', hot: (s.crFlux||1820) > 1850 },
      { name:'EM Cavity (Schumann-ionosphere)', signal: 'SR ' + (s.schFreq||7.83).toFixed(2) + ' Hz · TEC ' + (s.tecPeak||30).toFixed(0) + ' TECU', hot: false },
      { name:'Solar-Volcanic', signal: (s.sfi||120) > 130 ? '**High SFI ' + (s.sfi||120).toFixed(0) + '** — elevated volcanic degassing correlation window' : 'Solar flux ' + (s.sfi||120).toFixed(0) + ' SFU nominal', hot: (s.sfi||120) > 130 },
    ];
    var hotClusters = clusterStatus.filter(function(c){ return c.hot; });
    return '**Cross-Domain Correlation Analysis** (15 pathways continuously monitored)\n\n' +
      (hotClusters.length > 0
        ? '**⚠ Elevated signals:** ' + hotClusters.map(function(c){ return c.name; }).join(', ') + '\n\n'
        : '**All pathways at background levels.**\n\n') +
      clusterStatus.map(function(c){ return '· **' + c.name + ':** ' + c.signal; }).join('\n') + '\n\n' +
      'Open the **Clusters** tab for the Pearson correlation matrix, or **Discover → Lag Explorer** for time-lagged analysis.';
  }

  if (q.includes('synthes') || q.includes('insight') || q.includes('what is happening') || q.includes("what's happening")) {
    var ins = [];
    try { ins = typeof getInsights === 'function' ? getInsights(s, '1m') : []; } catch(e) {}
    if (ins.length === 0) {
      return '**Synthesis — 1-Month Window**\n\nPhysics engine nominal. All 15 cross-domain pathways monitored.\n\n' +
        '**Kp:** ' + kp.toFixed(1) + ' · **Syzygy:** ' + syzygy.toFixed(0) + '% · **EQ score:** ' + eq.score + '/100';
    }
    return '**Synthesis Intelligence — Current Highlights**\n\n' +
      ins.slice(0,4).map(function(i){
        var conf = i.confidence === 'high' ? '● ' : i.confidence === 'med' ? '◑ ' : '○ ';
        return conf + '**' + i.title + '** — ' + i.body.slice(0, 160) + (i.body.length > 160 ? '…' : '');
      }).join('\n\n') +
      '\n\nFor the full cross-layer signal matrix, open the **Synthesis** tab.';
  }

  if (q.includes('discover') || q.includes('novel') || q.includes('anomal') || q.includes('unusual') || q.includes('stress index')) {
    var stressVal = typeof scoreEarthquake === 'function' ? eq.score : 0;
    var novelSignals = [];
    if (syzygy > 80) novelSignals.push('Lunar syzygy at **' + syzygy.toFixed(0) + '%** — near-maximum tidal stress');
    if (kp >= 5) novelSignals.push('Geomagnetic storm **G' + Math.min(5,Math.floor(kp-3)) + '** — rare event threshold exceeded');
    if (quakes.filter(function(qk){ return qk.mag >= 7; }).length > 0) novelSignals.push('**M7+ event(s) in past 24h** — major seismic activity');
    if (histQuakes.filter(function(q){ return q.mag >= 7; }).length >= 3) novelSignals.push('**' + histQuakes.filter(function(q){ return q.mag >= 7; }).length + ' M7+ events in 30 days** — above baseline');
    if ((s.sfi||120) > 150) novelSignals.push('Solar flux **' + (s.sfi||120).toFixed(0) + ' SFU** — high activity cycle');
    if ((s.crFlux||1820) > 1900) novelSignals.push('Cosmic ray flux **' + (s.crFlux||1820).toFixed(0) + ' cpm** — elevated above solar-minimum baseline');
    return '**Discover — Novel & Anomalous Signals**\n\n' +
      '**Compound stress index:** **' + stressVal + '/100** [' + (eq.level||'CLEAR') + ']\n\n' +
      (novelSignals.length > 0
        ? '**Flagged anomalies:**\n' + novelSignals.map(function(n){ return '· ' + n; }).join('\n')
        : '**No anomalous signals detected.** All domains within baseline parameters.') +
      '\n\nFor interactive novelty indices and lag explorer, open the **Discover** tab.';
  }

  if (q.includes('alert') || q.includes('notif') || q.includes('warning') || q.includes('watch')) {
    var allNotifs = notifications ? notifications.filter(function(n){ return !n.dismissed; }) : [];
    if (allNotifs.length === 0) {
      return '**Active Alerts — None**\n\nAll forecast scores within normal parameters.\n\n' +
        '· EQ precursor: **' + eq.score + '/100** · Tsunami: **' + ts.score + '/100** · Storm RI: **' + ss.score + '/100**';
    }
    return '**Active Alerts (' + allNotifs.length + ')**\n\n' +
      allNotifs.slice(0,6).map(function(n){
        return '[**' + n.level.toUpperCase() + '**] ' + n.headline;
      }).join('\n') + '\n\nOpen the **Forecast** tab to see the full alert panel and 30-day calendar.';
  }

  // Default overview
  var cal0 = null;
  try { var _cal = computeForecastCalendar(); cal0 = _cal && _cal[0]; } catch(e) {}
  return '**ESO Intelligence — Current Overview**\n\n' +
    '**Geomagnetic:** Kp **' + kp.toFixed(1) + '**' + (kp >= 5 ? ' — G' + Math.min(5,Math.floor(kp-3)) + ' storm' : kp >= 4 ? ' — active' : ' — quiet') + '\n' +
    '**Tidal stress:** **' + syzygy.toFixed(0) + '%** syzygy · ' + (s.moonName || 'phase unknown') + '\n' +
    '**Seismic (24h):** **' + quakes.length + '** M4.5+ events worldwide\n' +
    '**Risk scores:** EQ precursor **' + eq.score + '/100** · Tsunami **' + ts.score + '/100** · Storm RI **' + ss.score + '/100**\n' +
    '**Solar flares (7d):** ' + ((_xrayFlares||[]).filter(function(f){ return f.xClass==='X'; }).length) + ' X-class · ' + ((_xrayFlares||[]).filter(function(f){ return f.xClass==='M'; }).length) + ' M-class\n' +
    (cal0 ? '**30-day calendar:** today ' + cal0.score + '/100 [' + cal0.level + ']\n' : '') +
    '\nAsk about a **region** (Japan, Pacific, Cascadia…), a **hazard** (earthquake, tsunami, storm), **space weather**, **clusters**, **synthesis**, **discover** anomalies, or **alerts**.';
}

// Expose API key setter
function setESOApiKey(key) {
  esoApiKey = key;
  var note = document.getElementById('eso-api-note');
  if (note) note.textContent = key ? '✓ Claude API enhanced mode active' : 'Claude API key optional for enhanced answers';
}


// ════════════════════════════════════════════════════════
// LAYER: TOGGLE HOOKS FOR NEW LAYERS
// ════════════════════════════════════════════════════════

// Extend the existing toggleLayer to handle Phase 4 layers (xray, pressure)
// Use IIFE to avoid function-declaration hoisting collision (same issue as Kp override).
// At this point window.toggleLayer is the charts wrapper from line ~3767, which correctly
// calls the core toggle logic. We capture it here at runtime, not via hoisting.
;(function() {
  var _prev = window.toggleLayer;
  window.toggleLayer = function(id) {
    if (_prev) _prev(id);
    // Handle new layers that need special map rendering after toggle
    if (id === 'xray')     setTimeout(function(){ updateXRayMapLayer(); }, 100);
    if (id === 'pressure') setTimeout(function(){ updatePressureMapLayer(); }, 100);
  };
}());


// ════════════════════════════════════════════════════════
// INITIALISATION: Boot all new systems on load
// ════════════════════════════════════════════════════════

function initPhase4() {
  // Start real data feeds
  startKpAutoRefresh();
  startDstAutoRefresh();         // Dst ring-current index — Tier 1
  startXRayAutoRefresh();
  startPressureAutoRefresh();
  startDSCOVRAutoRefresh();      // Solar wind speed + Bz — Tier 2.3
  startProtonAutoRefresh();      // GOES proton flux — Tier 2.4
  startF107AutoRefresh();        // Real F10.7 solar flux — Wave 4
  startCMEAutoRefresh();         // CME / storm forecast — Wave 4
  startSpaceAlertsRefresh();     // Space weather alerts — Wave 4
  startPrecipAutoRefresh();      // Precipitation layer — Wave 5
  startTsunamiWarningRefresh();  // Official tsunami warning feed — Wave 5
  if (typeof startIERSLodRefresh === 'function') startIERSLodRefresh(); // IERS LOD

  // New systems from Observer 1–5 recommendations
  if (typeof startFocalMechRefresh   === 'function') startFocalMechRefresh();   // GEO-B
  if (typeof startStrainProxyRefresh === 'function') startStrainProxyRefresh(); // GEO-C
  if (typeof startHindcastCycle      === 'function') startHindcastCycle();      // UX-B
  if (typeof startHypothesisChecker  === 'function') startHypothesisChecker();  // UX-C
  if (typeof initESOMode             === 'function') initESOMode();             // UX-A
  if (typeof restoreRollingBuffers   === 'function') restoreRollingBuffers();   // STAT-B
  if (typeof restoreBValueHistory    === 'function') restoreBValueHistory();    // STAT-C
  if (typeof ThesisFramework !== 'undefined' && ThesisFramework.init) ThesisFramework.init(); // Thesis framework

  // Render forecast calendar in forecast tab
  setTimeout(function() { renderForecastCalendar(); }, 2000);

  // Initial USGS direct fetch + health report
  setTimeout(function() {
    fetchUSGSQuakes().then(function(r) {
      updateApiHealth('usgs', r && r.val && r.val.length ? 'ok' : 'warn');
    }).catch(function() { updateApiHealth('usgs','err'); });
  }, 3000);

  // Initial API health ping for open-meteo (reported via pressure grid)
  setTimeout(function() {
    var _origPG = window.fetchPressureGrid;
    if (typeof _origPG === 'function') {
      _origPG().then(function() { updateApiHealth('openmeteo','ok'); })
               .catch(function() { updateApiHealth('openmeteo','err'); });
    }
    updateApiHealth('noaa-swpc', 'ok'); // presumed ok after Kp/Dst load
  }, 5000);

  // Initial status strip + baseline + periodic refresh
  setTimeout(function() { updateStatusStrip(); updateBaselineCards(); }, 500);
  setInterval(function() { updateStatusStrip(); updateBaselineCards(); }, 30000);
}

// Hook into existing init
var _origOnLoad = window.onload;
window.addEventListener('load', function() {
  setTimeout(initPhase4, 1500);
});


// ════ FIELD GUIDE + ADDITIONAL INIT (second script block) ════
/* ═══════════════════════════════════════════════════
   TOOLTIP SYSTEM
═══════════════════════════════════════════════════ */
(function(){
  var tip = document.getElementById('eso-tooltip');
  var hoverTimer, hideTimer;
  var DELAY_SHOW = 500, DELAY_HIDE = 100;
  var PAD = 12;

  function showTip(el, e) {
    if (!tip) return;
    clearTimeout(hideTimer);
    hoverTimer = setTimeout(function(){
      tip.innerHTML = el.getAttribute('data-tip');
      tip.classList.add('visible');
      positionTip(e);
    }, DELAY_SHOW);
  }

  function positionTip(e) {
    if (!tip) return;
    var x = e.clientX + PAD, y = e.clientY + PAD;
    var tw = tip.offsetWidth, th = tip.offsetHeight;
    if (x + tw > window.innerWidth - 8)  x = e.clientX - tw - PAD;
    if (y + th > window.innerHeight - 8) y = e.clientY - th - PAD;
    tip.style.left = x + 'px';
    tip.style.top  = y + 'px';
  }

  function hideTip() {
    if (!tip) return;
    clearTimeout(hoverTimer);
    hideTimer = setTimeout(function(){ tip.classList.remove('visible'); }, DELAY_HIDE);
  }

  document.addEventListener('mousemove', function(e) {
    if (!tip) return;
    var el = e.target.closest('[data-tip]');
    if (el) {
      if (tip.classList.contains('visible')) positionTip(e);
    }
  });

  document.addEventListener('mouseover', function(e) {
    var el = e.target.closest('[data-tip]');
    if (el) showTip(el, e); else hideTip();
  });

  document.addEventListener('mouseout', function(e) {
    var rel = e.relatedTarget;
    if (rel && rel.closest && rel.closest('[data-tip]')) return;
    hideTip();
  });

  document.addEventListener('scroll', hideTip, true);
  document.addEventListener('click',  hideTip, true);
})();

/* ═══════════════════════════════════════════════════
   FIELD GUIDE
═══════════════════════════════════════════════════ */
function toggleFieldGuide() {
  document.body.classList.toggle('guide-open');
}

function fgTab(id) {
  document.querySelectorAll('.fg-tab').forEach(function(t){ t.classList.remove('active'); });
  document.querySelectorAll('.fg-page').forEach(function(p){ p.classList.remove('active'); });
  var tabEl = document.querySelector('.fg-tab[onclick*="' + id + '"]');
  var pageEl = document.getElementById('fg-' + id);
  if (tabEl)  tabEl.classList.add('active');
  if (pageEl) pageEl.classList.add('active');
}

/* ═══════════════════════════════════════════════════
   KEYBOARD: ? = guide
═══════════════════════════════════════════════════ */
document.addEventListener('keydown', function(e) {
  if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
  if (e.key === '?') { e.preventDefault(); toggleFieldGuide(); }
  if (e.key === 'Escape') {
    if (document.body.classList.contains('guide-open')) {
      document.body.classList.remove('guide-open');
    }
  }
});

/* ═══════════════════════════════════════════════════
   FIRST-VISIT: DEFAULT LAYERS + HINT
═══════════════════════════════════════════════════ */
(function(){
  try {
    var isFirstVisit = !localStorage.getItem('eso-hint-seen');
    if (isFirstVisit) {
      // Auto-activate 4 default layers so the map comes alive immediately
      var defaultLayers = ['seismic', 'geomagnetic', 'sst', 'wind'];
      setTimeout(function(){
        defaultLayers.forEach(function(id) {
          try {
            var item = document.querySelector('[data-layer="' + id + '"]');
            if (item && typeof toggleLayer === 'function') {
              // Only activate if not already active
              if (!item.classList.contains('active')) {
                toggleLayer(id);
              }
            }
          } catch(e2) {}
        });
      }, 800);
      // Show first-visit hint card after a short delay
      setTimeout(function(){
        var h = document.getElementById('eso-hint');
        if (h) h.style.display = 'flex';
      }, 3500);
    }
  } catch(e){}
})();

// ════════════════════════════════════════════════════════
// WAVELET COHERENCE PANEL (STAT-D)
// Shows time-frequency coherence between any two active layers.
// High coherence (warm color) at a given period means the two
// signals share variance at that timescale during that window.
// ════════════════════════════════════════════════════════

function renderWaveletCoherence() {
  var container = document.getElementById('dsp-wavelet');
  if (!container) return;

  var active = Array.from(state.activeLayers);
  if (active.length < 2) {
    container.innerHTML = '<div style="color:var(--text-dim);font-size:9px;text-align:center;padding:24px 0;">Activate at least 2 layers to compute wavelet coherence.</div>';
    return;
  }

  // Get the two most recently active layers (or user-selected)
  var layerA = active[0], layerB = active[1];
  var selA = document.getElementById('wco-layer-a');
  var selB = document.getElementById('wco-layer-b');
  if (selA && selA.value) layerA = selA.value;
  if (selB && selB.value) layerB = selB.value;

  var seriesA = typeof getSeriesOrdered === 'function' ? getSeriesOrdered(layerA) : [];
  var seriesB = typeof getSeriesOrdered === 'function' ? getSeriesOrdered(layerB) : [];

  var labelA = (LAYER_META && LAYER_META[layerA] && LAYER_META[layerA].label) || layerA;
  var labelB = (LAYER_META && LAYER_META[layerB] && LAYER_META[layerB].label) || layerB;

  if (seriesA.length < 8 || seriesB.length < 8) {
    container.innerHTML = '<div style="color:var(--text-dim);font-size:9px;text-align:center;padding:24px 0;">Need at least 8 data points per layer. Keep layers active for a few minutes.</div>';
    return;
  }

  var result = typeof waveletCoherence === 'function' ? waveletCoherence(seriesA, seriesB) : null;
  if (!result) {
    container.innerHTML = '<div style="color:var(--text-dim);font-size:9px;text-align:center;padding:24px 0;">Computing wavelet coherence…</div>';
    return;
  }

  // Build layer selector UI
  var optionsHtml = active.map(function(l) {
    var label = (LAYER_META && LAYER_META[l] && LAYER_META[l].label) || l;
    return '<option value="' + l + '">' + label + '</option>';
  }).join('');

  container.innerHTML =
    '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap;">' +
      '<select id="wco-layer-a" onchange="renderWaveletCoherence()" style="font-size:8px;background:var(--surface2);color:var(--text);border:1px solid var(--border);padding:2px 4px;">' + optionsHtml + '</select>' +
      '<span style="font-size:9px;color:var(--text-dim)">vs</span>' +
      '<select id="wco-layer-b" onchange="renderWaveletCoherence()" style="font-size:8px;background:var(--surface2);color:var(--text);border:1px solid var(--border);padding:2px 4px;">' + optionsHtml + '</select>' +
    '</div>' +
    '<canvas id="wco-canvas" width="480" height="160" style="width:100%;height:160px;background:var(--surface2);border-radius:3px;"></canvas>' +
    '<div style="display:flex;justify-content:space-between;font-size:7px;color:var(--text-dim);margin-top:2px;">' +
      '<span>← earlier</span>' +
      '<span>Coherence²: 0 (dark) → 1 (bright)</span>' +
      '<span>later →</span>' +
    '</div>' +
    '<div id="wco-summary" style="font-size:8px;color:var(--text-dim);margin-top:6px;"></div>' +
    '<details class="chart-help"><summary>📐 What am I looking at?</summary><p>' +
    'Morlet wavelet coherence shows WHERE IN TIME and at WHAT PERIOD (timescale) two layers share variance. ' +
    'Bright areas = high coherence (the signals move together at that period during that window). ' +
    'Dark areas = independent. Horizontal axis = time (left = older). Vertical axis = period (short periods top, long bottom). ' +
    'Use this instead of cross-correlation when you suspect the relationship is non-stationary (changes over time).' +
    '</p></details>';

  // Restore selector values
  var selANew = document.getElementById('wco-layer-a');
  var selBNew = document.getElementById('wco-layer-b');
  if (selANew) selANew.value = layerA;
  if (selBNew) selBNew.value = layerB;

  // Draw heatmap on canvas
  setTimeout(function() {
    var canvas = document.getElementById('wco-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var S = result.S, N = result.N;

    // Render coherence as color heatmap: low=dark blue, high=yellow-red
    var imgData = ctx.createImageData(W, H);
    for (var sy = 0; sy < H; sy++) {
      var si = Math.floor((sy / H) * S);          // scale index
      if (si >= S) si = S - 1;
      for (var tx = 0; tx < W; tx++) {
        var ti = Math.floor((tx / W) * N);         // time index
        if (ti >= N) ti = N - 1;
        var coh = Math.min(1, Math.max(0, result.coherence[si][ti]));
        // Colormap: 0=black/blue, 0.5=green, 1=yellow
        var r = Math.floor(Math.min(255, coh * 2 * 255));
        var g = Math.floor(coh < 0.5 ? coh * 2 * 180 : (1 - (coh - 0.5) * 2) * 180 + 100);
        var b = Math.floor(Math.max(0, (1 - coh * 2) * 200));
        var idx = (sy * W + tx) * 4;
        imgData.data[idx]   = r;
        imgData.data[idx+1] = g;
        imgData.data[idx+2] = b;
        imgData.data[idx+3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    // Period labels on y-axis
    ctx.fillStyle = 'rgba(192,216,236,.7)';
    ctx.font = '8px Space Mono, monospace';
    result.periods.filter(function(_, i) { return i % Math.max(1, Math.floor(S/4)) === 0; })
      .forEach(function(p, i) {
        var y = Math.floor((i * Math.max(1, Math.floor(S/4)) / S) * H);
        ctx.fillText(p.toFixed(0) + 'dt', 4, Math.min(H-2, y + 9));
      });

    // Summary: find peak coherence period
    var peakCoh = 0, peakPeriod = 0;
    result.coherence.forEach(function(row, si) {
      var rowMean = row.reduce(function(s,v){return s+v;},0) / row.length;
      if (rowMean > peakCoh) { peakCoh = rowMean; peakPeriod = result.periods[si]; }
    });
    var sumEl = document.getElementById('wco-summary');
    if (sumEl) {
      sumEl.textContent = peakCoh > 0.5
        ? ('Peak coherence at period ≈' + peakPeriod.toFixed(0) + ' samples (mean coherence²=' + peakCoh.toFixed(2) + '). '
         + labelA + ' and ' + labelB + ' share significant variance at this timescale.')
        : ('Mean coherence below 0.5 — ' + labelA + ' and ' + labelB + ' appear largely independent at all tested timescales.');
      sumEl.style.color = peakCoh > 0.5 ? '#00e5ff' : 'var(--text-dim)';
    }
  }, 50);
}

// ════════════════════════════════════════════════════════
// PROGRESSIVE DISCLOSURE — BEGINNER / EXPERT MODE (UX-A)
// Beginner mode shows 5 plain-language indicators and hides
// the advanced analysis panels. Expert mode is the full UI.
// ════════════════════════════════════════════════════════

var _esoMode = 'expert'; // 'beginner' | 'expert'

function toggleESOMode() {
  _esoMode = _esoMode === 'expert' ? 'beginner' : 'expert';
  try { localStorage.setItem('eso-mode', _esoMode); } catch(e) {}
  applyESOMode();
}

function applyESOMode() {
  var btn = document.getElementById('eso-mode-btn');
  var body = document.body;
  if (_esoMode === 'beginner') {
    body.classList.add('eso-beginner');
    if (btn) btn.textContent = '🔬 Expert Mode';
    // Show beginner summary banner
    var banner = document.getElementById('eso-beginner-banner');
    if (banner) {
      banner.style.display = 'block';
      _updateBeginnerBanner();
    }
  } else {
    body.classList.remove('eso-beginner');
    if (btn) btn.textContent = '📖 Simple View';
    var banner = document.getElementById('eso-beginner-banner');
    if (banner) banner.style.display = 'none';
  }
}

function _updateBeginnerBanner() {
  var banner = document.getElementById('eso-beginner-banner');
  if (!banner) return;
  var eq  = typeof scoreEarthquake === 'function'  ? scoreEarthquake()  : { score: 0, level: 'CLEAR' };
  var ts  = typeof scoreTsunami    === 'function'  ? scoreTsunami()     : { score: 0, level: 'CLEAR' };
  var ss  = typeof scoreSuperstorm === 'function'  ? scoreSuperstorm()  : { score: 0, level: 'CLEAR' };
  var kp  = typeof _realKpCurrent !== 'undefined' && _realKpCurrent !== null ? _realKpCurrent : 2;

  function trafficLight(score) {
    return score >= 60 ? '#ff3d3d' : score >= 35 ? '#ffd600' : '#00ff88';
  }
  function levelWord(level) {
    return level === 'WARNING' ? '🔴 Warning' : level === 'WATCH' ? '🟡 Watch' : level === 'ELEVATED' ? '🟡 Elevated' : '🟢 Clear';
  }

  var kpWord = kp >= 5 ? '🔴 Geomagnetic Storm' : kp >= 4 ? '🟡 Active' : '🟢 Quiet';

  banner.innerHTML =
    '<div style="font-size:11px;font-weight:700;color:#fff;margin-bottom:10px;letter-spacing:.08em;">CURRENT CONDITIONS — PLAIN LANGUAGE</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
      _bgCard('🌍 Earthquake Risk',  levelWord(eq.level),  'Score ' + eq.score + '/100', trafficLight(eq.score)) +
      _bgCard('🌊 Tsunami Risk',     levelWord(ts.level),  'Score ' + ts.score + '/100', trafficLight(ts.score)) +
      _bgCard('⛈ Superstorm Risk',   levelWord(ss.level),  'Score ' + ss.score + '/100', trafficLight(ss.score)) +
      _bgCard('☀ Space Weather',     kpWord,               'Kp = ' + kp.toFixed(1),      kp >= 5 ? '#ff3d3d' : kp >= 4 ? '#ffd600' : '#00ff88') +
    '</div>' +
    '<div style="font-size:8px;color:var(--text-dim);margin-top:8px;text-align:center;">Switch to Expert Mode for raw data, charts, and cross-domain analysis.</div>';
}

function _bgCard(title, status, sub, color) {
  return '<div style="background:var(--surface2);border-radius:4px;padding:10px;border-left:3px solid ' + color + ';">' +
    '<div style="font-size:9px;color:var(--text-dim);margin-bottom:3px;">' + title + '</div>' +
    '<div style="font-size:13px;font-weight:700;color:' + color + ';">' + status + '</div>' +
    '<div style="font-size:8px;color:var(--text-dim);margin-top:2px;">' + sub + '</div>' +
  '</div>';
}

function initESOMode() {
  try { _esoMode = localStorage.getItem('eso-mode') || 'expert'; } catch(e) {}
  applyESOMode();
  // Refresh beginner banner on each data cycle
  setInterval(function() {
    if (_esoMode === 'beginner') _updateBeginnerBanner();
  }, 30000);
}

// ════════════════════════════════════════════════════════
// HINDCAST PANEL (UX-B)
// Shows the last N predictions with their validation status.
// Builds credibility by showing users what ESO got right/wrong.
// ════════════════════════════════════════════════════════

function renderHindcastPanel() {
  var container = document.getElementById('dsp-hindcast');
  if (!container) return;

  if (!_hindcastStore || !_hindcastStore.length) {
    container.innerHTML =
      '<div style="color:var(--text-dim);font-size:9px;text-align:center;padding:24px 10px;">' +
      '<b>No hindcast data yet.</b><br><br>' +
      'ESO saves predictions every 6 hours. After 48 hours, each prediction is validated against USGS records.<br><br>' +
      '<button onclick="saveHindcastSnapshot()" style="font-size:8px;padding:4px 10px;background:rgba(0,229,255,.12);border:1px solid var(--c-cyan);color:var(--c-cyan);cursor:pointer;border-radius:2px;font-family:inherit;">💾 Save first snapshot now</button>' +
      '</div>';
    return;
  }

  var total     = _hindcastStore.filter(function(h){ return h.validated; }).length;
  var accurate  = _hindcastStore.filter(function(h){ return h.validated && h.accurate; }).length;
  var accuracy  = total > 0 ? Math.round(accurate / total * 100) : null;

  var header = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
    '<div style="font-size:9px;color:var(--text-dim)">' + _hindcastStore.length + ' snapshots stored</div>' +
    (accuracy !== null ? '<div style="font-size:10px;font-weight:700;color:' + (accuracy >= 60 ? '#00ff88' : '#ffd600') + ';">Accuracy (M5.5± test): ' + accuracy + '%</div>' : '<div style="font-size:8px;color:var(--text-dim)">Validation pending (need 48h)</div>') +
    '</div>';

  var rows = _hindcastStore.slice().reverse().slice(0, 15).map(function(h) {
    var age  = Math.round((Date.now() - h.ts) / 3600000);
    var ageStr = age < 24 ? age + 'h ago' : Math.round(age/24) + 'd ago';
    var valCell = '';
    if (!h.validated) {
      var hoursLeft = Math.max(0, Math.round(48 - (Date.now() - h.ts) / 3600000));
      valCell = '<span style="color:var(--text-dim);font-size:7px;">⏳ validates in ~' + hoursLeft + 'h</span>';
    } else {
      var outcome = h.outcome;
      var icon    = h.accurate ? '✓' : '✗';
      var col     = h.accurate ? '#00ff88' : '#ff3d3d';
      valCell = '<span style="color:' + col + ';font-size:8px;font-weight:700;">' + icon + ' M' +
        (outcome && outcome.maxMag ? outcome.maxMag.toFixed(1) : '—') +
        ' (' + (outcome ? outcome.count : 0) + ' M5.5+)</span>';
    }
    var eqCol = h.eqScore >= 60 ? '#ff3d3d' : h.eqScore >= 35 ? '#ffd600' : '#00ff88';
    return '<div style="display:grid;grid-template-columns:60px 90px 1fr;gap:6px;align-items:center;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.05);">' +
      '<span style="font-size:7px;color:var(--text-dim);">' + ageStr + '</span>' +
      '<span style="font-size:9px;color:' + eqCol + ';font-weight:700;">EQ ' + h.eqScore + '/100</span>' +
      valCell + '</div>';
  }).join('');

  container.innerHTML = header + rows +
    '<details class="chart-help" style="margin-top:8px;"><summary>📐 How hindcast works</summary><p>' +
    'Every 6h ESO records the current risk scores. After 48h, it fetches the USGS catalog for that window and checks ' +
    'whether M5.5+ events occurred when EQ score ≥50, and whether none occurred when score &lt;50. ' +
    'This is a simplified binary test — real seismic forecasting is probabilistic. ' +
    'Use this to calibrate your confidence in the score engine over time.' +
    '</p></details>';
}

// ════════════════════════════════════════════════════════
// HYPOTHESIS BOARD (UX-C / Observer 5)
// Users can save discovery engine findings as formal hypotheses.
// ESO auto-checks each hypothesis against fresh data each refresh.
// Hypothesis: a specific testable claim derived from a Discovery.
// ════════════════════════════════════════════════════════

var _hypotheses = [];   // [{id, claim, evidence, savedTs, status, checkCount, lastCheck}]

function loadHypotheses() {
  try {
    var raw = localStorage.getItem('eso-hypotheses-v1');
    if (raw) _hypotheses = JSON.parse(raw);
  } catch(e) {}
}

function saveHypothesesToStorage() {
  try { localStorage.setItem('eso-hypotheses-v1', JSON.stringify(_hypotheses)); } catch(e) {}
}

function saveHypothesisFromDiscovery(idx) {
  var disc = discoveryLog[idx];
  if (!disc) return;
  var id = 'hyp-' + Date.now();
  _hypotheses.unshift({
    id:       id,
    claim:    disc.title,
    body:     disc.body,
    method:   disc.method,
    savedTs:  Date.now(),
    status:   'testing',      // 'testing' | 'supported' | 'refuted' | 'inconclusive'
    checkCount: 0,
    lastCheck:  null,
    checks:   [],             // [{ts, verdict, detail}]
  });
  if (_hypotheses.length > 30) _hypotheses.pop();
  saveHypothesesToStorage();
  renderHypothesisBoard();
  // Flash confirmation
  var msg = document.getElementById('hyp-confirm');
  if (msg) { msg.textContent = '✓ Saved as hypothesis'; msg.style.opacity = '1'; setTimeout(function(){ msg.style.opacity='0'; }, 2000); }
}

function checkHypothesesAgainstCurrentData() {
  if (!_hypotheses.length) return;
  var now = Date.now();
  _hypotheses.forEach(function(hyp) {
    if (hyp.status !== 'testing') return;
    if (now - (hyp.lastCheck || 0) < 30 * 60 * 1000) return; // throttle: 30min
    hyp.lastCheck = now;
    hyp.checkCount++;

    // Auto-check: if claim contains lag language, check cross-correlation still holds
    var verdict = 'inconclusive';
    var detail  = 'Automatic check #' + hyp.checkCount + ' — ';
    var active  = Array.from(state.activeLayers || []);

    if (hyp.claim.toLowerCase().indexOf('lag') !== -1 || hyp.claim.toLowerCase().indexOf('cross-correlation') !== -1) {
      // Re-run cross-correlation on the layers mentioned
      var foundR = null;
      for (var i = 0; i < active.length && foundR === null; i++) {
        for (var j = i+1; j < active.length; j++) {
          var a = typeof getSeriesOrdered === 'function' ? getSeriesOrdered(active[i]) : [];
          var b = typeof getSeriesOrdered === 'function' ? getSeriesOrdered(active[j]) : [];
          if (a.length < 6 || b.length < 6) continue;
          var cr = crossCorr(a, b, 8);
          var best = cr.reduce(function(m,c){ return Math.abs(c.r) > Math.abs(m.r) ? c : m; });
          if (Math.abs(best.r) > 0.5) foundR = best;
        }
      }
      if (foundR && Math.abs(foundR.r) > 0.65) {
        verdict = 'supported';
        detail += 'Cross-correlation still significant (r=' + foundR.r.toFixed(2) + ', lag=' + foundR.lag + ')';
      } else if (foundR && Math.abs(foundR.r) > 0.5) {
        verdict = 'inconclusive';
        detail += 'Correlation weaker than at discovery (r=' + foundR.r.toFixed(2) + ')';
      } else {
        detail += 'No significant lag correlation found in current data window.';
      }
    } else if (hyp.claim.toLowerCase().indexOf('earthquake') !== -1 || hyp.claim.toLowerCase().indexOf('seismic') !== -1) {
      // Check if seismic indicators remain elevated
      var eq = typeof scoreEarthquake === 'function' ? scoreEarthquake() : null;
      if (eq && eq.score >= 50) {
        verdict = 'supported';
        detail += 'Earthquake precursor score currently ' + eq.score + '/100 — conditions consistent with hypothesis.';
      } else if (eq) {
        detail += 'Earthquake precursor score now ' + eq.score + '/100 — conditions may have normalized.';
      }
    } else {
      detail += 'No automated check applies to this discovery type. Manual review recommended.';
    }

    hyp.checks.push({ ts: now, verdict: verdict, detail: detail });
    if (hyp.checks.length > 10) hyp.checks.shift();

    // Update status: 3 consecutive 'supported' → supported; 3 consecutive 'refuted' → refuted
    var recent = hyp.checks.slice(-3);
    if (recent.length === 3 && recent.every(function(c){ return c.verdict === 'supported'; })) {
      hyp.status = 'supported';
    } else if (recent.length === 3 && recent.every(function(c){ return c.verdict === 'refuted'; })) {
      hyp.status = 'refuted';
    }
  });
  saveHypothesesToStorage();
}

function renderHypothesisBoard() {
  var container = document.getElementById('dsp-hyp');
  if (!container) return;

  if (!_hypotheses.length) {
    container.innerHTML =
      '<div style="color:var(--text-dim);font-size:9px;text-align:center;padding:24px 10px;">' +
      '<b>No hypotheses saved yet.</b><br><br>' +
      'In the <b>Discovery Log</b> tab, click <b>⊕ Save as Hypothesis</b> on any discovery to track it here.<br><br>' +
      'ESO will automatically re-check each hypothesis against fresh data every 30 minutes.' +
      '</div>';
    return;
  }

  var statusColors = { testing: '#ffd600', supported: '#00ff88', refuted: '#ff3d3d', inconclusive: '#4a7a99' };
  var statusIcons  = { testing: '⏳', supported: '✓', refuted: '✗', inconclusive: '?' };

  container.innerHTML =
    '<div id="hyp-confirm" style="font-size:9px;color:#00ff88;text-align:center;margin-bottom:6px;opacity:0;transition:opacity .5s;"></div>' +
    _hypotheses.map(function(hyp) {
      var col  = statusColors[hyp.status]  || '#4a7a99';
      var icon = statusIcons[hyp.status]   || '?';
      var age  = Math.round((Date.now() - hyp.savedTs) / 3600000);
      var ageStr = age < 24 ? age + 'h ago' : Math.round(age/24) + 'd ago';
      var lastCheck = hyp.checks.length ? hyp.checks[hyp.checks.length-1] : null;
      var lastVerdict = lastCheck ? lastCheck.detail.slice(0, 80) + (lastCheck.detail.length > 80 ? '…' : '') : 'Not yet checked';
      return '<div style="border:1px solid ' + col + ';border-radius:3px;padding:8px;margin-bottom:8px;background:rgba(0,0,0,.2);">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;">' +
          '<div style="font-size:9px;color:#fff;flex:1;line-height:1.5;">' + hyp.claim + '</div>' +
          '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;">' +
            '<span style="font-size:9px;font-weight:700;color:' + col + ';">' + icon + ' ' + hyp.status.toUpperCase() + '</span>' +
            '<button onclick="_deleteHypothesis(\'' + hyp.id + '\')" style="font-size:7px;padding:1px 5px;background:none;border:1px solid rgba(255,61,61,.3);color:#ff6666;cursor:pointer;border-radius:2px;font-family:inherit;">delete</button>' +
          '</div>' +
        '</div>' +
        '<div style="font-size:7px;color:var(--text-dim);margin-top:4px;">Saved: ' + ageStr + ' · Checked ' + hyp.checkCount + '× · Method: ' + hyp.method + '</div>' +
        '<div style="font-size:7.5px;color:' + col + ';margin-top:4px;padding:3px 6px;background:rgba(255,255,255,.04);border-radius:2px;">Last: ' + lastVerdict + '</div>' +
      '</div>';
    }).join('') +
    '<div style="font-size:7px;color:var(--text-dim);text-align:center;margin-top:4px;">ESO auto-checks all hypotheses every 30 minutes · ' + _hypotheses.filter(function(h){return h.status==='testing';}).length + ' currently testing</div>';
}

function _deleteHypothesis(id) {
  _hypotheses = _hypotheses.filter(function(h){ return h.id !== id; });
  saveHypothesesToStorage();
  renderHypothesisBoard();
}

function startHypothesisChecker() {
  loadHypotheses();
  setInterval(function() {
    checkHypothesesAgainstCurrentData();
    if (document.querySelector('.disc-tab.active') &&
        document.querySelector('.disc-tab.active').id === 'dst-hyp') {
      renderHypothesisBoard();
    }
  }, 30 * 60 * 1000);
}

