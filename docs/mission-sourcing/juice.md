# JUICE (juice) sourcing

## Mission Identity
- Slug: `juice`
- Folder: `assets/juice`
- HORIZONS ID: `-28`
- Canonical mission name used here: `JUICE`

## Time Window Used
- Launch/reference start: `2023-04-14 12:14:00 UTC`
- Orbit data start: `2024-07-15 00:00:00 UTC`
- Orbit data end: `2024-10-15 00:00:00 UTC`
- Sampling step: `120` seconds
- Original trajectory window from source: `2023-Apr-14` to `2031-Jul-21`
- Selected interesting window strategy: custom Earth-Moon-assist-centered `92` days, because the mission's lunar relevance is the August 2024 gravity-assist passage rather than the launch or Jupiter-arrival phases.

## Primary Source References
- `docs/horizons-blurbs/raw/juice.txt`: mission purpose and flyby list, including `2024 Aug: Earth-Moon system (gravity-assist)`.
- `docs/horizons-blurbs/raw/juice.txt`: trajectory table with `2023-Apr-14` to `2031-Jul-21`.
- Generated lunar trajectory from `data-generated/juice/lunar-JUI.npz`: closest lunar approach at `2024-08-19 21:16 UTC`, about `752 km` above the lunar surface.

## Generated Files
- `assets/juice/data/config.json`
- `assets/juice/data/ephemeris-manifest.json`

## Notes
- The mission is included here as a cislunar gravity-assist case, not as a lunar science orbiter.
- Launch remains an event even though the selected animation window is centered much later on the Earth-Moon assist.
- Generated runtime artifacts are staged under `../moon-mission-data/assets/juice/data/`.
