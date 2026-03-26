# CAPSTONE (capstone) sourcing

## Mission Identity
- Slug: `capstone`
- Folder: `assets/capstone`
- HORIZONS ID: `-1176`
- Name source: `docs/horizons-blurbs/mission-index.json`

## Time Window Used
- Launch/reference start: `2022-06-28 09:55:52 UTC`
- Orbit data start: `2022-07-04 17:15:00 UTC`
- Orbit data end: `2022-10-04 17:15:00 UTC`
- Sampling step: `60` seconds
- Original trajectory window from source: `2022-06-28 10:07:00 UTC` to `2026-02-03 15:29:00 UTC`
- Selected interesting window strategy: `earliest`; capped to `92` days for pipeline/runtime constraints.

## Primary Source References
- docs/horizons-blurbs/raw/capstone.txt: 'photon_capstone_full_mission 2022-Jun-28 10:07 2022-Jul-04 17:15'
- docs/horizons-blurbs/mission-index.json: trajectory_end=2026-Feb-03 15:29
- docs/horizons-blurbs/raw/capstone.txt: launch section with 2022-Jun-28 09:55:52 UTC

## Generated Files
- `assets/capstone/data/config.json`

## Notes
- Config uses two origins (`geo`, `lunar`) plus generated `relative` mode.
- Ephemeris sources are configured as Chebyshev for SC/MOON/EARTH/SUN.
