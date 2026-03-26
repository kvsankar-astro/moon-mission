# GRAIL-SS Stage (grail-ss-stage) sourcing

## Mission Identity
- Slug: `grail-ss-stage`
- Folder: `assets/grail-ss-stage`
- HORIZONS ID: `-176`
- Name source: `docs/horizons-blurbs/mission-index.json`

## Time Window Used
- Launch/reference start: `2011-09-12 15:08:00 UTC`
- Orbit data start: `2011-09-12 15:08:23 UTC`
- Orbit data end: `2011-12-13 15:08:23 UTC`
- Sampling step: `60` seconds
- Original trajectory window from source: `2011-09-12 15:08:00 UTC` to `2061-08-30 00:00:00 UTC`
- Selected interesting window strategy: `earliest`; capped to `92` days for pipeline/runtime constraints.

## Primary Source References
- docs/horizons-blurbs/raw/grail-ss-stage.txt: 'GRSS_0910_99_50yr-stratcom 2011 SEP 12 2061 AUG 30'
- docs/horizons-blurbs/raw/grail-ss-stage.txt: '* Nominal time of depletion burn: 2011-Sep-12 15:08:23 UTC'

## Generated Files
- `assets/grail-ss-stage/data/config.json`

## Notes
- Config uses two origins (`geo`, `lunar`) plus generated `relative` mode.
- Ephemeris sources are configured as Chebyshev for SC/MOON/EARTH/SUN.
