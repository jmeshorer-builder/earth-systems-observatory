# ESO Deep Audit Report — 10-Persona Simulation
*Generated: 2026-03-29 · Auditing: earth-observatory-p3.html (Phase 6)*
*Status updated: 2026-04-05 — items marked ✅ DONE have been implemented in Phase 7 (earth-observatory-modular.html)*

---

## Methodology

Ten simulated personas — each with distinct expertise, backgrounds, and usage patterns — were given the Earth Systems Observatory dashboard for one week of daily use. Each persona approached ESO cold (no prior training) and used it within their professional or personal context. Their feedback is recorded below, followed by a unified prioritized action list.

---

## Persona 1: Dr. Elena Vasquez — Seismologist (USGS Research Geophysicist)

**Background:** 18 years in earthquake hazard assessment. Comfortable with real-time seismic monitoring tools (USGS ShakeMap, EONET). Data-driven, skeptical of non-peer-reviewed correlations.

### What Works
- **USGS live feed integration is solid.** The M4.5+ FDSNWS direct connection is exactly the right source. Markers with magnitude/depth/place tooltips are useful for quick triage.
- **Status strip** gives instant situational awareness — I can glance at EQ RISK and ALERTS without opening any panel.
- **Depth color-coding** on quake markers (red/orange/blue) is a smart visual shortcut for shallow vs. deep events.

### What's Wrong / Should Be Fixed
- **No magnitude filtering slider.** I want to filter M5+, M6+, or M7+ without seeing all the M4.5 noise. A range slider or min-magnitude dropdown would save significant time.
- **24-hour window is too short for seismic pattern analysis.** Give me 7-day and 30-day options. Seismic swarms and aftershock sequences play out over days to weeks.
- **EQ RISK score is a black box.** The composite score blends Kp, solar wind, tidal force, and recent seismicity — but I cannot see the individual weights or the formula. For any professional seismologist, a risk score without a transparent methodology is unusable. Add a "show calculation" expandable section.
- **Chain 9 (Earthquake Precursor Window) conflates correlation with causation.** The LAIC hypothesis (lithosphere-atmosphere-ionosphere coupling) is real research, but the presentation in the Chains tab makes it look like an operational forecast tool. Needs stronger caveats — at minimum a confidence label like "RESEARCH ONLY — NOT AN OPERATIONAL FORECAST."
- **No focal mechanism (beachball) display.** For anyone doing seismic analysis, the focal mechanism tells you whether it's thrust/normal/strike-slip. USGS provides this in the event detail JSON.
- **Aftershock sequence identification is missing.** The dashboard shows individual quakes as independent events. Aftershock clustering detection (by spatiotemporal proximity) would be valuable.

### Missing Data/Features
- **USGS ShakeAlert integration** for the West Coast (real-time early warning).
- **Historical seismicity heatmap** — show where M4.5+ events have concentrated over the past year as a density overlay.
- **Gutenberg-Richter b-value** for the displayed quake set would indicate whether the current seismicity pattern is normal or anomalous.

---

## Persona 2: Prof. Anil Chakraborty — Space Weather Physicist (Indian Institute of Geomagnetism)

**Background:** Solar-terrestrial physics researcher. Expert in Kp, Dst, solar wind coupling. Publishes on geomagnetic storm impacts on power grids and satellite operations.

### What Works
- **Real NOAA Kp is the right data source.** 7-day history is good for context. The Kp scale tooltip with 0–9 breakdown is well done.
- **X-ray flux / flare classification** correctly uses GOES satellite data with proper B/C/M/X classification.
- **The correlation cluster "Kp ↔ Solar Wind Pressure"** is scientifically accurate and well-documented with the evidence text.
- **Field Guide explanation of Kp** is accessible without oversimplifying.

