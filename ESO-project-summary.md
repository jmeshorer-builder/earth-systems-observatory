# Earth Systems Observatory — Project Summary
*Last updated: 2026-04-05*

---

## Overview

The **Earth Systems Observatory (ESO)** is a single-page, browser-based dashboard that synthesizes real-time geophysical, space weather, and atmospheric data into a unified, interactive visualization. It is designed for scientific curiosity, situational awareness, and cross-layer correlation analysis — helping users understand how solar activity, seismic events, ocean conditions, and atmospheric dynamics interact as a coupled Earth system.

---

## Current File

| Item | Detail |
|------|--------|
| **Primary file** | `earth-observatory-modular.html` (modular build) · `earth-observatory-p3.html` (legacy single-file) |
| **Approximate lines** | ~15,520 (modular build) |
| **Architecture** | Modular: HTML entry point + separate JS/CSS files, assembled by `build.py`. Single-file `p3.html` maintained for compatibility. |
| **Map engine** | Leaflet.js + CartoDB dark tiles |
| **Fonts** | Space Mono (monospace), Syne (UI headers) via Bunny Fonts CDN |

Previous versions: `earth-observatory-p2_4.html` (Phase 3 v2.4, stable baseline), `earth-observatory-p2.html`, `earth-observatory.html` (Phase 1).

---

## One Line

An interactive dark-map Earth science dashboard that overlays real-time geophysical data layers — seismic, solar, magnetic, atmospheric — and uses pattern recognition, cross-correlation, chain-of-events logic, and AI-powered synthesis to surface hidden relationships between Earth's coupled systems.

---

## Data Layers

| Layer | Source | Status |
|-------|--------|--------|
| Seismic activity (M4.5+) | USGS FDSNWS direct API | ✅ Live |
| Geomagnetic Kp index | NOAA SWPC (7-day JSON) | ✅ Live |
| Solar X-ray flux / flares | NOAA GOES satellite feed | ✅ Live |
| Sea surface temperature | Open-Meteo (grid sampling) | ✅ Live |
| Wind patterns | Open-Meteo | ✅ Live |
| Atmospheric pressure grid | Open-Meteo (live grid) | ✅ Live |
| Ionospheric TEC | Physics model (NASA/JPL) | ⚡ Model |
| Schumann resonance | Physics model (GDTC) | ⚡ Model |
| Tidal forcing | Deterministic lunar/solar calculation (JPL) | ⚡ Deterministic |
| Length of Day (LOD) | IERS Paris Observatory EOP C04 series (falls back to seasonal sinusoid) | ✅ Live |
| GCMT focal mechanisms | USGS event catalog (prefers GCMT product, falls back to USGS-MT) | ✅ Live |
| Gravity anomalies | NASA GRACE model | ⚡ Model |
| Geothermal heat flow | IHFC dataset model | ⚡ Model |
| Solar irradiance | NASA POWER model (solar cycle calc) | ⚡ Calculated |
| Solar wind pressure | NASA ACE model | ⚡ Calculated |
| Cosmic ray flux | NMDB model | ⚡ Calculated |
| Magnetic field | NOAA World Magnetic Model | ⚡ Model |
| Volcanic activity | Smithsonian GVP | ✅ Live |

Live APIs fall back to physics models when offline. Exponential backoff (2→4→8→10 min) prevents request storms. Manual retry via NET badge in status bar; tab visibility change auto-retries after 2 s.

---

## Feature Set

### Map & Layers
- Interactive Leaflet map with dark CartoDB basemap
- 16 toggleable data layers across 4 domains (Space Weather, Core & Crust, Atmosphere, Oceans)
- Domain group "ALL" toggle buttons to enable/disable an entire domain at once
- Region overlay with click-to-query ("Ask ESO about this region") via `askRegion()`
- Real-time USGS seismic event markers with magnitude/depth/place tooltips
- English-only labels (dark_nolabels tile + programmatic geographic labels)

### Right Panel — Tab System
5 tabs in a scrollable row (keyboard shortcuts `1`–`4`, `D`):

| Key | Tab | Purpose |
|-----|-----|---------|
| 1 | 🌐 Now | Live snapshot of all active layer readings |
| 2 | ⚠ Risk | Forecast & risk assessment (30-day calendar, compound risk score) |
| 3 | 🔗 Explore | Cross-layer correlation clusters (expandable cards with peer-reviewed evidence) |
| 4 | 📅 History | Time-series charts — 1M / 1Y / 5Y / Solar Cycle / YoY / Grand Cycle |
| D | 🔍 Analyze | Deep Analysis Engine (fullscreen overlay, 9 sub-tabs) |

**Keyboard shortcuts:** `1`–`4` jump to tabs · `D` opens Deep Analysis · `F` toggles fullscreen panel mode · `?` opens Field Guide · `Escape` exits fullscreen / closes overlays.

