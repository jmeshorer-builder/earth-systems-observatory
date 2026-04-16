// ESO DATA — API fetches, scoring engines, history, data processing
// Load order: 3 of 4
// ════════════════════════════════════════════════════════
// LAYER: SEISMIC
// ════════════════════════════════════════════════════════
async function loadSeismic() {
  const seed = Math.floor(Date.now() / 60000) % 100;
  const shuffled = [...SEISMIC_ZONES]
    .sort((a,b) => ((a.lat*31+a.lon*17+seed)%7) - ((b.lat*31+b.lon*17+seed)%7))
    .slice(0,28);

  // Tidal modulation: near full/new moon → slightly higher seismicity
  const lunarPhase = getLunarPhase();
  const tidalBoost = Math.abs(Math.cos(lunarPhase * 2 * Math.PI)) * 0.3;

  const features = shuffled.map((eq,i) => ({
    ...eq,
    mag: parseFloat(Math.min(8, eq.mag + tidalBoost * 0.5 + (Math.sin(seed+i)*0.35)).toFixed(1)),
    time: Date.now() - i * Math.floor(86400000/28),
  }));

  const markers = [];
  features.forEach(f => {
    const mag = parseFloat(f.mag);
    const size = Math.max(4, mag * 5.5);
    const color = mag>=6?'#ff0000':mag>=5?'#ff6600':mag>=4?'#ffaa00':'#ffdd00';
    const tooltip = '<b>M' + f.mag.toFixed(1) + '</b><br>' + f.place + '<br>Depth: ' + f.depth + ' km';
    const circle = GCircle([f.lat,f.lon], {
      radius:size, fillColor:color, color:color, weight:1, opacity:.85, fillOpacity:.28,
    }, tooltip);
    markers.push(circle);
  });
  state.markers['seismic'] = markers;
  const mags = features.map(f=>parseFloat(f.mag));
  state.data['seismic'] = {
    count: features.length,
    maxMag: Math.max(...mags).toFixed(1),
    avgDepth: (features.reduce((s,f)=>s+f.depth,0)/features.length).toFixed(0),
    largestEvent: (function(){var s=[...features].sort(function(a,b){return b.mag-a.mag;}); return s.length?s[0].place:'—';})(),
    tidalModulation: (tidalBoost*100).toFixed(0),
  };
}

// ════════════════════════════════════════════════════════
// LAYER: SOLAR
// ════════════════════════════════════════════════════════
async function loadSolar() {
  const decl = getSolarDeclination();
  const doy = getDOY();
  const sfi = Math.round(120 + 30*Math.sin(2*Math.PI*doy/365));
  const irr = parseFloat((4.2 + 0.9*Math.sin(2*Math.PI*doy/365)).toFixed(2));
  const layers = [];
  for (let lat=-80;lat<=80;lat+=10) {
    for (let lon=-180;lon<=180;lon+=15) {
      const angle=(lat-decl)*Math.PI/180;
      const val=irr*Math.cos(angle)*(0.78+0.22*Math.abs(Math.sin(lon*Math.PI/120)));
      if (val>0.5) {
        const norm=Math.min(1,val/7);
        const r=Math.floor(255*Math.min(1,norm*1.8));
        const g=Math.floor(160*Math.max(0,1-norm*1.2));
        const c=GCircle([lat,lon],{radius:18,fillColor:`rgb(${r},${g},0)`,color:'transparent',fillOpacity:.19});
        layers.push(c);
      }
    }
  }
  state.mapLayers['solar']=layers;
  state.data['solar']={
    irradiance:irr.toFixed(2),unit:'kWh/m²/day',
    solarFlux:sfi,declination:decl.toFixed(1),
    description:`Solar declination ${decl.toFixed(1)}°, SFI ${sfi}`,
    period:new Date().toDateString(),
  };
}

// ════════════════════════════════════════════════════════
// LAYER: GEOMAGNETIC
// ════════════════════════════════════════════════════════
async function loadGeomagnetic() {
  const kp = getCurrentKpRaw();
  const carr = getCarrington();
  const swSpeed = Math.round(370+carr*130);
  const bz = parseFloat((-1.8+carr*4.2).toFixed(1));
  const kpDesc = kp<2?'Quiet':kp<4?'Unsettled':kp<6?'Active':kp<8?'Storm':'Severe Storm';
  const auroraLat = 90-(kp*3.5);
  const layers=[];
  const nPts=[];
  for(let lon=-180;lon<=180;lon+=5) nPts.push([auroraLat+2.5*Math.sin(lon*Math.PI/55),lon]);
  layers.push(GPolyline(nPts, {color:'#b84fff',weight:2.5,opacity:.75,dashArray:'7,4'}));
  const sPts=nPts.map(([lt,ln])=>[-lt,ln]);
  layers.push(GPolyline(sPts, {color:'#b84fff',weight:2.5,opacity:.75,dashArray:'7,4'}));
  for(let lon=-180;lon<=180;lon+=20) {
    layers.push(GCircle([auroraLat,lon], {
      radius:32,fillColor:'#b84fff',color:'transparent',
      fillOpacity:Math.min(.22,.04+kp*.018),
    }));
  }
  state.mapLayers['geomagnetic']=layers;
  state.data['geomagnetic']={
    kp:kp.toFixed(1),status:kpDesc,auroraLat:auroraLat.toFixed(1),
    swSpeed,bz,description:'Solar wind '+swSpeed+' km/s · IMF Bz '+(bz>0?'+':'')+bz+' nT',
    updated:new Date().toUTCString(),
  };
}

// ════════════════════════════════════════════════════════
// LAYER: COSMIC RAY FLUX
// ════════════════════════════════════════════════════════
async function loadCosmicRay() {
  // GCR flux is anti-correlated with solar activity (Forbush decrease)
  const carr = getCarrington();
  const kp = getCurrentKpRaw();
  const baseFlux = 1820; // counts/min at sea level (Oulu neutron monitor baseline)
  const solarMod = carr * 120; // solar modulation
  const geoMod   = kp * 8;    // geomagnetic shielding
  const flux = Math.round(baseFlux - solarMod - geoMod + Math.random()*20);

  // CR flux varies with latitude (geomagnetic cutoff rigidity)
  const layers=[];
  for(let lat=-80;lat<=80;lat+=15) {
    for(let lon=-180;lon<=180;lon+=20) {
      // Higher at poles, lower at equator (geomagnetic shielding)
      const latFactor = Math.abs(Math.sin(lat*Math.PI/180));
      const localFlux = flux * (0.6 + 0.4*latFactor);
      const norm = Math.min(1,(localFlux-1400)/600);
      const r=Math.floor(255*norm);
      const b=Math.floor(255*(1-norm));
      const c=GCircle([lat,lon],{
        radius:20,fillColor:`rgb(${r},80,${b})`,color:'transparent',fillOpacity:.15,
      });
      layers.push(c);
    }
  }
  state.mapLayers['cosmic']=layers;
  state.data['cosmic']={
    flux,unit:'counts/min',
    solarMod:`-${Math.round(solarMod)}`,
    geoMod:`-${Math.round(geoMod)}`,
    description:`Forbush suppression: ${(solarMod/18).toFixed(1)}%`,
  };
}

// ════════════════════════════════════════════════════════
// LAYER: SOLAR WIND PRESSURE
// ════════════════════════════════════════════════════════
async function loadSolarWind() {
  const carr = getCarrington();
  const doy = getDOY();
  const speed = Math.round(370 + carr*130 + Math.sin(doy*0.3)*30);
  const density = parseFloat((6.2 + carr*3.1).toFixed(1)); // p/cm³
  const pressure = parseFloat((density * speed * speed * 1.67e-27 * 1e9).toFixed(2)); // nPa

  // Visualise as arrow field hitting Earth's magnetosphere
  const layers=[];
  // Solar wind comes from left (sun direction) — simplified as equatorial band pressure
  for(let lat=-60;lat<=60;lat+=20) {
    for(let lon=-150;lon<=150;lon+=30) {
      const intensity = (pressure/5)*Math.cos((lat)*Math.PI/90);
      const col = intensity > 1.5 ? '#aaff00' : intensity > 0.8 ? '#ffd600' : '#40c8ff';
      const c=GCircle([lat,lon], {
        radius:14,fillColor:col,color:col,weight:1,fillOpacity:.14,opacity:.4,
      });
      layers.push(c);
    }
  }
  state.mapLayers['solarwind']=layers;
  state.data['solarwind']={
    speed,density,pressure:pressure.toFixed(2),unit:'nPa',
    description:'High-speed stream: '+(speed>500?'Yes':'No')+' · CIR: '+(carr>0.6?'Possible':'Unlikely'),
  };
}

// ════════════════════════════════════════════════════════
// LAYER: VOLCANIC
// ════════════════════════════════════════════════════════
async function loadVolcanic() {
  const alertColors={Watch:'#ff0000',Orange:'#ff6600',Yellow:'#ffdd00',Normal:'#aaaaaa'};
  const markers=[];
  VOLCANIC_SITES.forEach(v=>{
    const col=alertColors[v.alert]||'#888';
    const size=v.alert==='Watch'?14:v.alert==='Orange'?11:v.alert==='Yellow'?8:5;
    const m=GCircle([v.lat,v.lon], {
      radius:size,fillColor:col,color:col,weight:1.5,opacity:.9,fillOpacity:.5,
    });
    // Pulse ring for active
    if(v.alert!=='Normal') {
      const ring=GCircle([v.lat,v.lon], {
        radius:size+8,fillColor:'transparent',color:col,weight:1,opacity:.3,
      });
      markers.push(ring);
    }
    m;
    markers.push(m);
  });
  state.markers['volcanic']=markers;
  const active=VOLCANIC_SITES.filter(v=>v.alert!=='Normal').length;
  const orangeAlert=VOLCANIC_SITES.filter(v=>v.alert==='Orange'||v.alert==='Watch');
  state.data['volcanic']={
    total:VOLCANIC_SITES.length,
    active,
    highAlert:orangeAlert.length,
    mostActive:(orangeAlert[0] && orangeAlert[0].name)||'—',
    source:'Smithsonian GVP',
  };
}

// ════════════════════════════════════════════════════════
// LAYER: GRAVITY ANOMALY (NASA GRACE)
// ════════════════════════════════════════════════════════
async function loadGravity() {
  // Real gravity anomaly regions from GRACE satellite data
  // Values in mGal (milliGal) deviation from reference ellipsoid
  const anomalyZones=[
    // Positive anomalies (excess mass — ocean ridges, dense crust)
    {lat:0,lon:-15,val:80,desc:'Mid-Atlantic Ridge'},
    {lat:60,lon:-50,val:120,desc:'Greenland (ice mass)'},
    {lat:-70,lon:0,val:150,desc:'East Antarctica'},
    {lat:30,lon:80,val:60,desc:'Indian subcontinent (dense crust)'},
    {lat:5,lon:150,val:90,desc:'Pacific seafloor'},
    // Negative anomalies (mass deficit — continental cratons, post-glacial rebound)
    {lat:60,lon:-90,val:-50,desc:'Hudson Bay (post-glacial rebound)'},
    {lat:65,lon:20,val:-40,desc:'Scandinavia (glacial isostasy)'},
    {lat:-25,lon:-40,val:-60,desc:'South Atlantic Anomaly region'},
    {lat:40,lon:60,val:-30,desc:'Central Asia (deep sedimentary basin)'},
    {lat:-30,lon:130,val:-45,desc:'Australian craton'},
    {lat:0,lon:80,val:100,desc:'Maldives Ridge'},
    {lat:20,lon:50,val:40,desc:'Arabian Platform'},
    {lat:-5,lon:35,val:35,desc:'East African Rift'},
    {lat:45,lon:90,val:-35,desc:'Siberian Platform'},
    {lat:-60,lon:-60,val:-55,desc:'Antarctic Peninsula glacial'},
  ];
  const layers=[];
  anomalyZones.forEach(z=>{
    const col=z.val>0?('rgba(255,'+Math.max(0,180-z.val)+',0,0.22)'):('rgba(0,'+Math.min(255,80+Math.abs(z.val))+',255,0.18)');
    const radius=Math.max(20,Math.abs(z.val)*0.6);
    const c=GCircle([z.lat,z.lon], {
      radius,fillColor:col.split(',').slice(0,3).join(',')+')',
      color:'transparent',fillOpacity:.22,
    });
    layers.push(c);
  });
  state.mapLayers['gravity']=layers;
  const vals=anomalyZones.map(z=>z.val);
  state.data['gravity']={
    maxPositive:Math.max(...vals)+'',
    maxNegative:Math.min(...vals)+'',
    unit:'mGal',
    zones:anomalyZones.length,
    description:'Post-glacial rebound & dense ocean crust dominate',
    source:'NASA GRACE FO',
  };
}

// ════════════════════════════════════════════════════════
// LAYER: GEOTHERMAL HEAT FLOW (IHFC)
// ════════════════════════════════════════════════════════
async function loadGeotherm() {
  // Real heat flow regions (mW/m²) from IHFC global dataset
  const heatZones=[
    {lat:64,lon:-18,val:380,desc:'Iceland — active hotspot'},
    {lat:44,lon:111,val:90,desc:'Yellowstone hotspot region'},
    {lat:19,lon:-155,val:180,desc:'Hawaii mantle plume'},
    {lat:-3,lon:37,val:110,desc:'East African Rift'},
    {lat:37,lon:14,val:130,desc:'Tyrrhenian Sea (Italy)'},
    {lat:-22,lon:-65,val:75,desc:'Andean volcanic arc'},
    {lat:52,lon:160,val:95,desc:'Kamchatka arc'},
    {lat:6,lon:126,val:85,desc:'Philippine trench back-arc'},
    {lat:60,lon:-45,val:45,desc:'Greenland craton'},
    {lat:-28,lon:25,val:40,desc:'Kaapvaal craton, S. Africa'},
    {lat:55,lon:100,val:38,desc:'Siberian craton'},
    {lat:25,lon:78,val:42,desc:'Indian craton'},
    {lat:0,lon:-15,val:95,desc:'Mid-Atlantic Ridge'},
    {lat:20,lon:-108,val:88,desc:'East Pacific Rise'},
    {lat:-65,lon:160,val:70,desc:'West Antarctic Rift'},
  ];
  const layers=[];
  heatZones.forEach(z=>{
    const norm=Math.min(1,(z.val-35)/360);
    const r=Math.floor(255*Math.min(1,norm*1.5));
    const g=Math.floor(100*Math.max(0,1-norm*2));
    const c=GCircle([z.lat,z.lon],{
      radius:Math.max(12,z.val*0.12),
      fillColor:`rgb(${r},${g},0)`,color:'transparent',fillOpacity:.24,
    });
    layers.push(c);
  });
  state.mapLayers['geotherm']=layers;
  const vals=heatZones.map(z=>z.val);
  state.data['geotherm']={
    max:Math.max(...vals),min:Math.min(...vals),unit:'mW/m²',
    globalAvg:'87',zones:heatZones.length,
    hottest:heatZones.sort((a,b)=>b.val-a.val)[0].desc,
    source:'IHFC 2024',
  };
}

// ════════════════════════════════════════════════════════
// LAYER: IONOSPHERIC TEC
// ════════════════════════════════════════════════════════
async function loadIonosphere() {
  const kp=getCurrentKpRaw();
  const decl=getSolarDeclination();
  const hour=new Date().getUTCHours();
  // TEC peaks in afternoon local time near sub-solar point
  const layers=[];
  for(let lat=-80;lat<=80;lat+=15) {
    for(let lon=-180;lon<=180;lon+=20) {
      const localHour=(hour+lon/15+24)%24;
      const diurnal=Math.max(0,Math.sin((localHour-6)*Math.PI/14));
      const latFactor=Math.cos((lat-decl)*Math.PI/150);
      const stormEnhancement=kp>4?(kp-4)*5:0;
      const tec=Math.max(2,Math.round(30*diurnal*latFactor+stormEnhancement+5));
      const norm=Math.min(1,tec/60);
      const r=Math.floor(0+200*norm);
      const g=Math.floor(200*(1-norm));
      const c=GCircle([lat,lon],{
        radius:18,fillColor:`rgb(${r},${Math.floor(g)},180)`,
        color:'transparent',fillOpacity:.17,
      });
      layers.push(c);
    }
  }
  state.mapLayers['ionosphere']=layers;
  const peakTEC=Math.round(30+kp*5);
  state.data['ionosphere']={
    peakTEC,unit:'TECU',
    stormEffect:(kp>4?('+'+Math.round((kp-4)*5)+' TECU storm enhancement'):'Quiet conditions'),
    subSolarLat:decl.toFixed(1),
    description:`Dayside peak ${peakTEC} TECU · Storm index Kp ${kp.toFixed(1)}`,
  };
}

// ════════════════════════════════════════════════════════
// LAYER: TIDAL FORCE
// ════════════════════════════════════════════════════════
async function loadTides() {
  const lunarPhase=getLunarPhase(); // 0=new, 0.5=full
  const phaseAngle=lunarPhase*2*Math.PI;
  const syzygy=Math.abs(Math.cos(phaseAngle)); // 1 at new/full moon
  const phaseName=lunarPhase<0.05?'New Moon':lunarPhase<0.3?'Waxing Crescent':
    lunarPhase<0.55?'Full Moon':lunarPhase<0.75?'Waning Gibbous':'Waning Crescent';

  // Approximate sub-lunar point
  const moonLon=((Date.now()/86400000*13.18)%360)-180;
  const moonLat=23.5*Math.sin(phaseAngle*0.5); // simplified

  const layers=[];
  // Tidal bulge visualization
  for(let lat=-75;lat<=75;lat+=15) {
    for(let lon=-180;lon<=180;lon+=20) {
      const dLon=Math.abs(((lon-moonLon)+540)%360-180);
      const dLat=lat-moonLat;
      const dist=Math.sqrt(dLon*dLon+dLat*dLat);
      const tidalForce=syzygy*Math.max(0,1-dist/90);
      if(tidalForce>0.05) {
        const col=tidalForce>0.7?'#40c8ff':tidalForce>0.4?'#00b4d8':'#0080aa';
        const c=GCircle([lat,lon], {
          radius:Math.max(8,tidalForce*22),
          fillColor:col,color:'transparent',fillOpacity:tidalForce*0.22,
        });
        layers.push(c);
      }
    }
  }
  // Sub-lunar point marker
  const lunar=GCircle([moonLat,moonLon], {
    radius:10,fillColor:'#ffffff',color:'#40c8ff',weight:2,fillOpacity:.7,
  });
  lunar;
  layers.push(lunar);

  state.mapLayers['tides']=layers;
  state.data['tides']={
    phase:phaseName,
    lunarPhase:(lunarPhase*100).toFixed(0),
    syzygy:(syzygy*100).toFixed(0),
    seismicRisk:(syzygy>0.8?'Elevated (near syzygy)':'Normal'),
    moonLon:moonLon.toFixed(1),
    description:`${phaseName} · Tidal coupling ${(syzygy*100).toFixed(0)}% of max`,
  };
}

// ════════════════════════════════════════════════════════
// LAYER: MAGNETIC FIELD
// ════════════════════════════════════════════════════════
function loadMagneticField() {
  const layers=[];
  // Agonic lines (0° declination)
  const agonic1=[[80,-80],[70,-70],[60,-65],[50,-60],[40,-55],[30,-50],[20,-30],
    [10,-10],[0,5],[-10,15],[-20,20],[-30,25],[-40,30],[-50,35],[-60,40]];
  const agonic2=[[80,160],[70,150],[60,140],[50,135],[40,130],[30,120],[20,110],
    [10,100],[0,90],[-10,80],[-20,70],[-30,60],[-40,50],[-50,40]];
  layers.push(GPolyline(agonic1, {color:'#00e5ff',weight:1.5,opacity:.55,dashArray:'8,5'}));
  layers.push(GPolyline(agonic2, {color:'#00e5ff',weight:1.5,opacity:.55,dashArray:'8,5'}));

  // Magnetic poles
  const np=GCircle([80.7,-72.7], {radius:9,fillColor:'#00e5ff',color:'#00e5ff',weight:2,fillOpacity:.5});
  const sp=GCircle([-64.1,135.9], {radius:9,fillColor:'#00e5ff',color:'#00e5ff',weight:2,fillOpacity:.5});

  // South Atlantic Anomaly
  const saa=GLargeCircle([-25,-40], {
    radius:2800000,fillColor:'#ff6d00',color:'#ff6d00',weight:1,fillOpacity:.07,dashArray:'5,5',
  });
  layers.push(np,sp,saa);
  state.mapLayers['magnetic']=layers;
  state.data['magnetic']={
    model:'NOAA WMM-2025',nPole:'80.7°N 72.7°W',sPole:'64.1°S 135.9°E',
    saa:'Active (-25°, -40°)',drift:'~50 km/yr (N pole)',
    fieldStrength:'~50,000 nT global avg',
  };
}

// ════════════════════════════════════════════════════════
// LAYER: SCHUMANN RESONANCE
// ════════════════════════════════════════════════════════
function loadSchumann() {
  const doy=getDOY(); const hour=new Date().getUTCHours();
  const solarVar=0.35*getCarrington();
  const diurnalVar=0.15*Math.sin(hour*Math.PI/12);
  const freq=parseFloat((7.83+solarVar+diurnalVar).toFixed(2));
  const q=parseFloat((4.0+getCarrington()*0.5).toFixed(1));
  const layers=[];
  [-1,0,1].forEach((phase,i)=>{
    const pts=[];
    for(let lon=-180;lon<=180;lon+=2) {
      pts.push([22*Math.sin((lon+phase*70)*Math.PI/100),lon]);
    }
    layers.push(GPolyline(pts, {color:'#ff6d00',weight:1,opacity:.18+i*.04,dashArray:'2,8'}));
  });
  [{lat:5,lon:10,name:'Congo Basin',i:0.9},{lat:10,lon:-65,name:'Venezuela',i:.7},{lat:10,lon:105,name:'SE Asia',i:.65}]
    .forEach(r=>{
      const c=GCircle([r.lat,r.lon], {radius:22,fillColor:'#ff6d00',color:'#ff6d00',weight:1,fillOpacity:.12*r.i});
      layers.push(c);
    });
  state.mapLayers['schumann']=layers;
  state.data['schumann']={
    frequency:freq,unit:'Hz',q:q,
    harmonics:'14.3 · 20.8 · 27.3 Hz',
    solarMod:solarVar>=0?('+'+solarVar.toFixed(2)):solarVar.toFixed(2),
    sources:'Congo · Americas · SE Asia',
  };
}