### What's Wrong / Should Be Fixed
- **Missing Dst index — the single most important gap.** Kp is a 3-hour index — it's coarse. Dst is hourly and far more sensitive to ring current injection during storms. During the 2024 May superstorm, Dst hit -412 nT while Kp saturated at 9. You cannot do serious space weather analysis without Dst. The API is free from NOAA SWPC (`kyoto-dst.json`).
- **No solar wind speed or density — only "pressure" (model-derived).** The real DSCOVR/ACE solar wind data is available from SWPC (`plasma-5-minute.json`). Pressure = ½ × ρ × v², but you need speed AND density separately because CME-driven storms (high density) have different signatures than high-speed stream storms (high velocity).
- **Proton flux is missing.** Solar energetic particle events (SPEs) are a distinct hazard from X-ray flares. They affect satellite electronics and polar aviation. The GOES proton flux feed is free.
- **The solar irradiance layer says "CALC" but the calculation is simplistic** — it uses a smooth 11-year sinusoid for solar cycle position. Real F10.7 flux data is available from SWPC and would be far more useful.
- **The Spectral Analysis (FFT) tab is running on ~8 minutes of data.** You cannot extract a 27-day solar rotation period from 8 minutes of samples. This is mathematically meaningless — it's displaying FFT artifacts, not real cycles. Either clearly label this as "demonstration mode" or disable it until the historical engine is built.

### Missing Data/Features
- **Real-time Dst index** (SWPC Kyoto provisional).
- **Real DSCOVR solar wind** (speed, density, Bz).
- **Proton flux** from GOES (5-minute integral flux).
- **Auroral oval visualization** — the Ovation Prime model from NOAA gives real-time auroral probability maps.
- **CME arrival time indicator** — NOAA publishes WSA-Enlil model runs showing when a coronal mass ejection will reach Earth.

---

## Persona 3: Maya Torres — UX Designer (Previously: Apple Weather, Dark Sky)

**Background:** 10 years designing data-dense consumer and prosumer interfaces. Expert in information hierarchy, progressive disclosure, responsive design, and accessibility standards (WCAG).

### What Works
- **Dark observatory aesthetic is gorgeous.** The color palette (cyan/amber/red on near-black) is distinctive and appropriate for the subject matter. It feels like a mission control interface.
- **Progressive disclosure is well-implemented.** Accordion sections in the Now tab, click-to-expand cluster cards, the bottom dock — these all manage information density without overwhelming.
- **Field Guide is a smart onboarding solution.** It's discoverable (? button, keyboard shortcut), comprehensive, and non-intrusive.
- **Tooltips are well-written** — they actually explain things rather than just repeating the label.

### What's Wrong / Should Be Fixed
- **The dashboard is not responsive.** At any window width below ~1200px, the layers panel overlaps the map and the right panel text wraps awkwardly. On a laptop (1366×768), the bottom dock is effectively invisible. Mobile is completely broken. Even if this is a "desktop research tool," many researchers use laptops.
- **No dark mode/light mode toggle.** The dark theme is beautiful, but projecting this in a well-lit conference room or printing it for a report requires a light mode.
- **Touch targets are too small.** Layer items, tab buttons, accordion headers, and dock toggles are all below the 44×44px minimum recommended by WCAG. On a 13" laptop trackpad, misclicks are constant.
- **Color alone conveys meaning.** The Kp scale, risk levels, quake depth — all depend solely on color. Color-blind users (8% of males) lose critical information. Add shape indicators, text labels, or patterns.
- **No loading state / skeleton screens.** When data is fetching, you see "—" and "loading…" which feels broken. A pulsing skeleton or progress bar would communicate "data is coming."
- **The right panel's scroll position resets when switching tabs.** If I'm halfway through reading the Explore tab, switch to Now, and come back, I'm at the top again. Preserve scroll position per tab.
- **Panel resize handle is invisible.** I didn't discover drag-to-resize for 3 days. The handle needs a visible grip indicator (dots or lines) on hover.
- **Status strip text at 8–9px is below readability threshold** for many users. Minimum 11px for critical data displays.

### Missing Features
- **Responsive breakpoints** (at minimum: 1024px laptop, 768px tablet).
- **Keyboard navigation is incomplete** — can't tab through layers, can't navigate within panels with arrow keys.
- **Screen reader support is absent** — no ARIA labels, no role attributes, no live regions for dynamic updates.
- **Print / export mode** for sharing observations.

---

## Persona 4: Dr. James Okafor — Climate Scientist (NOAA Climate Prediction Center)

**Background:** Atmosphere-ocean interactions, ENSO forecasting, SST anomaly monitoring. Uses operational tools daily (CPC monitoring products, NCEP models).

### What Works
- **Multi-domain integration is the killer feature.** I can see SST, atmospheric pressure, wind, solar forcing, and seismicity on the same map at the same time. No other tool I use does this.
- **Open-Meteo integration for pressure and wind** gives decent real-time synoptic data without requiring WMO access.
- **The 30-day forecast calendar** combining lunar, Kp, and LOD is a creative synthesis approach.