### Panel UX Features
- **Drag-to-resize**: drag left edge of right panel between 240–700 px; `--panel-w` CSS variable updated live
- **Fullscreen mode** (`F` key or button): panel expands to 100 vw, map/left panel/status strip hidden
- **Accordion sections** (Now tab): collapsible `▾` sections with `togglePS(id)`
- **Compact Clusters cards**: click `.corr-card` to toggle `.open` and expand correlation detail + evidence

### UX Help System (Phase 6)
- **Styled tooltip system**: `data-tip` attribute on 53 elements; rich formatted tooltips (500 ms delay, auto-positioned to avoid viewport edges). Covers all 16 layer items, all 5 right panel tabs, all 7 status strip metrics, all 9 Deep Analysis sub-tabs, and key UI controls.
- **Field Guide panel** (`?` button in header or `?` keyboard shortcut): slides in from right at z-index 1050. Four tabbed sections:
  - *Overview* — what ESO is and a step-by-step how-to-use guide
  - *Layers* — all 16 layers explained in plain language with physical context
  - *Reading* — how to interpret Kp scale, LIVE/MODEL/CALC badges, correlation clusters, history periods
  - *Tips* — keyboard shortcuts, 6 best-practice scenarios, uncertainty caveats
- **First-visit hint card**: appears 3.5 s after first load, floating above status bar; dismissed permanently (localStorage); opens Field Guide directly.

### Deep Analysis Engine (Fullscreen Overlay)
9 sub-tabs accessible via `D` key or 🔍 Analyze tab:

| Sub-tab | What it does |
|---------|-------------|
| Stress Index | Composite weighted Z-score (0–100) across all active layers |
| Lag Explorer | Cross-correlation between two layers at varying time offsets |
| Spectral | FFT frequency decomposition — reveals hidden periodic cycles |
| Phase Space | 2D attractor geometry — circular = oscillation, scatter = chaos |
| Mutual Info | Non-linear dependency matrix (captures what Pearson misses) |
| Planets | Gravitational tidal forcing from each solar system body |
| Novel Indices | Custom synthetic indices (Compound Seismic Trigger, EM Environment, etc.) |
| ⛓ Chains | 11 physical cascade pathways with historical precedents |
| Discovery Log | Automated pattern detection running every 30 s |

### Ask ESO (Floating Chat)
- Floating chat panel anchored bottom-right, independent of the tab panel
- Accessible via header button, keyboard, or map region click → "Ask ESO"
- `askRegion()` pre-populates a region status query and routes to float chat
- 8 Quick Region buttons with real USGS lat/lon bounding box queries
- Local expert engine always active; Claude API optional (`setESOApiKey()` in console)

### 30-Day Forecast Calendar (Risk tab)
- Deterministic 31-day calendar: daily compound risk score (0–100)
- Components: lunar syzygy %, NOAA Kp recurrence probability, LOD contribution (live IERS data when available, seasonal sinusoid fallback), compound boost
- Color-coded: 🔴 Critical (≥60) · 🟠 Watch (≥40) · 🟡 Advisory (≥22) · ⬜ Clear
- Moon phase emoji per cell, hover tooltip with full component breakdown
- **LOD tile** in baseline strip: color-coded gold (decelerating / seismically relevant) or green (accelerating); refreshes daily

### Status Strip
- Persistent top bar below header: GEO Kp · EQ Risk · Tsunami · Syzygy % · Flares · Alerts · NET
- All 7 metrics have hover tooltips explaining the indicator and its scale
- **NET badge** is clickable → calls `retryApis()` immediately
- Shows `● LIVE` (green) or `○ MODELS` (dim) depending on API availability

### Notifications
9 signal sources, 4 severity levels (Critical / Watch / Advisory / Info), bell icon with count, slide-in drawer, toast popups. Filter bar with severity + type toggles (All / Critical / Watch / Advisory / Info / Forecast / Chains / Discovery).

---

## API & Network Architecture

```
fetchRealKp()           → NOAA SWPC 7-day JSON (services.swpc.noaa.gov)
fetchUSGSQuakes()       → USGS FDSNWS direct (earthquake.usgs.gov) — M4.5+, 24h
fetchXRayFlux()         → NOAA GOES X-ray 7-day (services.swpc.noaa.gov)
fetchPressureGrid()     → Open-Meteo live surface pressure grid
fetchSST()              → Open-Meteo Marine API
fetchWind()             → Open-Meteo API
fetchVolcanic()         → Smithsonian GVP
fetchIERSLod()          → Paris Observatory EOP C04 series (hpiers.obspm.fr) — 60-day LOD history, daily refresh
fetchFocalMechanisms()  → USGS event catalog — prefers GCMT product, falls back to USGS-MT; tagged by source
```