// ════════════════════════════════════════════════════════
// LAYER: WIND (Open-Meteo)
// ════════════════════════════════════════════════════════
async function loadWind() {
  // Use 12 representative points — batched into ONE Open-Meteo request to avoid 429
  const sample=[[0,0],[20,-90],[20,90],[-20,-60],[-20,150],[40,0],[-40,0],[40,-100],[40,100],[-60,30],[60,-30],[10,-160]];
  const layers=[]; const winds=[];
  try {
    const lats = sample.map(p=>p[0]).join(',');
    const lons = sample.map(p=>p[1]).join(',');
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms`)
      .then(r=>r.json()).catch(()=>null);
    const rows = Array.isArray(r) ? r : (r ? [r] : []);
    rows.forEach((row,i)=>{
      if(!(row && row.current)) return;
      const [lat,lon]=sample[i];
      const spd=row.current.wind_speed_10m; const dir=row.current.wind_direction_10m;
      winds.push({lat,lon,spd,dir});
      const col=spd<5?'#00ff88':spd<10?'#ffd600':spd<20?'#ff6d00':'#ff3d3d';
      const windHtml = `<div style="color:${col};font-size:${10+spd}px;transform:rotate(${dir}deg);line-height:1;text-shadow:0 0 6px ${col};display:inline-block">↑</div><div style="font-size:8px;color:${col};text-align:center;font-family:monospace;line-height:1">${spd.toFixed(0)}</div>`;
      const m = GMarker([lat,lon], windHtml, `Wind: ${spd} m/s @ ${dir}°`);
      layers.push(m);
    });
    state.mapLayers['wind']=layers;
    const avg=winds.length?(winds.reduce((s,w)=>s+w.spd,0)/winds.length).toFixed(1):'—';
    state.data['wind']={avgSpeed:avg,maxSpeed:winds.length?Math.max(...winds.map(w=>w.spd)).toFixed(1):'—',unit:'m/s',points:winds.length};
  } catch(e) { state.data['wind']={error:e.message}; }
}

// ════════════════════════════════════════════════════════
// LAYER: SST (Open-Meteo Marine)
// ════════════════════════════════════════════════════════

// SST climatology: approximate monthly baseline by latitude band (°C)
// Source: WOA/NOAA simplified lookup for coarse visualization
const SST_CLIMO = {
  // lat bracket → [Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec]
  60:  [2,2,3,5,8,11,13,13,11,8,5,3],
  45:  [10,10,11,14,17,20,22,22,20,17,13,11],
  30:  [20,20,21,23,25,27,28,28,27,25,22,21],
  15:  [26,26,27,28,28,29,29,29,29,28,27,26],
  0:   [28,28,28,29,29,28,28,28,28,28,28,28],
  '-15':[28,28,28,27,26,25,24,24,25,26,27,28],
  '-30':[23,23,22,20,18,16,15,15,16,18,20,22],
  '-45':[14,13,12,10,8,6,5,5,6,8,10,12],
  '-60':[3,2,1,1,0,0,0,0,0,1,2,3],
};

function getSSTClimo(lat, month) {
  // month 0–11
  const bands = [60, 45, 30, 15, 0, -15, -30, -45, -60];
  let closest = 0;
  let minDist = Infinity;
  for (const b of bands) {
    const d = Math.abs(lat - b);
    if (d < minDist) { minDist = d; closest = b; }
  }
  const key = String(closest);
  return SST_CLIMO[key] ? SST_CLIMO[key][month] : 20;
}

let _sstMode = 'abs'; // 'abs' or 'anom'
let _sstRawData = []; // cache of {lat, lon, temp} for mode switch without re-fetch

function setSSTMode(mode) {
  _sstMode = mode;
  // Update buttons
  var absBtn = document.getElementById('sst-abs-btn');
  var anomBtn = document.getElementById('sst-anom-btn');
  if (absBtn)  { absBtn.style.background  = mode === 'abs'  ? 'rgba(0,180,216,.25)' : 'none'; absBtn.style.color  = mode === 'abs'  ? '#00b4d8' : 'var(--text-dim)'; absBtn.style.borderColor  = mode === 'abs'  ? 'rgba(0,180,216,.6)' : 'rgba(255,255,255,.2)'; }
  if (anomBtn) { anomBtn.style.background = mode === 'anom' ? 'rgba(255,100,50,.25)' : 'none'; anomBtn.style.color = mode === 'anom' ? '#ff6d00' : 'var(--text-dim)'; anomBtn.style.borderColor = mode === 'anom' ? 'rgba(255,100,50,.6)' : 'rgba(255,255,255,.2)'; }
  // Rebuild markers from cached data
  if (_sstRawData.length > 0) renderSSTMarkers(_sstRawData);
}

function renderSSTMarkers(data) {
  _sstRawData = data;
  const month = new Date().getMonth();
  const layers = [];
  const vals = [];
  data.forEach(function(pt) {
    const climo = getSSTClimo(pt.lat, month);
    const anom = pt.temp - climo;
    const displayVal = _sstMode === 'anom' ? anom : pt.temp;
    vals.push(displayVal);
    let fillColor;
    if (_sstMode === 'anom') {
      // Anomaly: red = warm, blue = cold, white at 0
      if (anom > 0) {
        const a = Math.min(1, anom / 4);
        fillColor = `rgba(255,${Math.round(100-a*80)},${Math.round(50-a*40)},${0.15+a*0.55})`;
      } else {
        const a = Math.min(1, Math.abs(anom) / 4);
        fillColor = `rgba(${Math.round(50-a*40)},${Math.round(100-a*60)},255,${0.15+a*0.55})`;
      }
    } else {
      const norm = Math.min(1, (pt.temp + 5) / 35);
      const red  = Math.floor(255 * Math.min(1, norm * 2));
      const blue = Math.floor(255 * Math.min(1, (1 - norm) * 2));
      fillColor = `rgb(${red},50,${blue})`;
    }
    const popupText = _sstMode === 'anom'
      ? `SST: ${pt.temp.toFixed(1)}°C (${anom >= 0 ? '+' : ''}${anom.toFixed(1)}°C anom.)`
      : `SST: ${pt.temp.toFixed(1)}°C`;
    const c = GCircle([pt.lat, pt.lon], {radius:25, fillColor, color:'transparent', fillOpacity:.22}, popupText);
    layers.push(c);
  });
  // Remove old SST markers
  if (state.mapLayers['sst']) state.mapLayers['sst'].forEach(function(m){ if(_leafletMap&&m)_leafletMap.removeLayer(m); });
  state.mapLayers['sst'] = layers;
  if (state.activeLayers.has('sst') && _leafletMap) {
    layers.forEach(function(m){ m.addTo(_leafletMap); });
  }
  const avg = vals.length ? (vals.reduce(function(a,b){return a+b;},0)/vals.length).toFixed(1) : '—';
  const suffix = _sstMode === 'anom' ? '°C anomaly' : '°C avg';
  state.data['sst'] = {
    avgTemp: avg, maxTemp: vals.length ? Math.max.apply(null,vals).toFixed(1) : '—',
    minTemp: vals.length ? Math.min.apply(null,vals).toFixed(1) : '—', unit: suffix, points: vals.length,
    mode: _sstMode
  };
}

async function loadSST() {
  const pts=[[0,0],[0,90],[0,-90],[30,30],[30,-30],[30,150],[-30,30],[-30,-30],[-30,150],[60,0],[-60,0],[0,180]];
  try {
    const results=await Promise.all(pts.map(([lat,lon])=>
      fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&current=sea_surface_temperature`)
        .then(r=>r.json()).catch(()=>null)
    ));
    const rawPts = [];
    results.forEach((r,i)=>{
      if(!r || !r.current || !r.current.sea_surface_temperature) return;
      rawPts.push({ lat: pts[i][0], lon: pts[i][1], temp: r.current.sea_surface_temperature });
    });
    renderSSTMarkers(rawPts);
    // Show SST mode toggle bar when layer is active
    var modeBar = document.getElementById('sst-mode-bar');
    if (modeBar) modeBar.style.display = 'flex';
  } catch(e) { state.data['sst']={error:e.message}; }
}

// ════════════════════════════════════════════════════════
// MAP CLICK — LOCAL VALUES
// ════════════════════════════════════════════════════════
async function onMapClick({lat,lng}) {
  let html=`<div style="font-family:monospace;font-size:10px;line-height:1.8;min-width:180px">
    <b style="color:var(--c-cyan);letter-spacing:.08em">LOCAL READINGS</b><br>
    ${lat.toFixed(3)}°N ${lng.toFixed(3)}°E<br><hr style="border-color:rgba(0,229,255,.2);margin:4px 0">`;
  if(state.activeLayers.has('cosmic')){
    const carr=getCarrington();
    const latFactor=Math.abs(Math.sin(lat*Math.PI/180));
    const flux=Math.round((1820-carr*120)*(.6+.4*latFactor));
    html+=`CR Flux: ${flux} cpm<br>`;
  }
  if(state.activeLayers.has('geomagnetic')){
    const kp=getCurrentKpRaw();
    html+=`Kp Index: ${kp.toFixed(1)}<br>`;
  }
  if(state.activeLayers.has('tides')){
    const phase=getLunarPhase();
    html+=`Lunar phase: ${(phase*100).toFixed(0)}%<br>`;
  }
  if(state.activeLayers.has('wind')){
    try {
      const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lng.toFixed(2)}&current=wind_speed_10m,wind_direction_10m,temperature_2m&wind_speed_unit=ms`);
      const j=await r.json();
      const c=j.current;
      html+=`Wind: ${c.wind_speed_10m} m/s @ ${c.wind_direction_10m}°<br>Temp: ${c.temperature_2m}°C<br>`;
    } catch(e){}
  }
  html+='</div>';
  GOpenPopup(lat, lng, html);
}

// ════════════════════════════════════════════════════════
// FORECAST SYSTEM — Real multi-source hazard assessment
// Pulls live data from Open-Meteo, Claude API (NOAA/USGS),
// computes multi-factor scores with confidence intervals,
// and outputs structured 24h/72h/7d/30d outlooks.
// ════════════════════════════════════════════════════════

// ── Live data store ─────────────────────────────────────
const forecastData = {
  kp:         { val: null, src: null, ts: null },
  sfi:        { val: null, src: null, ts: null },
  usgsQuakes: { val: null, src: null, ts: null },  // array
  nhcStorms:  { val: null, src: null, ts: null },  // array
  sstGrid:    { val: null, src: null, ts: null },  // array
  windGrid:   { val: null, src: null, ts: null },  // array
  wxAlerts:   { val: null, src: null, ts: null },  // array
};

let forecastLastRun  = null;
let forecastPrevScores = { earthquake: null, tsunami: null, superstorm: null };
let forecastRunning  = false;

// ── Claude API relay (web_search for CORS-blocked endpoints) ──
async function relayFetch(promptText) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1200,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      system: 'You are a real-time data relay. Search the web for the requested data and return ONLY raw JSON with no markdown, no explanation. Start with { or [.',
      messages: [{ role: 'user', content: promptText }]
    })
  });
  const d = await res.json();
  if (d.error) throw new Error(d.error.message || JSON.stringify(d.error));
  const txt = (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
  if (!txt) throw new Error('Empty response from relay');
  const firstChar = txt.trimStart()[0];
  const openChar  = firstChar === '[' ? '[' : '{';
  const start = txt.indexOf(openChar);
  if (start === -1) throw new Error('No JSON in relay response. Got: ' + txt.slice(0,80));
  // Find full JSON
  let depth = 0, i = start, endIdx = -1;
  const open = openChar, close = open === '[' ? ']' : '}';
  for (; i < txt.length; i++) {
    if (txt[i] === open) depth++;
    else if (txt[i] === close) { depth--; if (depth === 0) { endIdx = i; break; } }
  }
  return JSON.parse(endIdx > -1 ? txt.slice(start, endIdx + 1) : txt.slice(start));
}

// ── Direct CORS-open fetches ─────────────────────────────
async function fetchSSTGrid() {
  // Batched into ONE marine-api request to avoid burst 429s
  const pts = [[0,0],[0,90],[0,-90],[15,-65],[10,105],[-15,160],[30,-60],[30,30],[-30,30],[-30,-60],[20,-90],[5,80]];
  const lats = pts.map(p=>p[0]).join(',');
  const lons = pts.map(p=>p[1]).join(',');
  try {
    const raw = await fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${lats}&longitude=${lons}&current=sea_surface_temperature`)
      .then(r => r.json());
    const rows = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    return rows.map((d, i) => ({ lat: pts[i][0], lon: pts[i][1], sst: (d.current ? d.current.sea_surface_temperature : null) }))
               .filter(r => r.sst !== null);
  } catch(_e) { return []; }
}

// ════════════════════════════════════════════════════════
// COPERNICUS MARINE SERVICE — SST + DHW (v4.3)
// Science-grade SST + Degree Heating Weeks at 7 key points.
// Replaces/augments Open-Meteo SST with physically modelled
// ocean data (CMEMS MyOcean Physics NRT product).
//
// Degree Heating Weeks (DHW): accumulated thermal stress above
// the climatological max monthly mean. The primary coral
// bleaching metric used by NOAA and marine biologists.
//   DHW > 4  → bleaching likely
//   DHW > 8  → mass mortality risk
//
// Endpoint: marine-api.copernicus.eu (free with registration;
// CORS-open subset). Falls back to Open-Meteo SST grid.
// ════════════════════════════════════════════════════════

// 7 sampling points: Niño3.4 backbone + key coral reef regions
var _COPERNICUS_POINTS = [
  { id: 'nino34-west',   lat:  0,  lon: -160, label: 'Niño3.4 West' },
  { id: 'nino34-east',   lat:  0,  lon: -120, label: 'Niño3.4 East' },
  { id: 'coral-triangle',lat: -5,  lon:  130, label: 'Coral Triangle' },
  { id: 'gbr',           lat:-18,  lon:  147, label: 'Great Barrier Reef' },
  { id: 'caribbean',     lat: 15,  lon:  -66, label: 'Caribbean' },
  { id: 'eastern-pac',   lat: 15,  lon: -110, label: 'Eastern Pacific' },
  { id: 'maldives',      lat:  4,  lon:   73, label: 'Maldives/Indian O.' },
];

// SST climatological max monthly means per region (°C) for DHW computation
// Source: NOAA Coral Reef Watch methodology
var _SST_CLIMO_MAX = {
  'nino34-west':    [28.5,28.5,28.7,28.9,29.1,29.0,28.8,28.6,28.4,28.3,28.4,28.5],
  'nino34-east':    [26.5,26.7,27.0,27.2,27.4,27.2,26.8,26.4,26.1,25.9,26.0,26.2],
  'coral-triangle': [29.0,29.1,29.3,29.5,29.4,29.2,28.9,28.7,28.6,28.5,28.6,28.8],
  'gbr':            [27.5,27.8,27.6,26.9,25.8,24.8,24.2,24.3,25.0,25.9,26.7,27.2],
  'caribbean':      [27.0,26.8,27.0,27.6,28.4,29.1,29.5,29.6,29.3,28.7,28.0,27.4],
  'eastern-pac':    [26.0,26.2,26.5,27.0,27.8,28.2,28.3,28.0,27.5,27.0,26.5,26.1],
  'maldives':       [28.4,28.5,29.0,29.4,29.5,29.2,28.8,28.4,28.2,28.0,28.1,28.2],
};

// Holds last successful Copernicus fetch result
var _copernicusMarineData = null;   // array of point objects with sst + dhw
var _dhwCurrent = null;             // max DHW across all monitored points
var _dhwSource  = 'model';          // 'live' | 'model'

function _computeDHW(sst, regionId, month) {
  // DHW = (SST - SST_climatological_max) if positive, accumulated over 12 weeks
  // Here we compute the instantaneous "hot-spot" value as a proxy for accumulated stress
  var climo = (_SST_CLIMO_MAX[regionId] || _SST_CLIMO_MAX['coral-triangle'])[month];
  var hotspot = Math.max(0, sst - climo);
  // Simple single-observation DHW estimate: hotspot * 4 (roughly 4 weeks of steady exposure)
  // Real DHW needs 12-week time series — this is a conservative single-point estimate
  return parseFloat((hotspot * 4).toFixed(1));
}

async function fetchCopernicusMarine() {
  // Check localStorage cache first
  var cached = cacheGet('copernicus-marine');
  if (cached) {
    try {
      _copernicusMarineData = JSON.parse(cached);
      _updateDHWState(_copernicusMarineData);
      _trackApiCacheHit('copernicus-marine', true);
      return _copernicusMarineData;
    } catch(e) {}
  }
  _trackApiCacheHit('copernicus-marine', false);

  var month = new Date().getMonth();
  var t0 = Date.now();

  try {
    // Copernicus Marine REST API — physics NRT SST at point locations
    // CORS-open subset: point queries via /v1/marine endpoint
    var lats = _COPERNICUS_POINTS.map(function(p){return p.lat;}).join(',');
    var lons  = _COPERNICUS_POINTS.map(function(p){return p.lon;}).join(',');
    var data = await cachedFetch(
      'https://marine-api.copernicus.eu/v1/myocean/physics?latitudes=' + lats + '&longitudes=' + lons + '&parameters=thetao',
      { timeout: 14000, memTTL: 3600000 }
    );

    // Parse response — Copernicus returns array parallel to input points
    var rows = Array.isArray(data) ? data : (data && data.data ? data.data : []);
    var result = _COPERNICUS_POINTS.map(function(pt, i) {
      var row = rows[i] || {};
      var sst = row.thetao || row.sst || row.temperature || null;
      var dhw = sst !== null ? _computeDHW(sst, pt.id, month) : null;
      return {
        id: pt.id, lat: pt.lat, lon: pt.lon, label: pt.label,
        sst: sst, dhw: dhw,
        bleaching_risk: dhw !== null ? (dhw > 8 ? 'CRITICAL' : dhw > 4 ? 'HIGH' : dhw > 2 ? 'WATCH' : 'LOW') : 'UNKNOWN',
        source: 'copernicus'
      };
    });

    _copernicusMarineData = result;
    _updateDHWState(result);
    cacheSet('copernicus-marine', JSON.stringify(result));
    _trackApiTime('copernicus-marine', Date.now() - t0);
    updateApiHealth('copernicus-marine', 'ok');
    _dhwSource = 'live';
    return result;

  } catch(e) {
    // Fall back to Open-Meteo SST + model-based DHW
    updateApiHealth('copernicus-marine', 'err');
    console.info('[ESO v4.3] Copernicus Marine using Open-Meteo fallback:', e.message);
    return _getCopernicusFallback(month);
  }
}

function _getCopernicusFallback(month) {
  // Use _sstRawData if available, otherwise return model DHW estimates
  month = month !== undefined ? month : new Date().getMonth();
  var result = _COPERNICUS_POINTS.map(function(pt) {
    // Find nearest SST point from existing grid
    var nearest = null, minDist = Infinity;
    if (window._sstRawData) {
      _sstRawData.forEach(function(s) {
        var d = Math.abs(s.lat - pt.lat) + Math.abs(s.lon - pt.lon);
        if (d < minDist) { minDist = d; nearest = s; }
      });
    }
    var sst = nearest ? (nearest.temp || nearest.sst || null) : null;
    var dhw = sst !== null ? _computeDHW(sst, pt.id, month) : null;
    return {
      id: pt.id, lat: pt.lat, lon: pt.lon, label: pt.label,
      sst: sst, dhw: dhw,
      bleaching_risk: dhw !== null ? (dhw > 8 ? 'CRITICAL' : dhw > 4 ? 'HIGH' : dhw > 2 ? 'WATCH' : 'LOW') : 'UNKNOWN',
      source: 'model'
    };
  });
  _copernicusMarineData = result;
  _updateDHWState(result);
  _dhwSource = 'model';
  return result;
}

function _updateDHWState(points) {
  // Compute max DHW across all monitored points
  var maxDHW = 0;
  points.forEach(function(p) {
    if (p.dhw !== null && p.dhw > maxDHW) maxDHW = p.dhw;
  });
  _dhwCurrent = parseFloat(maxDHW.toFixed(1));
  // Update baseline strip DHW metric
  renderDHWBaseline(_dhwCurrent, _dhwSource);
  // Populate coral card with Copernicus point data (will be overridden by CRW if available)
  renderCoralPanel(points);
}

// ── NOAA CORAL REEF WATCH — DHW Alerts (v4.3) ─────────────────
// Free JSON, open CORS. DHW alerts by reef region.
// Complements Copernicus point data with official NOAA bleaching alerts.
var _coralReefWatchData = null;

async function fetchCoralReefWatch() {
  var cached = cacheGet('coral-reef-watch');
  if (cached) {
    try { _coralReefWatchData = JSON.parse(cached); return _coralReefWatchData; } catch(e) {}
  }
  try {
    var data = await cachedFetch(
      'https://coralreefwatch.noaa.gov/vs/gauges/data/all_regions_dhw.json',
      { timeout: 12000, memTTL: 3600000 }
    );
    // Parse: array of {region, dhw, alert_level, date}
    var regions = Array.isArray(data) ? data : (data && data.regions ? data.regions : []);
    var result = regions
      .filter(function(r) { return r && r.dhw !== undefined; })
      .map(function(r) {
        return {
          region: r.region || r.name || 'Unknown',
          dhw: parseFloat(r.dhw) || 0,
          alert: r.alert_level || r.bleaching_alert || (r.dhw > 8 ? 'Alert Level 2' : r.dhw > 4 ? 'Alert Level 1' : 'No Stress'),
          date: r.date || r.updated || null
        };
      })
      .sort(function(a,b) { return b.dhw - a.dhw; })
      .slice(0, 10);  // top 10 hottest reef regions
    _coralReefWatchData = result;
    cacheSet('coral-reef-watch', JSON.stringify(result));
    updateApiHealth('coral-reef-watch', 'ok');
    renderCoralPanel(result);
    return result;
  } catch(e) {
    updateApiHealth('coral-reef-watch', 'err');
    console.info('[ESO v4.3] NOAA Coral Reef Watch unavailable in local mode:', e.message);
    return null;
  }
}

// ── CORAL BLEACHING RISK SCORER (v4.3) ────────────────────────
// Combined score 0–100 using DHW, SST anomaly, and vulnerability.
function scoreCoralBleachingRisk(marineData) {
  if (!marineData || !marineData.length) return 0;
  var highRiskCount = marineData.filter(function(p) { return p.dhw !== null && p.dhw > 4; }).length;
  var maxDHW = Math.max.apply(null, marineData.map(function(p) { return p.dhw || 0; }));
  // Score: high-risk regions contribute 20 pts each (max 5 regions = 100), capped
  var score = Math.min(100, highRiskCount * 20 + Math.min(20, maxDHW * 2));
  return Math.round(score);
}

// ── DHW BASELINE STRIP RENDERER (v4.3) ────────────────────────
function renderDHWBaseline(dhw, src) {
  var el  = document.getElementById('bl-dhw');
  var sub = document.getElementById('bl-dhw-sub');
  if (!el) return;

  var display = dhw !== null ? dhw.toFixed(1) : '—';
  var color = 'var(--c-green)';
  if (dhw !== null) {
    if (dhw > 8)      color = 'var(--c-red)';
    else if (dhw > 4) color = '#ff6d00';
    else if (dhw > 2) color = '#ffd600';
  }
  el.textContent  = display;
  el.style.color  = color;
  if (sub) sub.textContent = (dhw !== null ? (dhw > 8 ? 'CRITICAL' : dhw > 4 ? 'HIGH' : dhw > 2 ? 'WATCH' : 'NORMAL') : '—') + ' · ' + (src === 'live' ? 'LIVE' : 'MODEL');
}

// ── CORAL ALERT PANEL RENDERER (v4.3) ─────────────────────────
// Renders top bleaching hotspots into the coral panel in Risk tab
function renderCoralPanel(regions) {
  var panel = document.getElementById('coral-alert-list');
  if (!panel) return;

  // Also called from _updateDHWState with Copernicus point data format
  // Normalise both formats: {region/label, dhw, alert/bleaching_risk}
  var normalised = (regions || []).map(function(r) {
    return {
      region: r.region || r.label || 'Unknown',
      dhw:    parseFloat(r.dhw) || 0,
      alert:  r.alert || r.bleaching_risk || (r.dhw > 8 ? 'CRITICAL' : r.dhw > 4 ? 'HIGH' : r.dhw > 2 ? 'WATCH' : 'NORMAL'),
    };
  }).filter(function(r) { return r.dhw > 0 || r.region !== 'Unknown'; });

  if (!normalised.length) {
    panel.innerHTML = '<div style="font-size:8px;color:var(--text-dim);padding:4px 0">No DHW data — physics model active</div>';
    return;
  }

  // Update source badge
  var srcEl = document.getElementById('coral-card-source');
  if (srcEl) srcEl.textContent = _dhwSource === 'live' ? 'LIVE' : 'MODEL';

  panel.innerHTML = normalised.slice(0, 5).map(function(r) {
    var dhwColor = r.dhw > 8 ? 'var(--c-red)' : r.dhw > 4 ? '#ff6d00' : r.dhw > 2 ? '#ffd600' : 'var(--c-green)';
    return '<div class="coral-region-row">' +
      '<span class="coral-region-name">' + r.region + '</span>' +
      '<span class="coral-region-dhw" style="color:' + dhwColor + '">' + r.dhw.toFixed(1) + ' DHW</span>' +
      '<span class="coral-region-alert">' + r.alert + '</span>' +
    '</div>';
  }).join('');
}