### What's Wrong / Should Be Fixed
- **SST is shown as absolute temperature, not anomaly.** Every climate scientist works with anomalies (departure from 30-year mean). Absolute SST of 28°C means nothing without knowing if it's 2°C above normal for that location and season. This is a fundamental issue.
- **Pressure grid is too coarse (25 points globally).** A 25-point grid cannot resolve synoptic-scale features like low-pressure systems or fronts. The Open-Meteo API supports much finer grids — 0.25° resolution is freely available. Even 2.5° would give ~10,000 grid points.
- **No ENSO indicator.** The El Niño-Southern Oscillation is the dominant mode of interannual climate variability. The Niño3.4 SST index is trivially computable from the existing SST data — average SSTs in the 5°S–5°N, 170°W–120°W box and compare to climatology.
- **Wind layer shows speed only, not direction.** Wind barbs or arrows would make the atmospheric circulation visible. Speed without direction is half the picture.
- **No precipitation or humidity layer.** Atmospheric moisture is critical for understanding where energy is stored in the atmosphere. ERA5 reanalysis data is available through Open-Meteo archive.
- **The "1 Month" time period in the System State section is misleading** — it appears to project forward based on current physics, not show actual historical data. Label it "1-Month Projection (Model)" to avoid confusion.

### Missing Data/Features
- **SST anomaly mode** (toggle between absolute and anomaly).
- **ENSO phase indicator** (computed from SST grid in Niño3.4 region).
- **Precipitation / precipitable water layer**.
- **Atmospheric river detection** — composite of wind + moisture would identify these features.
- **MJO phase diagram** — the Madden-Julian Oscillation is the primary mode of intraseasonal tropical variability.

---

## Persona 5: Lt. Col. Sarah Kim (ret.) — Emergency Management Specialist

**Background:** 15 years in FEMA emergency operations. Now consults on natural hazard preparedness for municipalities. Needs clear, actionable risk communication.

### What Works
- **The Risk tab gives a clear bottom line.** EQ Risk, Tsunami Risk, and the forecast calendar with color coding (red/orange/yellow/clear) are immediately understandable.
- **Chain of Events** concept is excellent for understanding cascading hazards — exactly how emergency managers think. "Earthquake → landslide → dam failure → flooding" is how we brief commanders.
- **Notification system with severity levels** (Critical/Watch/Advisory/Info) maps perfectly to the National Weather Service alerting scheme we already use.
- **Status strip is like a dashboard gauge cluster** — quick scan tells me if anything needs attention.

### What's Wrong / Should Be Fixed
- **No geographic filtering.** I'm responsible for the Pacific Northwest. I don't care about earthquakes in Indonesia right now. Let me set a region of interest and filter everything to that area.
- **Tsunami risk score doesn't account for coastal proximity.** An M7.0 in the Himalayas at 200km depth is not a tsunami risk. An M6.5 at 10km depth off the Aleutians is. The score needs to factor in oceanic/coastal location, focal depth < 70km, and distance from coast.
- **No population exposure overlay.** A volcanic eruption in Kamchatka and one near Naples have vastly different risk implications. Population density context is essential for emergency management.
- **Alert fatigue is a concern.** After running ESO for a full week, the notification drawer accumulated 200+ items. I need a "Daily Summary" mode that aggregates alerts into a single briefing rather than individual toasts.
- **No export or share function.** I want to grab the current risk assessment and paste it into a situation report (SITREP). PDF export of current state or a "copy to clipboard" summary would be huge.
- **Chains tab mixes established science with contested hypotheses** without clear visual distinction. An emergency manager could brief a city council using Chain 9 or 10 thinking it's established science. The "Contested" label needs to be more prominent — red border, explicit "NOT FOR OPERATIONAL USE" warning.

### Missing Features
- **Region of interest** with persistent filtering.
- **SITREP export** — one-page PDF of current conditions and active alerts.
- **Population exposure layer** (NASA GPW or WorldPop gridded population).
- **Notification aggregation / daily digest mode.**
- **Integration with NOAA tsunami warning center** (tsunami.gov) for official warnings vs. ESO's computed risk.

---

## Persona 6: Dr. Kenji Murakami — Ionospheric Physicist (JAXA)

**Background:** Researches ionospheric anomalies and their potential as earthquake precursors. Expert in TEC measurements, LAIC theory. Published on pre-seismic TEC enhancements.

