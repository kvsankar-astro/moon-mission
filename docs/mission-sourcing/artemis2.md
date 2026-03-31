# Artemis 2 (artemis2) sourcing

## Mission Identity
- Slug: `artemis2`
- Folder: `assets/artemis2`
- HORIZONS ID: `-1024`
- Name source: `docs/horizons-blurbs/mission-index.json`

## Time Window Used
- Launch/reference start: `2026-04-01 22:24:00 UTC`
- Orbit data start: `2026-04-02 01:49:00 UTC`
- Orbit data end: `2026-04-10 23:52:00 UTC`
- Sampling step: `60` seconds

## Primary Source References
- `docs/horizons-blurbs/raw/artemis-ii-orion.txt`: published `Revised: Mar 27, 2026`
- `docs/horizons-blurbs/raw/artemis-ii-orion.txt`: `Events : Mar 31, 2026`
- `docs/horizons-blurbs/raw/artemis-ii-orion.txt`: `To be launched April 1 @ 22:24 UTC`
- `docs/horizons-blurbs/raw/artemis-ii-orion.txt`: `Orion_OEM_20260401_LP19_p000_Open_V0.1 2026-Apr-02 01:49 2026-Apr-10 23:52`

## Generated Files
- `assets/artemis2/data/config.json`

## Notes
- Config uses two origins (`geo`, `lunar`) plus generated `relative` mode.
- Runtime orbit artifacts were generated locally from the published HORIZONS trajectory and synced to `../moon-mission-data/assets/artemis2/data/`.
