# ESO Working Context — Phase 4 Build Reference

> **Purpose:** Read THIS file instead of re-reading all source files. Updated after each version.
> **Last updated:** v4.3 (2026-04-15)

## Current Version: v4.3

## File Map (src/)
| File | Lines | Purpose | Load Order |
|------|-------|---------|------------|
| eso-style.css | ~2,009 | All CSS + v4.0 utility classes + v4.1 map controls | 0 (stylesheet) |
| eso-stats.js | 518 | Math/stats (Pearson, wavelet, MI, z-score) | 1 |
| eso-core.js | ~2,060 | State, map, layers, caching, **cachedFetch + retryFetch + data versioning (v4.0)** | 2 |
| eso-data.js | 3,940 | API fetches, scoring, backoff, API health, v4.2 ENSO, **v4.3: fetchCopernicusMarine, fetchCoralReefWatch, scoreCoralBleachingRisk, renderDHWBaseline, renderCoralPanel** | 3 |
| eso-ui.js | 4,369 | Charts, analysis panels, Ask ESO, SITREP, init, v4.1 GIBS, **v4.3 DHW fallback from SST patch** | 4 |
| eso-thesis.js | 539 | Thesis framework (register/activate/evidence) | 5 |
| thesis-a-solar-seismic.js | 875 | Thesis A module (concluded) | 6 |
| thesis-b-tidal-seismic.js | 591 | Thesis B module (concluded) | 7 |
| earth-observatory-modular.html | 1,592 | HTML shell + v4.1 map controls + v4.2 ENSO card + **v4.3 Coral Risk Card + DHW baseline** | last |
| build.py | 101 | Build script: src/ → earth-observatory-p3.html | N/A |
| **TOTAL** | **~16,635** | | |

## Key Insertion Points

### eso-core.js
- **Line 1**: `const state = { activeLayers, data, mapLayers, markers }`
- **~Line 1639**: **v4.0 DATA VERSIONING** — `ESO_DATA_VERSION`, auto-clear stale caches on version bump
- **~Line 1670**: **v4.0 IN-MEMORY FETCH CACHE** — `cachedFetch(url, opts)`, `retryFetch(url, opts)`, `_fetchCache` Map, `_inflightReqs` Map for dedup
- **~Line 1770**: `ESO_CACHE_TTL` (localStorage), `cacheSet()`, `cacheGet()`, `cacheClear()` — now includes TTLs for iri-enso, copernicus-marine, coral-reef-watch
- **~Line 1800**: `warmCacheOnLoad()` IIFE + Dst cache patch
- **~Line 1840+**: `serializeStateToHash()` / `restoreStateFromHash()`

### eso-data.js
- **Lines 1-30**: `loadSeismic()` — synthetic seismic layer (first function)
- **Lines 703-713**: `fetchKpAndSFI()` — uses relayFetch
- **Lines 732-748**: `runForecastDataFetch()` — master fetch orchestrator (Promise.allSettled)
- **Lines 1133-1207**: Network backoff system (`_apiOnline`, `_apiBackoffUntil`, `_markApiOffline()`, `_markApiOnline()`, `_apiReady()`, `_fetchWithTimeout()`)
- **Lines 1297+**: Real API fetches: `fetchRealKp()`, `fetchDst()`, `fetchDSCOVR()`, `fetchF107()`, `fetchIERSLod()`, `fetchCMEForecast()`, `fetchSpaceAlerts()`, `fetchPrecipGrid()`, `fetchProtonFlux()`
- **Lines 1900-1940**: `_apiHealthState` + `updateApiHealth()` + health patches
- **Lines 2090+**: `fetchOfficialTsunamiAlerts()`
- **Lines 2423+**: `fetchUSGSDirect()`, `fetchUSGSQuakes()`
- **Lines 2535+**: `fetchXRayFlux()`
- **Lines 2623+**: `fetchPressureGrid()`
- **Lines 3114+**: `fetchFocalMechanisms()`

### eso-ui.js
- **Lines 1–10**: `map`, `_leafletMap`, `_leafletIW` globals
- **Lines 11–100+**: **v4.1 GIBS layer vars**: `_mapBaseLayerCurrent`, `_mapBaseLayerDark`, `_mapBaseLayerSat`, `_mapGibsSSTLayer`, `_GIBS_BASE`
- **v4.1 functions**: `setBaseLayer(type)`, `toggleGibsSST()`
- `initLeafletMap()` — now initialises both CartoDB dark AND GIBS satellite layers
- Right panel tabs: Now, Risk, Explore, History, Analyze
- Deep Analysis: 9 sub-tabs (Stress, Lag, Spectral, Phase Space, MI, Planets, Novel, Chains, Discovery)
- Ask ESO: `answerESOQuestion()` 
- SITREP: `generateSitrep()`
- Baseline strip items: Kp, Dst, ENSO, SW Speed, IMF Bz, Proton Flux, b-value

### earth-observatory-modular.html (v4.1 additions)
- `#map-layer-controls` — bottom-left map control bar with `#map-base-toggle` and `#map-gibs-sst-btn`
- `#map-gibs-attr` — NASA attribution (satellite mode only)

### earth-observatory-modular.html
- Links to all 8 source files via `<script src="...">` and `<link rel="stylesheet">`
- API health panel: IDs `ah-noaa-swpc`, `ah-usgs`, `ah-openmeteo`, `ah-goes`, `ah-dscovr`, `ah-dst`, `ah-iers-lod`, `ah-gcmt`

