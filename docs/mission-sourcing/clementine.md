# Clementine (clementine) sourcing

## Mission Identity
- Slug: `clementine`
- Folder: `assets/clementine`
- HORIZONS ID: `-40`
- Name source: `docs/horizons-blurbs/mission-index.json`

## Time Window Used
- Launch/reference start: `1994-01-25 16:34:00 UTC`
- Orbit data start: `1994-02-19 12:59:00 UTC`
- Orbit data end: `1994-05-03 12:59:00 UTC`
- Sampling step: `120` seconds

## Primary Source References
- docs/horizons-blurbs/raw/clementine.txt: 'clem_nrl 1994-Feb-19 12:59 1994-May-03 12:59'
- docs/horizons-blurbs/raw/clementine.txt: 'was launched 1994-Jan-25 @ 16:34 UTC'

## Generated Files
- `assets/clementine/data/config.json`

## Notes
- Config uses two origins (`geo`, `lunar`) plus generated `relative` mode.
- Ephemeris sources are configured as Chebyshev for SC/MOON/EARTH/SUN.
- Sampling was widened from `60` to `120` seconds to stay under HORIZONS output-size limits for the selected mapping arc.
