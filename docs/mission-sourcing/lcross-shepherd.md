# LCROSS Shepherd (lcross-shepherd) sourcing

## Mission Identity
- Slug: `lcross-shepherd`
- Folder: `assets/lcross-shepherd`
- HORIZONS ID: `-18`
- Name source: `docs/horizons-blurbs/mission-index.json`

## Time Window Used
- Launch/reference start: `2009-06-18 21:32:01 UTC`
- Orbit data start: `2009-07-09 11:35:00 UTC`
- Orbit data end: `2009-10-09 11:35:00 UTC`
- Sampling step: `60` seconds
- Original trajectory window from source: `2009-06-18 00:00:00 UTC` to `2009-10-09 11:35:00 UTC`
- Selected interesting window strategy: `terminal`; capped to `92` days for pipeline/runtime constraints.

## Primary Source References
- docs/horizons-blurbs/raw/lcross-shepherd.txt: trajectory table begins at 2009-Jun-18 and ends 2009-Oct-09
- docs/horizons-blurbs/raw/lcross-shepherd.txt: '* Shepherd impact : 2009-Oct-09 11:35:36.116 UTC'

## Generated Files
- `assets/lcross-shepherd/data/config.json`

## Notes
- Config uses two origins (`geo`, `lunar`) plus generated `relative` mode.
- Ephemeris sources are configured as Chebyshev for SC/MOON/EARTH/SUN.
