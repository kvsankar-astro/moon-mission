# SMART-1 (smart1) sourcing

## Mission Identity
- Slug: `smart1`
- Folder: `assets/smart1`
- SPICE target code: `-238`
- Canonical mission name used here: `SMART-1`

## Time Window Used
- Launch/reference start: `2003-09-27 23:14:39 UTC`
- Orbit data start: `2004-11-11 02:04:13 UTC`
- Orbit data end: `2006-09-03 05:42:22 UTC`
- Sampling step: `600` seconds
- Coverage strategy: union of the two public SMART-1 moon-phase kernels, clipped to the public mission-end impact time.

## Primary Source References
- ESA SMART-1 SPICE archive: `https://spiftp.esac.esa.int/data/SPICE/SMART-1/kernels/spk/`
- ESA mission event pages: `https://sci.esa.int/web/smart-1/-/39723-lunar-orbit` and `https://sci.esa.int/web/smart-1/-/40364-smart-1-status-report`
- Source kernels used here: `ORMS__041111020517_00206.BSP` and `ORMS_______________00233.BSP`

## Generated Files
- `assets/smart1/data/config.json`
- `assets/smart1/data/ephemeris-manifest.json`
- `assets/smart1/data/README-spice-export.md`

## Notes
- Launch is preserved as a mission event even though public orbit coverage begins much later, during the reconstructed lunar phase.
- Runtime artifacts are staged under `../moon-mission-data/assets/smart1/data/`.
- The current `skyfield-ts` checkout does not read the SMART-1 public SPK type, so this mission is sampled with CSPICE and then compressed into the same Chebyshev runtime format used elsewhere in the repo.
