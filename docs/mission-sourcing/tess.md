# TESS (tess) sourcing

## Mission Identity
- Slug: `tess`
- Folder: `assets/tess`
- HORIZONS ID: `-95`
- Canonical mission name used here: `TESS`

## Time Window Used
- Launch/reference start: `2018-04-18 22:51:00 UTC`
- Orbit data start: `2018-04-18 23:37:00 UTC`
- Orbit data end: `2018-07-19 23:37:00 UTC`
- Sampling step: `120` seconds
- Original trajectory window from source: `2018-Apr-18 23:37` to `2027-Sep-15 13:00`
- Selected interesting window strategy: earliest `92` days, chosen to capture deployment, phasing loops, the lunar flyby, and the opening transition into the stable science orbit.

## Primary Source References
- `docs/horizons-blurbs/raw/tess.txt`: launch time, mission overview, and the note that the first `60` days use `11` burns, `3.5` phasing loops, and a lunar flyby to reach the operational orbit.
- `docs/horizons-blurbs/raw/tess.txt`: trajectory table with `2018-Apr-18 23:37` to `2027-Sep-15 13:00`.
- Generated lunar trajectory from `data-generated/tess/lunar-TESS.npz`: closest lunar approach at `2018-05-17 06:35 UTC`, about `8,253 km` above the lunar surface.

## Generated Files
- `assets/tess/data/config.json`
- `assets/tess/data/ephemeris-manifest.json`

## Notes
- This mission is an example of a science observatory whose lunar relevance is concentrated entirely in the transfer arc rather than the long-duration science orbit.
- Launch is preserved as a pre-data event because public HORIZONS trajectory coverage starts after ascent and early deployment.
- Generated runtime artifacts are staged under `../moon-mission-data/assets/tess/data/`.
