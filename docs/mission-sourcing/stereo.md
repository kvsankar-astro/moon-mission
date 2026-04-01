# STEREO (stereo) sourcing

## Mission Identity
- Slug: `stereo`
- Folder: `assets/stereo`
- HORIZONS IDs: `-234` (`STEREO-A`), `-235` (`STEREO-B`)
- Canonical mission name used here: `STEREO`
- Repo shape decision: combined multi-craft mission, matching the single Wikipedia mission row and the repo's `GRAIL` pattern.

## Time Window Used
- Launch/reference start: `2006-10-26 01:53:00 UTC`
- Orbit data start: `2006-10-26 01:53:00 UTC`
- Orbit data end: `2007-01-26 01:53:00 UTC`
- Sampling step: `60` seconds
- Original trajectory coverage from source extends far beyond the lunar phase for both spacecraft.
- Selected interesting window strategy: earliest `92` days, chosen to capture both lunar redirect flybys and the split into leading and trailing heliocentric orbits.

## Primary Source References
- `docs/horizons-blurbs/raw/stereo-a.txt` and `docs/horizons-blurbs/raw/stereo-b.txt`: shared mission background, launch time, and the note that the first three months use two lunar encounters to redirect the observatories.
- Generated lunar trajectory from `data-generated/stereo/lunar-STRA.npz`: `STEREO-A` closest lunar approach at `2006-12-15 21:29 UTC`, about `5,621 km` above the lunar surface.
- Generated lunar trajectory from `data-generated/stereo/lunar-STRA.npz`: `STEREO-B` closest lunar approach at `2007-01-21 09:05 UTC`, about `7,083 km` above the lunar surface.

## Generated Files
- `assets/stereo/data/config.json`
- `assets/stereo/data/ephemeris-manifest.json`

## Notes
- The combined mission config uses two craft keys so both observatories remain visible in one mission entry and one orbit artifact set.
- The long heliocentric tail of the mission is intentionally omitted here; the lunar redirect phase is the reason this mission belongs in the repo.
- Generated runtime artifacts are staged under `../moon-mission-data/assets/stereo/data/`.
