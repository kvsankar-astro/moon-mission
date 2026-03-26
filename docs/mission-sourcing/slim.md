# SLIM (slim) sourcing

## Mission Identity
- Slug: `slim`
- Folder: `assets/slim`
- HORIZONS ID: `-240`
- Name source: `docs/horizons-blurbs/mission-index.json`

## Time Window Used
- Launch/reference start: `2023-09-06 23:42:00 UTC`
- Orbit data start: `2023-10-19 15:19:57 UTC`
- Orbit data end: `2024-01-19 15:19:57 UTC`
- Sampling step: `60` seconds
- Original trajectory window from source: `2023-09-07 00:32:00 UTC` to `2024-01-31 00:00:00 UTC`
- Selected interesting window strategy: `terminal`; capped to `92` days for pipeline/runtime constraints.

## Primary Source References
- docs/horizons-blurbs/raw/slim.txt: first listed trajectory segment begins 2023-Sep-07 00:32
- docs/horizons-blurbs/raw/slim.txt: final listed segment ends 2024-Jan-31
- docs/horizons-blurbs/raw/slim.txt: launch and landing times in background

## Generated Files
- `assets/slim/data/config.json`

## Notes
- Config uses two origins (`geo`, `lunar`) plus generated `relative` mode.
- Ephemeris sources are configured as Chebyshev for SC/MOON/EARTH/SUN.
