# SELENE / Kaguya (selene) sourcing

## Mission Identity
- Slug: `selene`
- Folder: `assets/selene`
- SPICE target code: `-131`
- Canonical mission name used here: `SELENE / Kaguya`

## Time Window Used
- Launch/reference start: `2007-09-14 01:31:01 UTC`
- Orbit data start: `2007-10-20 02:30:00 UTC`
- Orbit data end: `2009-06-10 18:25:00 UTC`
- Sampling step: `60` seconds
- Coverage strategy: public DARTS main-orbit SPK, clipped to the documented lunar-impact end time.

## Primary Source References
- NAIF SELENE pointer: `https://naif.jpl.nasa.gov/pub/naif/SELENE/kernels/aareadme.txt`
- JAXA DARTS SELENE SPICE archive: `https://darts.isas.jaxa.jp/pub/spice/SELENE/kernels_ORG/spk/`
- JAXA mission event pages: `https://www.kaguya.jaxa.jp/en/event/timeline_e.htm` and `https://www.kaguya.jaxa.jp/en/communication/KAGUYA_Lunar_Impact_e.htm`
- Source kernel used here: `SEL_M_071020_090610_SGMH_02.BSP`

## Generated Files
- `assets/selene/data/config.json`
- `assets/selene/data/ephemeris-manifest.json`
- `assets/selene/data/README-spice-export.md`

## Notes
- Launch and the first lunar-orbit-insertion burn are preserved as mission events even though public orbit coverage begins on `2007-10-20`.
- The exported geocentric and selenocentric Chebyshev files preserve the `13` public SPICE coverage intervals instead of smoothing across those kernel gaps.
- Runtime artifacts are staged under `../moon-mission-data/assets/selene/data/`.