**Failure handling:**
1. Any `fetch` failure or non-200 response → `_markApiOffline()`
2. Exponential backoff: 2 min → 4 min → 8 min → 10 min cap
3. `retryApis()` resets all counters and re-fetches all live sources
4. `visibilitychange` event triggers auto-retry after 2 s when tab regains focus
5. Clicking NET badge calls `retryApis()` immediately

---

## UI/UX Design Principles

- **Dark observatory aesthetic**: near-black backgrounds (#020810), cyan/amber/red accent palette, Space Mono for data values
- **Minimal chrome**: data fills available space; panels collapse to reveal full map
- **Progressive disclosure**: accordion sections + expandable cards = high data density without overwhelming scroll
- **Keyboard-first navigation**: `1`–`4` tabs, `D` Deep Analysis, `F` fullscreen, `?` Field Guide, `Escape` exit
- **Contextual help layer**: 53-element tooltip system + Field Guide panel explains every term, scale, and indicator without leaving the dashboard
- **Physics-model fallbacks**: ESO always shows a coherent picture even when APIs are offline
- **Non-intrusive onboarding**: first-visit hint card + persistent `?` Guide button; help is available but never forced on returning users

---

## Development History

| Phase | Features Added |
|-------|---------------|
| Phase 1 | Basic map, static layer toggles |
| Phase 2 | Multi-tab right panel, correlation engine, basic charts |
| Phase 3 / p2_4 | Synthesis tab, seismic markers, Chain-of-Events, Discover sub-tabs, Notifications, Forecast tab, advanced statistical engine (Pearson, FFT, mutual info, phase-space) |
| Phase 4 (p3) | Real NOAA Kp API, USGS direct API, GOES X-ray layer, atmospheric pressure layer, 30-day Timeline tab, Ask ESO floating chat, 30-day forecast calendar |
| Phase 5 (p3, Mar 2026) | UI/UX overhaul: 5-tab panel + keyboard shortcuts 1–4/D/F/Esc, accordion sections, compact Clusters cards (click-to-expand), fullscreen panel mode, drag-resize handle (240–700 px). API fixes: exponential backoff, clickable NET retry badge, `visibilitychange` auto-retry. QA fixes: askRegion routing, duplicate CSS cleanup |
| Phase 6 (p3, Mar 2026) | **UX Accessibility Layer**: 53-element styled tooltip system (`data-tip`), Field Guide sliding panel (`?` button + keyboard shortcut) with 4 tabbed sections (Overview / Layers / Reading / Tips), first-visit hint card, Deep Analysis sub-tab tooltips, status strip metric tooltips. z-index architecture fix (guide at 1050, above header at 1000). |
| Phase 7 (modular, Apr 2026) | **Modular architecture** (`build.py` + separate JS/CSS files). **Three live external data connections**: (1) IERS LOD from Paris Observatory feeding earthquake risk score Factor 4 and forecast calendar, replacing synthetic sinusoid; (2) GCMT focal mechanisms — prefers Global CMT product over USGS-MT, source-tagged and counted in panel; (3) Prospective Bz Logger in Thesis A — auto-detects DSCOVR Bz ≤ −12 nT events sustained ~50 min, logs to localStorage with timestamp/peak Bz/pending hit-miss, builds dataset for pre-registered 2–3 year replication study. |

---

## Known Issues / Technical Notes

- Two `fetchUSGSQuakes` definitions in file (~line 5814 relay version, ~line 7084 direct API version); JS hoisting means second definition wins — correct behavior but should be cleaned up
- Ask ESO uses local expert engine; full Claude API integration is a future roadmap item
- Charts tab uses generated/simulated data for layers without full historical feeds
- Lag Explorer and Spectral analysis use short (8-min) data windows until 30-day historical engine is built

---

## File Locations

```
Earth systems observatory/
├── earth-observatory-modular.html  ← primary app (Phase 7, modular build — current)
├── earth-observatory-p3.html       ← Phase 4–6 single-file (maintained for compatibility)
├── earth-observatory-p2_4.html     ← Phase 3 v2.4 stable baseline (archive)
├── build.py                        ← assembles modular HTML from JS/CSS modules
├── eso-core.js                     ← core utilities, constants, state
├── eso-data.js                     ← all data fetching (USGS, NOAA, IERS, GCMT, etc.)
├── eso-ui.js                       ← UI rendering, tab switching, panel logic
├── eso-stats.js                    ← statistical engine (Pearson, FFT, MI, phase-space)
├── eso-style.css                   ← all styles
├── eso-thesis.js                   ← shared thesis framework
├── thesis-a-solar-seismic.js       ← Thesis A: solar-seismic correlation + Bz logger
├── thesis-b-tidal-seismic.js       ← Thesis B: tidal triggering
├── ESO-project-summary.md          ← this file
├── ESO-research-roadmap.md         ← development roadmap
└── ESO-deep-audit-report.md        ← 10-persona audit findings and priority action list
```
