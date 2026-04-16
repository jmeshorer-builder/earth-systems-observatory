# ESO Research Roadmap — Development & Data Layer Plan
*Last updated: 2026-04-05 · Current version: earth-observatory-modular.html (Phase 7)*

---

## Completed Items ✅

| # | Feature | Status |
|---|---------|--------|
| 1 | Replace synthetic Kp with NOAA SWPC real Kp | ✅ Done — `fetchRealKp()` using `services.swpc.noaa.gov` |
| 2 | Replace Claude relay USGS with direct FDSNWS API | ✅ Done — `fetchUSGSQuakes()` using `earthquake.usgs.gov` directly |
| 3 | GOES X-ray flux layer (solar flares) | ✅ Done — `fetchXRayFlux()`, 7-day history, X/M-class notifications |
| 4 | 30-day forecast calendar | ✅ Done — lunar syzygy + Kp recurrence + LOD compound risk calendar |
| 5 | Atmospheric pressure layer | ✅ Done — Open-Meteo live grid |
| 6 | Ask ESO floating chat | ✅ Done — float panel with region queries, quick region buttons, local expert engine |
| 7 | IERS LOD live feed | ✅ Done — `fetchIERSLod()` hitting Paris Observatory EOP C04; feeds `scoreEarthquake()` Factor 4 + forecast calendar; LOD tile in baseline strip |
| 8 | GCMT focal mechanism preference | ✅ Done — `fetchFocalMechanisms()` prefers GCMT product over USGS-MT; source-tagged; split count in panel |
| 9 | Prospective Bz Logger (Thesis A) | ✅ Done — auto-detects DSCOVR Bz ≤ −12 nT sustained events; logs to localStorage; Prospective Log block in Thesis A panel |
| 10 | Modular file architecture | ✅ Done — `build.py` + separate JS/CSS module files; `earth-observatory-modular.html` is now primary build |

Also completed — Phase 5 (March 2026, UI/UX overhaul):
- **5-tab panel** with keyboard shortcuts 1–4/D, F (fullscreen), Escape
- **Accordion sections** in Now/Data tab (collapsible, smooth transition)
- **Compact Clusters cards** (click-to-expand correlation detail + evidence)
- **Fullscreen panel mode** (F key / button → 100 vw, map hidden)
- **Drag-to-resize panel** (240–700 px, `--panel-w` CSS variable)
- **Exponential API backoff** (2→4→8→10 min cap)
- **Clickable NET badge** → immediate `retryApis()`
- **`visibilitychange` auto-retry** (2 s delay when tab regains focus)
- QA fixes: `askRegion()` routing, duplicate CSS, silent `!resp.ok` in Kp/X-ray fetches

Also completed — Phase 7 (April 2026, modular architecture + live data connections):
- **Modular file architecture**: `build.py` assembles `earth-observatory-modular.html` from separate JS/CSS modules (`eso-core.js`, `eso-data.js`, `eso-ui.js`, `eso-stats.js`, `eso-style.css`, `eso-thesis.js`, `thesis-a-solar-seismic.js`, `thesis-b-tidal-seismic.js`)
- **IERS Length of Day (LOD) connection** (`fetchIERSLod()`): fetches Paris Observatory EOP C04 series, parses 60-day LOD history, computes trend (decelerating/accelerating/stable). Feeds `scoreEarthquake()` Factor 4 and 30-day forecast calendar — replaces synthetic sinusoid when live data is available. LOD tile in baseline strip, color-coded, daily refresh. Falls back to seasonal sinusoid on CORS failure.
- **GCMT focal mechanisms** (`fetchFocalMechanisms()`): now prefers the Global Centroid Moment Tensor product over generic USGS-MT in the event catalog. Each mechanism tagged `source: 'GCMT'` or `'USGS-MT'`; panel shows split count. Health tracked at `ah-gcmt` in API status.
- **Prospective Bz Logger** (`thesis-a-solar-seismic.js`): rolling 18-slot DSCOVR Bz buffer checks every 5 min for Bz ≤ −12 nT sustained across 10+ readings (~50 min). Triggers logged to localStorage with timestamp, peak Bz, and `hit: null` pending manual outcome entry. Displayed in Thesis A panel as **Prospective Log** with trigger count, hit/miss/pending breakdown, and per-event table. Builds dataset for pre-registered 2–3 year replication study automatically.

Also completed — Phase 6 (March 2026, UX accessibility layer):
- **53-element styled tooltip system** (`data-tip` attribute) — covers all 16 layer items, all right panel tabs, all status strip metrics, all Deep Analysis sub-tabs, and key UI controls
- **Field Guide sliding panel** (`?` button in header + `?` keyboard shortcut, z-index 1050)
  - *Overview* tab: ESO concept, 5-step how-to-use walkthrough, panel layout guide
  - *Layers* tab: all 16 data layers explained in plain language with physical context
  - *Reading* tab: Kp scale guide, LIVE/MODEL/CALC badge meanings, correlation cluster interpretation, history period explanations
  - *Tips* tab: keyboard shortcuts, 6 best-practice scenarios, uncertainty and caveats section
- **First-visit hint card**: 3.5 s delayed, floating above status bar, dismisses to localStorage, opens Field Guide directly
- **Deep Analysis sub-tab tooltips**: all 9 sub-tabs (Stress Index, Lag Explorer, Spectral, Phase Space, Mutual Info, Planets, Novel Indices, Chains, Discovery Log) have contextual hover tooltips explaining the analytical method and how to interpret results
- **Status strip metric tooltips**: all 7 metrics (Kp, EQ Risk, Tsunami, Syzygy, Flares, Alerts, NET) explained on hover with scale context

