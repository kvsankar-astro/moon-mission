# LADEE (ladee) sourcing

## Mission Identity
- Slug: `ladee`
- Folder: `assets/ladee`
- HORIZONS ID: `-12`
- Name source: `docs/horizons-blurbs/mission-index.json`

## Time Window Used
- Launch/reference start: `2013-09-07 03:27:00 UTC`
- Orbit data start: `2014-01-16 00:00:00 UTC`
- Orbit data end: `2014-04-18 00:00:00 UTC`
- Sampling step: `60` seconds
- Original trajectory window from source: `2013-09-07 00:00:00 UTC` to `2014-04-18 00:00:00 UTC`
- Selected interesting window strategy: `terminal`; capped to `92` days for pipeline/runtime constraints.

## Primary Source References
- docs/horizons-blurbs/raw/ladee.txt: trajectory rows span 2013-Sep-07 to 2014-Apr-18
- docs/horizons-blurbs/raw/ladee.txt: 'Launch : 2013-Sep-07 03:27 UTC'

## Generated Files
- `assets/ladee/data/config.json`

## Notes
- Config uses two origins (`geo`, `lunar`) plus generated `relative` mode.
- Ephemeris sources are configured as Chebyshev for SC/MOON/EARTH/SUN.
