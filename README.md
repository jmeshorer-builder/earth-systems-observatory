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
- See: `Thesis A — Severe Geomagnetic Storms and Subduction Zone Seismicity.docx`

### Thesis B — Tidal Triggering of Great Earthquakes
**Status: CONCLUDED (2026-04)**

Tests whether M7.5+ earthquakes occur at higher rates during syzygy windows (±3 days of new/full moon).

- Result: **NULL** — p = 0.9175, RR = 0.871×, N = 147. Tidal triggering not supported. Ide et al. (2016, Nature Geoscience) not replicated.
- All robustness checks (permutation test, magnitude sweep M7.0–8.5+, temporal split, tectonic zone breakdown) confirm null.
- See: `Thesis B — Tidal Triggering — Research Conclusions.docx`

---

## Project Structure

```
earth-observatory-modular.html  — HTML shell (structure + script tags)
eso-style.css                   — All CSS
eso-stats.js                    — Math/stats library (no DOM dependencies)
eso-core.js                     — State, map, UI navigation, layer system
eso-data.js                     — API fetches, scoring, data processing
eso-ui.js                       — Charts, analysis panels, notifications
eso-thesis.js                   — Generic thesis framework
thesis-a-solar-seismic.js       — Thesis A implementation
thesis-b-tidal-seismic.js       — Thesis B implementation
build.py                        — Concatenates all source files → earth-observatory-p3.html
earth-observatory-p3.html       — Built output (open this in browser)
```

### Backfill Scripts
- `backfill-thesis-a.py` — 15-year NASA OMNI + USGS catalog analysis for Thesis A
- `backfill-thesis-b.py` — 50-year USGS M7.0+ tidal analysis for Thesis B

---

## Running Locally

Open `earth-observatory-p3.html` directly in any modern browser. No server required — all API calls are made client-side.

To rebuild after editing source files:
```bash
python3 build.py          # builds earth-observatory-p3.html
python3 build.py --both   # builds both standard and minified versions
```

---

## Data Sources

| Domain | Source |
|---|---|
| Seismicity | USGS FDSNWS |
| Geomagnetic / Space weather | NOAA SWPC |
| Solar wind | NASA DSCOVR |
| Earth rotation (LOD) | IERS Paris Observatory EOP C04 |
| Focal mechanisms | GCMT / USGS moment tensors |
| Tsunami warnings | GDACS + USGS |
| Sea surface temperature | NOAA |
| Precipitation | Open-Meteo |
