# ESO Version History

| Version | Date       | Status      | Key Changes                                                  |
|---------|------------|-------------|--------------------------------------------------------------|
| v3.0    | 2026-04-13 | Released    | Modular architecture, Thesis A concluded, Thesis B concluded, 3 live external connections, minified build |
| v4.0    | 2026-04-14 | Released    | Phase 4 start: cachedFetch + retryFetch (in-memory dedup + timeout), data versioning (ESO_DATA_VERSION), API health upgrade (response times + cache hit rates + 5 new endpoint slots), CSS utility classes extracted (.eso-pill-btn, .eso-header-btn, .eso-dim-label, .eso-panel-desc), localStorage TTL prep for ENSO/Copernicus/CRW |
| v4.1    | 2026-04-14 | Released    | NASA GIBS satellite base layer (MODIS Terra True Color, daily), NASA GHRSST MUR SST tile overlay (science-grade, 1km), map layer controls (🗺/🛰 toggle + SST toggle), NASA attribution, light-mode fix for satellite mode |
| v4.2    | 2026-04-14 | Released    | IRI/CPC ENSO official forecast (fetchIRICPCEnso, auto-boot 2s delay, 24h cache), NOAA ONI historical series, renderENSOStatus (live strip + source badge), El Niño 2026 Risk Card in Risk tab (probability gauge + phase + consensus), physics fallback from SST grid |
| v4.3    | 2026-04-14 | Released    | Copernicus Marine + Coral Reef Watch (DHW, coral bleaching risk scoring) |
| v4.4    | 2026-04-15 | Released    | eso-elnino.js scaffold (10-file build); NASA FIRMS fire layer (MODIS C6.1 24h NRT, 2° cluster grid, FRP color ramp, fallback synthetic); ENSO toggleable layer + data card (ONI trend, risk score 0–100, phase color); 5th domain 🔥 Fire; 17 layers total; corrClusters cn-elnino-fire + cn-fire-sst; getElNinoRiskScore() + getElNinoPhase() exposed for v4.6+ thesis work |
| v4.5    | 2026-04-15 | Released    | Right Panel Redesign + Deep Analysis Consolidation: Deep Analysis 12→5 tabs (Stress · Lag · Spectral+Wavelet · Chaos/Phase+MI · Cause/Chains+Planets+Indices+Log+Hindcast+Hyp+Thesis); legacy tab aliases preserved; universal .da-context-header (Kp · EQ · ENSO · Fire + breadcrumb); _updateDaContextHeader() auto-populated on open; "→ Deep Analysis" CTAs in all 4 right-panel tabs (context-linked); .da-cause-section accordion layout; .da-section-head subheads in Spectral+Chaos panels; .rpanel-deep-cta CSS; bottom bar → v4.5 |
| v4.6    | 2026-04-15 | Released    | Thesis C — El Niño Marine Heatwave Cascade: THESIS_C_CHAIN (5 links: ENSO→SST→MHW→Coral→Fishery), getCompoundRisk() (weighted fusion: ENSO 30%·DHW 25%·coral 20%·solar 15%·seismic 10%), evaluateThesisCChain(), renderThesisCCascade(), evidence accumulator (6h log), ThesisFramework.register(thesis-c-marine-heatwave), falsification criteria |
| v4.7    | 2026-04-15 | Released    | Thesis D — ENSO-Wildfire-Carbon Chain: THESIS_D_CHAIN (4 links: ENSO→Precip deficit→Fire weather→Carbon pulse), getFIRMSRegionalCounts() (SE Asia·Australia·Amazon), evaluateThesisDChain(), renderThesisDCascade(), ThesisFramework.register(thesis-d-wildfire-carbon); dual-thesis toggle (🌊 Marine / 🔥 Wildfire) in Risk tab elnino-thesis-card; switchElNinoThesis(); renderElNinoCascadeCard() auto-updates on Risk tab open + forecast refresh; compound risk gauge |
| v4.8    | 2026-04-15 | Released    | Compound Risk Fusion + Ask ESO El Niño Intelligence: ENSO coupling Factor 6 in scoreEarthquake() (0–8 pts, LOD/pressure mechanism), ENSO boost in computeForecastCalendar() with cell tooltip annotation, El Niño mode in answerESOQuestion() (regex trigger: el niño/enso/marine heatwave/wildfire/coral/firms), ENSO cross-domain block in buildESOContext(), ENSO section auto-added to generateSitrep() when phase ≠ Neutral |
| v4.9.2  | 2026-04-15 | Current     | Deep Analysis button press feedback: _esoFlashBtn() + _esoFlash() + _flashSelect() utilities; SCAN button shows "↻ SCANNING…" pulse then flash; disc-tab/da-close/rpanel-deep-cta :active states; select border flash on change; @keyframes eso-btn-pulse + eso-btn-flash-anim |
| v4.9.1  | 2026-04-15 | Released    | Deep Analysis QA fixes: seedSeriesHistory() pre-fills ring buffer on layer activation + DA open (charts work immediately, no wait); canvas width fallback to parentElement.offsetWidth (bars no longer empty when panel just opened); switchDiscTab renders after 60ms delay (CSS transition); wavelet colormap rewritten (navy→teal→yellow, rescaled to actual max coherence — no more all-blue); FFT min points 8→6 + session-data annotation; wavelet renderer no longer rewrites container innerHTML (targets existing wco-canvas) |
| v4.9    | 2026-04-15 | Released    | Polish + Backfill + v4.0 Release: backfill-elnino.py (NOAA ONI fetch, validate mode, 1950–present); elnino-backfill.json (900 proxy records, 8 known events); loadElNinoBackfill() + validateThesisCDWeights() + runElNinoValidation() in eso-elnino.js; auto-load on page ready (3s delay); releases/v4.0/ snapshot + RELEASE-NOTES.md; version banner → v4.9; footer → v4.9 |

---

## How versioning works

- **Releases** are stored in `releases/vX.Y/` as static HTML snapshots (full + minified).
- **Source** lives in `src/` — always edit here, then run `python3 src/build.py` to regenerate the root `earth-observatory-p3.html`.
- **Version bumping:** When starting a new version, copy the previous `releases/vX.Y/` folder and increment. Add a row to this table when the version is released.

## Version numbering convention

| Change type        | Bump |
|--------------------|------|
| Major redesign / new thesis | v**X+1**.0 |
| New feature / significant UI change | vX.**Y+1** |
| Bug fix / minor tweak | Use git commits only — no new release folder |

## Next planned version

---

## Next planned version

| v4.3    | 2026-04-15 | Current     | Copernicus Marine SST+DHW (7 sampling points, model fallback from SST grid), NOAA Coral Reef Watch alerts, scoreCoralBleachingRisk(), DHW baseline strip metric, Coral Bleaching Risk Card in Risk tab, _computeDHW per region using NOAA CRW methodology. API Review ✓ passed (19/19 real checks). |

---

## Next planned version

- **v4.4** — NASA FIRMS fire layer + eso-elnino.js scaffold (10-file build)
