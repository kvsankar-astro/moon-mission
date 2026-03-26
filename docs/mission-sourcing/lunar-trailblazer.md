# Lunar Trailblazer (lunar-trailblazer) sourcing

## Mission Identity
- Slug: `lunar-trailblazer`
- Folder: `assets/lunar-trailblazer`
- HORIZONS ID: `-242`
- Name source: `docs/horizons-blurbs/mission-index.json`

## Time Window Used
- Launch/reference start: `2025-02-27 00:16:32 UTC`
- Orbit data start: `2025-04-30 00:00:00 UTC`
- Orbit data end: `2025-07-31 00:00:00 UTC`
- Sampling step: `60` seconds
- Original trajectory window from source: `2025-02-27 00:00:00 UTC` to `2051-01-01 00:00:00 UTC`
- Selected interesting window strategy: `terminal`; capped to `92` days for pipeline/runtime constraints.

## Primary Source References
- docs/horizons-blurbs/raw/lunar-trailblazer.txt: 'ltb_trj_od007v1 2025-Feb-27 2051-Jan-01'
- docs/horizons-blurbs/raw/lunar-trailblazer.txt: mission launch date line 2025-Feb-27 00:16:32 UTC
- docs/horizons-blurbs/raw/lunar-trailblazer.txt: NOTE with mission end on 2025-Jul-31

## Generated Files
- `assets/lunar-trailblazer/data/config.json`

## Notes
- Config uses two origins (`geo`, `lunar`) plus generated `relative` mode.
- Ephemeris sources are configured as Chebyshev for SC/MOON/EARTH/SUN.