---

## Active Roadmap — Next Priorities

### Priority 1: 30-Day Historical Data Engine
**Status:** Not started — highest transformative value remaining

Everything the app needs is available via free, no-key, CORS-open APIs. Without this, all correlations run on 8 minutes of data — statistically meaningless for the documented lags (27-day, 90-day).

| Data | API | Range |
|------|-----|-------|
| Kp history | `services.swpc.noaa.gov/products/noaa-planetary-k-index.json` | ~50 days |
| Solar flux F10.7 | `services.swpc.noaa.gov/json/solar-cycle/observed-solar-cycle-indices.json` | Years |
| Solar wind (7-day) | `services.swpc.noaa.gov/products/solar-wind/plasma-5-minute.json` | 7 days |
| M4.5+ quake catalog | `earthquake.usgs.gov/fdsnws/event/1/query` with `starttime`/`endtime` | Years |
| SST/pressure archive | `archive-api.open-meteo.com/v1/archive` | 80 years |

**What this unlocks:**
- True anomaly detection (σ above 30-day mean, not 8-minute mean)
- Validated lag analysis: actually measure the 27-day Kp→seismicity lag against real data
- Event-based cluster analysis: "what preceded this M6+?"
- Cycle-aware synthesis: ground the 1-month synthesis in actual retrospective data
- Past Event Audit: did predicted downstream chain effects occur?

---

### Priority 2: Dst Index Layer (Geomagnetic Ring Current)
**Status:** Not started

More sensitive geomagnetic storm indicator than Kp alone. Strong negative Dst (-100 nT or below) indicates major ring current injection with more direct ionospheric pathway than Kp captures.

- API: `services.swpc.noaa.gov/products/kyoto-dst.json` (provisional hourly)
- No key, CORS available
- Supplement Kp in Chain 9 (Earthquake Precursor Window) as a quiet-time sensitive indicator

---

### Priority 3: Proton Flux Layer (Solar Energetic Particles)
**Status:** Not started

Energetic protons (direct solar origin, vs. galactic GCR) penetrate to ~30 km altitude, drive polar ionospheric absorption, and correlate with Schumann resonance shifts. Complements GCR layer for Chain 4.

- API: `services.swpc.noaa.gov/json/goes/primary/integral-proton-fluxes-plot-5-minute.json`
- No key, CORS, 5-minute updates

---

### Priority 4: Event-Based Cluster Analysis
**Status:** Depends on Priority 1 (historical engine)

Research-grade precursor analysis: for each M6+ earthquake in the past 30 days, extract Kp±3 days, TEC, tidal phase, LOD position. Compute conditional correlation ("given M6+, what preceded it?"). This is how real earthquake precursor research is done.

---

### Priority 5: Real Lag Validation in Lag Explorer
**Status:** Depends on Priority 1

Currently the Lag Explorer shows textbook lag values (e.g., Kp→seismicity +27 days). With 30 days of real paired data, it would show *measured* lags from actual data — turning a reference display into an empirical research tool.

---

### Priority 6: Ask ESO — Claude API Integration
**Status:** Architecture ready (local expert engine running); API key optional

The Ask ESO chat currently uses a local pattern-matching expert engine. Full Claude API integration (`setESOApiKey('sk-...')` in console) enables natural language responses. Future: in-app API key entry UI, streaming responses.

---

### Priority 7: Duplicate `fetchUSGSQuakes` Cleanup
**Status:** Minor technical debt

Two definitions exist in the file (~line 5814 relay version, ~line 7084 direct API version). JS hoisting means second definition wins — behavior is correct — but the first definition should be removed to avoid confusion.

---

## Layers Considered & Deferred

| Layer | Reason deferred |
|-------|----------------|
| CO₂/CH₄ concentration | Changes on decadal timescales; no value for short-term forecasting |
| Ocean currents | Correlation with primary phenomena (seismic, geomagnetic) is weak and slow |
| Tectonic plate velocity | Near-static; already captured by fault zone hardcoding |
| Ice extent | Relevant for long-term climate, not short-term cross-domain correlations |
| Lightning density | Too localized and weather-driven to add to global patterns meaningfully |

---

## Synthesis & Cluster Improvements (Post–Historical Engine)

Once 30-day historical data is available:

1. **Replace 8-minute correlation window with 30-day daily summaries** — makes Pearson engine statistically meaningful for documented lags
2. **Add conditional/lagged correlations** — "Kp today vs. seismicity +27 days" (same math, needs paired history)
3. **Correlation direction arrows** in matrix — `→` for "A leads B" based on KNOWN_LAGS registry
4. **Ground the 1-month Synthesis view** in actual 30-day retrospective instead of today's-state projections
5. **Past Event Audit section** — for each triggered chain: did predicted downstream effects occur?
6. **Statistical significance scoring** — χ² or Fisher exact test to distinguish real correlations from noise

---

## MD File Maintenance Protocol

These files (`ESO-project-summary.md` and `ESO-research-roadmap.md`) are updated at the **end of each approved ESO working session** — after the user confirms the work is complete and not a draft. Claude should include MD file updates as a final task in every ESO session todo list.
