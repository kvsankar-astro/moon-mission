# KPLO Danuri (kplo-danuri) sourcing

## Mission Identity
- Slug: `kplo-danuri`
- Folder: `assets/kplo-danuri`
- HORIZONS ID: `-155`
- Name source: `docs/horizons-blurbs/mission-index.json`

## Time Window Used
- Launch/reference start: `2022-08-04 23:08:00 UTC`
- Orbit data start: `2022-09-15 00:00:00 UTC`
- Orbit data end: `2022-12-16 00:00:00 UTC`
- Sampling step: `60` seconds
- Original trajectory window from source: `2022-08-04 23:19:00 UTC` to `2026-07-02 23:33:00 UTC`
- Selected interesting window strategy: `terminal`; capped to `92` days for pipeline/runtime constraints.

## Primary Source References
- docs/horizons-blurbs/raw/kplo-danuri.txt: 'Concatenated trajectory solutions (828) 2022-Aug-04 23:19 2026-Jul-02 23:33'
- docs/horizons-blurbs/raw/kplo-danuri.txt: launch timeline with 2022-Aug-04 23:08 UTC

## Generated Files
- `assets/kplo-danuri/data/config.json`

## Notes
- Config uses two origins (`geo`, `lunar`) plus generated `relative` mode.
- Ephemeris sources are configured as Chebyshev for SC/MOON/EARTH/SUN.
