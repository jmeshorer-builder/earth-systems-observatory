# ESO v4.0 Release Notes
**Released:** 2026-04-15  
**Build:** 17,563 lines / 898 KB readable · 771 KB minified  
**Live:** https://jmeshorer-builder.github.io/earth-systems-observatory/earth-observatory-p3.html

## Phase 4 — El Niño Cross-Domain Intelligence Engine

### What's new in Phase 4 (v4.0–v4.9)

**v4.0** — Fetch infrastructure: `cachedFetch`, `retryFetch`, AbortController, data versioning, API health tracking  
**v4.1** — NASA GIBS satellite base layer (MODIS Terra True Color), NASA GHRSST MUR SST tile overlay  
**v4.2** — IRI/CPC ENSO official forecast, NOAA ONI historical series, El Niño 2026 Risk Card  
**v4.3** — Copernicus Marine DHW layer, NOAA Coral Reef Watch, coral bleaching risk scoring  
**v4.4** — NASA FIRMS fire layer (MODIS C6.1 24h NRT), ENSO layer, `eso-elnino.js` scaffold (10-file build)  
**v4.5** — Deep Analysis 12→5 tabs (Stress · Lag · Spectral · Chaos · Cause), universal context header, CTAs  
**v4.6** — Thesis C: El Niño Marine Heatwave Cascade (5-link chain, compound risk scorer `getCompoundRisk()`)  
**v4.7** — Thesis D: ENSO-Wildfire-Carbon Chain (4-link chain, FIRMS regional counts, dual-thesis Risk tab card)  
**v4.8** — ENSO compound factor in `scoreEarthquake()`, El Niño mode in Ask ESO, SITREP ENSO section, calendar ENSO annotations  
**v4.9** — Historical backfill script (`backfill-elnino.py`), `elnino-backfill.json`, validation against 1997–98/2015–16/2023–24 events, release snapshot

### Architecture
10 source files: `eso-stats.js` → `eso-core.js` → `eso-data.js` → `eso-ui.js` → `eso-thesis.js` → `thesis-a.js` → `thesis-b.js` → `eso-elnino.js` → `earth-observatory-modular.html`, built by `build.py`

### Known limitations
- DHW from Copernicus Marine requires CORS proxy in production (falls back to synthetic)
- FIRMS CSV may be rate-limited; synthetic fallback activates automatically
- El Niño backfill ONI data requires local run of `backfill-elnino.py` (NOAA API blocked in some environments)

### Not for operational use
Research and educational tool only. Not a warning system.
