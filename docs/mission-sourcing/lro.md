# LRO (lro) sourcing

## Mission Identity
- Slug: `lro`
- Folder: `assets/lro`
- HORIZONS ID: `-85`
- Name source: `docs/horizons-blurbs/mission-index.json`

## Time Window Used
- Launch/reference start: `2009-06-18 09:32:00 UTC`
- Orbit data start: `2009-06-18 22:16:00 UTC`
- Orbit data end: `2009-09-18 22:16:00 UTC`
- Sampling step: `60` seconds
- Original trajectory window from source: `2009-06-18 22:16:00 UTC` to `2027-07-18 23:59:00 UTC`
- Selected interesting window strategy: `earliest`; capped to `92` days for pipeline/runtime constraints.

## Primary Source References
- docs/horizons-blurbs/raw/lro.txt: 'Reconstructed trajectory 2009-Jun-18 22:16 2025-Sep-15 00:01'
- docs/horizons-blurbs/raw/lro.txt: '558day_20260107_01 2026-Jan-07 00:01 2027-Jul-18 23:59'
- docs/horizons-blurbs/raw/lro.txt: 'launched 2009-Jun-18 9:32 UTC'

## Generated Files
- `assets/lro/data/config.json`

## Notes
- Config uses two origins (`geo`, `lunar`) plus generated `relative` mode.
- Ephemeris sources are configured as Chebyshev for SC/MOON/EARTH/SUN.