## Existing Patterns (follow these)
- **Fetch + fallback**: try/catch with physics model fallback
- **Backoff**: `_apiReady()` check before fetch, `_markApiOnline()`/`_markApiOffline()` after
- **Cache**: `cacheGet(key)` before fetch, `cacheSet(key, data)` after success
- **Health**: `updateApiHealth('endpoint', 'ok'|'err')` after fetch
- **Timeout**: `_fetchWithTimeout(url, ms)` — Promise.race, no AbortSignal (srcdoc issue)

## Build Command
```bash
cd "/path/to/Earth systems observatory"
python3 src/build.py --both
```

## Review Schedule (Phase 4)
| After Version | Review Type | Focus |
|---------------|-------------|-------|
| v4.0 | Dev Review | Fetch infra correctness, no regressions |
| v4.3 | API Review | All new endpoints working, fallbacks tested |
| v4.5 | UI/UX Review | Right panel redesign, Deep Analysis consolidation |
| v4.7 | Product Review | Thesis C + D chains, compound scoring logic |
| v4.9 | QA Review | Full regression, performance audit, release readiness |

## v4.3 New Functions + State (for future versions to use)
- `fetchCopernicusMarine()` → array of `{ id, lat, lon, label, sst, dhw, bleaching_risk, source }` — 7 reef-region points
- `fetchCoralReefWatch()` → array of `{ region, dhw, alert, date }` — top 10 hottest reefs by NOAA
- `scoreCoralBleachingRisk(marineData)` → 0–100 composite bleaching risk score
- `renderDHWBaseline(dhw, src)` — updates `#bl-dhw` and `#bl-dhw-sub` in baseline strip
- `renderCoralPanel(regions)` — updates `#coral-alert-list` in Risk tab (normalizes both Copernicus + CRW format)
- `_computeDHW(sst, regionId, month)` → DHW estimate for a region/SST combo
- `_getCopernicusFallback(month)` → model DHW from SST grid (always available post-SST-load)
- `_updateDHWState(points)` — computes max DHW, updates `_dhwCurrent`, calls both baseline + panel renderers
- `_copernicusMarineData` — global holding 7-point marine array
- `_dhwCurrent` — max DHW (number) across monitored regions
- `_dhwSource` — `'live'` | `'model'` — use to show source badge
- `_COPERNICUS_POINTS` — array of 7 monitoring locations (add more if needed)
- `_SST_CLIMO_MAX` — per-region climatological SST maxima used for DHW computation
- `forecastData.marine` — Copernicus data in master forecast object
- `forecastData.coralBleachScore` — 0–100 bleach risk score

## v4.2 New Functions + State (for future versions to use)
- `fetchIRICPCEnso()` → `{ nino34_obs, phase, probability, consensus, source }` — use as ENSO backbone for thesis engine
- `fetchNOAAONI()` → array of `{ year, mon, oni }` — 12 most recent ONI values for trend analysis
- `renderENSOStatus(ensoData)` — call after any ENSO data update; updates strip + risk card
- `renderENSORiskCard(ensoData)` — updates `#enso-risk-card` in Risk tab
- `_ensoLiveData` — global holding latest ENSO data (check `.source !== 'physics'` for live status)
- `_oniLiveData` — global holding latest 12 ONI entries
- `_getENSOPhysicsFallback()` — returns SST-based ENSO estimate (internal, used as fallback)
- `forecastData.enso` — ENSO integrated into master forecast data object

## v4.1 New Functions (for future versions to use)
- `setBaseLayer('dark'|'satellite')` — switch map base tile (CartoDB dark ↔ NASA GIBS MODIS True Color)
- `toggleGibsSST()` — toggle NASA GHRSST MUR SST tile overlay (science-grade, daily)
- `_GIBS_BASE` — GIBS WMTS endpoint root (use to add more GIBS layers: fire, aerosol, snow cover, etc.)
- `_mapGibsSSTActive` — boolean state of SST overlay
- `updateApiHealth('nasa-gibs', 'ok'|'err')` — now registered

## v4.0 New APIs Available (for future versions to use)
- `cachedFetch(url, opts)` — in-memory cache + dedup + timeout (use instead of raw fetch)
- `retryFetch(url, opts)` — cachedFetch + exponential retry (use for critical APIs)
- `_trackApiTime(endpoint, ms)` — record response time for an endpoint
- `_trackApiCacheHit(endpoint, isHit)` — record cache hit/miss
- `getApiStats(endpoint)` — get avg response time + cache hit rate
- New `ESO_CACHE_TTL` keys: `'iri-enso'`, `'copernicus-marine'`, `'coral-reef-watch'`
- New `_apiHealthState` endpoints: `'iri-enso'`, `'copernicus-marine'`, `'coral-reef-watch'`, `'nasa-firms'`, `'nasa-gibs'`

## Version Log
| Version | Date | Changes | Lines |
|---------|------|---------|-------|
| v3.0 | 2026-04-13 | Baseline (Thesis A/B concluded, 9-file build) | 15,604 |
| v4.0 | 2026-04-14 | cachedFetch/retryFetch, data versioning, API health upgrade, CSS utility classes | 15,760 |
| v4.1 | 2026-04-14 | NASA GIBS satellite base layer, GIBS GHRSST SST overlay, map layer controls UI | 15,946 |
| v4.2 | 2026-04-14 | IRI/CPC ENSO fetch, NOAA ONI, renderENSOStatus, El Niño 2026 Risk Card | 16,286 |
| **Phase 4 milestone** | 2026-04-14 | Snapshot saved: releases/Phase4-v4.0/ (v4.0+v4.1+v4.2) | — |
| v4.3 | 2026-04-15 | Copernicus Marine SST+DHW, NOAA CRW, scoreCoralBleachingRisk, DHW baseline, Coral Risk Card. API Review ✓ | 16,635 |
