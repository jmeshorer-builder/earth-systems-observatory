# Release: Phase 4 — v4.0 Milestone
**Date:** 2026-04-14  
**Snapshot taken at:** v4.2 build (includes v4.0 + v4.1 + v4.2 changes)

## What's in this milestone
This is the first major Phase 4 release snapshot, capturing all work from v4.0 through v4.2.

### v4.0 — Fetch Infrastructure
- `cachedFetch()` — in-memory Map cache (5-min TTL) + request deduplication + timeout
- `retryFetch()` — cachedFetch + exponential backoff with configurable retries  
- `ESO_DATA_VERSION` — localStorage schema versioning with auto-cache-clear on bump
- API health system upgraded: response time tracking, cache hit rates, 5 new endpoint slots
- CSS utility classes: `.eso-pill-btn`, `.eso-header-btn`, `.eso-dim-label`, `.eso-panel-desc`

### v4.1 — NASA GIBS Satellite Layer
- NASA GIBS MODIS Terra True Color satellite base layer (daily, free, no API key)
- NASA GHRSST MUR Sea Surface Temperature science-grade overlay (daily, 1km resolution)
- Map layer controls: `🗺 MAP` / `🛰 SAT` base toggle + `🌊 SST` overlay toggle
- NASA GIBS attribution (visible in satellite mode only)
- Light-mode invert fix for satellite imagery

### v4.2 — IRI/CPC ENSO + NOAA ONI
- `fetchIRICPCEnso()` — IRI/CPC consensus ENSO forecast (authoritative, replaces synthetic)
- `fetchNOAAONI()` — NOAA Oceanic Niño Index historical series (1950–present)
- `renderENSOStatus()` — live ENSO phase + anomaly on baseline strip with source badge
- `renderENSORiskCard()` — El Niño 2026 probability card in Risk tab (gauge + phase + consensus)
- Auto-boot on load (2s delay, non-blocking), 24h localStorage cache
- Physics fallback from SST grid when IRI/CPC unavailable

## Build stats
- Full: 16,286 lines / 839 KB
- Minified: 14,491 lines / 725 KB

## Known limitations at this snapshot
- IRI/CPC ENSO endpoint may require CORS negotiation — physics fallback covers this gracefully
- GIBS tiles limited to zoom 9 (250m MODIS resolution limit)
- ONI text parsing depends on CPC file format stability
