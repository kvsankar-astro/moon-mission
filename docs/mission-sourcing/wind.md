# WIND (wind) sourcing

## Mission Identity
- Slug: `wind`
- Folder: `assets/wind`
- HORIZONS ID: `-8`
- Canonical mission name used here: `Wind`

## Time Window Used
- Launch/reference start: `1994-11-01 09:31:00 UTC`
- Orbit data start: `1994-11-01 10:49:00 UTC`
- Orbit data end: `1995-02-01 10:49:00 UTC`
- Sampling step: `120` seconds
- Original trajectory window from source: `1994-Nov-01` to `2026-Jun-02`
- Selected interesting window strategy: earliest `92` days, chosen to capture the opening double-lunar swingby phase described in the HORIZONS background.

## Primary Source References
- `docs/horizons-blurbs/raw/wind.txt`: launch time, mission URLs, and the note that the first nine months used a double-lunar swingby orbit.
- `docs/horizons-blurbs/raw/wind.txt`: trajectory coverage table with `Wind_merged 1994-Nov-01 2026-Jun-02`.
- Moon-centered HORIZONS vector queries for `-8` around the early mission window show local closest-approach minima at `1994-11-03 06:04 UTC` (~`104,811 km`) and `1994-12-27 14:43 UTC` (~`11,834 km`).

## Generated Files
- `assets/wind/data/config.json`
- `assets/wind/data/ephemeris-manifest.json`

## Notes
- Config uses two origins (`geo`, `lunar`) plus generated `relative` mode.
- HORIZONS does not provide WIND ephemeris before `1994-Nov-01 10:48:19 TDB`, so the orbit window begins at `10:49 UTC` even though launch remains a mission event marker.
- Generated runtime artifacts are staged under `../moon-mission-data/assets/wind/data/`.