### What Works
- **TEC layer exists** — most dashboards ignore the ionosphere entirely. The LAIC connection to seismicity is explicitly included in the correlation clusters, which shows the developers understand the research landscape.
- **Chain 9 (Earthquake Precursor Window) correctly identifies the TEC enhancement → seismic correlation.** The mechanism described (piezoelectric stress → radon emission → air ionization → TEC anomaly) matches current published literature.
- **Cross-layer visualization** — the ability to overlay TEC + seismic + Kp simultaneously is exactly what LAIC researchers need.
- **Mutual Information tab** is the right tool for LAIC analysis since the TEC-seismic relationship is nonlinear.

### What's Wrong / Should Be Fixed
- **TEC is labeled "MODEL" but the model is too simplistic.** Real TEC data is available from NASA/JPL IGS (International GNSS Service) as daily global TEC maps. The physics model used here appears to be a smooth diurnal/seasonal cycle without real spatial structure. This limits the LAIC analysis to theoretical illustration rather than actual detection.
- **No TEC anomaly detection algorithm.** In LAIC research, the signal is the *anomaly* — deviation from the 27-day running median at each location. Simply showing absolute TEC is not useful. I need: (1) compute 27-day median TEC for each grid cell, (2) compute current deviation, (3) flag cells exceeding ±2σ.
- **Lag Explorer cannot test the documented 1–5 day TEC→EQ precursor window** because it has only 8 minutes of data. This is the single most important analysis for LAIC research and it's currently non-functional.
- **No GPS station locations shown.** If we're claiming TEC data (even modeled), showing where the underlying GNSS stations are would help researchers assess spatial reliability.

### Missing Data/Features
- **Real IGS TEC maps** (NASA/JPL CDDIS, 1-day latency, freely available).
- **TEC anomaly detection** (27-day running median deviation).
- **VLF/ELF anomaly layer** — subionospheric VLF signal perturbations are another documented precursor signal.
- **Radon monitoring integration** — ground-based radon measurements at seismic stations are increasingly available and are a direct LAIC pathway indicator.

---

## Persona 7: Marco Silva — Data Journalist (Reuters Climate Desk)

**Background:** Visual storytelling, data visualization, public-facing science communication. Uses Flourish, D3.js, Datawrapper daily. Evaluates tools for their ability to tell stories to a general audience.

### What Works
- **The visual design is publication-quality.** The dark aesthetic with color-coded layers looks professional enough to screenshot for an article. The map overlays are clean and non-cluttered.
- **Field Guide would work well as reader context** — if I embedded ESO in an article, readers could use the Guide to understand what they're seeing.
- **Tooltip system is excellent for exploration.** I hovered everything in my first session and felt like I understood the tool within 30 minutes.
- **The "one-line" descriptions** in the layer panel are well-written for general audiences.

### What's Wrong / Should Be Fixed
- **No shareable state / URL.** I can't bookmark a specific view (layers on, region zoomed, tab active) and send it to my editor or embed it in an article. This is the #1 barrier to using ESO in journalism.
- **No screenshot or image export.** Right-clicking the map gives me the tile layer, not the data overlays. A "capture current view" button that renders the map + layers + overlays to a PNG would be incredibly useful.
- **Data source citations are inconsistent.** Some layers say "NOAA SWPC model" (what model?), others say "NASA POWER model." A journalist needs exact source URLs to fact-check. Each layer should link to its API endpoint documentation.
- **No date/time stamp on the map view.** When I take a screenshot, there's no timestamp visible in the viewport — only in the header clock. If this appears in an article, readers won't know when it was captured.
- **Historical Charts tab uses simulated data** but doesn't clearly say so. If I published a chart from the History tab thinking it was real data, that's a journalistic error. Label simulated data prominently: "SIMULATED — NOT HISTORICAL MEASUREMENTS."
- **Units are inconsistent.** Some values show units (Hz, %, hPa), others don't. The Kp index has no unit (correct — it's dimensionless), but this isn't explained anywhere outside the Field Guide.

### Missing Features
- **Shareable URL state** (encode layers, zoom, tab, time in URL hash).
- **Map view export to PNG/SVG.**
- **Embed mode** (iframe-friendly, no header/panels, just map + overlays + legend).
- **Data provenance panel** — for each active layer, show: source name, API URL, last fetch time, update frequency, license.

---

## Persona 8: Priya Mehta — Graduate Student (Computational Geophysics, MIT)

