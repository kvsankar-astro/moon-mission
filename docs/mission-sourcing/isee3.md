# ISEE-3 / ICE (isee3) sourcing

## Mission Identity
- Slug: `isee3`
- Folder: `assets/isee3`
- HORIZONS ID: `-111`
- Canonical mission name used here: `ISEE-3 / ICE`

## Time Window Used
- Launch/reference start: `1978-08-12 15:12:00 UTC`
- Orbit data start: `2014-06-25 19:19:00 UTC`
- Orbit data end: `2014-09-25 19:19:00 UTC`
- Sampling step: `120` seconds
- Original trajectory window from source: `2014-Jan-01` to `2014-Dec-31`
- Selected interesting window strategy: encounter-centered `92` days around the 2014 Earth/Moon return, because the raw HORIZONS trajectory is a 2014 reconstruction rather than the full 1978-1980s mission history.

## Primary Source References
- `docs/horizons-blurbs/raw/isee-3-ice.txt`: launch details, 2008 carrier reacquisition note, and 2014 reconstructed Earth/Moon encounter update.
- `docs/horizons-blurbs/raw/isee-3-ice.txt`: exact lunar close approach reported as `2014-Aug-10 19:18:27 UTC`, about `16,663 km` above the lunar surface.

## Generated Files
- `assets/isee3/data/config.json`
- `assets/isee3/data/ephemeris-manifest.json`

## Notes
- Mission chronology and orbit-data chronology are far apart here: launch is in `1978`, while the HORIZONS reconstruction used for animation is the `2014` return encounter.
- Pre-data mission events such as launch and 2008 reacquisition are preserved in the config even though the sampled orbit window starts in 2014.
- Generated runtime artifacts are staged under `../moon-mission-data/assets/isee3/data/`.