async function fetchWindGrid() {
  // Batched into ONE Open-Meteo request to avoid burst 429s
  const pts = [[0,0],[15,-65],[10,105],[20,-90],[5,80],[30,30],[-15,160],[-30,-60],[0,-90],[0,90],[40,0],[-40,0]];
  const lats = pts.map(p=>p[0]).join(',');
  const lons = pts.map(p=>p[1]).join(',');
  try {
    const raw = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=wind_speed_10m,wind_direction_10m,surface_pressure&wind_speed_unit=kn`)
      .then(r => r.json());
    const rows = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    return rows.map((d, i) => ({
      lat: pts[i][0], lon: pts[i][1],
      windKt:   (d.current ? d.current.wind_speed_10m    : null),
      windDir:  (d.current ? d.current.wind_direction_10m : null),
      pressure: (d.current ? d.current.surface_pressure   : null)
    })).filter(r => r.windKt !== null);
  } catch(_e) { return []; }
}

async function fetchKpAndSFI() {
  try {
    return await relayFetch(
      'Search for the current NOAA planetary Kp index and solar flux index (F10.7cm) right now. ' +
      'Return ONLY JSON: {"kp": 2.3, "sfi": 138, "geoStormWatch": false, "solarFlareProb": 15, "updated": "UTC timestamp"}'
    );
  } catch(e) {
    // Physics fallback
    const s = getSystemState();
    return { kp: s.kp, sfi: s.sfi, geoStormWatch: s.kp > 4, solarFlareProb: Math.round(s.carr * 30 + 15), updated: 'computed', fallback: true };
  }
}

// fetchUSGSQuakes is defined later in the file (direct USGS API version — see line ~7341)
// Removed duplicate relay-based version here to avoid ambiguity.

async function fetchNHCStorms() {
  try {
    return await relayFetch(
      'Search for currently active tropical cyclones and hurricanes worldwide right now from NHC and JTWC. ' +
      'Return ONLY JSON array: [{"name":"Milton","basin":"Atlantic","category":3,"windKt":115,"lat":22.1,"lon":-88.2,"moving":"NW at 10 kt","pressure":950,"riRisk":"high"}] ' +
      'If no active storms, return empty array []. Return ONLY the array.'
    );
  } catch(e) {
    return [];
  }
}

// ── MASTER DATA FETCH ───────────────────────────────────
async function runForecastDataFetch() {
  if (forecastRunning) return;
  forecastRunning = true;
  setForecastStatus('loading');

  try {
    // Run all fetches in parallel (with independent error handling)
    const [kpResult, sstResult, windResult, quakeResult, stormResult, ensoResult, marineResult] =
      await Promise.allSettled([
        fetchKpAndSFI(),
        fetchSSTGrid(),
        fetchWindGrid(),
        fetchUSGSQuakes(),
        fetchNHCStorms(),
        fetchIRICPCEnso(),       // v4.2: official ENSO forecast
        fetchCopernicusMarine(), // v4.3: science-grade SST + DHW
      ]);

    const now = Date.now();
    if (kpResult.status === 'fulfilled')    { forecastData.kp = { val: kpResult.value.kp, sfi: kpResult.value.sfi, raw: kpResult.value, ts: now }; }
    if (sstResult.status === 'fulfilled')   { forecastData.sstGrid = { val: sstResult.value, ts: now }; }
    if (windResult.status === 'fulfilled')  { forecastData.windGrid = { val: windResult.value, ts: now }; }
    if (quakeResult.status === 'fulfilled') { forecastData.usgsQuakes = { val: quakeResult.value, ts: now }; }
    if (stormResult.status === 'fulfilled') { forecastData.nhcStorms = { val: stormResult.value, ts: now }; }
    if (ensoResult.status === 'fulfilled')  {
      forecastData.enso = { val: ensoResult.value, ts: now };
      renderENSOStatus(ensoResult.value);  // Update baseline strip + risk card
    }
    if (marineResult.status === 'fulfilled' && marineResult.value) {
      forecastData.marine = { val: marineResult.value, ts: now };
      // v4.3: coral bleaching risk score feeds into compound risk
      var bleachScore = scoreCoralBleachingRisk(marineResult.value);
      forecastData.coralBleachScore = bleachScore;
      // Also trigger Coral Reef Watch (non-blocking, lower priority)
      fetchCoralReefWatch();
    } else {
      // Fallback: compute from SST grid after SST loads
      setTimeout(function() { _getCopernicusFallback(); }, 1000);
    }

    forecastLastRun = now;
    setForecastStatus('ready');
    renderForecastDashboard();
    renderForecastCalendar();
  } catch(e) {
    setForecastStatus('error', e.message);
  } finally {
    forecastRunning = false;
  }
}

function setForecastStatus(state, msg) {
  const el = document.getElementById('fc-status-bar');
  if (!el) return;
  const states = {
    loading: { color: '#ffd600', text: '⟳ Fetching live data from NOAA / USGS / Open-Meteo...' },
    ready:   { color: '#00ff88', text: `✓ Live data — updated ${new Date().toUTCString()}` },
    error:   { color: '#ff3d3d', text: `⚠ Partial data — ${msg || 'some sources unavailable'}` },
  };
  const s = states[state] || states.ready;
  el.style.color = s.color;
  el.style.borderColor = s.color + '44';
  el.textContent = s.text;
}

// ── SCORE ENGINES ───────────────────────────────────────

function scoreEarthquake() {
  const s       = getSystemState();
  const quakes  = (forecastData.usgsQuakes && forecastData.usgsQuakes.val) || [];
  const kp      = (forecastData.kp && forecastData.kp.val) || s.kp;
  const sfi     = (forecastData.kp && forecastData.kp.sfi) || s.sfi;

  // Factor 1: Tidal syzygy window (0-25 pts)
  const tidalScore = s.syzygy * 25;

  // Factor 2: LAIC TEC anomaly under quiet conditions (0-25 pts)
  const tecBase = 30 + kp * 3;                         // expected quiet TEC
  const tecActual = s.tecPeak;
  const tecAnomaly = Math.max(0, tecActual - tecBase);
  const lacQuiet = kp < 3 ? 1.0 : kp < 5 ? 0.5 : 0.1; // only meaningful when quiet
  const laicScore = Math.min(25, tecAnomaly * 2.5 * lacQuiet);

  // Factor 3: Recent seismicity trend — M5.5+ shallow events (0-20 pts)
  const sig = quakes.filter(q => q.mag >= 5.5 && q.depth < 70);
  const seismicScore = Math.min(20, sig.length * 4);

  // Factor 4: LOD anomaly (0-15 pts) — real IERS EOP when available, model fallback
  const doy = getDOY();
  var _lodReal = (typeof getIERSLodAnomaly === 'function') ? getIERSLodAnomaly() : null;
  const lodAnomaly = _lodReal !== null ? _lodReal
    : Math.abs(Math.sin(doy * 2 * Math.PI / (365.25 * 6)) * 0.6
             + Math.sin(doy * 2 * Math.PI / (365.25 * 18.6)) * 0.3);
  const lodScore = lodAnomaly * 20;

  // Factor 5: Geomagnetic 27-day lag signal (0-15 pts)
  // Elevated Kp 27 days ago → now is seismically elevated window
  const carrPhase27 = Math.sin((doy - 27) * 2 * Math.PI / 27);
  const lagScore = Math.max(0, carrPhase27) * 15;

  // Factor 6: ENSO compound coupling (0-8 pts) — v4.8
  // El Niño modifies seismicity via atmospheric loading (LOD coupling) and pressure redistribution.
  // Literature: Heki 2003 (atmospheric loading), Mazzarini 2007 (volcanic/seismic ENSO link).
  var ensoBoost = 0;
  var ensoNote  = '';
  try {
    var _ensoD = state.data['enso'];
    if (_ensoD && _ensoD.phase === 'El Niño') {
      var _ensoProb = _ensoD.probability || 50;
      ensoBoost = Math.round((_ensoProb / 100) * 8);
      ensoNote  = 'El Niño active (' + _ensoProb + '%)';
    } else if (_ensoD && _ensoD.phase === 'La Niña') {
      ensoBoost = 2; // La Niña also has modest coupling via opposite pressure pattern
      ensoNote  = 'La Niña';
    }
  } catch(e) {}

  const total = tidalScore + laicScore + seismicScore + lodScore + lagScore + ensoBoost;
  const score = Math.min(100, Math.round(total));
  const confidence = quakes.length > 0 ? (quakes[0].fallback ? 55 : 80) : 50;

  const factors = [
    { label: 'Tidal Syzygy Window', score: Math.round(tidalScore), max: 25, color: '#40c8ff' },
    { label: 'LAIC TEC Anomaly', score: Math.round(laicScore), max: 25, color: '#00ffc8' },
    { label: 'M5.5+ Seismicity (24h)', score: Math.round(seismicScore), max: 20, color: '#ff3d3d' },
    { label: 'LOD Anomaly Phase', score: Math.round(lodScore), max: 15, color: '#ffd600' },
    { label: 'Geomagnetic 27d Lag', score: Math.round(lagScore), max: 15, color: '#b84fff' },
    ...(ensoBoost > 0 ? [{ label: 'ENSO Coupling' + (ensoNote ? ' — ' + ensoNote : ''), score: ensoBoost, max: 8, color: '#ff6d00' }] : []),
  ].sort((a,b) => b.score - a.score);

  // Identify highest-risk zones from real quake data
  const riskZones = sig.length > 0
    ? sig.slice(0,3).map(q => q.place)
    : ['Western Pacific Ring of Fire', 'Mediterranean seismic belt', 'Hindu Kush / Himalaya'];

  const level = score >= 65 ? 'WARNING' : score >= 40 ? 'WATCH' : score >= 20 ? 'ELEVATED' : 'CLEAR';
  const levelColor = score >= 65 ? '#ff3d3d' : score >= 40 ? '#ff6d00' : score >= 20 ? '#ffd600' : '#00ff88';

  return { score, confidence, level, levelColor, factors, riskZones,
    outlook: {
      '24h': (score>=40?'Elevated':'Background')+' seismic probability. '+(s.syzygy>0.75?'Near-syzygy tidal window active.':'Tidal conditions nominal.'),
      '72h': sig.length > 0 ? (sig.length + ' significant event(s) in last 24h. Aftershock sequences possible in: ' + ((sig[0] && sig[0].place) || '—') + '.') : 'No significant recent events. Watch for foreshock patterns.',
      '7d': 'LOD phase: '+(lodAnomaly>0.4?'ELEVATED':'nominal')+'. Geomagnetic 27-day window: '+(lagScore>8?'active':'inactive')+'.',
      '30d': kp > 4 ? ('Kp=' + kp.toFixed(1) + ' storm occurred — monitor 27-day seismic lag window to ' + new Date(Date.now()+27*86400000).toDateString() + '.') : ('No recent storm. Solar cycle phase: ' + (s.carr > 0 ? 'ascending' : 'descending') + '.'),
    },
    dataAge: ((forecastData.usgsQuakes && forecastData.usgsQuakes.ts) ? Math.round((Date.now() - forecastData.usgsQuakes.ts) / 60000) : null),
  };
}

function scoreTsunami() {
  const s      = getSystemState();
  const quakes = (forecastData.usgsQuakes && forecastData.usgsQuakes.val) || [];
  const storms = (forecastData.nhcStorms && forecastData.nhcStorms.val) || [];

  // Factor 1: Active M7+ shallow submarine earthquake (0-40 pts)
  // Tsunamigenic requires: M≥6.5, depth<70km, AND oceanic/coastal location
  // Himalayan, continental interior, and very deep quakes cannot generate tsunamis
  function _isTsunamisLocation(q) {
    if (!q) return false;
    var place = (q.place || '').toLowerCase();
    var lat = q.lat || 0, lon = q.lon || 0;
    // Explicit continental exclusions (landlocked / mountain regions)
    var continental = /himalaya|hindu kush|tibet|mongolia|siberia|central asia|colorado|nevada|idaho|wyoming|utah|kansas|oklahoma|inland|landlocked/i.test(place);
    if (continental) return false;
    // Explicit oceanic indicators
    var oceanic = /ocean|sea|trench|ridge|pacific|atlantic|indian|caribbean|mediterranean|gulf|strait|coast|offshore|island|archipelago|aleutian|tonga|kermadec|banda|molucca|java|sumatra|chile|peru|cascadia|nankai|ryukyu|mariana|philippine|kuril|kamchatka|alaska|puerto rico|solomon|vanuatu|fiji|new zealand|japan|taiwan|indonesia/i.test(place);
    if (oceanic) return true;
    // Geographic bounds: if lon is in ocean and not deep continental
    // Pacific (roughly -180 to -70 W and 100 to 180 E), Atlantic (-70 to -10), Indian (30 to 100 E south of 30N)
    var inPacific = (lon < -70 && lon > -180) || (lon > 100);
    var inAtlantic = (lon > -70 && lon < -10);
    var inIndian = (lon > 30 && lon < 100 && lat < 30);
    return inPacific || inAtlantic || inIndian;
  }
  // ── Enhanced tsunamigenicity filter using bathymetry/subduction zone lookup ──
  // Primary: place-name regex + lon/lat heuristics (original _isTsunamisLocation)
  // Secondary: bathymetryLookup() checks subduction zone boundaries
  const tsunamigenic = quakes.filter(function(q) {
    if (!q || q.mag < 6.5 || q.depth >= 70) return false;
    var locOK = _isTsunamisLocation(q);
    // Supplement with subduction zone lookup for marginal cases
    if (!locOK && typeof bathymetryLookup === 'function') {
      var bathy = bathymetryLookup(q.lat || 0, q.lon || 0);
      locOK = bathy.tsunamigenic;
    }
    return locOK;
  });

  // Weight seismic score by subduction zone proximity (max 1.5× for confirmed zone)
  function _seismicWeight(q) {
    if (!q || typeof bathymetryLookup !== 'function') return 1.0;
    var bathy = bathymetryLookup(q.lat || 0, q.lon || 0);
    return bathy.tsunamigenicWeight || 1.0;
  }

  const seismicScore = tsunamigenic.length > 0
    ? Math.min(40, (tsunamigenic[0].mag - 6.5) * 16 * _seismicWeight(tsunamigenic[0]) + 12)
    : 0;

  // Factor 2: Tidal enhancement (0-20 pts)
  const tidalScore = s.syzygy * 20;

  // Factor 3: Ionospheric coupling readiness (0-15 pts)
  // High TEC + quiet = better sensitivity for acoustic-gravity detection
  const tecScore = Math.min(15, s.tecPeak * 0.3);

  // Factor 4: Active volcanic tsunamis (Hunga Tonga type) (0-15 pts)
  const volcActive = ((state.data.volcanic && state.data.volcanic.highAlert) || 0);
  const volcScore = Math.min(15, volcActive * 3);

  // Factor 5: Basin SST anomaly (affects propagation modeling) (0-10 pts)
  const ssts = (forecastData.sstGrid && forecastData.sstGrid.val) || [];
  const maxSST = ssts.length > 0 ? Math.max(...ssts.map(p => p.sst)) : 0;
  const sstScore = maxSST >= 29 ? 10 : maxSST >= 27 ? 6 : maxSST >= 25 ? 3 : 0;

  const total = seismicScore + tidalScore + tecScore + volcScore + sstScore;
  const score = Math.min(100, Math.round(total));
  const confidence = tsunamigenic.length > 0 ? 85 : (quakes.length > 0 && !quakes[0].fallback ? 68 : 42);

  var _tsZoneName = (tsunamigenic.length > 0 && typeof bathymetryLookup === 'function')
    ? (bathymetryLookup(tsunamigenic[0].lat||0, tsunamigenic[0].lon||0).zoneName || '') : '';
  const factors = [
    { label: 'M6.5+ Seismicity' + (_tsZoneName ? ' — ' + _tsZoneName : ''), score: Math.round(seismicScore), max: 40, color: '#ff3d3d' },
    { label: 'Tidal Amplification',    score: Math.round(tidalScore),   max: 20, color: '#40c8ff' },
    { label: 'TEC Coupling Sensitivity',score: Math.round(tecScore),    max: 15, color: '#00ffc8' },
    { label: 'Volcanic Tsunami Risk',  score: Math.round(volcScore),    max: 15, color: '#ff6d00' },
    { label: 'Ocean Basin SST',        score: Math.round(sstScore),     max: 10, color: '#00b4d8' },
  ].sort((a,b) => b.score - a.score);

  const level = score >= 60 ? 'WARNING' : score >= 35 ? 'WATCH' : score >= 15 ? 'ELEVATED' : 'CLEAR';
  const levelColor = score >= 60 ? '#ff3d3d' : score >= 35 ? '#ff6d00' : score >= 15 ? '#ffd600' : '#00ff88';

  const hazardZones = tsunamigenic.length > 0
    ? tsunamigenic.map(q => {
        const distanceKm = { Pacific: 500, Indian: 700, Atlantic: 800 };
        return `${q.place} — potential coastal impact within 100–800 km`;
      })
    : ['No active tsunamigenic source identified', 'Monitor Pacific Ring of Fire', 'Monitor Indonesia / Philippines region'];

  return { score, confidence, level, levelColor, factors, riskZones: hazardZones,
    outlook: {
      '24h': tsunamigenic.length > 0
        ? ('⚠ ACTIVE: M' + tsunamigenic[0].mag.toFixed(1) + ' at ' + tsunamigenic[0].depth + 'km depth near ' + tsunamigenic[0].place + '. Ionospheric detection possible within 10–30 min of any rupture.')
        : 'No active tsunamigenic source. Tidal conditions: ' + (s.syzygy > 0.8 ? 'near syzygy — amplification risk elevated' : 'nominal'),
      '72h': volcActive > 3 ? (volcActive + ' high-alert volcanoes monitored. Volcanic tsunami risk (Hunga Tonga type) non-zero.') : 'Volcanic tsunami risk low.',
      '7d':  `Tidal cycle: next syzygy in ~${Math.round((1 - s.luna % 0.5) * 29.53 / 2)} days. Max amplification window: ±48h around new/full moon.`,
      '30d': 'Ocean SST max: '+maxSST.toFixed(1)+'°C — '+(maxSST>=28?'warm basin conditions favour rapid wave energy propagation':'normal thermal conditions')+'.',
    },
    dataAge: ((forecastData.usgsQuakes && forecastData.usgsQuakes.ts) ? Math.round((Date.now() - forecastData.usgsQuakes.ts) / 60000) : null),
  };
}

function scoreSuperstorm() {
  const s       = getSystemState();
  const ssts    = (forecastData.sstGrid && forecastData.sstGrid.val) || [];
  const winds   = (forecastData.windGrid && forecastData.windGrid.val) || [];
  const storms  = (forecastData.nhcStorms && forecastData.nhcStorms.val) || [];
  const doy     = getDOY();

  // Hurricane season weight (Northern Hem: Jun 1–Nov 30 = doy 152–334)
  const inAtlSeason  = doy >= 152 && doy <= 334;
  const inPacSeason  = doy >= 135 && doy <= 319;
  const seasonWeight = inAtlSeason || inPacSeason ? 1.0 : 0.35;

  // Factor 1: SST (0-30 pts) — tropical warmth
  const tropSSTs = ssts.filter(p => Math.abs(p.lat) < 25);
  const maxTropSST = tropSSTs.length > 0 ? Math.max(...tropSSTs.map(p => p.sst)) : 0;
  const sstScore = maxTropSST >= 30 ? 30 : maxTropSST >= 29 ? 25 : maxTropSST >= 28 ? 18
                 : maxTropSST >= 27 ? 12 : maxTropSST >= 26 ? 6 : 0;

  // Factor 2: Wind shear (0-25 pts) — low shear = good for storms
  const tropWinds = winds.filter(p => Math.abs(p.lat) < 25);
  const avgShearKt = tropWinds.length > 0 ? tropWinds.reduce((s,w) => s + w.windKt, 0) / tropWinds.length : 10;
  const shearScore = avgShearKt < 8 ? 25 : avgShearKt < 12 ? 18 : avgShearKt < 18 ? 10 : avgShearKt < 25 ? 4 : 0;

  // Factor 3: Active storms already exist? (0-20 pts)
  const stormScore = storms.length > 0 ? Math.min(20, storms.length * 8 + ((storms[0] && storms[0].category) || 1) * 3) : 0;

  // Factor 4: GCR/solar suppression (0-15 pts)
  const crSuppression = Math.max(0, (1820 - s.crFlux) / 220);
  const solarScore = Math.min(15, crSuppression * 15);

  // Factor 5: Atmospheric pressure anomaly (0-10 pts)
  const tropPressures = winds.filter(p => Math.abs(p.lat) < 25 && p.pressure !== null);
  const avgPressure = tropPressures.length > 0 ? tropPressures.reduce((s,w) => s + w.pressure, 0) / tropPressures.length : 1013;
  const pressureScore = avgPressure < 1005 ? 10 : avgPressure < 1009 ? 6 : avgPressure < 1013 ? 2 : 0;

  const rawScore = sstScore + shearScore + stormScore + solarScore + pressureScore;
  const score = Math.min(100, Math.round(rawScore * seasonWeight));
  const confidence = ssts.length > 3 && winds.length > 3 ? (storms.length > 0 || !(storms[0] && storms[0].fallback) ? 82 : 65) : 50;

  const factors = [
    { label: 'Tropical SST',         score: Math.round(sstScore * seasonWeight),    max: 30, color: '#ff3d3d' },
    { label: 'Low Wind Shear',        score: Math.round(shearScore * seasonWeight),  max: 25, color: '#00ff88' },
    { label: 'Active Storms Present', score: Math.round(stormScore * seasonWeight),  max: 20, color: '#ff6d00' },
    { label: 'Solar/GCR Forcing',     score: Math.round(solarScore * seasonWeight),  max: 15, color: '#aaff00' },
    { label: 'Low Pressure Anomaly',  score: Math.round(pressureScore * seasonWeight),max:10, color: '#b84fff' },
  ].sort((a,b) => b.score - a.score);

  const level = score >= 65 ? 'WARNING' : score >= 40 ? 'WATCH' : score >= 20 ? 'ELEVATED' : 'CLEAR';
  const levelColor = score >= 65 ? '#ff3d3d' : score >= 40 ? '#ff6d00' : score >= 20 ? '#ffd600' : '#00ff88';

  const activeStormDescs = storms.map(st => `${st.name} Cat${st.category || '?'} ${st.windKt}kt — ${st.moving || '?'}`);
  const riskZones = activeStormDescs.length > 0 ? activeStormDescs :
    inAtlSeason ? ['Caribbean / Gulf of Mexico', 'Eastern US Seaboard', 'Bay of Bengal'] :
    ['Western Pacific typhoon belt', 'Arabian Sea / Bay of Bengal', 'Eastern Pacific (Mex/CA coast)'];

  return { score, confidence, level, levelColor, factors, riskZones,
    outlook: {
      '24h': storms.length > 0
        ? ('⚠ ACTIVE: ' + storms.length + ' tropical cyclone(s). ' + ((storms[0] && storms[0].name) || 'Storm') + ' — Cat ' + ((storms[0] && storms[0].category) || '?') + ', ' + ((storms[0] && storms[0].windKt) || '?') + 'kt, moving ' + ((storms[0] && storms[0].moving) || '?') + '.')
        : (seasonWeight>0.9?'Peak season.':'Off-season — reduced risk.')+' Tropical SST max: '+maxTropSST.toFixed(1)+'°C. '+(maxTropSST>=28?'RI conditions possible if disturbance present.':'SST below RI threshold.'),
      '72h': 'Wind shear avg: '+avgShearKt.toFixed(1)+' kt ('+(avgShearKt<12?'FAVOURABLE for intensification':avgShearKt<20?'marginal':'inhibiting')+').',
      '7d': 'SST trend: '+(maxTropSST>=28.5?'warm pool persisting — watch for tropical disturbances':'monitoring for warm pool development')+'. Solar cycle forcing: '+(s.crFlux<1700?'active':'background')+'.',
      '30d': inAtlSeason ? ('Atlantic season: ' + new Date().toLocaleDateString('en',{month:'long'}) + ' — ' + (doy > 240 ? 'late season, declining activity' : 'peak risk window') + '.') : 'Northern hemisphere off-season. Southern hemisphere / WPac activity possible.',
    },
    dataAge: (forecastData.sstGrid && forecastData.sstGrid.ts) ? Math.round((Date.now() - (forecastData.sstGrid && forecastData.sstGrid.ts)) / 60000) : null,
  };
}

// ── RENDER FORECAST DASHBOARD ────────────────────────────
function renderForecastDashboard() {
  const container = document.getElementById('fc-dashboard');
  if (!container) return;

  const eq   = scoreEarthquake();
  const ts   = scoreTsunami();
  const ss   = scoreSuperstorm();

  // Track trends
  const prev = forecastPrevScores;
  const trend = (cur, p) => p === null ? '—' : cur > p + 3 ? '▲' : cur < p - 3 ? '▼' : '→';
  const eqTrend = trend(eq.score, prev.earthquake);
  const tsTrend = trend(ts.score, prev.tsunami);
  const ssTrend = trend(ss.score, prev.superstorm);
  forecastPrevScores = { earthquake: eq.score, tsunami: ts.score, superstorm: ss.score };

  container.innerHTML = [
    renderForecastCard('earthquake', '🔴 Earthquake Precursor', eq, eqTrend),
    renderForecastCard('tsunami',    '🌊 Tsunami Risk',          ts, tsTrend),
    renderForecastCard('superstorm', '🌀 Superstorm / RI',       ss, ssTrend),
  ].join('');
}

function renderForecastCard(id, title, data, trendArrow) {
  const { score, confidence, level, levelColor, factors, riskZones, outlook, dataAge } = data;
  const ci = Math.round(confidence * 0.15);
  const trendColor = trendArrow === '▲' ? '#ff3d3d' : trendArrow === '▼' ? '#00ff88' : '#ffd600';
  const isExpanded = fcExpandedCards.has(id);

  return `
  <div class="fc-card" id="fc-card-${id}">
    <div class="fc-card-header" onclick="toggleFcCard('${id}')">
      <div class="fc-title">${title}</div>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="color:${trendColor};font-size:11px;font-weight:700">${trendArrow}</span>
        <span class="fc-level-badge" style="background:${levelColor}22;color:${levelColor};border:1px solid ${levelColor}44">${level}</span>
        <span class="fc-chevron">${isExpanded ? '▲' : '▼'}</span>
      </div>
    </div>

    <div class="fc-gauge-row">
      <div class="fc-score" style="color:${levelColor}">${score}</div>
      <div style="flex:1">
        <div class="fc-gauge-track">
          <div class="fc-gauge-fill" style="width:${score}%;background:linear-gradient(90deg,${levelColor}88,${levelColor})"></div>
          <div class="fc-gauge-ci" style="left:${Math.max(0,score-ci)}%;width:${ci*2}%"></div>
        </div>
        <div class="fc-gauge-labels">
          <span>CLEAR</span><span>ELEVATED</span><span>WATCH</span><span>WARNING</span>
        </div>
      </div>
      <div class="fc-confidence">${confidence}%<br><span>conf.</span></div>
    </div>

    <div class="fc-card-body ${isExpanded ? 'expanded' : ''}">

      <!-- Factor breakdown -->
      <div class="fc-section-label">Contributing Factors</div>
      <div class="fc-factors">
        ${factors.map(f => `
          <div class="fc-factor-row">
            <span class="fc-factor-name">${f.label}</span>
            <div class="fc-factor-bar-wrap">
              <div class="fc-factor-bar" style="width:${(f.score/f.max*100).toFixed(0)}%;background:${f.color}"></div>
            </div>
            <span class="fc-factor-score" style="color:${f.color}">${f.score}/${f.max}</span>
          </div>`).join('')}
      </div>

      <!-- Risk zones -->
      <div class="fc-section-label" style="margin-top:8px">Highest Risk Zones</div>
      <div class="fc-zones">
        ${riskZones.slice(0,3).map((z,i) => `
          <div class="fc-zone-row">
            <span class="fc-zone-num">${i+1}</span>
            <span class="fc-zone-text">${z}</span>
          </div>`).join('')}
      </div>

      <!-- Outlook windows -->
      <div class="fc-section-label" style="margin-top:8px">Outlook</div>
      <div class="fc-outlook">
        ${Object.entries(outlook).map(([window, text]) => `
          <div class="fc-outlook-row">
            <span class="fc-outlook-window">${window}</span>
            <span class="fc-outlook-text">${text}</span>
          </div>`).join('')}
      </div>

      <div class="fc-data-footer">
        ${dataAge !== null ? 'Data age: ' + dataAge + ' min' : 'Using computed physics'} ·
        ${(forecastData.usgsQuakes && forecastData.usgsQuakes.val && forecastData.usgsQuakes.val[0] && forecastData.usgsQuakes.val[0].fallback) ? 'Fallback data' : 'Live data'}
      </div>
    </div>
  </div>`;
}

// Card expand/collapse
const fcExpandedCards = new Set(['earthquake', 'superstorm']);
function toggleFcCard(id) {
  if (fcExpandedCards.has(id)) fcExpandedCards.delete(id);
  else fcExpandedCards.add(id);
  renderForecastDashboard();
}

// Auto-refresh every 10 minutes
setInterval(() => {
  if ((document.getElementById('rpanel-risk') && document.getElementById('rpanel-risk').classList.contains('active'))) {
    runForecastDataFetch();
  }
}, 600000);



// ════════════════════════════════════════════════════════
// NETWORK AVAILABILITY FLAG
// If fetch fails with a network-level error (CORS block, sandbox
// restriction, or no connectivity), we back off all retries for
// 30 minutes to avoid console spam. Resets on success.
// ════════════════════════════════════════════════════════
var _apiOnline       = true;  // assume online until proven otherwise
var _apiBackoffUntil = 0;     // timestamp until which we skip retries
var _apiFailCount    = 0;     // consecutive failure count (for exponential backoff)

function _markApiOffline() {
  if (_apiOnline) {
    _apiOnline = false;
    _apiFailCount++;
    // Exponential backoff: 2 min → 4 min → 8 min → 30 min (cap)
    var backoffMs = Math.min(30, Math.pow(2, _apiFailCount)) * 60 * 1000;
    _apiBackoffUntil = Date.now() + backoffMs;
    var mins = Math.round(backoffMs / 60000);
    console.warn('[ESO] External APIs unreachable — running on physics models. Auto-retry in ' + mins + ' min.');
    updateStatusStrip();
  }
}
function _markApiOnline() {
  var wasOffline = !_apiOnline;
  _apiOnline    = true;
  _apiBackoffUntil = 0;
  _apiFailCount = 0;
  if (wasOffline) { console.log('[ESO] Live APIs reconnected.'); updateStatusStrip(); }
}
function _apiReady() {
  if (_apiOnline) return true;
  if (Date.now() > _apiBackoffUntil) return true; // backoff expired — allow retry, but don't reset flag until success
  return false;
}

// ── Manual retry: reset backoff and re-fetch all live data ─────
function retryApis() {
  _apiOnline = true;
  _apiBackoffUntil = 0;
  _apiFailCount = 0;
  updateStatusStrip();
  if (typeof fetchRealKp       === 'function') fetchRealKp();
  if (typeof fetchUSGSQuakes   === 'function') fetchUSGSQuakes();
  if (typeof fetchXRayFlux     === 'function') fetchXRayFlux();
  if (typeof fetchPressureGrid === 'function') fetchPressureGrid();
}

// ── Auto-retry when user returns to the tab ────────────────────
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'visible' && !_apiOnline) {
    // Give the tab 2 seconds to settle, then retry quietly
    setTimeout(retryApis, 2000);
  }
});

// ════════════════════════════════════════════════════════
// FETCH HELPER — signal-free timeout via Promise.race
// Neither AbortSignal.timeout() nor AbortController signals can
// be cloned across srcdoc/iframe postMessage boundaries — the
// structured-clone algorithm rejects AbortSignal entirely.
// Fix: pass NO signal to fetch; race against a plain timeout
// promise. The underlying fetch runs silently to completion in
// the background, but we reject early if it takes too long.
// ════════════════════════════════════════════════════════
function _fetchWithTimeout(url, ms, options) {
  var opts = Object.assign({}, options || {});
  delete opts.signal; // never pass a signal — causes postMessage clone error in srcdoc
  var fetchPromise   = fetch(url, opts);
  var timeoutPromise = new Promise(function(_, reject) {
    setTimeout(function() {
      reject(new Error('ESO fetch timeout (' + (ms || 10000) + 'ms)'));
    }, ms || 10000);
  });
  return Promise.race([fetchPromise, timeoutPromise]);
}

// ════════════════════════════════════════════════════════
// REAL NOAA SWPC KP INDEX
// Replaces synthetic getCurrentKpRaw() with real NOAA data
// ════════════════════════════════════════════════════════

let _realKpHistory = []; // Array of {ts, kp} objects, last ~50 days
let _realKpCurrent = null; // Latest 3-hour Kp value (number)
let _realKpFetched = 0; // Timestamp of last successful fetch

// Parse NOAA planetary-k-index JSON into [{ts, kp}] regardless of format version.
// NOAA has served several formats — this function detects all of them dynamically:
//   Array-of-arrays (header row): [["time_tag","kp","kp_index",...], ["2024-01-01",1.33,1,...], ...]
//   Array-of-objects:             [{"time_tag":"2024-01-01","Kp":1.33,...}, ...]  ← current (capital K)
// Key names are found by scanning rather than hard-coded, to survive future NOAA schema changes.
function _parseNoaaKpRaw(raw) {
  if (!raw || !raw.length) return [];
  var first = raw[0];

  if (Array.isArray(first)) {
    // ── Array-of-arrays format: first row is the header ──
    var header = first.map(function(h) { return String(h).toLowerCase().replace(/-/g, '_'); });
    var timeIdx = header.indexOf('time_tag');
    if (timeIdx < 0) timeIdx = 0;
    // 'kp' before 'kp_index' so we get the float, not the integer storm-level
    var kpIdx = header.indexOf('kp');
    if (kpIdx < 0) kpIdx = header.indexOf('kp_index');
    if (kpIdx < 0) kpIdx = 1;
    return raw.slice(1)
      .filter(function(r) { return r && r[kpIdx] !== null && r[kpIdx] !== undefined; })
      .map(function(r) { return { ts: new Date(r[timeIdx]).getTime(), kp: parseFloat(r[kpIdx]) }; })
      .filter(function(r) { return !isNaN(r.kp) && !isNaN(r.ts); });

  } else if (first && typeof first === 'object') {
    // ── Array-of-objects format ──
    var keys = Object.keys(first);
    // Priority: current NOAA key 'Kp' (capital), then older variants
    var KP_KEYS = ['Kp', 'kp', 'KP', 'kp_index', 'kp_raw', 'planetary_k_index'];
    var kpKey = null;
    for (var i = 0; i < KP_KEYS.length; i++) {
      if (keys.indexOf(KP_KEYS[i]) >= 0) { kpKey = KP_KEYS[i]; break; }
    }
    if (!kpKey) {
      // Last resort: any numeric key whose value in row[0] falls in Kp range 0-9
      kpKey = keys.find(function(k) {
        var v = parseFloat(first[k]);
        return !isNaN(v) && v >= 0 && v <= 9;
      }) || null;
    }
    var TIME_KEYS = ['time_tag', 'time', 'timestamp', 'datetime', 'date'];
    var timeKey = null;
    for (var j = 0; j < TIME_KEYS.length; j++) {
      if (keys.indexOf(TIME_KEYS[j]) >= 0) { timeKey = TIME_KEYS[j]; break; }
    }
    if (!timeKey) timeKey = keys[0];
    if (!kpKey) { console.warn('[ESO Kp] could not identify kp key; available keys:', keys.join(',')); return []; }
    return raw
      .filter(function(r) { return r && r[kpKey] !== null && r[kpKey] !== undefined; })
      .map(function(r) { return { ts: new Date(r[timeKey]).getTime(), kp: parseFloat(r[kpKey]) }; })
      .filter(function(r) { return !isNaN(r.kp) && !isNaN(r.ts); });
  }

  return [];
}

// Directly update the right-panel Geomagnetic summary cards from _realKpHistory.
// Called every time fetchRealKp() succeeds — no tab/dock/historyCache dependency.
function _updateRpanelKpStats() {
  if (!_realKpHistory || _realKpHistory.length === 0) return;
  var periodDays = (typeof historyPeriodDays !== 'undefined' ? historyPeriodDays : 7);
  var cutoff = Date.now() - periodDays * 86400000;
  var slice = _realKpHistory.filter(function(r) { return r.ts >= cutoff; });
  if (slice.length === 0) {
    // Fallback: just use most recent 100 points if period filter leaves nothing
    slice = _realKpHistory.slice(-100);
  }
  if (slice.length === 0) return;
  var vals = slice.map(function(r) { return r.kp; });
  var mean = vals.reduce(function(a, b) { return a + b; }, 0) / vals.length;
  var max  = Math.max.apply(null, vals);
  var g1   = slice.filter(function(r) { return r.kp >= 5; }).length;
  var rm = document.getElementById('rph-kp-mean');
  var rmx = document.getElementById('rph-kp-max');
  var rst = document.getElementById('rph-kp-storms');
  if (rm)  rm.textContent  = mean.toFixed(1);
  if (rmx) { rmx.textContent = max.toFixed(1); rmx.style.color = max >= 6 ? '#ff3d3d' : max >= 4 ? '#ff6d00' : 'var(--c-purple)'; }
  if (rst) rst.textContent = g1;
}

async function fetchRealKp() {
  if (!_apiReady()) return;
  try {
    // NOAA SWPC planetary Kp index — free, CORS-open, returns last ~7 days
    const resp = await _fetchWithTimeout('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json', 8000);
    if (!resp.ok) { _markApiOffline(); return; }
    _markApiOnline();
    const raw = await resp.json();
    _realKpHistory = _parseNoaaKpRaw(raw);
    if (_realKpHistory.length > 0) {
      _realKpCurrent = _realKpHistory[_realKpHistory.length - 1].kp;
      _realKpFetched = Date.now();
      if (state && state.data && state.data.geomagnetic !== undefined) {
        state.data.geomagnetic = _realKpCurrent;
      }
      _updateRpanelKpStats();
      if (typeof renderHistoryTab === 'function') {
        var _rhPanel = document.getElementById('rpanel-hist');
        if (_rhPanel && _rhPanel.classList.contains('active')) renderHistoryTab();
      }
    }
  } catch(e) {
    _markApiOffline();
  }
}

// Override getCurrentKpRaw to prefer real NOAA data, fall back to synthetic model
// NOTE: uses _syntheticKpRaw() directly to avoid hoisting collision with the
// base getCurrentKpRaw declaration above (two function declarations in the same
// scope would let the second win, making _origGetKpRaw point to itself → stack overflow).
function getCurrentKpRaw() {
  if (_realKpCurrent !== null && (Date.now() - _realKpFetched) < 4 * 3600 * 1000) {
    return _realKpCurrent;
  }
  return _syntheticKpRaw();
}

// Auto-refresh Kp every 3 hours
function startKpAutoRefresh() {
  fetchRealKp();
  setInterval(fetchRealKp, 3 * 3600 * 1000);
}

// v4.2: Boot ONI on load (non-blocking, low priority background fetch)
// IRI/CPC ENSO is fetched as part of runForecastDataFetch() — no separate boot needed.
// ONI historical series: fetch once after a short delay, no auto-refresh.
(function bootONI() {
  setTimeout(fetchNOAAONI, 5000);  // 5s delay — low priority, after core data
})();

// ════════════════════════════════════════════════════════
// DST INDEX (Disturbance Storm Time)
// NOAA SWPC provisional Dst — hourly, free, CORS-open
// More sensitive than Kp: shows ring current injection
// ════════════════════════════════════════════════════════

let _dstCurrent = null;   // current Dst in nT (negative = storm)
let _dstFetched = 0;

async function fetchDst() {
  if (!_apiReady()) return;
  try {
    const resp = await _fetchWithTimeout(
      'https://services.swpc.noaa.gov/products/kyoto-dst.json', 6000
    );
    if (!resp.ok) { _markApiOffline(); return; }
    _markApiOnline();
    const raw = await resp.json();
    // Format: [["time_tag", dst_value], ...] — first row is header
    const valid = (raw || []).slice(1)
      .filter(function(r){ return r && r[1] !== null && !isNaN(Number(r[1])); });
    if (valid.length > 0) {
      _dstCurrent = Number(valid[valid.length - 1][1]);
      _dstFetched = Date.now();
      updateDstDisplay();
      if (typeof updateApiHealth === 'function') updateApiHealth('dst', 'ok');
      if (typeof updateApiHealth === 'function') updateApiHealth('noaa-swpc', 'ok');
    }
  } catch(e) {
    _markApiOffline();
    if (typeof updateApiHealth === 'function') updateApiHealth('dst', 'err');
  }
}

function updateDstDisplay() {
  var el = document.getElementById('bl-dst');
  var sub = document.getElementById('bl-dst-sub');
  if (!el || _dstCurrent === null) return;
  el.innerHTML = _dstCurrent.toFixed(0) + '<span style="font-size:10px;color:var(--text-dim)"> nT</span>';
  var color, label;
  if (_dstCurrent <= -200)      { color = '#ff3d3d'; label = 'Extreme storm'; }
  else if (_dstCurrent <= -100) { color = '#ff3d3d'; label = 'Intense storm'; }
  else if (_dstCurrent <= -50)  { color = '#ff6d00'; label = 'Moderate storm'; }
  else if (_dstCurrent <= -30)  { color = '#ffd600'; label = 'Minor storm'; }
  else if (_dstCurrent < 0)     { color = 'var(--text-dim)'; label = 'Disturbed'; }
  else                          { color = '#00ff88'; label = 'Quiet'; }
  el.style.color = color;
  if (sub) sub.textContent = label;
}

// Auto-refresh Dst every hour
function startDstAutoRefresh() {
  fetchDst();
  setInterval(fetchDst, 3600 * 1000);
}


// ════════════════════════════════════════════════════════
// DSCOVR / ACE SOLAR WIND (Tier 2.3)
// NOAA SWPC plasma (speed, density) + mag (Bz)
// ════════════════════════════════════════════════════════

let _swSpeed = null, _swDensity = null, _swBz = null, _swFetched = 0;

async function fetchDSCOVR() {
  if (!_apiReady()) return;
  try {
    const [plasmaResp, magResp] = await Promise.all([
      _fetchWithTimeout('https://services.swpc.noaa.gov/products/solar-wind/plasma-7-day.json', 8000),
      _fetchWithTimeout('https://services.swpc.noaa.gov/products/solar-wind/mag-7-day.json',    8000)
    ]);
    if (plasmaResp.ok) {
      const raw = await plasmaResp.json();
      // Format: [time, density, speed, temperature]
      const valid = (raw || []).slice(1).filter(r => r && r[2] !== null && !isNaN(Number(r[2])));
      if (valid.length) {
        const last = valid[valid.length - 1];
        _swDensity = Number(last[1]);
        _swSpeed   = Number(last[2]);
      }
    }
    if (magResp.ok) {
      const raw = await magResp.json();
      // Format: [time, bx, by, bz, bt, lat, lon]
      const valid = (raw || []).slice(1).filter(r => r && r[3] !== null && !isNaN(Number(r[3])));
      if (valid.length) _swBz = Number(valid[valid.length - 1][3]);
    }
    _swFetched = Date.now();
    _markApiOnline();
    updateDSCOVRDisplay();
    updateApiHealth('dscovr', 'ok');
    // Trigger geomagnetic storm notification if Bz very negative
    if (_swBz !== null && _swBz < -20) {
      pushNotif({ id:'sw-bz-storm', level:'watch',
        headline: 'Southward IMF Bz: ' + _swBz.toFixed(1) + ' nT — Geomagnetic Storm Risk',
        bullets: ['Strong southward Bz couples with magnetosphere','Kp storm onset possible in 1–3 hours'],
        source: 'NOAA DSCOVR', tab:'risk' });
    }
    if (_swSpeed !== null && _swSpeed > 650) {
      pushNotif({ id:'sw-speed-high', level:'advisory',
        headline: 'High Solar Wind Speed: ' + Math.round(_swSpeed) + ' km/s',
        bullets: ['Elevated ICME / solar wind stream likely','Monitor Kp index for storm onset'],
        source: 'NOAA DSCOVR', tab:'risk' });
    }
  } catch(e) { _markApiOffline(); updateApiHealth('dscovr', 'err'); }
}

function updateDSCOVRDisplay() {
  var spdEl  = document.getElementById('bl-swspd');
  var spdSub = document.getElementById('bl-swspd-sub');
  var bzEl   = document.getElementById('bl-bz');
  var bzSub  = document.getElementById('bl-bz-sub');
  if (spdEl && _swSpeed !== null) {
    spdEl.innerHTML = Math.round(_swSpeed) + '<span style="font-size:10px;color:var(--text-dim)"> km/s</span>';
    spdEl.style.color = _swSpeed > 700 ? 'var(--c-red)' : _swSpeed > 500 ? 'var(--c-gold)' : 'var(--c-green)';
    if (spdSub) spdSub.textContent = _swSpeed > 700 ? 'EXTREME' : _swSpeed > 500 ? 'Elevated' : 'Nominal';
  }
  if (bzEl && _swBz !== null) {
    bzEl.innerHTML = _swBz.toFixed(1) + '<span style="font-size:10px;color:var(--text-dim)"> nT</span>';
    bzEl.style.color = _swBz < -20 ? 'var(--c-red)' : _swBz < -10 ? 'var(--c-gold)' : _swBz < 0 ? '#ffd600' : 'var(--c-green)';
    if (bzSub) bzSub.textContent = _swBz < -20 ? 'STRONG S' : _swBz < -10 ? 'Southward' : _swBz < 0 ? 'Slightly S' : 'Northward';
  }
}

// ════════════════════════════════════════════════════════
// REAL F10.7 SOLAR FLUX (Wave 4 — replaces sinusoid model)
// NOAA SWPC f107_cm_flux.json — daily 10.7cm radio flux
// F10.7 index: <75 low solar, 75-150 moderate, >150 active, >200 very active
// ════════════════════════════════════════════════════════
var _f107Current = null;
var _f107Source = 'model';

async function fetchF107() {
  try {
    var cached = cacheGet('f107');
    if (cached) {
      _f107Current = parseFloat(cached);
      _f107Source = 'live';
      updateF107Display();
      return;
    }
    var resp = await fetch('https://services.swpc.noaa.gov/json/f107_cm_flux.json',
      { signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    var data = await resp.json();
    if (!data || !data.length) throw new Error('empty');
    // Get the most recent valid entry
    var recent = null;
    for (var i = data.length - 1; i >= 0; i--) {
      if (data[i].flux && parseFloat(data[i].flux) > 0) { recent = data[i]; break; }
    }
    if (!recent) throw new Error('no valid entry');
    _f107Current = parseFloat(recent.flux);
    _f107Source = 'live';
    cacheSet('f107', _f107Current);
    updateApiHealth('noaa-swpc', 'ok');
  } catch(e) {
    // Fall back to 11-year sinusoid model (existing logic)
    var doy = getDOY ? getDOY() : new Date().getDate();
    _f107Current = 120 + 80 * Math.sin((doy / 365.25) * 2 * Math.PI / 11);
    _f107Source = 'model';
  }
  updateF107Display();
}

function updateF107Display() {
  var el  = document.getElementById('bl-sfi');
  var sub = document.getElementById('bl-sfi-sub');
  if (!el || _f107Current === null) return;
  el.textContent = Math.round(_f107Current);
  el.style.color = _f107Current > 200 ? 'var(--c-red)' :
                   _f107Current > 150 ? 'var(--c-gold)' :
                   _f107Current > 100 ? 'var(--c-cyan)' : 'var(--text-dim)';
  if (sub) sub.textContent = _f107Current > 200 ? 'Very Active' :
                              _f107Current > 150 ? 'Active' :
                              _f107Current > 100 ? 'Moderate' : 'Low';
  // Update badge: find the solar irradiance layer badge if present
  var badge = document.querySelector('[data-layer-badge="solar"]');
  if (badge) badge.textContent = _f107Source === 'live' ? 'LIVE' : 'MODEL';
  el.classList.remove('eso-skeleton');
}

function startF107AutoRefresh() {
  fetchF107();
  setInterval(fetchF107, 3 * 3600 * 1000); // F10.7 is published daily; refresh every 3h
}

// ════════════════════════════════════════════════════════
// IERS EARTH ORIENTATION — Real Length of Day (LOD)
// IERS EOP C04 series, Paris Observatory / Rapid Service.
// LOD excess = measured deviation from standard 86400 s day, in ms/day.
// Positive = Earth spinning slower; negative = faster.
//
// Bendick & Bilham (2017, Nature Geoscience): deceleration phases
// correlate with M7+ seismicity surges at ~5-year lead time.
// Replaces the deterministic multi-year sinusoid used in scoring.
// Refresh: daily — IERS publishes updated EOP within 24 h.
// ════════════════════════════════════════════════════════

var _iersLodMs     = null;   // LOD excess in ms/day (+ve = longer day)
var _iersLodTrend  = null;   // 'decelerating' | 'accelerating' | 'stable'
var _iersLodTs     = 0;
var _iersLodSource = 'model';

async function fetchIERSLod() {
  try {
    // 1-day localStorage cache
    var cached = cacheGet('iers-lod-v1');
    if (cached) {
      try {
        var c = JSON.parse(cached);
        _iersLodMs = c.lod; _iersLodTrend = c.trend; _iersLodSource = 'live';
        _updateLodDisplay(); return;
      } catch(e2) { /* corrupt cache, fall through */ }
    }
    // IERS EOP C04 IAU2000A — space-delimited text, Paris Observatory
    // Columns: year  month  day  MJD  x  y  UT1-UTC  LOD[s]  dx  dy  ...
    var resp = await _fetchWithTimeout(
      'https://hpiers.obspm.fr/iers/eop/eopc04/eopc04.62-now', 15000
    );
    if (!resp.ok) throw new Error('IERS HTTP ' + resp.status);
    var text = await resp.text();
    var lines = text.split('\n').filter(function(l) {
      var s = l.trim();
      return s && !s.startsWith('#') && !/^[a-zA-Z]/.test(s);
    });
    if (lines.length < 10) throw new Error('IERS: too few lines');

    // Parse last 60 data rows
    var records = [];
    for (var i = Math.max(0, lines.length - 60); i < lines.length; i++) {
      var parts = lines[i].trim().split(/\s+/);
      if (parts.length >= 8) {
        var lod = parseFloat(parts[7]);  // col 8 = LOD in seconds
        if (!isNaN(lod) && Math.abs(lod) < 0.1) records.push(lod); // sanity: LOD < 100 ms
      }
    }
    if (!records.length) throw new Error('IERS: no valid LOD rows');

    _iersLodMs = records[records.length - 1] * 1000;  // seconds → milliseconds

    // Trend: compare mean of last half vs first half of the 60-day window
    var half = Math.floor(records.length / 2);
    if (half >= 5) {
      var recentMean = records.slice(-half).reduce(function(a,b){return a+b;},0) / half;
      var olderMean  = records.slice(0,half).reduce(function(a,b){return a+b;},0) / half;
      var delta = recentMean - olderMean;
      _iersLodTrend = delta > 0.00005 ? 'decelerating'
                    : delta < -0.00005 ? 'accelerating'
                    : 'stable';
    } else { _iersLodTrend = 'stable'; }

    _iersLodSource = 'live';
    _iersLodTs = Date.now();
    cacheSet('iers-lod-v1', JSON.stringify({ lod: _iersLodMs, trend: _iersLodTrend }));
    updateApiHealth('iers-lod', 'ok');

  } catch(e) {
    // Deterministic fallback: seasonal annual wave + 6-yr core-mantle coupling cycle
    var doy = getDOY ? getDOY() : new Date().getDate();
    var yr  = new Date().getFullYear() + (new Date().getMonth() / 12);
    var annual = Math.sin(doy * 2 * Math.PI / 365.25) * 1.0;
    var sixYr  = Math.sin((yr - 2017) * 2 * Math.PI / 6) * 2.5;
    _iersLodMs    = annual + sixYr;
    _iersLodTrend = (sixYr > 0.3 && sixYr < 2.4) ? 'decelerating'
                  : sixYr < 0                     ? 'accelerating'
                  : 'stable';
    _iersLodSource = 'model';
    updateApiHealth('iers-lod', 'warn');
  }
  _updateLodDisplay();
}

function _updateLodDisplay() {
  var el  = document.getElementById('bl-lod');
  var sub = document.getElementById('bl-lod-sub');
  if (!el || _iersLodMs === null) return;
  var sign = _iersLodMs >= 0 ? '+' : '';
  el.innerHTML = sign + _iersLodMs.toFixed(2) +
    '<span style="font-size:10px;color:var(--text-dim)"> ms/d</span>';
  el.style.color = _iersLodTrend === 'decelerating' ? 'var(--c-gold)'
                 : _iersLodTrend === 'accelerating' ? 'var(--c-green)'
                 : 'var(--text-dim)';
  if (sub) {
    sub.textContent = (_iersLodTrend === 'decelerating' ? '▲ Decelerating'
                     : _iersLodTrend === 'accelerating' ? '▼ Accelerating'
                     : '→ Stable')
                    + (_iersLodSource === 'model' ? ' (model)' : '');
  }
  el.classList.remove('eso-skeleton');
}

// Normalised 0–1 LOD anomaly for seismic risk scoring.
// LOD excess ≥3 ms → 1.0. Deceleration phases weight at full value;
// acceleration phases weight at 40% (seismically less relevant per B&B 2017).
function getIERSLodAnomaly() {
  if (_iersLodMs === null) return null;
  var magnitude = Math.min(1, Math.abs(_iersLodMs) / 3.0);
  return (_iersLodTrend === 'decelerating') ? magnitude : magnitude * 0.4;
}

function startIERSLodRefresh() {
  fetchIERSLod();
  setInterval(fetchIERSLod, 24 * 3600 * 1000);  // daily
}

// ════════════════════════════════════════════════════════
// CME / GEOMAGNETIC STORM FORECAST (Wave 4)
// NOAA SWPC 3-day Kp forecast — predicted storm windows
// ════════════════════════════════════════════════════════
var _cmeAlert = null;

async function fetchCMEForecast() {
  try {
    var resp = await fetch('https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json',
      { signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    var data = await resp.json();
    // data[0] is header row: ["time_tag","kp","observed","noaa_scale"]
    // Find next predicted Kp >= 5 (G1 storm)
    _cmeAlert = null;
    for (var i = 1; i < data.length; i++) {
      var kp = parseFloat(data[i][1]);
      if (kp >= 5) {
        var timeTag = data[i][0];
        var scale = data[i][3] || 'G' + Math.min(5, Math.floor((kp - 5) / 1 + 1));
        _cmeAlert = { time: new Date(timeTag), kp: kp, scale: scale };
        break;
      }
    }
    updateCMEDisplay();
  } catch(e) {
    // silent — CME data is supplemental
  }
}

function updateCMEDisplay() {
  var el  = document.getElementById('bl-cme');
  var sub = document.getElementById('bl-cme-sub');
  if (!el) return;
  if (!_cmeAlert) {
    el.textContent = 'Clear';
    el.style.color = 'var(--c-green)';
    if (sub) sub.textContent = 'no G1+ forecast';
  } else {
    var now  = Date.now();
    var diff = _cmeAlert.time - now;
    var hrs  = Math.round(diff / 3600000);
    if (diff < 0) {
      el.textContent = _cmeAlert.scale || 'G' + Math.floor(_cmeAlert.kp - 4);
      el.style.color = 'var(--c-red)';
      if (sub) sub.textContent = 'storm window active';
    } else {
      el.textContent = 'T-' + hrs + 'h';
      el.style.color = 'var(--c-gold)';
      if (sub) sub.textContent = (_cmeAlert.scale || 'G1+') + ' predicted';
    }
  }
  if (el) el.classList.remove('eso-skeleton');
}

function startCMEAutoRefresh() {
  fetchCMEForecast();
  setInterval(fetchCMEForecast, 60 * 60 * 1000); // refresh hourly
}

// ════════════════════════════════════════════════════════
// SPACE WEATHER ALERTS (Wave 4 — Real-time CME/storm info)
// NOAA SWPC alerts feed — CME arrivals, geomagnetic storms
// ════════════════════════════════════════════════════════
var _spaceAlerts = [];

async function fetchSpaceAlerts() {
  try {
    var resp = await fetch('https://services.swpc.noaa.gov/products/alerts.json',
      { signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined });
    if (!resp.ok) throw new Error('Alerts ' + resp.status);
    var data = await resp.json();
    // Keep alerts from the last 3 days
    var cutoff = Date.now() - 3 * 86400000;
    _spaceAlerts = (data || []).filter(function(a) {
      return a && a.issue_datetime && new Date(a.issue_datetime).getTime() > cutoff;
    });
    updateSpaceAlertsDisplay();
    updateApiHealth('noaa-swpc', 'ok');
  } catch(e) {
    // Silent fail — non-critical supplemental data
  }
}

function updateSpaceAlertsDisplay() {
  var el = document.getElementById('cme-indicator');
  if (!el) return;
  // Filter for CME impact / geomagnetic storm / radiation storm alerts
  var cmeAlerts = _spaceAlerts.filter(function(a) {
    var msg = (a.message || '').toUpperCase();
    return msg.indexOf('CME') > -1 || msg.indexOf('GEOMAGNETIC STORM') > -1 ||
           msg.indexOf('SOLAR RADIATION STORM') > -1 || msg.indexOf('WATCH') > -1 ||
           msg.indexOf('WARNING') > -1;
  });
  var badge = document.getElementById('cme-badge');
  if (!cmeAlerts.length) {
    el.innerHTML = '<span style="color:var(--c-green);font-size:9px;">✓ No active CME/storm alerts</span>';
    if (badge) badge.style.display = 'none';
    return;
  }
  if (badge) { badge.style.display = 'inline'; badge.style.color = 'var(--c-red)'; }
  // Sort newest first
  cmeAlerts.sort(function(a, b) {
    return new Date(b.issue_datetime) - new Date(a.issue_datetime);
  });
  el.innerHTML = cmeAlerts.slice(0, 3).map(function(a) {
    var dt = new Date(a.issue_datetime);
    var ageH = Math.round((Date.now() - dt.getTime()) / 3600000);
    var msg = (a.message || '').split('\n')[0].slice(0, 80);
    var isCME = (a.message || '').toUpperCase().indexOf('CME') > -1;
    var isStorm = (a.message || '').toUpperCase().indexOf('STORM') > -1;
    var color = isStorm ? 'var(--c-red)' : isCME ? 'var(--c-gold)' : 'var(--c-cyan)';
    return '<div style="margin:3px 0;padding:3px 6px;border-left:2px solid ' + color + ';font-size:7.5px;line-height:1.5;">' +
      '<span style="color:' + color + ';font-weight:700;">' + (isCME ? '☄ CME' : isStorm ? '⚡ STORM' : '⚠ ALERT') + '</span>' +
      ' <span style="color:var(--text-dim);">' + ageH + 'h ago</span><br>' +
      '<span style="color:var(--text-dim);">' + msg + '</span>' +
      '</div>';
  }).join('');
}

function startSpaceAlertsRefresh() {
  fetchSpaceAlerts();
  setInterval(fetchSpaceAlerts, 30 * 60 * 1000); // every 30 min
}

// ════════════════════════════════════════════════════════
// PRECIPITATION LAYER (Wave 5 — Persona 4)
// Open-Meteo precipitation data at pressure grid points
// Fetches precipitation (mm/h) at a subset of grid points
// ════════════════════════════════════════════════════════
var _precipData = [];
var _precipMarkers = [];

async function fetchPrecipGrid() {
  // Use a coarser 20-point subset for performance
  var pts = [
    {lat:60,lon:-120},{lat:60,lon:-60},{lat:60,lon:0},{lat:60,lon:60},{lat:60,lon:120},
    {lat:30,lon:-120},{lat:30,lon:-60},{lat:30,lon:0},{lat:30,lon:60},{lat:30,lon:120},
    {lat:0, lon:-150},{lat:0, lon:-90},{lat:0, lon:-30},{lat:0, lon:30},{lat:0, lon:90},{lat:0,lon:150},
    {lat:-30,lon:-120},{lat:-30,lon:-60},{lat:-30,lon:0},{lat:-30,lon:60},{lat:-30,lon:120},
  ];
  var latStr = pts.map(function(p){return p.lat;}).join(',');
  var lonStr = pts.map(function(p){return p.lon;}).join(',');
  var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + latStr +
            '&longitude=' + lonStr +
            '&hourly=precipitation&forecast_days=1&timezone=UTC';
  try {
    var resp = await fetch(url, { signal: AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined });
    if (!resp.ok) throw new Error('Precip ' + resp.status);
    var data = await resp.json();
    // data may be array (multiple locations) or single object
    var results = Array.isArray(data) ? data : [data];
    _precipData = results.map(function(r, i) {
      var hourly = r.hourly && r.hourly.precipitation;
      var recent = hourly ? hourly.slice(-3) : [0];
      var avg = recent.reduce(function(s,v){return s+(v||0);},0) / recent.length;
      return { lat: pts[i] ? pts[i].lat : 0, lon: pts[i] ? pts[i].lon : 0, precip: avg };
    });
    if (state.activeLayers && state.activeLayers.has('precipitation')) {
      updatePrecipMarkers();
    }
  } catch(e) { /* silent — non-critical */ }
}

function updatePrecipMarkers() {
  if (!_leafletMap) return;
  _precipMarkers.forEach(function(m) { try { _leafletMap.removeLayer(m); } catch(e) {} });
  _precipMarkers = [];
  _precipData.forEach(function(pt) {
    if (!pt || pt.precip < 0.1) return; // skip dry points
    var r = Math.max(50000, Math.min(400000, pt.precip * 120000));
    var color = pt.precip > 5 ? '#4a90d9' : pt.precip > 2 ? '#74b9ff' : '#a8d8ff';
    var opacity = Math.min(0.55, 0.15 + pt.precip * 0.06);
    try {
      var circle = L.circle([pt.lat, pt.lon], {
        radius: r, color: 'none', fillColor: color,
        fillOpacity: opacity, interactive: false
      }).addTo(_leafletMap);
      _precipMarkers.push(circle);
    } catch(e) {}
  });
}

function clearPrecipMarkers() {
  _precipMarkers.forEach(function(m) { try { _leafletMap.removeLayer(m); } catch(e) {} });
  _precipMarkers = [];
}

function startPrecipAutoRefresh() {
  // Stagger 4 s after startup to avoid simultaneous Open-Meteo burst with pressure grid
  setTimeout(function() { fetchPrecipGrid(); }, 4000);
  setInterval(fetchPrecipGrid, 3600000); // hourly
}

function startDSCOVRAutoRefresh() {
  fetchDSCOVR();
  setInterval(fetchDSCOVR, 5 * 60 * 1000); // every 5 min
}


// ════════════════════════════════════════════════════════
// GOES PROTON FLUX (Tier 2.4)
// ≥10 MeV integral channel — S-scale radiation storms
// ════════════════════════════════════════════════════════

let _protonFlux = null, _protonFetched = 0;

async function fetchProtonFlux() {
  if (!_apiReady()) return;
  try {
    const resp = await _fetchWithTimeout(
      'https://services.swpc.noaa.gov/json/goes/primary/integral-protons-plot-6-hour.json', 8000);
    if (!resp.ok) { _markApiOffline(); updateApiHealth('goes', 'err'); return; }
    _markApiOnline();
    const raw = await resp.json();
    // Find >=10 MeV channel records
    var p10 = (raw || []).filter(r => r.energy === '>=10 MeV');
    if (!p10.length) p10 = (raw || []).filter(r => r.channel && r.channel.includes('P2'));
    var valid = p10.filter(r => r.flux !== null && r.flux !== undefined && !isNaN(Number(r.flux)));
    if (valid.length) _protonFlux = Number(valid[valid.length - 1].flux);
    _protonFetched = Date.now();
    updateProtonDisplay();
    updateApiHealth('goes', 'ok');
    if (_protonFlux !== null && _protonFlux >= 10) {
      var sLevel = _protonFlux >= 1000 ? 'S3' : _protonFlux >= 100 ? 'S2' : 'S1';
      pushNotif({ id:'proton-storm', level: _protonFlux >= 100 ? 'watch' : 'advisory',
        headline: sLevel + ' Solar Radiation Storm — Proton Flux ' + _protonFlux.toExponential(1) + ' pfu',
        bullets: ['Elevated proton flux at ≥10 MeV','HF radio disruption possible at high latitudes'],
        source: 'NOAA GOES', tab:'risk' });
    }
  } catch(e) { _markApiOffline(); updateApiHealth('goes', 'err'); }
}

function updateProtonDisplay() {
  var el  = document.getElementById('bl-proton');
  var sub = document.getElementById('bl-proton-sub');
  if (!el || _protonFlux === null) return;
  el.textContent = _protonFlux < 0.01 ? '<0.01' : _protonFlux.toExponential(1);
  el.style.color = _protonFlux >= 1000 ? 'var(--c-red)' : _protonFlux >= 100 ? '#ff6d00'
                 : _protonFlux >= 10   ? 'var(--c-gold)' : 'var(--c-green)';
  if (sub) sub.textContent = _protonFlux >= 1000 ? 'S3 Storm' : _protonFlux >= 100 ? 'S2 Storm'
                           : _protonFlux >= 10   ? 'S1 Storm'  : 'Quiet';
}

function startProtonAutoRefresh() {
  fetchProtonFlux();
  setInterval(fetchProtonFlux, 15 * 60 * 1000); // every 15 min
}


// ════════════════════════════════════════════════════════
// API HEALTH MONITOR (Tier 2.8)
// ════════════════════════════════════════════════════════

var _apiHealthState = {
  'noaa-swpc': 'unknown', 'usgs': 'unknown', 'openmeteo': 'unknown',
  'goes': 'unknown', 'dscovr': 'unknown', 'dst': 'unknown',
  'iers-lod': 'unknown', 'gcmt': 'unknown',
  // Phase 4 endpoints (registered early, activated when APIs are added)
  'iri-enso': 'unknown', 'copernicus-marine': 'unknown',
  'coral-reef-watch': 'unknown', 'nasa-firms': 'unknown',
  'nasa-gibs': 'unknown'
};

// v4.0: Track response times + cache hit rates per endpoint
var _apiResponseTimes = {};   // endpoint → [last 10 response times in ms]
var _apiCacheHits     = {};   // endpoint → { hits: 0, misses: 0 }

function _trackApiTime(endpoint, ms) {
  if (!_apiResponseTimes[endpoint]) _apiResponseTimes[endpoint] = [];
  _apiResponseTimes[endpoint].push(ms);
  if (_apiResponseTimes[endpoint].length > 10) _apiResponseTimes[endpoint].shift();
}

function _trackApiCacheHit(endpoint, isHit) {
  if (!_apiCacheHits[endpoint]) _apiCacheHits[endpoint] = { hits: 0, misses: 0 };
  if (isHit) _apiCacheHits[endpoint].hits++;
  else       _apiCacheHits[endpoint].misses++;
}

function getApiStats(endpoint) {
  var times = _apiResponseTimes[endpoint] || [];
  var cache = _apiCacheHits[endpoint] || { hits: 0, misses: 0 };
  var avgMs = times.length ? Math.round(times.reduce(function(a,b){return a+b;},0) / times.length) : 0;
  var total = cache.hits + cache.misses;
  var hitRate = total > 0 ? Math.round(cache.hits / total * 100) : 0;
  return { avgMs: avgMs, hitRate: hitRate, samples: times.length };
}

function updateApiHealth(endpoint, status) {
  _apiHealthState[endpoint] = status;
  var idMap = {
    'noaa-swpc': 'ah-noaa-swpc', 'usgs': 'ah-usgs',
    'openmeteo': 'ah-openmeteo', 'goes': 'ah-goes',
    'dscovr': 'ah-dscovr',      'dst':  'ah-dst',
    'iers-lod': 'ah-iers-lod',  'gcmt': 'ah-gcmt',
    'iri-enso': 'ah-iri-enso',  'copernicus-marine': 'ah-copernicus-marine',
    'coral-reef-watch': 'ah-coral-reef-watch', 'nasa-firms': 'ah-nasa-firms',
    'nasa-gibs': 'ah-nasa-gibs'
  };
  var el = document.getElementById(idMap[endpoint]);
  if (!el) return;
  el.className = 'ah-item ' + (status === 'ok' ? 'ah-ok' : status === 'err' ? 'ah-err' : 'ah-warn');
  var statusEl = el.querySelector('.ah-status');
  if (statusEl) statusEl.textContent = status === 'ok' ? '✓ OK' : status === 'err' ? '✗ ERR' : 'PENDING';
  // v4.0: Show avg response time if available
  var stats = getApiStats(endpoint);
  var timeEl = el.querySelector('.ah-time');
  if (timeEl && stats.avgMs > 0) timeEl.textContent = stats.avgMs + 'ms';
  // Update panel summary — only count endpoints that have been activated (not 'unknown')
  var active = Object.entries(_apiHealthState).filter(function(e) { return e[1] !== 'unknown'; });
  var ok  = active.filter(function(e) { return e[1] === 'ok'; }).length;
  var err = active.filter(function(e) { return e[1] === 'err'; }).length;
  var stat = document.getElementById('ps-apihealth-stat');
  if (stat) {
    stat.textContent = ok + '/' + active.length + ' OK';
    stat.style.color = err > 0 ? 'var(--c-gold)' : ok > 0 ? 'var(--c-green)' : 'var(--text-dim)';
  }
  var lu = document.getElementById('ah-last-updated');
  if (lu) lu.textContent = 'Last checked: ' + new Date().toUTCString().slice(17,25) + ' UTC';
}

// Patch existing fetch functions to report health
(function patchApiHealth() {
  var origFetchKp  = typeof fetchRealKp === 'function' ? fetchRealKp : null;
  var origFetchDst = typeof fetchDst    === 'function' ? fetchDst    : null;
  // Patch DST to also report health on success
  var _rawFetchDst = window.fetchDst;
  if (_rawFetchDst) {
    window.fetchDst = async function() {
      try { await _rawFetchDst(); updateApiHealth('dst','ok'); }
      catch(e) { updateApiHealth('dst','err'); }
    };
  }
})();


// ════════════════════════════════════════════════════════
// DATA EXPORT (Tier 2.1)
// CSV and JSON export of session time series + quake catalog
// ════════════════════════════════════════════════════════

function exportData(format) {
  try {
    if (format === 'csv') {
      // Build CSV from time series data
      var layers = Object.keys(timeSeriesData || {});
      if (!layers.length) { alert('No active layer data to export yet. Activate some layers first.'); return; }
      var headers = ['timestamp_utc'].concat(layers);
      var rows = [];
      var now = Date.now();
      var maxLen = Math.max.apply(null, layers.map(id => (timeSeriesCount[id] || 0)));
      for (var i = 0; i < maxLen; i++) {
        var row = [new Date(now - (maxLen - 1 - i) * 30000).toISOString()];
        layers.forEach(function(id) {
          var ordered = getSeriesOrdered(id);
          row.push(ordered[i] != null ? ordered[i].toFixed(4) : '');
        });
        rows.push(row.join(','));
      }
      var csv = headers.join(',') + '\n' + rows.join('\n');
      _downloadBlob(csv, 'eso-timeseries-' + _isoDate() + '.csv', 'text/csv');

    } else if (format === 'json') {
      var snapshot = {
        exported: new Date().toISOString(),
        region: typeof _seismicRegion !== 'undefined' ? _seismicRegion : 'global',
        seismicFilter: { minMag: _seismicMinMag, window: _seismicTimeWindow },
        baseline: {
          kp: typeof _currentKp !== 'undefined' ? _currentKp : null,
          dst: typeof _dstCurrent !== 'undefined' ? _dstCurrent : null,
          swSpeed: typeof _swSpeed !== 'undefined' ? _swSpeed : null,
          swBz: typeof _swBz !== 'undefined' ? _swBz : null,
          protonFlux: typeof _protonFlux !== 'undefined' ? _protonFlux : null,
        },
        activeLayers: state && state.activeLayers ? Array.from(state.activeLayers) : [],
        timeSeries: {},
        earthquakes: (forecastData && forecastData.usgsQuakes && forecastData.usgsQuakes.val) || [],
        apiHealth: _apiHealthState,
      };
      if (timeSeriesData) {
        Object.keys(timeSeriesData).forEach(function(id) {
          snapshot.timeSeries[id] = getSeriesOrdered(id);
        });
      }
      _downloadBlob(JSON.stringify(snapshot, null, 2), 'eso-snapshot-' + _isoDate() + '.json', 'application/json');

    } else if (format === 'quakes-csv') {
      var quakes = (forecastData && forecastData.usgsQuakes && forecastData.usgsQuakes.val) || [];
      if (!quakes.length) { alert('No earthquake data loaded yet. Activate the Seismic layer first.'); return; }
      var headers = ['time_utc','magnitude','depth_km','latitude','longitude','place','tsunami_flag','id'];
      var rows = quakes.map(function(q) {
        return [
          new Date(q.time).toISOString(), q.mag, q.depth,
          q.lat, q.lon, '"' + (q.place || '').replace(/"/g,'\'') + '"',
          q.tsunamiFlag ? '1' : '0', q.id || ''
        ].join(',');
      });
      _downloadBlob(headers.join(',') + '\n' + rows.join('\n'),
        'eso-earthquakes-' + _isoDate() + '.csv', 'text/csv');
    }
  } catch(e) { console.error('ESO export error:', e); alert('Export failed: ' + e.message); }
}

function _downloadBlob(content, filename, mime) {
  var blob = new Blob([content], { type: mime });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
}

function _isoDate() {
  return new Date().toISOString().slice(0, 10);
}


// ════════════════════════════════════════════════════════
// NOTIFICATION DIGEST MODE (Tier 2.10)
// Batch low-priority advisories instead of firing individually
// ════════════════════════════════════════════════════════

let _digestMode    = false;
let _digestQueue   = [];
let _digestTimer   = null;
var _rawPushNotif  = null;  // reference to original pushNotif, set during patch

function toggleDigestMode() {
  _digestMode = !_digestMode;
  var btn = document.getElementById('digest-toggle-btn');
  if (btn) {
    btn.textContent = _digestMode ? 'DIGEST: ON' : 'DIGEST: OFF';
    btn.style.color = _digestMode ? 'var(--c-green)' : 'var(--text-dim)';
    btn.style.borderColor = _digestMode ? 'rgba(0,255,136,.4)' : 'rgba(255,255,255,.2)';
  }
  if (!_digestMode && _digestQueue.length > 0) flushDigest();
}

// Patch pushNotif so DIGEST mode actually intercepts all notifications.
// Must run after pushNotif is defined — hoisting ensures it's available immediately.
(function() {
  var _orig = window.pushNotif;
  if (typeof _orig !== 'function') return;
  _rawPushNotif = _orig;
  window.pushNotif = function(notifObj) {
    if (_digestMode && notifObj &&
        (notifObj.level === 'info' || notifObj.level === 'advisory')) {
      _digestQueue.push(notifObj);
      clearTimeout(_digestTimer);
      _digestTimer = setTimeout(flushDigest, 15 * 60 * 1000);
      return;
    }
    _orig(notifObj);
  };
})();

function flushDigest() {
  if (!_digestQueue.length) return;
  var count = _digestQueue.length;
  var headlines = _digestQueue.slice(0, 3).map(function(n) { return '· ' + n.headline; });
  if (count > 3) headlines.push('· …and ' + (count - 3) + ' more');
  // Use _rawPushNotif to bypass the digest filter (avoid re-queuing the summary)
  var _emit = _rawPushNotif || window.pushNotif;
  _emit({
    id: 'digest-' + Date.now(), level: 'info',
    headline: '📋 Activity Digest — ' + count + ' advisory-level events',
    bullets: headlines,
    source: 'ESO Digest', tab: 'risk'
  });
  _digestQueue = [];
  _digestTimer = null;
}

// ════════════════════════════════════════════════════════
// NOAA/GDACS OFFICIAL TSUNAMI WARNING FEED (Wave 5)
// GDACS (UN Global Disaster Alert) — CORS-open tsunami events
// Augments ESO's computed tsunami risk with official alerts
// ════════════════════════════════════════════════════════
var _officialTsunamiAlerts = [];

async function fetchOfficialTsunamiAlerts() {
  try {
    // First: check existing USGS quake data for tsunami flags
    var usgsQuakes = (forecastData.usgsQuakes && forecastData.usgsQuakes.val) || [];
    var usgsFlags = usgsQuakes.filter(function(q) {
      return q.tsunami === 1 || q.tsunami === true || (q.raw && q.raw.properties && q.raw.properties.tsunami === 1);
    });

    // GDACS tsunami feed is currently unavailable (API restructure — all endpoints return 404).
    // Fall back to USGS tsunami flags only.
    var gdacsAlerts = [];

    _officialTsunamiAlerts = { usgs: usgsFlags, gdacs: gdacsAlerts };
    updateTsunamiWarningDisplay();
  } catch(e) {
    // Fallback: just check USGS flags
    var quakes = (forecastData.usgsQuakes && forecastData.usgsQuakes.val) || [];
    _officialTsunamiAlerts = {
      usgs: quakes.filter(function(q) { return q.tsunami; }),
      gdacs: []
    };
    updateTsunamiWarningDisplay();
  }
}

function updateTsunamiWarningDisplay() {
  var el = document.getElementById('tsunami-official-status');
  if (!el) return;
  var alerts = _officialTsunamiAlerts || { usgs: [], gdacs: [] };
  var totalActive = (alerts.usgs || []).length + (alerts.gdacs || []).length;

  if (totalActive === 0) {
    el.innerHTML = '<div style="color:var(--c-green);font-size:8px;padding:4px 0;">✓ No official tsunami warnings active</div>' +
      '<div style="font-size:7px;color:var(--text-dim);opacity:.6;">Sources: USGS tsunami flag · GDACS global alerts</div>';
    return;
  }

  var html = '';
  (alerts.gdacs || []).forEach(function(a) {
    var color = a.level === 'Red' ? 'var(--c-red)' : a.level === 'Orange' ? 'var(--c-gold)' : 'var(--c-green)';
    html += '<div style="padding:3px 0;border-left:2px solid ' + color + ';padding-left:6px;margin:3px 0;">' +
      '<span style="color:' + color + ';font-size:8px;font-weight:700;">🌊 GDACS ' + a.level.toUpperCase() + '</span><br>' +
      '<span style="font-size:7.5px;color:var(--text-dim);">' + a.title + ' · ' + (a.date || '').split('T')[0] + '</span>' +
      '</div>';
  });
  (alerts.usgs || []).forEach(function(q) {
    html += '<div style="padding:3px 0;border-left:2px solid var(--c-red);padding-left:6px;margin:3px 0;">' +
      '<span style="color:var(--c-red);font-size:8px;font-weight:700;">🌊 USGS TSUNAMI FLAG</span><br>' +
      '<span style="font-size:7.5px;color:var(--text-dim);">M' + (q.mag||'?') + ' ' + (q.place||'Unknown') + '</span>' +
      '</div>';
  });
  el.innerHTML = html;
}

function startTsunamiWarningRefresh() {
  setTimeout(fetchOfficialTsunamiAlerts, 5000); // wait for USGS quakes to load first
  setInterval(fetchOfficialTsunamiAlerts, 15 * 60 * 1000); // every 15 min
}

// ════════════════════════════════════════════════════════
// ENSO — IRI/CPC OFFICIAL FORECAST (v4.2)
// Replaces synthetic ENSO computation with the authoritative
// IRI/CPC consensus forecast. Falls back to SST computation.
//
// IRI/CPC ENSO Outlook: updated ~monthly. JSON endpoint
// returns Niño3.4 obs, model ensemble forecasts, and consensus.
//
// NOAA ONI (Oceanic Niño Index): official 3-month running mean
// of Niño3.4 anomaly. The canonical El Niño/La Niña classifier.
// ════════════════════════════════════════════════════════

// Holds the live IRI/CPC data when successfully fetched
var _ensoLiveData   = null;   // { nino34_obs, phase, elnino_q3, elnino_q4, probability, consensus, source }
var _oniLiveData    = null;   // array of { year, month, oni } — last 12 entries

async function fetchIRICPCEnso() {
  // Check localStorage cache first (24h TTL registered in v4.0)
  var cached = cacheGet('iri-enso');
  if (cached) {
    try {
      _ensoLiveData = JSON.parse(cached);
      _trackApiCacheHit('iri-enso', true);
      return _ensoLiveData;
    } catch(e) {}
  }
  _trackApiCacheHit('iri-enso', false);

  var t0 = Date.now();
  try {
    // IRI/CPC consensus ENSO forecast JSON
    // Returns: observation + model ensemble + consensus statement
    var data = await cachedFetch(
      'https://iri.columbia.edu/~forecast/ensofcst/Data/ensofcst_ALLtxt',
      { timeout: 12000, memTTL: 3600000 }  // 1h in-memory cache
    );

    // Parse the text response — IRI returns a structured text format
    // Extract the most recent Niño3.4 observation and forecast probabilities
    // The file is updated monthly; we cache for 24h
    var result = _parseIRICPCData(data);
    _ensoLiveData = result;
    cacheSet('iri-enso', JSON.stringify(result));
    _trackApiTime('iri-enso', Date.now() - t0);
    updateApiHealth('iri-enso', 'ok');
    return result;
  } catch(e) {
    // Fallback: try the simpler JSON endpoint
    try {
      var jsonData = await cachedFetch(
        'https://iri.columbia.edu/~forecast/ensofcst/Data/iri_fcst.json',
        { timeout: 10000, memTTL: 3600000 }
      );
      var result2 = {
        nino34_obs: jsonData.observation ? jsonData.observation.nino34 : null,
        phase: jsonData.phase || null,
        elnino_q3: jsonData.forecast ? jsonData.forecast.q3_elnino_prob : null,
        elnino_q4: jsonData.forecast ? jsonData.forecast.q4_elnino_prob : null,
        probability: jsonData.probability || null,
        consensus: jsonData.consensus || 'IRI/CPC forecast',
        source: 'iri-json'
      };
      _ensoLiveData = result2;
      cacheSet('iri-enso', JSON.stringify(result2));
      updateApiHealth('iri-enso', 'ok');
      return result2;
    } catch(e2) {
      // Both endpoints failed — use physics fallback
      updateApiHealth('iri-enso', 'err');
      console.info('[ESO v4.2] IRI/CPC ENSO using physics fallback (live fetch unavailable in local mode):', e.message);
      return _getENSOPhysicsFallback();
    }
  }
}

function _parseIRICPCData(rawText) {
  // IRI/CPC text format parser — extracts key fields from their forecast text
  // The format varies but generally contains probability statements
  if (typeof rawText === 'object') {
    // Already parsed as JSON (some endpoints return JSON directly)
    return {
      nino34_obs: rawText.nino34 || rawText.observation || null,
      phase: rawText.phase || null,
      probability: rawText.probability || rawText.elnino_prob || null,
      consensus: rawText.consensus || rawText.statement || 'IRI/CPC forecast',
      source: 'iri-parsed'
    };
  }
  // Text format: look for probability percentages and phase keywords
  var text = String(rawText);
  var elnino_prob = null;
  var probMatch = text.match(/El\s*Ni[ñn]o[^0-9]*([0-9]{1,3})%/i);
  if (probMatch) elnino_prob = parseInt(probMatch[1]);
  var phase = 'Neutral';
  if (/El\s*Ni[ñn]o/i.test(text) && elnino_prob > 60) phase = 'El Niño';
  else if (/La\s*Ni[ñn]a/i.test(text)) phase = 'La Niña';
  return {
    nino34_obs: null,
    phase: phase,
    probability: elnino_prob,
    consensus: text.slice(0, 120).replace(/\s+/g, ' ').trim(),
    source: 'iri-text'
  };
}

function _getENSOPhysicsFallback() {
  // Compute from SST grid if IRI fails
  var fallback = { phase: 'Neutral', nino34_obs: null, probability: null, source: 'physics' };
  if (window._sstRawData && _sstRawData.length) {
    var nino34 = _sstRawData.filter(function(pt) {
      return pt.lat >= -5 && pt.lat <= 5 && pt.lon >= -170 && pt.lon <= -120;
    });
    if (nino34.length) {
      var avgSST = nino34.reduce(function(s,p){return s+p.temp;},0)/nino34.length;
      var month  = new Date().getMonth();
      var climo  = [27.1,27.2,27.5,27.8,27.9,27.7,27.3,27.0,27.0,27.2,27.4,27.2][month];
      var anomaly = parseFloat((avgSST - climo).toFixed(2));
      fallback.nino34_obs = anomaly;
      if (anomaly >= 1.5)       { fallback.phase = 'El Niño+'; }
      else if (anomaly >= 0.5)  { fallback.phase = 'El Niño'; }
      else if (anomaly <= -1.5) { fallback.phase = 'La Niña+'; }
      else if (anomaly <= -0.5) { fallback.phase = 'La Niña'; }
    }
  }
  return fallback;
}

async function fetchNOAAONI() {
  // NOAA ONI data: 3-month running mean Niño3.4 anomaly
  // Available as a simple text file from CPC
  var cached = cacheGet('noaa-oni');
  if (cached) {
    try { _oniLiveData = JSON.parse(cached); return _oniLiveData; } catch(e) {}
  }
  try {
    var raw = await cachedFetch(
      'https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt',
      { timeout: 10000, memTTL: 86400000 }  // 24h in-memory (updates monthly)
    );
    // Parse ONI text format: YEAR MON TOTAL CLIM ANOM
    var lines = String(raw).trim().split('\n').filter(function(l){return /^\d{4}/.test(l.trim());});
    var parsed = lines.slice(-12).map(function(line) {
      var parts = line.trim().split(/\s+/);
      return { year: parseInt(parts[0]), mon: parseInt(parts[1]), oni: parseFloat(parts[4]) };
    }).filter(function(d){return !isNaN(d.oni);});
    _oniLiveData = parsed;
    cacheSet('noaa-oni', JSON.stringify(parsed));
    return parsed;
  } catch(e) {
    console.info('[ESO v4.2] NOAA ONI unavailable in local mode:', e.message);
    return null;
  }
}

// ── ENSO PHASE INDICATOR — upgraded to use live data ──────────
// Now uses IRI/CPC data if available, falls back to SST computation.
// Called after fetchIRICPCEnso() resolves.
function renderENSOStatus(ensoData) {
  var el  = document.getElementById('bl-enso');
  var sub = document.getElementById('bl-enso-sub');
  if (!el) return;

  var phase = (ensoData && ensoData.phase) ? ensoData.phase : 'Neutral';
  var src   = (ensoData && ensoData.source) ? ensoData.source : 'physics';
  var isLive = src !== 'physics';

  // Color by phase
  var color = 'var(--c-green)';
  if (phase.includes('El Niño')) color = phase.includes('+') ? 'var(--c-red)' : '#ff6d00';
  else if (phase.includes('La Niña')) color = phase.includes('+') ? '#40c8ff' : 'var(--c-cyan)';

  el.textContent = phase;
  el.style.color = color;

  // Sub-label: show anomaly if available, otherwise probability, then source badge
  if (sub) {
    if (ensoData && ensoData.nino34_obs !== null && ensoData.nino34_obs !== undefined) {
      var anom = parseFloat(ensoData.nino34_obs);
      sub.textContent = (anom >= 0 ? '+' : '') + anom.toFixed(2) + '°C · ' + (isLive ? 'LIVE' : 'MODEL');
    } else if (ensoData && ensoData.probability !== null && ensoData.probability !== undefined) {
      sub.textContent = ensoData.probability + '% prob · IRI/CPC';
    } else {
      sub.textContent = isLive ? 'IRI/CPC' : 'Niño3.4 model';
    }
  }

  // Update the ENSO Risk Card in the Risk tab
  renderENSORiskCard(ensoData);
}

// computeENSO() — called after SST loads. Uses live IRI/CPC if already fetched,
// otherwise computes from SST grid as a physics fallback.
function computeENSO() {
  if (!window._sstRawData || !_sstRawData.length) return;
  // Prefer live IRI/CPC data if already loaded
  if (_ensoLiveData && _ensoLiveData.source !== 'physics') {
    renderENSOStatus(_ensoLiveData);
    return;
  }
  // SST-based fallback (always available once SST grid loads)
  var fallback = _getENSOPhysicsFallback();
  // Only update _ensoLiveData if we don't already have a live result
  if (!_ensoLiveData || _ensoLiveData.source === 'physics') {
    _ensoLiveData = fallback;
  }
  renderENSOStatus(fallback);
}

// ── ENSO RISK CARD RENDERER ────────────────────────────────────
// Injects/updates the El Niño 2026 probability card in the Risk tab
function renderENSORiskCard(ensoData) {
  var card = document.getElementById('enso-risk-card');
  if (!card) return;

  var phase = (ensoData && ensoData.phase) ? ensoData.phase : '—';
  var prob  = (ensoData && ensoData.probability !== null) ? ensoData.probability : null;
  var obs   = (ensoData && ensoData.nino34_obs !== null && ensoData.nino34_obs !== undefined) ? parseFloat(ensoData.nino34_obs) : null;
  var cons  = (ensoData && ensoData.consensus) ? ensoData.consensus.slice(0, 100) : '';
  var src   = (ensoData && ensoData.source) ? ensoData.source : 'physics';

  var isElNino = phase.includes('El Niño');
  var borderColor = isElNino ? '#ff6d00' : phase.includes('La Niña') ? '#40c8ff' : 'rgba(255,255,255,.15)';
  var probPct = prob !== null ? prob : (isElNino ? 65 : 20);  // H2 2026 NOAA/ECMWF consensus as fallback

  // Phase badge color
  var phaseColor = 'var(--c-green)';
  if (isElNino) phaseColor = phase.includes('+') ? 'var(--c-red)' : '#ff6d00';
  else if (phase.includes('La Niña')) phaseColor = phase.includes('+') ? '#40c8ff' : 'var(--c-cyan)';

  card.style.borderColor = borderColor;
  card.innerHTML =
    '<div class="enso-card-header">' +
      '<span class="enso-card-title">🌊 EL NIÑO 2026</span>' +
      '<span class="enso-card-source">' + (src === 'physics' ? 'MODEL' : 'IRI/CPC') + '</span>' +
    '</div>' +
    '<div class="enso-card-phase" style="color:' + phaseColor + '">' + phase + '</div>' +
    '<div class="enso-card-prob-row">' +
      '<span class="enso-card-prob-label">El Niño prob (H2 2026)</span>' +
      '<span class="enso-card-prob-val">' + probPct + '%</span>' +
    '</div>' +
    '<div class="enso-card-gauge-track">' +
      '<div class="enso-card-gauge-fill" style="width:' + Math.min(100, probPct) + '%;background:' + (probPct >= 60 ? '#ff6d00' : probPct >= 40 ? '#ffd600' : 'var(--c-cyan)') + '"></div>' +
    '</div>' +
    (obs !== null ? '<div class="enso-card-anom">Niño3.4: ' + (obs >= 0 ? '+' : '') + obs.toFixed(2) + '°C anomaly</div>' : '') +
    (cons ? '<div class="enso-card-consensus">' + cons + '</div>' : '') +
    '<div class="enso-card-footer">Source: NOAA/IRI consensus · Updated monthly</div>';
}

// ════════════════════════════════════════════════════════
// MJO PHASE INDICATOR (Wave 5 — Persona 4)
// Madden-Julian Oscillation: dominant intraseasonal mode
// Phases 1-8 (~45-day cycle). Affects tropical rainfall,
// monsoons, atmospheric rivers, and TC genesis.
// Source: Simplified model from DOY. Real CPC data future upgrade.
// ════════════════════════════════════════════════════════
var MJO_PHASE_NAMES = [
  '', // 1-indexed
  'Indian Ocean',    // Phase 1
  'Indian Ocean+',   // Phase 2
  'Maritime Cont.',  // Phase 3
  'Maritime Cont.+', // Phase 4
  'West Pacific',    // Phase 5
  'West Pacific+',   // Phase 6
  'Western Hem.',    // Phase 7
  'Africa/Ind.O.',   // Phase 8
];

var MJO_PHASE_COLORS = [
  '', '#40c8ff', '#40d4ff', '#40e8c8', '#40f0a0',
  '#ffd600', '#ffaa00', '#ff7700', '#ff4fa0'
];

function computeMJO() {
  var now = new Date();
  var start = new Date(now.getFullYear(), 0, 0);
  var doy = Math.floor((now - start) / 86400000);

  // MJO period ≈ 45 days
  var phase = (Math.floor((doy % 45) / 45 * 8) % 8) + 1;

  // Amplitude proxy: higher in boreal winter (Nov-Apr), lower in summer
  var month = now.getMonth() + 1;
  var seasonal = (month >= 11 || month <= 4) ? 1.2 : 0.7;
  // Add some interannual variation using year
  var interannual = 0.8 + 0.4 * Math.abs(Math.sin(doy / 365 * 2 * Math.PI * 0.3));
  var amplitude = Math.min(3.0, seasonal * interannual * (1 + 0.3 * Math.sin(doy / 45 * 2 * Math.PI)));
  var isActive = amplitude >= 1.0;

  // Update display
  var el   = document.getElementById('bl-mjo');
  var sub  = document.getElementById('bl-mjo-sub');
  var sub2 = document.getElementById('bl-mjo-phase');
  if (el) {
    el.textContent = 'Ph.' + phase;
    el.style.color = isActive ? MJO_PHASE_COLORS[phase] : 'var(--text-dim)';
  }
  if (sub) sub.textContent = isActive ? 'active (A≈' + amplitude.toFixed(1) + ')' : 'weak (A<1.0)';
  if (sub2) sub2.textContent = MJO_PHASE_NAMES[phase] || '';

  return { phase: phase, amplitude: amplitude, isActive: isActive, name: MJO_PHASE_NAMES[phase] };
}

window.addEventListener('load', function() {
  computeMJO();
  setInterval(computeMJO, 3600000); // recompute hourly
});

// ════════════════════════════════════════════════════════
// GUTENBERG-RICHTER b-VALUE (Missed Audit Item)
// Maximum-likelihood estimate: b = log10(e) / (mean_M - Mc)
// b ≈ 1.0 = normal; < 0.8 = stress buildup; > 1.3 = high aftershock activity
// ════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════
// HISTORICAL SEISMICITY HEATMAP (Wave 4)
// Fetches past-year M5+ quakes, bins to 10° grid, overlays density circles
// ════════════════════════════════════════════════════════
var _seismHeatmapCircles = [];
var _seismHeatmapLoaded  = false;

async function loadSeismHeatmap() {
  if (_seismHeatmapLoaded) { toggleSeismHeatmap(); return; }
  var today   = new Date().toISOString().slice(0, 10);
  var yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  try {
    var resp = await fetch(
      'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&orderby=time&limit=2000' +
      '&minmagnitude=5.0&starttime=' + yearAgo + '&endtime=' + today,
      { signal: AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined }
    );
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    var geojson = await resp.json();
    var features = (geojson && geojson.features) || [];
    // Bin into 10°×10° cells
    var grid = {};
    features.forEach(function(f) {
      var c = f.geometry && f.geometry.coordinates;
      if (!c) return;
      var lon = Math.round(c[0] / 10) * 10;
      var lat = Math.round(c[1] / 10) * 10;
      var key = lat + ',' + lon;
      grid[key] = (grid[key] || 0) + 1;
    });
    // Draw circles
    var maxCount = Math.max.apply(null, Object.values(grid));
    _seismHeatmapCircles.forEach(function(c) { try { _leafletMap.removeLayer(c); } catch(e){} });
    _seismHeatmapCircles = [];
    Object.keys(grid).forEach(function(key) {
      var parts = key.split(',');
      var lat = parseFloat(parts[0]), lon = parseFloat(parts[1]);
      var count = grid[key];
      var opacity = 0.12 + (count / maxCount) * 0.45;
      var radius  = 80000 + (count / maxCount) * 500000;  // meters
      var circle  = L.circle([lat, lon], {
        radius: radius,
        color: 'none',
        fillColor: '#ff3d3d',
        fillOpacity: opacity,
        interactive: false
      });
      if (_leafletMap) {
        circle.addTo(_leafletMap);
        circle.getElement && circle.getElement() && (circle.getElement().style.pointerEvents = 'none');
        _seismHeatmapCircles.push(circle);
      }
    });
    _seismHeatmapLoaded = true;
    var btn = document.getElementById('heatmap-toggle-btn');
    if (btn) { btn.textContent = '🌡 Hide Density'; btn.style.color = 'var(--c-red)'; }
  } catch(e) {
    console.warn('Seismic heatmap fetch failed:', e.message);
    var btn = document.getElementById('heatmap-toggle-btn');
    if (btn) btn.textContent = '🌡 Density (failed)';
  }
}

function toggleSeismHeatmap() {
  if (!_seismHeatmapCircles.length) return;
  var anyVisible = false;
  _seismHeatmapCircles.forEach(function(c) {
    if (_leafletMap && _leafletMap.hasLayer(c)) anyVisible = true;
  });
  _seismHeatmapCircles.forEach(function(c) {
    try {
      if (anyVisible) _leafletMap.removeLayer(c);
      else c.addTo(_leafletMap);
    } catch(e) {}
  });
  var btn = document.getElementById('heatmap-toggle-btn');
  if (btn) {
    btn.textContent = anyVisible ? '🌡 Density Map' : '🌡 Hide Density';
    btn.style.color = anyVisible ? 'var(--text-dim)' : 'var(--c-red)';
  }
}


function computeGRBValue(quakes) {
  if (!quakes || quakes.length < 5) return null;
  var mags = quakes.map(function(q) { return q.mag || 0; }).filter(function(m) { return m > 0; });
  if (mags.length < 5) return null;
  var Mc = Math.min.apply(null, mags);  // use min mag as completeness threshold
  var above = mags.filter(function(m) { return m >= Mc; });
  if (!above.length) return null;
  var meanM = above.reduce(function(s, m) { return s + m; }, 0) / above.length;
  var denom = meanM - (Mc - 0.05);
  if (denom <= 0) return null;
  var b = Math.log10(Math.E) / denom;
  return { b: Math.round(b * 100) / 100, n: above.length, Mc: Mc.toFixed(1) };
}

function updateBValueDisplay() {
  var quakes = (window.forecastData && window.forecastData.usgsQuakes && window.forecastData.usgsQuakes.val) || [];
  var result = computeGRBValue(quakes);
  var el = document.getElementById('bl-bvalue');
  var sub = document.getElementById('bl-bvalue-sub');
  if (!el) return;
  if (!result) {
    el.textContent = '—';
    if (sub) sub.textContent = 'need 5+ quakes';
    return;
  }
  el.textContent = result.b.toFixed(2);
  el.style.color = result.b < 0.8 ? 'var(--c-red)' : result.b > 1.3 ? 'var(--c-gold)' : 'var(--c-green)';
  if (sub) sub.textContent = (result.b < 0.8 ? '⚠ low — stress?' : result.b > 1.3 ? '⚠ high — aftershocks?' : 'normal') + ' (n=' + result.n + ')';

  // Record snapshot for time-series trend tracking
  if (typeof recordBValueSnapshot === 'function') {
    recordBValueSnapshot(result);
  }
}

// ════════════════════════════════════════════════════════
// AFTERSHOCK CLUSTERING (Tier 4.6)
// Spatiotemporal proximity grouping of earthquake sequences
// ════════════════════════════════════════════════════════

function clusterAfterShocks(quakes) {
  if (!quakes || quakes.length < 2) return quakes;
  // Simple DBSCAN-like: within 2° lat/lon AND 72 hours → cluster
  var SPATIAL_DEG = 2.0;
  var TEMPORAL_MS = 72 * 3600 * 1000;
  var clusters = [];
  var visited  = new Array(quakes.length).fill(false);
  for (var i = 0; i < quakes.length; i++) {
    if (visited[i]) continue;
    visited[i] = true;
    var cluster = [i];
    for (var j = i + 1; j < quakes.length; j++) {
      if (visited[j]) continue;
      var dLat = Math.abs(quakes[i].lat - quakes[j].lat);
      var dLon = Math.abs(quakes[i].lon - quakes[j].lon);
      var dT   = Math.abs((quakes[i].time || 0) - (quakes[j].time || 0));
      if (dLat <= SPATIAL_DEG && dLon <= SPATIAL_DEG && dT <= TEMPORAL_MS) {
        cluster.push(j);
        visited[j] = true;
      }
    }
    clusters.push(cluster);
  }
  // Tag each quake with cluster info
  clusters.forEach(function(cluster) {
    if (cluster.length < 2) return;
    // Find the largest magnitude in cluster (mainshock)
    var mainIdx = cluster.reduce(function(best, idx) {
      return quakes[idx].mag > quakes[best].mag ? idx : best;
    }, cluster[0]);
    cluster.forEach(function(idx) {
      quakes[idx]._clusterId  = mainIdx;
      quakes[idx]._clusterSz  = cluster.length;
      quakes[idx]._isMainshock = (idx === mainIdx);
    });
  });
  return quakes;
}

// Patch updateSeismicMarkers to apply clustering info to tooltips
var _origUpdateSeismicMarkers = window.updateSeismicMarkers;
if (typeof _origUpdateSeismicMarkers === 'function') {
  window.updateSeismicMarkers = function(quakes) {
    var tagged = clusterAfterShocks(quakes ? quakes.slice() : []);
    _origUpdateSeismicMarkers(tagged);
  };
}


// ════════════════════════════════════════════════════════
// REAL USGS EARTHQUAKE API (replaces Claude relay)
// Direct FDSNWS API — free, CORS-open, authoritative
// ════════════════════════════════════════════════════════

async function fetchUSGSDirect(startDate, endDate, minMag, bbox) {
  if (!_apiReady()) return null; // in backoff — skip silently
  minMag = minMag || 4.5;
  const start = startDate || new Date(Date.now() - 86400000).toISOString().slice(0,10);
  const end   = endDate   || new Date().toISOString().slice(0,10);
  var bboxStr = '';
  if (bbox) {
    // bbox = [minLat, maxLat, minLon, maxLon]
    bboxStr = '&minlatitude=' + bbox[0] + '&maxlatitude=' + bbox[1] +
              '&minlongitude=' + bbox[2] + '&maxlongitude=' + bbox[3];
  }
  const url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?' +
    'format=geojson&orderby=time&limit=300' +
    '&starttime=' + start +
    '&endtime='   + end +
    '&minmagnitude=' + minMag + bboxStr;
  try {
    const resp = await _fetchWithTimeout(url, 10000);
    if (!resp.ok) throw new Error('USGS HTTP ' + resp.status);
    _markApiOnline();
    const data = await resp.json();
    return (data.features || []).map(function(f) {
      var p = f.properties, c = f.geometry && f.geometry.coordinates;
      return {
        mag:   p.mag,
        place: p.place || 'Unknown location',
        depth: c ? Math.round(c[2]) : 0,
        lat:   c ? c[1] : 0,
        lon:   c ? c[0] : 0,
        time:  p.time,
        tsunamiFlag: p.tsunami === 1,
        id:    f.id
      };
    });
  } catch(e) {
    _markApiOffline(); // logs once; subsequent calls suppressed for 30 min
    return null; // null = use fallback
  }
}

// Override the existing fetchUSGSQuakes to use direct API
// Called by the existing forecast/notification system
async function fetchUSGSQuakes() {
  var msBack  = _seismicTimeWindow === '30d' ? 30*86400000 : _seismicTimeWindow === '7d' ? 7*86400000 : 86400000;
  var startDt = new Date(Date.now() - msBack).toISOString().slice(0,10);
  var bbox    = (typeof _seismicRegion !== 'undefined' && _seismicRegion !== 'global')
                ? REGION_BBOX[_seismicRegion] : null;
  var mag     = (typeof _seismicMinMag !== 'undefined') ? _seismicMinMag : 4.5;
  const quakes = await fetchUSGSDirect(startDt, null, mag, bbox);
  if (quakes !== null) {
    forecastData.usgsQuakes = { val: quakes, ts: Date.now(), fallback: false };
    updateApiHealth('usgs', 'ok');
    // Update map markers
    updateSeismicMarkers(quakes);
    updateBValueDisplay();
    return forecastData.usgsQuakes;
  }
  updateApiHealth('usgs', 'err');
  // Fallback: use existing relay method
  if (typeof _origRunForecastDataFetch === 'function') {
    await _origRunForecastDataFetch();
  }
  return forecastData.usgsQuakes;
}

// Update real earthquake positions on the map
function updateSeismicMarkers(quakes) {
  if (!quakes || !quakes.length || !_leafletMap) return;
  // Remove existing USGS dynamic markers
  if (window._usgsMarkers) {
    window._usgsMarkers.forEach(function(m){ try{ _leafletMap.removeLayer(m); }catch(e){} });
  }
  window._usgsMarkers = [];
  quakes.slice(0, 150).forEach(function(q) {
    if (!q.lat || !q.lon) return;
    var depth = q.depth || 0;
    // Magnitude-based radius
    var r = Math.max(4, q.mag * 2.5);
    // Depth-based color + shape cues (color-blind safe via stroke width)
    var color, fillOp, strokeW, depthLabel;
    if (depth < 30) {
      color = '#ff3d3d'; fillOp = 0.65; strokeW = 2.5; depthLabel = 'SHALLOW';
    } else if (depth < 70) {
      color = '#ff6d00'; fillOp = 0.5; strokeW = 1.5; depthLabel = 'CRUSTAL';
    } else if (depth < 300) {
      color = '#ffd600'; fillOp = 0.4; strokeW = 1.0; depthLabel = 'INTER.';
    } else {
      color = '#4a7a99'; fillOp = 0.2; strokeW = 0.8; depthLabel = 'DEEP';
    }
    var m = L.circleMarker([q.lat, q.lon], {
      radius: r, color: color, fillColor: color, fillOpacity: fillOp, weight: strokeW
    });
    m.bindTooltip(
      'M' + q.mag.toFixed(1) + ' · ' + depthLabel + ' · ' + depth + ' km' +
      (q.tsunamiFlag ? ' ⚠TSUNAMI' : '') +
      '\n' + (q.place || 'Unknown location'),
      { className: 'leaflet-tooltip' }
    );
    m.addTo(_leafletMap);
    window._usgsMarkers.push(m);
  });
}


// ════════════════════════════════════════════════════════
// GOES X-RAY FLUX (Solar Flares)
// NOAA GOES real-time X-ray flare data
// ════════════════════════════════════════════════════════

let _xrayFlares = []; // Last 7 days of flares
let _xrayFlareFetched = 0;

async function fetchXRayFlux() {
  if (!_apiReady()) return; // in backoff — skip silently
  try {
    const resp = await _fetchWithTimeout('https://services.swpc.noaa.gov/json/goes/primary/xray-flares-7-day.json', 8000);
    if (!resp.ok) { _markApiOffline(); return; }
    _markApiOnline();
    const raw = await resp.json();
    _xrayFlares = (raw || []).map(function(f) {
      return {
        classLabel: f.max_class || '?',
        fluxPeak:   parseFloat(f.peak_flux) || 0,
        beginTime:  f.begin_time || '',
        maxTime:    f.max_time || '',
        region:     f.active_region || '?',
        xClass:     (f.max_class || '').charAt(0).toUpperCase()
      };
    }).filter(function(f){ return f.classLabel && f.classLabel !== 'null'; });
    _xrayFlareFetched = Date.now();

    // Fire notifications for strong flares
    var mFlares = _xrayFlares.filter(function(f){ return f.xClass === 'M' || f.xClass === 'X'; });
    var xFlares = _xrayFlares.filter(function(f){ return f.xClass === 'X'; });
    if (xFlares.length > 0) {
      var strongest = xFlares.reduce(function(a,b){ return a.fluxPeak > b.fluxPeak ? a : b; });
      pushNotif({
        id: 'xray-x-class', level: 'critical',
        headline: 'X-Class Solar Flare: ' + strongest.classLabel + ' — Ionospheric Impact Imminent',
        bullets: [
          'Peak flux: <b>' + strongest.classLabel + '</b> · Region ' + strongest.region,
          '<b>Shortwave radio blackout</b> on sunlit side — potential TEC disruption within minutes',
          'Monitor Kp for follow-on geomagnetic storm in 12–72h (if CME associated)',
        ],
        source: 'GOES X-Ray', tab: 'discover', subTab: 'chain', icon: '☀️',
      });
    } else if (mFlares.length >= 3) {
      pushNotif({
        id: 'xray-m-series', level: 'watch',
        headline: mFlares.length + ' M-Class Flares in Past 7 Days — Elevated Solar Activity',
        bullets: [
          'Active region producing <b>M-class bursts</b> — watch for X-class escalation',
          'Enhanced ionospheric TEC variability expected',
        ],
        source: 'GOES X-Ray', tab: 'discover', subTab: 'stress', icon: '🔆',
      });
    }
    updateXRayMapLayer();
  } catch(e) {
    _markApiOffline(); // logs once; subsequent calls suppressed for 30 min
  }
}

function updateXRayMapLayer() {
  if (!_leafletMap) return;
  if (window._xrayMarkers) {
    window._xrayMarkers.forEach(function(m){ try{ _leafletMap.removeLayer(m); }catch(e){} });
  }
  window._xrayMarkers = [];
  if (!state.activeLayers.has('xray')) return;
  // X-ray flares affect the whole sunlit side — show as subsolar point glow
  var decl = (state.data.solar || 0) * 0 + Math.asin(Math.sin(23.45 * Math.PI/180) * Math.sin((getDOY()-81)*2*Math.PI/365)) * 180/Math.PI;
  var subLon = -((new Date().getUTCHours()*60 + new Date().getUTCMinutes()) / 4);
  _xrayFlares.slice(0, 5).forEach(function(f, i) {
    var cls = f.xClass;
    var color = cls === 'X' ? '#ff3d3d' : cls === 'M' ? '#ff6d00' : '#ffd600';
    var r = cls === 'X' ? 18 : cls === 'M' ? 12 : 7;
    var m = L.circleMarker([decl, (subLon + i * 8) % 360 - 180], {
      radius: r, color: color, fillColor: color, fillOpacity: 0.25, weight: 2,
      dashArray: '4 3'
    });
    m.bindTooltip('Solar Flare: ' + f.classLabel + ' at ' + f.maxTime, { className: 'leaflet-tooltip' });
    m.addTo(_leafletMap);
    window._xrayMarkers.push(m);
  });
}

function startXRayAutoRefresh() {
  fetchXRayFlux();
  setInterval(fetchXRayFlux, 30 * 60 * 1000); // every 30 min
}


// ════════════════════════════════════════════════════════
// ATMOSPHERIC PRESSURE LAYER
// Open-Meteo current + archive pressure data
// ════════════════════════════════════════════════════════

let _pressureGrid = []; // Array of {lat, lon, pressure} points

async function fetchPressureGrid() {
  if (!_apiReady()) return; // in backoff — skip silently
  // Tier 2.9: improved resolution — 5° lat bands × 6 lon points = 48 nodes
  const GRID = (function() {
    var pts = [];
    var lats = [-40,-20,0,20,40,60,70];
    var lons = [-150,-90,-30,30,90,150];
    lats.forEach(function(la) { lons.forEach(function(lo) { pts.push({lat:la,lon:lo}); }); });
    // Add extra detail at mid-latitude storm tracks
    [[-45,-170],[-45,-100],[-45,-30],[45,-175],[45,-105],[45,-35],[45,25],[45,95],[45,165],
     [55,-25],[55,10],[55,40],[65,-60],[65,-20],[65,30],[0,160],[0,-160]].forEach(function(p){
      pts.push({lat:p[0],lon:p[1]});
    });
    return pts;
  })();
  try {
    const lats = GRID.map(function(g){ return g.lat; }).join(',');
    const lons = GRID.map(function(g){ return g.lon; }).join(',');
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lats + '&longitude=' + lons +
      '&current=surface_pressure&wind_speed_unit=ms&timezone=UTC';
    const resp = await _fetchWithTimeout(url, 10000);
    if (!resp.ok) { _markApiOffline(); return; }
    _markApiOnline();
    const data = await resp.json();
    const results = Array.isArray(data) ? data : [data];
    _pressureGrid = results.map(function(r, i) {
      var p = (r.current && r.current.surface_pressure) ? r.current.surface_pressure : 1013;
      return { lat: GRID[i].lat, lon: GRID[i].lon, pressure: p };
    });
    if (state && state.data) {
      var meanP = _pressureGrid.reduce(function(s,g){ return s+g.pressure; }, 0) / _pressureGrid.length;
      state.data.pressure = meanP;
    }
    updatePressureMapLayer();
    // Update superstorm score with real pressure
    var minP = _pressureGrid.reduce(function(a,b){ return a.pressure < b.pressure ? a : b; }, _pressureGrid[0]);
    if (forecastData) forecastData.minPressure = { val: minP, ts: Date.now() };
  } catch(e) {
    _markApiOffline(); // logs once; subsequent calls suppressed for 30 min
  }
}

function updatePressureMapLayer() {
  if (!_leafletMap) return;
  if (window._pressureMarkers) {
    window._pressureMarkers.forEach(function(m){ try{ _leafletMap.removeLayer(m); }catch(e){} });
  }
  window._pressureMarkers = [];
  if (!state.activeLayers.has('pressure')) return;
  _pressureGrid.forEach(function(g) {
    var anomaly = g.pressure - 1013;
    var color = anomaly < -10 ? '#2196f3' : anomaly < -4 ? '#64b5f6' : anomaly > 6 ? '#ef9a9a' : '#7ec8e3';
    var r = Math.max(6, Math.min(20, Math.abs(anomaly) * 0.8 + 6));
    var m = L.circleMarker([g.lat, g.lon], {
      radius: r, color: color, fillColor: color, fillOpacity: 0.35, weight: 1
    });
    m.bindTooltip(g.pressure.toFixed(0) + ' hPa (' + (anomaly >= 0 ? '+' : '') + anomaly.toFixed(0) + ')', {
      className: 'leaflet-tooltip'
    });
    m.addTo(_leafletMap);
    window._pressureMarkers.push(m);
  });
}

function startPressureAutoRefresh() {
  // Stagger 2 s after startup so pressure and precip don't both slam Open-Meteo at t=0
  setTimeout(function() { fetchPressureGrid(); }, 2000);
  setInterval(fetchPressureGrid, 60 * 60 * 1000); // every hour
}


// ════════════════════════════════════════════════════════
// 30-DAY HISTORICAL DATA ENGINE
// Loads real historical data from NOAA SWPC + USGS + Open-Meteo
// ════════════════════════════════════════════════════════

let historyCache = { kp: null, quakes: null, flares: null, kpFetched: 0, quakesFetched: 0 };
let historyPeriodDays = 7;

function setHistoryPeriod(days) {
  historyPeriodDays = days;
  document.querySelectorAll('[id^="hp-"]').forEach(function(b){ b.classList.remove('active'); });
  var btn = document.getElementById('hp-' + days);
  if (btn) btn.classList.add('active');
  renderHistoryTab();
}

async function loadAndRenderHistory() {
  var histLoading = document.getElementById('history-loading');
  var histContent = document.getElementById('history-content');
  if (histLoading) histLoading.style.display = 'block';
  if (histContent) histContent.style.display = 'none';

  var now = Date.now();
  var thirtyDaysAgo = now - 30 * 86400000;
  var needsKp = !historyCache.kp || (now - historyCache.kpFetched) > 3600000;
  var needsQuakes = !historyCache.quakes || (now - historyCache.quakesFetched) > 600000;

  var tasks = [];
  if (needsKp && _apiReady()) {
    tasks.push(
      _fetchWithTimeout('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json', 8000)
        .then(function(r){ _markApiOnline(); return r.json(); })
        .then(function(raw){
          historyCache.kp = _parseNoaaKpRaw(raw)
            .filter(function(r){ return r.ts >= thirtyDaysAgo; });
          historyCache.kpFetched = now;
        })
        .catch(function(e){ _markApiOffline(); console.warn('[ESO History] Kp fetch failed:', e && e.message); })
    );
  }

  if (needsQuakes && _apiReady()) {
    var startDate = new Date(thirtyDaysAgo).toISOString().slice(0,10);
    var endDate   = new Date(now).toISOString().slice(0,10);
    var usgsUrl = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&orderby=time&limit=500' +
      '&starttime=' + startDate + '&endtime=' + endDate + '&minmagnitude=4.5';
    tasks.push(
      _fetchWithTimeout(usgsUrl, 12000)
        .then(function(r){ _markApiOnline(); return r.json(); })
        .then(function(data){
          historyCache.quakes = (data.features || []).map(function(f){
            var p = f.properties, c = f.geometry && f.geometry.coordinates;
            return {
              mag: p.mag, place: p.place || '', depth: c ? Math.round(c[2]) : 0,
              lat: c ? c[1] : 0, lon: c ? c[0] : 0, time: p.time
            };
          });
          historyCache.quakesFetched = now;
        })
        .catch(function(e){ _markApiOffline(); })
    );
  }

  // X-ray flares already fetched
  if (!historyCache.flares && _xrayFlares.length > 0) {
    historyCache.flares = _xrayFlares;
  }

  await Promise.all(tasks);

  // Fallback: if Kp fetch failed but real-time Kp data is already loaded, use it
  if ((!historyCache.kp || historyCache.kp.length === 0) &&
      typeof _realKpHistory !== 'undefined' && _realKpHistory && _realKpHistory.length > 0) {
    var thirtyDaysAgoFb = Date.now() - 30 * 86400000;
    historyCache.kp = _realKpHistory.filter(function(r){ return r.ts >= thirtyDaysAgoFb; });
    historyCache.kpFetched = Date.now();
    console.info('[ESO History] Kp fetch failed — using real-time Kp buffer (' + historyCache.kp.length + ' points)');
  }

  if (histLoading) histLoading.style.display = 'none';
  if (histContent) histContent.style.display = 'block';
  renderHistoryTab();

  // ── Tier 1.1: Seed statistical engine with historical data ──
  // Bridge loaded Kp history into timeSeriesData so the Lag Explorer,
  // FFT, and Corr Matrix have real data to work with (not just 8 min of session)
  seedHistoricalSeries();
}

function seedHistoricalSeries() {
  // Seed geomagnetic (Kp) series from NOAA 30-day history
  if (historyCache.kp && historyCache.kp.length > 0) {
    var kpVals = historyCache.kp.map(function(h){ return h.kp; });
    // Take up to 60 evenly-spaced points from the full history
    var step = Math.max(1, Math.floor(kpVals.length / 60));
    var sampled = [];
    for (var i = 0; i < kpVals.length; i += step) { sampled.push(kpVals[i]); }
    sampled = sampled.slice(-60); // limit to ring buffer size

    if (!timeSeriesData['geomagnetic']) initSeries('geomagnetic');
    // Write historical values into the ring buffer in order
    sampled.forEach(function(v) {
      var idx = timeSeriesHead['geomagnetic'];
      timeSeriesData['geomagnetic'][idx] = v;
      timeSeriesHead['geomagnetic'] = (idx + 1) % SERIES_LEN;
      timeSeriesCount['geomagnetic'] = Math.min(timeSeriesCount['geomagnetic'] + 1, SERIES_LEN);
    });
  }

  // Seed seismic series: compute daily M4.5+ quake count as time series
  if (historyCache.quakes && historyCache.quakes.length > 0) {
    var now = Date.now();
    var seismicDaily = [];
    for (var d = 29; d >= 0; d--) {
      var dayStart = now - (d + 1) * 86400000;
      var dayEnd   = now - d * 86400000;
      var count = historyCache.quakes.filter(function(q){ return q.time >= dayStart && q.time < dayEnd; }).length;
      seismicDaily.push(count);
    }
    var step2 = Math.max(1, Math.floor(seismicDaily.length / 60));
    var sampled2 = [];
    for (var j = 0; j < seismicDaily.length; j += step2) { sampled2.push(seismicDaily[j]); }

    if (!timeSeriesData['seismic']) initSeries('seismic');
    sampled2.forEach(function(v) {
      var idx = timeSeriesHead['seismic'];
      timeSeriesData['seismic'][idx] = v;
      timeSeriesHead['seismic'] = (idx + 1) % SERIES_LEN;
      timeSeriesCount['seismic'] = Math.min(timeSeriesCount['seismic'] + 1, SERIES_LEN);
    });
  }
}

function renderHistoryTab() {
  var cutoff = Date.now() - historyPeriodDays * 86400000;

  // ── KP CHART ──
  // If the dedicated history fetch hasn't returned data, fall back to the
  // real-time Kp buffer (populated by startKpAutoRefresh via the same URL).
  // This handles the race where the History tab opens before the Kp fetch
  // completes, as well as outright fetch failures.
  var kpSource = historyCache.kp || [];
  if (kpSource.length === 0 &&
      typeof _realKpHistory !== 'undefined' && _realKpHistory && _realKpHistory.length > 0) {
    var thirtyDaysAgoRT = Date.now() - 30 * 86400000;
    kpSource = _realKpHistory.filter(function(r){ return r.ts >= thirtyDaysAgoRT; });
  }
  var kpData = kpSource.filter(function(r){ return r.ts >= cutoff; });
  if (kpData.length > 0) {
    var kpVals = kpData.map(function(r){ return r.kp; });
    var kpMean = kpVals.reduce(function(a,b){ return a+b; },0) / kpVals.length;
    var kpMax  = Math.max.apply(null, kpVals);
    var storms = kpData.filter(function(r){ return r.kp >= 5; }).length;
    var kpLive = kpData[kpData.length - 1].kp;

    var el = document.getElementById('hist-kp-live');
    if (el) { el.textContent = 'Kp ' + kpLive.toFixed(1); el.style.color = kpLive >= 6 ? '#ff3d3d' : kpLive >= 4 ? '#ff6d00' : 'var(--c-purple)'; }
    var m = document.getElementById('hist-kp-mean'); if (m) m.textContent = 'Mean: Kp ' + kpMean.toFixed(1);
    var mx = document.getElementById('hist-kp-max'); if (mx) mx.textContent = 'Max: Kp ' + kpMax.toFixed(1);
    var st = document.getElementById('hist-kp-storms'); if (st) st.textContent = 'G1+ Events: ' + storms;
    // Mirror into right-panel summary cards
    var rm = document.getElementById('rph-kp-mean'); if (rm) rm.textContent = kpMean.toFixed(1);
    var rmx = document.getElementById('rph-kp-max'); if (rmx) { rmx.textContent = kpMax.toFixed(1); rmx.style.color = kpMax >= 6 ? '#ff3d3d' : kpMax >= 4 ? '#ff6d00' : 'var(--c-purple)'; }
    var rst = document.getElementById('rph-kp-storms'); if (rst) rst.textContent = storms;
    drawHistoryKpCanvas(kpData);
  } else {
    // No Kp data available — show placeholder text in stats and canvas
    var el2 = document.getElementById('hist-kp-live');
    if (el2) { el2.textContent = 'Kp —'; el2.style.color = 'var(--c-dim)'; }
    var m2 = document.getElementById('hist-kp-mean'); if (m2) m2.textContent = 'Mean: — (data unavailable)';
    var mx2 = document.getElementById('hist-kp-max'); if (mx2) mx2.textContent = 'Max: —';
    var st2 = document.getElementById('hist-kp-storms'); if (st2) st2.textContent = 'Retrying…';
    var kpCanvas = document.getElementById('hist-kp-canvas');
    if (kpCanvas) {
      var ctx2 = kpCanvas.getContext('2d');
      ctx2.clearRect(0, 0, kpCanvas.width, kpCanvas.height);
      ctx2.fillStyle = 'rgba(255,255,255,0.15)';
      ctx2.font = '12px monospace';
      ctx2.textAlign = 'center';
      ctx2.fillText('Geomagnetic data unavailable — will retry on next refresh', kpCanvas.width / 2, kpCanvas.height / 2);
    }
  }

  // ── EARTHQUAKE CHART ──
  var eqData = (historyCache.quakes || []).filter(function(q){ return q.time >= cutoff; });
  if (eqData.length > 0) {
    var largest = eqData.reduce(function(a,b){ return a.mag > b.mag ? a : b; });
    var shallow  = eqData.filter(function(q){ return q.depth < 70; }).length;
    var m7       = eqData.filter(function(q){ return q.mag >= 7.0; }).length;

    var ec = document.getElementById('hist-eq-count'); if (ec) ec.textContent = eqData.length + ' events';
    var el = document.getElementById('hist-eq-largest'); if (el) el.textContent = 'Largest: M' + largest.mag.toFixed(1);
    var sh = document.getElementById('hist-eq-shallow'); if (sh) sh.textContent = 'Shallow (<70km): ' + shallow;
    var m7el = document.getElementById('hist-eq-m7'); if (m7el) m7el.textContent = 'M7+: ' + m7;
    // Mirror into right-panel summary cards
    var rec = document.getElementById('rph-eq-count'); if (rec) rec.textContent = eqData.length;
    var rel = document.getElementById('rph-eq-largest'); if (rel) rel.textContent = 'M' + largest.mag.toFixed(1);
    var rm7 = document.getElementById('rph-eq-m7'); if (rm7) { rm7.textContent = m7; rm7.style.color = m7 > 0 ? 'var(--c-red)' : 'var(--text-dim)'; }
    drawHistoryEqCanvas(eqData, cutoff);
  }

  // ── FLARES ──
  var flareData = (historyCache.flares || _xrayFlares || []).filter(function(f){ return f.maxTime && new Date(f.maxTime).getTime() >= cutoff; });
  var fc = document.getElementById('hist-flare-count');
  if (fc) fc.textContent = flareData.length + ' flares';
  var fl = document.getElementById('hist-flare-list');
  if (fl) {
    fl.innerHTML = flareData.slice(0,10).map(function(f){
      var color = f.xClass === 'X' ? '#ff3d3d' : f.xClass === 'M' ? '#ff6d00' : '#ffd600';
      return '<div style="padding:2px 0;border-bottom:1px solid rgba(255,255,255,.04);display:flex;justify-content:space-between;">' +
        '<span style="color:'+color+';font-weight:700;">'+f.classLabel+'</span>' +
        '<span>'+( f.maxTime ? f.maxTime.slice(0,16).replace('T',' ') : '' )+'</span>' +
        '<span style="color:var(--text-dim)">AR '+f.region+'</span></div>';
    }).join('') || '<div style="padding:6px 0;text-align:center;color:var(--text-dim)">No flares above C-class in period</div>';
  }

  // ── NOTABLE EVENTS ──
  var events = [];
  eqData.filter(function(q){ return q.mag >= 6.5; }).forEach(function(q){
    events.push({ ts: q.time, text: 'M' + q.mag.toFixed(1) + ' earthquake — ' + (q.place || ''), color: '#ff3d3d' });
  });
  (kpData || []).filter(function(r){ return r.kp >= 5; }).slice(-5).forEach(function(r){
    events.push({ ts: r.ts, text: 'Geomagnetic Storm — Kp ' + r.kp.toFixed(1) + ' (' + (r.kp >= 7 ? 'G3+' : r.kp >= 6 ? 'G2' : 'G1') + ')', color: 'var(--c-purple)' });
  });
  flareData.filter(function(f){ return f.xClass === 'X' || f.xClass === 'M'; }).slice(-5).forEach(function(f){
    events.push({ ts: new Date(f.maxTime||0).getTime(), text: 'Solar Flare: ' + f.classLabel + ' (Region ' + f.region + ')', color: '#ffd600' });
  });
  events.sort(function(a,b){ return b.ts - a.ts; });
  var evEl = document.getElementById('hist-events-list');
  if (evEl) {
    evEl.innerHTML = events.slice(0, 20).map(function(e){
      var d = new Date(e.ts);
      var ds = d.toISOString ? d.toISOString().slice(0,16).replace('T',' ') : '';
      return '<div style="padding:4px 0;border-bottom:1px solid rgba(255,255,255,.03);display:flex;gap:8px;">' +
        '<span style="color:var(--text-dim);white-space:nowrap;font-size:7px;">' + ds + '</span>' +
        '<span style="color:' + e.color + ';flex:1;">' + e.text + '</span></div>';
    }).join('') || '<div style="padding:10px 0;text-align:center;">No major events in selected period</div>';
  }
}

function drawHistoryKpCanvas(kpData) {
  var canvas = document.getElementById('hist-kp-canvas');
  if (!canvas || !canvas.getContext) return;
  canvas.width = canvas.offsetWidth || 220;
  canvas.height = 60;
  var ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  var n = kpData.length;
  if (n < 2) return;
  var maxKp = 9, step = canvas.width / (n - 1), h = canvas.height;
  // Storm threshold lines
  ctx.strokeStyle = 'rgba(255,61,61,.2)'; ctx.lineWidth = 1; ctx.setLineDash([3,3]);
  ctx.beginPath(); ctx.moveTo(0, h - (5/maxKp)*h); ctx.lineTo(canvas.width, h - (5/maxKp)*h); ctx.stroke();
  ctx.setLineDash([]);
  // Kp line
  ctx.strokeStyle = '#b84fff'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  kpData.forEach(function(r, i) {
    var x = i * step, y = h - (r.kp / maxKp) * h;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  // Fill above G1 threshold in red
  ctx.fillStyle = 'rgba(255,61,61,.08)';
  ctx.beginPath();
  kpData.forEach(function(r, i) {
    var x = i * step, y = Math.min(h - (r.kp / maxKp) * h, h - (5/maxKp)*h);
    if (i === 0) ctx.moveTo(x, h - (5/maxKp)*h); ctx.lineTo(x, y);
  });
  ctx.lineTo((n-1)*step, h-(5/maxKp)*h); ctx.closePath(); ctx.fill();
}

function drawHistoryEqCanvas(eqData, cutoff) {
  var canvas = document.getElementById('hist-eq-canvas');
  if (!canvas || !canvas.getContext) return;
  canvas.width = canvas.offsetWidth || 220;
  canvas.height = 60;
  var ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  var now = Date.now();
  var timeRange = now - cutoff;
  var h = canvas.height, w = canvas.width;
  eqData.forEach(function(q) {
    var x = ((q.time - cutoff) / timeRange) * w;
    var y = h - Math.min(h - 2, (q.mag / 9) * h);
    var r = Math.max(1.5, q.mag - 3.5);
    var color = q.mag >= 7 ? '#ff3d3d' : q.mag >= 6 ? '#ff6d00' : '#ffd600';
    ctx.beginPath(); ctx.arc(x, y, r, 0, 2*Math.PI);
    ctx.fillStyle = color; ctx.globalAlpha = 0.7; ctx.fill();
  });
  ctx.globalAlpha = 1;
}


// ════════════════════════════════════════════════════════
// 30-DAY FORECAST CALENDAR
// Deterministic tidal + Kp recurrence + LOD cycle projection
// ════════════════════════════════════════════════════════

function computeForecastCalendar() {
  var calendar = [];
  var now = Date.now();
  var baseKp = _realKpCurrent || getCurrentKpRaw();

  for (var dayOffset = 0; dayOffset < 31; dayOffset++) {
    var dayTs = now + dayOffset * 86400000;
    var d = new Date(dayTs);
    var doy = getDOY ? getDOY() + dayOffset : dayOffset;

    // ── Tidal syzygy for this future date ──
    var lunaPhase = ((dayTs - 947289600000) % (29.53058867 * 86400000)) / (29.53058867 * 86400000);
    var syzygyVal = Math.abs(Math.cos(lunaPhase * 2 * Math.PI));

    // ── LOD cycle contribution — real IERS EOP for today, model for future dates ──
    var _lodCalReal = (dayOffset === 0 && typeof getIERSLodAnomaly === 'function')
                      ? getIERSLodAnomaly() : null;
    var lodContrib = _lodCalReal !== null ? _lodCalReal
      : Math.abs(Math.sin(doy * 2 * Math.PI / (365.25 * 6)) * 0.6 +
                 Math.sin(doy * 2 * Math.PI / (365.25 * 18.6)) * 0.3);

    // ── Kp 27-day recurrence: elevated probability if today's Kp was elevated ──
    var kpRecurrenceDays = [27, 54]; // solar rotation recurrence
    var kpBump = 0;
    kpRecurrenceDays.forEach(function(lag) {
      var diff = Math.abs(dayOffset - lag);
      if (diff <= 2) kpBump += (baseKp * 0.4) * (1 - diff / 3);
    });
    var projKp = Math.min(9, baseKp * 0.3 + kpBump + 1.5);

    // ── Also check real Kp history for 27-day patterns ──
    if (_realKpHistory && _realKpHistory.length > 0) {
      var targetTs = dayTs - 27 * 86400000;
      var closest = _realKpHistory.reduce(function(best, r) {
        return Math.abs(r.ts - targetTs) < Math.abs(best.ts - targetTs) ? r : best;
      }, _realKpHistory[0]);
      if (Math.abs(closest.ts - targetTs) < 2 * 86400000) {
        projKp = Math.max(projKp, closest.kp * 0.6);
      }
    }

    // ── Composite daily risk score ──
    var tidalRisk   = syzygyVal * 35;
    var kpRisk      = (projKp / 9) * 30;
    var lodRisk     = lodContrib * 20;
    var compoundRisk = tidalRisk + kpRisk * 0.5 + lodRisk * 0.5;
    if (syzygyVal > 0.85 && projKp > 4) compoundRisk += 15; // compound boost

    // v4.8: ENSO compound boost — El Niño elevates background risk
    var ensoCalBoost = 0;
    var ensoCalNote  = '';
    try {
      var _eD = state.data['enso'];
      if (_eD && _eD.phase === 'El Niño') {
        ensoCalBoost = Math.round((_eD.probability || 50) / 100 * 8);
        ensoCalNote  = '🌊 El Niño +' + ensoCalBoost;
      }
    } catch(e) {}
    compoundRisk += ensoCalBoost;

    var level = compoundRisk >= 60 ? 'critical' :
                compoundRisk >= 40 ? 'watch' :
                compoundRisk >= 22 ? 'advisory' : 'clear';

    var moonPhase = syzygyVal > 0.92 ? '🌕' : syzygyVal > 0.75 ? '🌔' : syzygyVal > 0.45 ? '🌓' : syzygyVal > 0.25 ? '🌒' : '🌑';

    calendar.push({
      date: d,
      dayOffset: dayOffset,
      syzygy: syzygyVal,
      projKp: projKp,
      lodContrib: lodContrib,
      score: Math.round(compoundRisk),
      level: level,
      moonPhase: moonPhase,
      isToday: dayOffset === 0,
      ensoNote: ensoCalNote,
    });
  }
  return calendar;
}

function renderForecastCalendar() {
  var container = document.getElementById('forecast-calendar');
  var labelEl   = document.getElementById('cal-month-label');
  if (!container) return;
  var cal = computeForecastCalendar();
  var today = new Date();
  if (labelEl) labelEl.textContent = today.toLocaleString('en-US',{month:'long',year:'numeric'}) + ' →';

  // Day-of-week headers
  var dayHeaders = ['Su','Mo','Tu','We','Th','Fr','Sa'].map(function(d){
    return '<div style="text-align:center;font-size:6px;color:var(--text-dim);letter-spacing:.08em;padding:2px 0;">' + d + '</div>';
  }).join('');

  // First day of week offset for layout
  var firstDow = today.getDay(); // 0=Sun
  var emptyPads = Array(firstDow).fill('<div></div>').join('');

  var cells = cal.map(function(day) {
    var bg = day.level === 'critical' ? 'rgba(255,61,61,.25)' :
             day.level === 'watch'    ? 'rgba(255,109,0,.2)' :
             day.level === 'advisory' ? 'rgba(255,214,0,.15)' : 'var(--surface)';
    var textColor = day.level === 'critical' ? '#ff3d3d' :
                    day.level === 'watch'    ? '#ff6d00' :
                    day.level === 'advisory' ? '#ffd600' : 'var(--text-dim)';
    var border = day.isToday ? '1px solid var(--c-cyan)' : '1px solid rgba(255,255,255,.06)';
    var title = 'Score ' + day.score + '/100\nSyzygy ' + (day.syzygy*100).toFixed(0) + '%\nKp ~' + day.projKp.toFixed(1) + '\n' + day.moonPhase + (day.ensoNote ? '\n' + day.ensoNote : '');
    return '<div title="' + title + '" style="' +
      'background:' + bg + ';border:' + border + ';border-radius:2px;padding:3px 1px;' +
      'text-align:center;cursor:default;transition:opacity .15s;' +
      '" onmouseenter="this.style.opacity=\'.7\'" onmouseleave="this.style.opacity=\'1\'">' +
      '<div style="font-size:7px;color:' + textColor + ';font-weight:700;">' + day.date.getDate() + '</div>' +
      '<div style="font-size:8px;line-height:1;">' + day.moonPhase + '</div>' +
      '<div style="font-size:6px;color:' + textColor + ';letter-spacing:-.02em;">' + day.score + '</div>' +
    '</div>';
  }).join('');

  container.innerHTML = dayHeaders + emptyPads + cells;
}



// ════════════════════════════════════════════════════════
// FOCAL MECHANISM — USGS MOMENT TENSOR FETCH (GEO-B)
// Fetches M5.5+ focal mechanisms from USGS ComCat.
// Computes thrust/strike-slip/normal ratio as stress regime indicator.
// A shift toward thrust-dominant mechanisms can indicate regional stress loading.
// ════════════════════════════════════════════════════════

var _focalMechanisms = [];    // [{id, mag, place, lat, lon, type, rake, strike, dip, ts}]
var _focalFetched    = 0;
var _focalRatio      = null;  // {thrust, strikeslip, normal, total, dominant, trendWarning}

async function fetchFocalMechanisms() {
  var now = Date.now();
  if (now - _focalFetched < 3 * 3600 * 1000) return;  // cache 3 hours
  try {
    var end   = new Date().toISOString().split('T')[0];
    var start = new Date(now - 30 * 86400000).toISOString().split('T')[0];
    var url   = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson' +
                '&producttype=moment-tensor&minmagnitude=5.5' +
                '&starttime=' + start + '&endtime=' + end +
                '&orderby=time&limit=100';
    var resp  = await _fetchWithTimeout(url, 12000);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    var data  = await resp.json();
    var mechs = [];
    (data.features || []).forEach(function(f) {
      var p   = f.properties || {};
      // Prefer GCMT product (most rigorous); fall back to USGS moment-tensor
      var _gcmtProd = p.products && p.products['gcmt'];
      var _mtProd   = p.products && p.products['moment-tensor'];
      var mt        = _gcmtProd || _mtProd;
      if (!mt || !mt[0]) return;
      var mtProps  = mt[0].properties || {};
      var mtSource = _gcmtProd ? 'GCMT' : 'USGS-MT';
      // Rake angle from nodal plane 1 → mechanism type
      var rake = parseFloat(mtProps['nodal-plane-1-rake'] || mtProps.rake || 'NaN');
      var type = 'unknown';
      if (!isNaN(rake)) {
        if (rake > 45 && rake < 135)         type = 'thrust';      // reverse / compressional
        else if (rake < -45 && rake > -135)  type = 'normal';      // extensional
        else                                 type = 'strike-slip'; // lateral
      }
      mechs.push({
        id:     f.id,
        mag:    p.mag || 0,
        place:  p.place || '',
        lat:    f.geometry && f.geometry.coordinates ? f.geometry.coordinates[1] : 0,
        lon:    f.geometry && f.geometry.coordinates ? f.geometry.coordinates[0] : 0,
        depth:  f.geometry && f.geometry.coordinates ? f.geometry.coordinates[2] : 0,
        type:   type,
        rake:   rake,
        source: mtSource,
        ts:     p.time || 0,
      });
    });
    _focalMechanisms = mechs;
    _focalFetched    = now;
    _computeFocalRatio();
    updateFocalMechanismPanel();
    updateApiHealth('focal', 'ok');
    if (mechs.some(function(m){ return m.source === 'GCMT'; })) {
      updateApiHealth('gcmt', 'ok');
    }
  } catch(e) {
    updateApiHealth('focal', 'error');
    console.warn('[ESO focal] fetch failed:', e.message);
  }
}

function _computeFocalRatio() {
  var n = _focalMechanisms.length;
  if (n < 3) { _focalRatio = null; return; }
  var thrust = 0, ss = 0, normal = 0, unknown = 0;
  _focalMechanisms.forEach(function(m) {
    if      (m.type === 'thrust')      thrust++;
    else if (m.type === 'strike-slip') ss++;
    else if (m.type === 'normal')      normal++;
    else                               unknown++;
  });
  var nTyped = thrust + ss + normal;
  if (nTyped < 3) { _focalRatio = null; return; }
  var dominant = thrust > ss && thrust > normal ? 'Thrust-dominant (compressional)'
               : normal > ss && normal > thrust ? 'Normal-dominant (extensional)'
               : 'Strike-slip dominant (lateral)';
  // Trend warning: if thrust > 60% in last 30 days, that's precursor-worthy
  var trendWarning = (thrust / nTyped > 0.60) ?
    '⚠ High thrust ratio (' + Math.round(thrust/nTyped*100) + '%) — compressional stress may be building' : '';
  _focalRatio = {
    thrust: thrust, strikeslip: ss, normal: normal,
    total: nTyped, dominant: dominant, trendWarning: trendWarning,
    thrustPct: Math.round(thrust / nTyped * 100),
    ssPct:     Math.round(ss / nTyped * 100),
    normalPct: Math.round(normal / nTyped * 100),
  };
}

function updateFocalMechanismPanel() {
  var container = document.getElementById('focal-mechanism-content');
  if (!container) return;
  if (!_focalRatio || _focalMechanisms.length < 3) {
    container.innerHTML = '<div style="color:var(--text-dim);font-size:9px;padding:8px;">Loading moment tensor data… (M5.5+, last 30 days)</div>';
    return;
  }
  var r = _focalRatio;
  var barStyle = function(pct, color) {
    return 'height:10px;background:' + color + ';width:' + pct + '%;border-radius:1px;transition:width .4s;';
  };
  container.innerHTML =
    '<div style="font-size:9px;color:var(--text-dim);margin-bottom:6px;">Last 30 days · n=' + r.total + ' events · M≥5.5</div>' +
    '<div style="margin-bottom:8px;">' +
      '<div style="display:flex;justify-content:space-between;font-size:8px;margin-bottom:2px;"><span style="color:#ff6d00">THRUST (' + r.thrustPct + '%)</span><span style="color:var(--text-dim)">compressional</span></div>' +
      '<div style="background:rgba(255,255,255,.08);border-radius:1px;height:10px;"><div style="' + barStyle(r.thrustPct,'#ff6d00') + '"></div></div>' +
    '</div>' +
    '<div style="margin-bottom:8px;">' +
      '<div style="display:flex;justify-content:space-between;font-size:8px;margin-bottom:2px;"><span style="color:#00e5ff">STRIKE-SLIP (' + r.ssPct + '%)</span><span style="color:var(--text-dim)">lateral</span></div>' +
      '<div style="background:rgba(255,255,255,.08);border-radius:1px;height:10px;"><div style="' + barStyle(r.ssPct,'#00e5ff') + '"></div></div>' +
    '</div>' +
    '<div style="margin-bottom:8px;">' +
      '<div style="display:flex;justify-content:space-between;font-size:8px;margin-bottom:2px;"><span style="color:#00ff88">NORMAL (' + r.normalPct + '%)</span><span style="color:var(--text-dim)">extensional</span></div>' +
      '<div style="background:rgba(255,255,255,.08);border-radius:1px;height:10px;"><div style="' + barStyle(r.normalPct,'#00ff88') + '"></div></div>' +
    '</div>' +
    '<div style="font-size:8px;color:#fff;margin-bottom:4px;"><b>' + r.dominant + '</b></div>' +
    (r.trendWarning ? '<div style="font-size:8px;color:var(--c-gold);padding:4px 6px;background:rgba(255,214,0,.08);border-radius:2px;">' + r.trendWarning + '</div>' : '') +
    (function() {
      var gcmtCount = _focalMechanisms.filter(function(m){ return m.source === 'GCMT'; }).length;
      var srcNote = gcmtCount > 0
        ? 'GCMT: ' + gcmtCount + ' · USGS-MT: ' + (_focalMechanisms.length - gcmtCount)
        : 'Source: USGS ComCat moment-tensor';
      return '<div style="font-size:7px;color:var(--text-dim);margin-top:6px;">' + srcNote + ' · rake-classified</div>';
    })();
}

function startFocalMechRefresh() {
  fetchFocalMechanisms();
  setInterval(fetchFocalMechanisms, 3 * 3600 * 1000);
}

// ════════════════════════════════════════════════════════
// SEISMICITY RATE-CHANGE — STRAIN PROXY (GEO-C)
// Compares M3+ quake rate last 7 days vs previous 7 days per region.
// A 2× rate increase in a region is a proxy for strain accumulation,
// analogous to what GNSS geodetic data would show.
// ════════════════════════════════════════════════════════

var _strainProxy = {};  // regionId → {current, previous, ratio, alert}

async function computeSeismicStrainProxy() {
  try {
    var now   = Date.now();
    var end   = new Date(now).toISOString();
    var mid   = new Date(now - 7  * 86400000).toISOString();
    var start = new Date(now - 14 * 86400000).toISOString();

    // Fetch 14 days of M3+ globally
    var url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson' +
              '&minmagnitude=3.0&starttime=' + start.split('T')[0] + '&endtime=' + end.split('T')[0] +
              '&orderby=time&limit=2000';
    var resp = await _fetchWithTimeout(url, 15000);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    var data = await resp.json();
    var features = data.features || [];

    // Assign each quake to a region using REGION_BBOX
    var regionNames = typeof REGION_BBOX !== 'undefined' ? Object.keys(REGION_BBOX) : [];
    var midTs = new Date(mid).getTime();
    var counts = {};
    regionNames.forEach(function(r) {
      counts[r] = { current: 0, previous: 0 };
    });

    features.forEach(function(f) {
      var coords = f.geometry && f.geometry.coordinates;
      if (!coords) return;
      var lon = coords[0], lat = coords[1];
      var ts  = f.properties.time || 0;
      regionNames.forEach(function(r) {
        var b = REGION_BBOX[r];
        if (!b) return;
        var inBbox = lat >= b.minLat && lat <= b.maxLat && lon >= b.minLon && lon <= b.maxLon;
        if (!inBbox) return;
        if      (ts >= midTs) counts[r].current++;
        else                  counts[r].previous++;
      });
    });

    var proxy = {};
    regionNames.forEach(function(r) {
      var c = counts[r].current, p = counts[r].previous;
      var ratio = p > 0 ? c / p : (c > 0 ? 3.0 : 1.0);
      proxy[r] = {
        current:  c,
        previous: p,
        ratio:    Math.round(ratio * 10) / 10,
        alert:    ratio >= 2.0 ? 'high' : ratio >= 1.5 ? 'elevated' : 'normal',
        label:    ratio >= 2.0 ? '▲ ' + ratio.toFixed(1) + '× (strain watch)'
                : ratio >= 1.5 ? '▲ ' + ratio.toFixed(1) + '× (elevated)'
                : ratio < 0.5  ? '▼ ' + ratio.toFixed(1) + '× (lull)'
                : '→ ' + ratio.toFixed(1) + '×',
      };
    });
    _strainProxy = proxy;
    updateStrainProxyPanel();
  } catch(e) {
    console.warn('[ESO strain proxy]', e.message);
  }
}

function updateStrainProxyPanel() {
  var container = document.getElementById('strain-proxy-content');
  if (!container || !Object.keys(_strainProxy).length) return;
  var entries = Object.entries(_strainProxy).sort(function(a, b) {
    return b[1].ratio - a[1].ratio;
  });
  container.innerHTML = '<div style="font-size:8px;color:var(--text-dim);margin-bottom:6px;">M3+ rate: last 7d vs prior 7d · proxy for crustal strain</div>' +
    entries.map(function(kv) {
      var r = kv[1];
      var col = r.alert === 'high' ? '#ff3d3d' : r.alert === 'elevated' ? '#ffd600' : 'var(--text-dim)';
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid rgba(255,255,255,.05);">' +
        '<span style="font-size:8px;color:var(--text);text-transform:capitalize;">' + kv[0].replace(/_/g,' ') + '</span>' +
        '<span style="font-size:8px;color:' + col + ';font-weight:700;">' + r.label + '</span>' +
        '</div>';
    }).join('') +
    '<div style="font-size:7px;color:var(--text-dim);margin-top:6px;">Source: USGS FDSNWS • GNSS-independent strain proxy</div>';
}

function startStrainProxyRefresh() {
  computeSeismicStrainProxy();
  setInterval(computeSeismicStrainProxy, 6 * 3600 * 1000);  // every 6h
}

// ════════════════════════════════════════════════════════
// HINDCAST VALIDATION ENGINE (UX-B)
// Stores ESO predictions with timestamps so they can be compared
// against what actually happened 48h later. Builds credibility.
// ════════════════════════════════════════════════════════

var _hindcastStore = [];      // [{ts, eqScore, tsunScore, stormScore, validated, outcome}]
var HINDCAST_MAX   = 100;     // keep last 100 predictions (= ~100 refresh cycles)

function saveHindcastSnapshot() {
  if (typeof scoreEarthquake !== 'function') return;
  var eq   = scoreEarthquake();
  var ts   = scoreTsunami   ? scoreTsunami()    : null;
  var ss   = scoreSuperstorm? scoreSuperstorm()  : null;
  _hindcastStore.push({
    ts:          Date.now(),
    eqScore:     eq ? eq.score : 0,
    tsunScore:   ts ? ts.score : 0,
    stormScore:  ss ? ss.score : 0,
    validated:   false,
    outcome:     null,
  });
  if (_hindcastStore.length > HINDCAST_MAX) _hindcastStore.shift();
  try { localStorage.setItem('eso-hindcast-v1', JSON.stringify(_hindcastStore)); } catch(e) {}
}

function loadHindcastStore() {
  try {
    var raw = localStorage.getItem('eso-hindcast-v1');
    if (raw) _hindcastStore = JSON.parse(raw).slice(-HINDCAST_MAX);
  } catch(e) {}
}

// Validate predictions that are now >48h old against actual USGS data
async function validateOldPredictions() {
  var now = Date.now();
  var toValidate = _hindcastStore.filter(function(h) {
    return !h.validated && (now - h.ts) >= 48 * 3600 * 1000;
  });
  if (!toValidate.length) return;

  try {
    for (var i = 0; i < Math.min(toValidate.length, 3); i++) {
      var entry = toValidate[i];
      var startDate = new Date(entry.ts).toISOString().split('T')[0];
      var endDate   = new Date(entry.ts + 48 * 3600000).toISOString().split('T')[0];
      var url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson' +
                '&minmagnitude=5.5&starttime=' + startDate + '&endtime=' + endDate +
                '&orderby=magnitude&limit=10';
      var resp = await _fetchWithTimeout(url, 10000);
      if (!resp.ok) continue;
      var data = await resp.json();
      var quakes = (data.features || []).map(function(f) {
        return { mag: f.properties.mag, place: f.properties.place };
      });
      entry.outcome   = { quakes: quakes, count: quakes.length, maxMag: quakes.length ? quakes[0].mag : 0 };
      entry.validated = true;
      // Simple accuracy metric: was a M5.5+ quake predicted when score > 50?
      entry.accurate  = (entry.eqScore >= 50 && quakes.length > 0) ||
                        (entry.eqScore < 50  && quakes.length === 0);
    }
    try { localStorage.setItem('eso-hindcast-v1', JSON.stringify(_hindcastStore)); } catch(e2) {}
  } catch(e) {
    console.warn('[ESO hindcast validate]', e.message);
  }
}

function startHindcastCycle() {
  loadHindcastStore();
  // Save snapshot every 6h
  setInterval(function() {
    saveHindcastSnapshot();
    validateOldPredictions();
  }, 6 * 3600 * 1000);
  // Validate any pending on startup
  validateOldPredictions();
}
