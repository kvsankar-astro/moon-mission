# Chandrayaan-2 Lander Vikram (chandrayaan2-vikram) sourcing

## Mission Identity
- Slug: `chandrayaan-2-lander-vikram`
- Folder: `assets/chandrayaan2-vikram`
- HORIZONS ID: `-153`
- Name source: `docs/horizons-blurbs/mission-index.json`

## Time Window Used
- Launch/reference start: `2019-07-22 09:13:00 UTC`
- Orbit data start: `2019-07-22 09:31:00 UTC`
- Orbit data end: `2019-09-06 20:26:00 UTC`
- Sampling step: `60` seconds

## Primary Source References
- docs/horizons-blurbs/raw/chandrayaan-2-lander-vikram.txt: first lander trajectory segment starts 2019-Jul-22 09:31
- docs/horizons-blurbs/raw/chandrayaan-2-lander-vikram.txt: lander segment ends 2019-Sep-06 20:26
- docs/horizons-blurbs/raw/chandrayaan-2-lander-vikram.txt: launch and separation timeline in background

## Generated Files
- `assets/chandrayaan2-vikram/data/config.json`

## Notes
- Config uses two origins (`geo`, `lunar`) plus generated `relative` mode.
- Ephemeris sources are configured as Chebyshev for SC/MOON/EARTH/SUN.
