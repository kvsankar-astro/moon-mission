# HGS-1 (hgs1) sourcing

## Mission Identity
- Slug: `hgs1`
- Folder: `assets/hgs1`
- HORIZONS ID: `-125126`
- Canonical mission name used here: `HGS-1`

## Time Window Used
- Launch/reference start: `1997-12-24 23:19:00 UTC`
- Orbit data start: `1998-04-01 00:00:00 UTC`
- Orbit data end: `1998-07-02 00:00:00 UTC`
- Sampling step: `120` seconds
- Original trajectory coverage from source is available from launch.
- Selected interesting window strategy: custom flyby-centered `92` days so the two lunar gravity assists are both visible in one animation window.

## Primary Source References
- `docs/horizons-blurbs/raw/hgs-1.txt`: launch details and the note that two successive lunar flybys were used to rescue the satellite into geosynchronous orbit.
- Moon-centered HORIZONS vector queries for `-125126` show local closest-approach minima at `1998-05-13 08:33 UTC` (~`8,219 km` altitude) and `1998-06-06 19:34 UTC` (~`38,782 km` altitude).

## Generated Files
- `assets/hgs1/data/config.json`
- `assets/hgs1/data/ephemeris-manifest.json`

## Notes
- Config uses two origins (`geo`, `lunar`) plus generated `relative` mode.
- Launch remains an event even though the chosen animation window starts later, because the key story is a flyby-centered rescue arc rather than the initial parking period.
- Generated runtime artifacts are staged under `../moon-mission-data/assets/hgs1/data/`.
