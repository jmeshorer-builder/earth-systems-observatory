# 🌍 Earth Systems Observatory (ESO)

A real-time geophysical monitoring dashboard and scientific research platform for cross-domain Earth systems analysis — seismicity, space weather, tidal forces, climate, and ionospheric activity.

**[→ Open the Live App](https://jmeshorer-builder.github.io/earth-systems-observatory/earth-observatory-p3.html)**

---

## What It Does

ESO fetches and visualizes live data from multiple scientific agencies (NOAA, USGS, NASA, IERS) and overlays them on an interactive world map. It is also a research tool for testing hypotheses about correlations between geophysical domains.

**Real-time data streams:**
- Seismicity — USGS earthquake catalog (M3–M8+, 24h / 7d / 30d, global or regional)
- Space weather — NOAA Kp index, DSCOVR solar wind (Bz, speed, density), GOES X-ray flares, proton flux, Dst ring current, F10.7 solar flux
- Tidal forcing — Meeus lunar phase algorithm (sub-degree accuracy), syzygy detection
- Climate — SST anomalies, ENSO phase (Nino3.4), MJO phase, precipitation grid
- Earth rotation — IERS Length of Day (LOD) excess from Paris Observatory EOP C04 series
- Tsunami — GDACS + USGS official warning feeds

**Analysis features:**
- Aftershock clustering (DBSCAN-like, 2°/72h)
- Gutenberg-Richter b-value (max-likelihood, real-time + time series)
- Pearson correlation with BH-FDR correction, Morlet wavelet coherence, mutual information permutation tests
- Historical seismicity heatmap (30-day density overlay)
- Beginner / Expert mode toggle with guided tour

---

## Thesis Research

ESO includes a built-in scientific thesis framework for pre-registered hypothesis testing.

### Thesis A — Severe Geomagnetic Storms and Subduction Zone Seismicity
**Status: CONCLUDED (2026-04-02)**

Tests whether extreme solar wind events (Bz ≤ −10 nT) trigger M7.0+ subduction zone earthquakes within a 96-hour window.

- Primary result: **NULL** — p = 0.663 over 15-year catalog. The prior 5-year p = 0.027 was a false positive.
- Exploratory finding: Bz ≤ −12 nT (severe storms only) → p = 0.0027, RR = 3.6×, n = 33 triggers, 7 hits (Bonferroni-corrected).
- Now in **prospective replication phase** — auto-logging new Bz ≤ −12 nT trigger events for 2–3 years.
- See: `research/thesis-a/Thesis A — Severe Geomagnetic Storms and Subduction Zone Seismicity.pdf`

### Thesis B — Tidal Triggering of Great Earthquakes
**Status: CONCLUDED (2026-04)**

Tests whether M7.5+ earthquakes occur at higher rates during syzygy windows (±3 days of new/full moon).

- Result: **NULL** — p = 0.9175, RR = 0.871×, N = 147. Tidal triggering not supported. Ide et al. (2016, Nature Geoscience) not replicated.
- All robustness checks (permutation test, magnitude sweep M7.0–8.5+, temporal split, tectonic zone breakdown) confirm null.
- See: `research/thesis-b/Thesis B — Tidal Triggering — Research Conclusions.pdf`

### Thesis C — El Niño Marine Heatwave Cascade
**Status: IN PROGRESS**

Tests whether ENSO → SST → marine heatwave → coral bleaching → fishery disruption cascade dynamics have detectable signatures in cross-domain geophysical data.

### Thesis D — ENSO → Wildfire → Carbon Chain
**Status: IN PROGRESS**

Tests whether El Niño-driven precipitation deficits in SE Asia, Australia, and the Amazon predictably amplify fire weather and atmospheric carbon pulse dynamics.

---

## Project Structure

```
earth-systems-observatory/
│
├── earth-observatory-p3.html       ← Live app (open this in browser)
├── earth-observatory-p3.min.html   ← Minified build
├── README.md
├── VERSIONS.md
│
├── src/                            ← Source files (edit these)
│   ├── earth-observatory-modular.html   HTML shell
│   ├── eso-style.css                    All CSS
│   ├── eso-stats.js                     Math/stats library (no DOM deps)
│   ├── eso-core.js                      State, map, UI navigation, layers
│   ├── eso-data.js                      API fetches, scoring, data processing
│   ├── eso-ui.js                        Charts, analysis panels, notifications
│   ├── eso-thesis.js                    Generic thesis framework
│   ├── eso-elnino.js                    El Niño / ENSO intelligence engine
│   ├── thesis-a-solar-seismic.js        Thesis A implementation
│   ├── thesis-b-tidal-seismic.js        Thesis B implementation
│   └── build.py                         Merges src/ → earth-observatory-p3.html
│
├── research/                       ← Study design & conclusions
│   ├── thesis-a/
│   │   ├── Thesis A — Severe Geomagnetic Storms and Subduction Zone Seismicity.pdf
│   │   └── backfill-thesis-a.py         15-yr NASA OMNI + USGS analysis
│   ├── thesis-b/
│   │   ├── Thesis B — Tidal Triggering of Great Earthquakes — Research Design.pdf
│   │   ├── Thesis B — Tidal Triggering — Research Conclusions.pdf
│   │   └── backfill-thesis-b.py         50-yr USGS M7.0+ tidal analysis
│   └── elnino/
│       └── backfill-elnino.py           NOAA ONI historical series (1950–present)
│
├── data/                           ← Backfill JSON caches
│   ├── thesis-a-backfill.json
│   ├── thesis-b-backfill.json
│   └── elnino-backfill.json
│
├── docs/                           ← Project documentation
│   ├── ESO-project-summary.md
│   ├── ESO-research-roadmap.md
│   └── ESO-Phase4-Version-Roadmap.docx
│
└── releases/                       ← Release snapshots
    ├── v3.0/
    └── v4.0/
```

---

## Running Locally

Open `earth-observatory-p3.html` directly in any modern browser. No server required — all API calls are made client-side.

To rebuild after editing source files:
```bash
cd src
python3 build.py          # builds ../earth-observatory-p3.html
python3 build.py --both   # builds both standard and minified versions
```

---

## Data Sources

| Domain | Source |
|---|---|
| Seismicity | USGS FDSNWS |
| Space weather / geomagnetic | NOAA SWPC |
| Solar wind | NASA DSCOVR (OMNI) |
| Satellite imagery | NASA GIBS (MODIS Terra) |
| Sea surface temperature | NASA GHRSST MUR + NOAA |
| ENSO forecast | IRI/CPC official forecast + NOAA ONI |
| Marine heatwaves / coral bleaching | Copernicus Marine + NOAA Coral Reef Watch |
| Wildfire | NASA FIRMS (MODIS C6.1 NRT) |
| Earth rotation (LOD) | IERS Paris Observatory EOP C04 |
| Focal mechanisms | GCMT / USGS moment tensors |
| Tsunami warnings | GDACS + USGS |
| Precipitation | Open-Meteo |
