# Lunar Prospector (lunar-prospector) sourcing

## Mission Identity
- Slug: `lunar-prospector`
- Folder: `assets/lunar-prospector`
- HORIZONS ID: `-25`
- Name source: `docs/horizons-blurbs/mission-index.json`

## Time Window Used
- Launch/reference start: `1998-01-07 03:00:00 UTC`
- Orbit data start: `1998-01-07 03:00:00 UTC`
- Orbit data end: `1998-01-20 00:05:00 UTC`
- Sampling step: `60` seconds

## Primary Source References
- docs/horizons-blurbs/raw/lunar-prospector.txt: 'lpm-transfer.bsp (1998-Jan-07 03:00:00 -> 1998-Jan-11 12:18:03)'
- docs/horizons-blurbs/raw/lunar-prospector.txt: 'lpm-loi.bsp (1998-Jan-11 12:18:03 -> 1998-Jan-20 00:05:00)'

## Generated Files
- `assets/lunar-prospector/data/config.json`

## Notes
- Config uses two origins (`geo`, `lunar`) plus generated `relative` mode.
- Ephemeris sources are configured as Chebyshev for SC/MOON/EARTH/SUN.