**Background:** 2nd year PhD, building ML models for earthquake forecasting. Comfortable with Python/R, expects data accessibility and reproducibility. Wants to validate ESO's statistical claims.

### What Works
- **The statistical engine is impressively comprehensive** for a browser app — Pearson, cross-lag, FFT, phase-space, mutual information. These are the right methods.
- **Correlation clusters with evidence citations** give me papers to look up and verify the claims.
- **Novel Indices tab** shows creative thinking about composite indicators — the Compound Seismic Trigger Index concept is interesting.
- **Ask ESO** responding to "what preceded this M6+?" is exactly the research question I'm working on.

### What's Wrong / Should Be Fixed
- **No data export.** I cannot download any of the data ESO fetches or computes. No CSV export, no JSON dump, no API endpoint. For a research tool, this is a dealbreaker. I need to take ESO's data into my Python pipeline.
- **Statistical results show no confidence intervals or p-values.** The Pearson correlations in the matrix have no significance testing. With 8 minutes of data (effectively ~4–8 samples at the shortest update interval), any correlation is statistically meaningless. At minimum show n (sample size) and p-value next to each r value.
- **The Mutual Information matrix doesn't show the permutation test null distribution.** Without knowing the null MI value (what you'd get from random shuffled data), I can't judge whether the computed MI is meaningful.
- **Discovery Log flags "unusual co-occurrences" but doesn't specify the detection criteria.** What threshold defines "unusual"? What's the baseline comparison? How many simultaneous tests are being run (multiple comparison problem)?
- **No version control or reproducibility log.** If I see an interesting pattern, I want to know: exact timestamp, which APIs returned data, what values were used in the calculation. A "session log" that captures raw inputs and outputs would enable reproducibility.

### Missing Features
- **Data export** (CSV/JSON for all layers and computed metrics).
- **Statistical significance display** (p-values, confidence intervals, effect sizes).
- **Raw data inspector** — click any computed value and see the raw inputs that produced it.
- **Session recording / playback** — capture a time-lapse of Earth system evolution for later analysis.
- **Python/R integration** — even a simple JSON API endpoint that serves the current state would let me consume ESO data programmatically.

---

## Persona 9: Robert Chen — Retired High School Science Teacher

**Background:** 35 years teaching Earth science and physics. Now volunteers at a science museum. Evaluates educational tools for public engagement. Less technical, prioritizes clarity and wonder.

### What Works
- **This is the most visually impressive Earth science tool I've ever seen.** The dark map with glowing data layers is immediately captivating. Students would be drawn in by the aesthetics alone.
- **The Field Guide is excellent.** It explains everything in plain language. I read through all 4 tabs on my first day and felt equipped to explore.
- **Keyboard shortcuts** (1–4, D, F, ?) are simple to remember and give the feel of a "command center" that students would love.
- **Chain of Events storytelling** is brilliant pedagogy. "Solar flare → magnetosphere compression → geomagnetic storm → aurora + GPS disruption" — this is exactly how I'd teach systems thinking.

### What's Wrong / Should Be Fixed
- **The initial state is overwhelming.** First load: dark map with nothing visible, empty right panel showing "—" everywhere, MODELS badge glowing. A new user doesn't know what to click first. The first-visit hint appears but says "click ? for the Guide" — that's asking me to read documentation before I can use the tool. Instead: **auto-enable 3–4 default layers on first visit** (seismic, Kp, SST, wind) so the map comes alive immediately.
- **Terminology is intimidating.** "Syzygy," "TEC," "FDSNWS," "Z-score," "phase-space attractor" — these will drive away anyone without a physics degree. The tooltips help, but the primary labels should use plain language with technical terms in parentheses. Example: "Moon Alignment (Syzygy)" instead of just "SYZYGY."
- **The Explore tab's correlation cards** use phrases like "Pearson r = 0.73" without ever explaining what Pearson correlation means in the main interface. The Field Guide explains it, but in-context help would be better.
- **Deep Analysis is exciting but incomprehensible to a general audience.** The Spectral tab shows a frequency plot with no explanation of what the peaks mean. Add an auto-generated plain-language interpretation: "This data shows a strong 14-day cycle, matching the lunar tidal period."
- **No guided tours or walkthroughs.** A "Take a tour" button that walks through 5 screens (map → layers → risk → explore → analyze) with highlighted elements and explanations would dramatically improve onboarding.

