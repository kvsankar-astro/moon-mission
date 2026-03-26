# GRAIL-B Flow (grail-b-flow) sourcing

## Mission Identity
- Slug: `grail-b-flow`
- Folder: `assets/grail-b-flow`
- HORIZONS ID: `-181`
- Name source: `docs/horizons-blurbs/mission-index.json`

## Time Window Used
- Launch/reference start: `2011-09-10 00:00:00 UTC`
- Orbit data start: `2012-09-16 00:00:00 UTC`
- Orbit data end: `2012-12-17 00:00:00 UTC`
- Sampling step: `60` seconds
- Original trajectory window from source: `2011-09-10 00:00:00 UTC` to `2012-12-17 00:00:00 UTC`
- Selected interesting window strategy: `terminal`; capped to `92` days for pipeline/runtime constraints.

## Primary Source References
- docs/horizons-blurbs/raw/grail-b-flow.txt: trajectory rows span 2011-Sep-10 through 2012-Dec-17
- docs/horizons-blurbs/raw/grail-b-flow.txt: impact noted for 2012 Dec 17

## Generated Files
- `assets/grail-b-flow/data/config.json`

## Notes
- Config uses two origins (`geo`, `lunar`) plus generated `relative` mode.
- Ephemeris sources are configured as Chebyshev for SC/MOON/EARTH/SUN.
