# Lunar Flashlight (lunar-flashlight) sourcing

## Mission Identity
- Slug: `lunar-flashlight`
- Folder: `assets/lunar-flashlight`
- HORIZONS ID: `-164`
- Name source: `docs/horizons-blurbs/mission-index.json`

## Time Window Used
- Launch/reference start: `2022-12-11 07:38:00 UTC`
- Orbit data start: `2022-12-11 08:34:00 UTC`
- Orbit data end: `2023-03-13 08:34:00 UTC`
- Sampling step: `60` seconds
- Original trajectory window from source: `2022-12-11 08:34:00 UTC` to `2038-01-01 00:00:00 UTC`
- Selected interesting window strategy: `earliest`; capped to `92` days for pipeline/runtime constraints.

## Primary Source References
- docs/horizons-blurbs/raw/lunar-flashlight.txt: 'trj_lfl_221211-230627_380101_final_v1 2022-Dec-11 08:34 2038-Jan-01'
- docs/horizons-blurbs/raw/lunar-flashlight.txt: launch/deployment times in background section

## Generated Files
- `assets/lunar-flashlight/data/config.json`

## Notes
- Config uses two origins (`geo`, `lunar`) plus generated `relative` mode.
- Ephemeris sources are configured as Chebyshev for SC/MOON/EARTH/SUN.