### Missing Features
- **Guided tour / walkthrough mode.**
- **Default layers on first visit** to make the map immediately interesting.
- **Plain-language auto-interpretations** of statistical results.
- **"What am I looking at?" button** for each chart/visualization that gives a 2-sentence explanation.
- **Educational scenarios** — "What happens during a solar storm?" that auto-activates relevant layers and walks through the chain.

---

## Persona 10: Dr. Fatima Al-Rashid — Geophysical Data Engineer (Shell Exploration)

**Background:** Builds data pipelines for seismic monitoring and well operations. Expert in API architecture, data quality, system reliability. Evaluates tools for production readiness.

### What Works
- **The exponential backoff system is well-designed.** 2→4→8→10 min cap with clickable retry is a proper resilience pattern. The `visibilitychange` auto-retry is a nice touch for browser-based apps.
- **Direct API calls** (no relay server) is the right architecture for a client-side app — eliminates a single point of failure.
- **Physics model fallbacks** ensure the dashboard is always usable, even offline. Good graceful degradation.
- **LIVE/MODEL/CALC badges** clearly communicate data provenance at a glance.

### What's Wrong / Should Be Fixed
- **8,700+ lines in a single file is unmaintainable.** HTML, CSS, and JS all in one file means any change risks breaking unrelated functionality. Even if a build step is undesirable, splitting into `eso.css`, `eso.js`, and `index.html` with inline script tags would help. At minimum, split the JS into logical modules: `eso-layers.js`, `eso-analysis.js`, `eso-fetch.js`, `eso-ui.js`.
- **Two `fetchUSGSQuakes` function definitions** is not just tech debt — it's a correctness risk. If the file is ever reordered or minified, which definition wins may change. Remove the dead code.
- **No error telemetry.** When an API fails, the user sees the MODELS badge, but there's no way to know *which* API failed, *when*, or *why*. Add a collapsible "API Status" panel showing: each endpoint, last fetch time, last HTTP status, latency, next retry time.
- **No data caching.** Every page load re-fetches all live APIs from scratch. Use localStorage or IndexedDB to cache the last successful response with a TTL. This reduces API load and gives the user instant data on page load while fresh data fetches in the background.
- **No automated tests.** For a tool making scientific claims (risk scores, correlations), there should be unit tests for the scoring functions (`scoreEarthquake`, `scoreTsunami`, `scoreSuperstorm`), the statistical functions (Pearson, FFT, mutual info), and the chain-of-events logic.
- **CORS dependency is fragile.** The app depends on 4+ external APIs all supporting CORS. If any of them change their CORS policy (Open-Meteo has done this before), the entire data pipeline for that layer breaks silently. A service worker proxy would provide a safety net.
- **No CSP (Content Security Policy) headers.** The app loads external fonts (Bunny CDN), tiles (CartoDB), and fetches from multiple APIs. A proper CSP header would prevent XSS attacks if the app is ever served from a real domain.

### Missing Features
- **API status dashboard** (per-endpoint health monitoring).
- **Local data caching with TTL** (IndexedDB).
- **Modular file structure** (separate CSS/JS or at least logical JS modules).
- **Unit test suite** for scoring and statistical functions.
- **Service worker** for offline capability and CORS fallback.

---
---

# Compiled Prioritized Action List

Based on the consensus of all 10 personas, here is every recommended improvement organized by priority tier. Priority is determined by: how many personas flagged it, severity of the impact (scientific accuracy > usability > polish), and implementation complexity (quick wins elevated).

---

## TIER 1 — Critical (Scientific Integrity & Core Functionality)
*These issues affect the accuracy or trustworthiness of ESO's scientific outputs. Must be addressed first.*

| # | Action | Objective | Flagged By |
|---|--------|-----------|------------|
| 1.1 | **Build 30-day historical data engine** | Enable statistically meaningful correlations, anomaly detection, lag validation, and event-based analysis. Without this, all statistical outputs (Pearson, FFT, Lag Explorer, MI) are running on ~8 min of data — mathematically meaningless for the documented lags. | Personas 2, 6, 8 |
| 1.2 | **Add Dst index (ring current)** | Hourly Dst from SWPC is more sensitive than 3-hourly Kp for storm detection. Essential for space weather analysis. Free API available. | Persona 2 |
| 1.3 | **Add statistical significance indicators** | Show sample size (n), p-values, confidence intervals on all correlation metrics. Without these, ESO's statistical claims are scientifically unverifiable. | Persona 8 |
| 1.4 | **Replace simulated chart data with real history** | History tab currently uses generated data. Must clearly label simulated data as "SIMULATED" or replace with real historical feeds once the historical engine exists. | Personas 7, 8 |
| 1.5 | **Strengthen "contested research" warnings** | Chain 9–11 and LAIC-related clusters need prominent "RESEARCH HYPOTHESIS — NOT OPERATIONAL FORECAST" labels. Red borders, explicit disclaimers. Prevent misuse by emergency managers or journalists. | Personas 1, 5 |
| 1.6 | **SST anomaly mode** | Show SST departure from climatological mean, not just absolute temperature. Climate scientists work exclusively with anomalies. | Persona 4 |

