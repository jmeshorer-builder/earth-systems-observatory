# Release v3.0 — 2026-04-13

## Status
Production (live on GitHub Pages)

## What's in this release
- Full modular architecture: 9 source files merged by `build.py`
- Thesis A: Geomagnetic storms → subduction seismicity (CONCLUDED — null at -10nT, exploratory signal at -12nT)
- Thesis B: Tidal triggering of great earthquakes (CONCLUDED — null, p=0.9175)
- Three live external connections: IERS LOD, GCMT focal mechanisms, prospective Bz logger
- Progressive disclosure: Beginner/Expert mode, Field Guide, Guided Tour, SITREP modal
- Minified build: `earth-observatory-p3.min.html` (~13% smaller than full)

## Build stats
- Full: ~15,273 lines / ~797 KB
- Minified: ~13,641 lines / ~693 KB

## Source snapshot
Built from `src/` at this date. See git log for exact commit.

## Known state
- Thesis A Addendum A1 (focal mechanism analysis) appended
- Thesis B null result confirmed across all robustness checks
- NOAA Kp field name fix (`kp` → `Kp`) applied
- Dead backup `earth-observatory-p2_4.html` removed
