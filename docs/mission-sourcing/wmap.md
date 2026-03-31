# WMAP (wmap) sourcing

## Mission Identity
- Slug: `wmap`
- Folder: `assets/wmap`
- HORIZONS ID: `-165`
- Canonical mission name used here: `WMAP`

## Time Window Used
- Launch/reference start: `2001-06-30 19:46:46 UTC`
- Orbit data start: `2001-06-30 21:16:00 UTC`
- Orbit data end: `2001-09-30 21:16:00 UTC`
- Sampling step: `120` seconds
- Original trajectory window from source: `2001-Jun-30` to `2009-Apr-07`
- Selected interesting window strategy: earliest `92` days, chosen to capture launch recovery, phasing loops, the lunar gravity assist, and the opening transfer toward Earth-Moon-Sun L2.

## Primary Source References
- `docs/horizons-blurbs/raw/wmap.txt`: mission background and trajectory table with `MAP_Mission_20090417 2001-Jun-30 2009-Apr-07`.
- `https://lambda.gsfc.nasa.gov/product/wmap/dr5/pub_papers/nineyear/supplement/WMAP_supplement.pdf`: launch at `2001-06-30 19:46:46 UTC`, first observing-mode entry at `2001-07-02 19:18 UTC`, and lunar swingby at `2001-07-30 16:37 UTC`.
- HORIZONS vector query for `-165` reports no ephemeris before `2001-Jun-30 21:15:04.1840 TDB`, so the sampled orbit window begins at `21:16 UTC`.

## Generated Files
- `assets/wmap/data/config.json`
- `assets/wmap/data/ephemeris-manifest.json`

## Notes
- Config uses two origins (`geo`, `lunar`) plus generated `relative` mode.
- The lunar swingby passed about `5,279 km` above the Moon's surface, or about `7,018 km` from the Moon's center.
- Generated runtime artifacts are staged under `../moon-mission-data/assets/wmap/data/`.