---

## TIER 2 — High (Major Usability & Missing Data Layers)
*These are the most impactful improvements for daily usability and scientific completeness.*

| # | Action | Objective | Flagged By |
|---|--------|-----------|------------|
| 2.1 | **Add data export (CSV/JSON)** | Allow researchers to download fetched and computed data for use in external tools. Essential for reproducibility. | Persona 8 |
| 2.2 | **Add geographic region filter** | Let users define and save a region of interest; filter all data, alerts, and analysis to that region. | Personas 1, 5 |
| 2.3 | **Add real DSCOVR solar wind data** (speed, density, Bz) | Replace model-derived solar wind pressure with real measurements. Separate speed and density for storm-type discrimination. | Persona 2 |
| 2.4 | **Add proton flux layer** (GOES integral proton flux) | Distinct solar hazard from X-ray flares. Affects satellite operations and polar aviation. Free API. | Persona 2 |
| 2.5 | **Add magnitude filter for earthquakes** | Slider or dropdown to filter displayed quakes by minimum magnitude (M5+, M6+, M7+). | Persona 1 |
| 2.6 | **Extend earthquake time window** to 7-day and 30-day options | 24-hour window misses swarm/aftershock patterns. | Persona 1 |
| 2.7 | **Auto-enable default layers on first visit** | New users see an empty map. Automatically activate seismic + Kp + SST + wind on first load to make ESO immediately engaging. | Persona 9 |
| 2.8 | **Add API status panel** | Show per-endpoint health: last fetch, HTTP status, latency, next retry. Replace the opaque NET badge with transparent diagnostics. | Persona 10 |
| 2.9 | **Improve pressure grid resolution** | Increase from 25 global points to at least 2.5° grid (~10k points) using the same Open-Meteo API. Current resolution cannot resolve synoptic features. | Persona 4 |
| 2.10 | **Add notification aggregation / daily digest** | After a week of use, the notification drawer is unmanageable. Add a summary mode that groups alerts by type and time period. | Persona 5 |

---

## TIER 3 — Medium (UX Polish & Accessibility)
*These improve the experience for a broader user base and make ESO more professional.*

| # | Action | Objective | Flagged By |
|---|--------|-----------|------------|
| 3.1 | **Add responsive breakpoints** | Support 1024px (laptop) and 768px (tablet). Layers panel and right panel should collapse/stack at narrow widths. | Persona 3 |
| 3.2 | **Add color-blind safe indicators** | Supplement color-only information (Kp scale, risk levels, depth coding) with shapes, patterns, or text labels. | Persona 3 |
| 3.3 | **Increase minimum font size to 11px** | Status strip and several labels are 7–9px, below readability threshold. | Persona 3 |
| 3.4 | **Add loading states / skeleton screens** | Replace "—" and "loading…" with animated skeleton placeholders during data fetch. | Persona 3 |
| 3.5 | **Make resize handle visible** | Add a visible grip indicator (dots, lines) on the panel resize handle, at minimum on hover. | Persona 3 |
| 3.6 | **Preserve scroll position per tab** | When switching tabs and returning, maintain the previous scroll position. | Persona 3 |
| 3.7 | **Add shareable URL state** | Encode active layers, zoom, center, active tab, and time in URL hash for bookmarking and sharing. | Persona 7 |
| 3.8 | **Add plain-language auto-interpretations** for statistical results | Each chart/analysis should have a generated text summary: "This shows a strong 14-day cycle matching lunar tides." | Persona 9 |
| 3.9 | **Use friendlier terminology in primary labels** | "Moon Alignment (Syzygy)" instead of "SYZYGY." Keep technical terms as secondary/parenthetical. | Persona 9 |
| 3.10 | **Add timestamp watermark to map viewport** | Show date/time on the map view for screenshot provenance. | Persona 7 |
| 3.11 | **Add SITREP / PDF export** | One-page summary of current conditions, active alerts, and risk levels for reporting. | Persona 5 |

---

## TIER 4 — Lower (Enhancements & Advanced Features)
*Nice-to-have features that would elevate ESO from good to exceptional.*

| # | Action | Objective | Flagged By |
|---|--------|-----------|------------|
| 4.1 | **Add guided tour / walkthrough** | Step-by-step interactive onboarding: map → layers → risk → explore → analyze. | Persona 9 |
| 4.2 | **Add map view export (PNG/SVG)** | Render current map + all active layers + legend to downloadable image. | Persona 7 |
| 4.3 | **Add wind direction arrows/barbs** | Show direction alongside speed for the wind layer. | Persona 4 |
| 4.4 | ✅ DONE **Add focal mechanism (beachball)** for quakes | USGS event catalog integration done. `fetchFocalMechanisms()` now prefers GCMT product, falls back to USGS-MT; source-tagged with split count in panel. (Phase 7) | Persona 1 |
| 4.5 | **Add ENSO phase indicator** | Compute Niño3.4 index from existing SST grid. | Persona 4 |
| 4.6 | **Add earthquake aftershock clustering** | Group spatiotemporally proximate events as sequences. | Persona 1 |
| 4.7 | **Add data caching (IndexedDB + TTL)** | Cache API responses locally for instant page load and reduced API load. | Persona 10 |
| 4.8 | **Add educational scenario mode** | Prebuilt scenarios: "What happens during a solar storm?" auto-activates relevant layers and walks through chains. | Persona 9 |
| 4.9 | **Add population density overlay** | Contextual hazard exposure from NASA GPW or WorldPop. | Persona 5 |
| 4.10 | **Add data provenance panel** | Per-layer: source name, API URL, last fetch time, update frequency, license. | Persona 7 |
| 4.11 | **Add embed/iframe mode** | Strip header/panels for article embedding. | Persona 7 |
| 4.12 | **Add ARIA labels and screen reader support** | Full accessibility compliance for the interface. | Persona 3 |
| 4.13 | **Remove duplicate `fetchUSGSQuakes`** definition | Clean up dead code (~line 5814 relay version). | Persona 10 |
| 4.14 | ✅ DONE **Split file into modules** | Modular architecture implemented in Phase 7: `build.py` + `eso-core.js`, `eso-data.js`, `eso-ui.js`, `eso-stats.js`, `eso-style.css`, `eso-thesis.js`, `thesis-a-solar-seismic.js`, `thesis-b-tidal-seismic.js`. | Persona 10 |
| 4.15 | **Add real IGS TEC maps** | Replace physics-model TEC with daily NASA/JPL GNSS TEC maps. | Persona 6 |
| 4.16 | **Add TEC anomaly detection** (27-day median deviation) | Core requirement for LAIC earthquake precursor research. | Persona 6 |
| 4.17 | **Add session recording / raw data log** | Capture timestamped raw inputs and computed outputs for reproducibility. | Persona 8 |
| 4.18 | **Add auroral oval visualization** | NOAA Ovation Prime model for real-time auroral probability. | Persona 2 |

---

## Quick Wins (Low Effort, High Visibility)
*These can be done in a single session and make immediate impact.*

| # | Action | Effort |
|---|--------|--------|
| QW1 | Auto-enable 3–4 default layers on first visit | ~20 lines JS |
| QW2 | Add "SIMULATED DATA" label to History charts | ~5 lines per chart |
| QW3 | Make resize handle visible on hover | ~10 lines CSS |
| QW4 | Remove duplicate `fetchUSGSQuakes` | Delete ~50 lines |
| QW5 | Add prominent "RESEARCH ONLY" border to Chains 9–11 | ~15 lines CSS + HTML |
| QW6 | Add timestamp watermark to map viewport | ~10 lines JS + CSS |
| QW7 | Use friendlier labels: "Moon Alignment" instead of "SYZYGY" | Text changes |
| QW8 | Add loading skeleton CSS for data panels | ~30 lines CSS |

---

*End of audit report. Recommended next step: begin with Tier 1 items (historical engine is the keystone — it unlocks items 1.1, 1.3, 1.4, and most of Tier 2) and Quick Wins (can be done immediately without architectural changes).*
