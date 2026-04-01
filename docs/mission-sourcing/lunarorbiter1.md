# Lunar Orbiter 1 (lunarorbiter1) sourcing

## Mission Identity
- Slug: `lunarorbiter1`
- Folder: `assets/lunarorbiter1`
- SPICE target code: `-531`
- Canonical mission name used here: `Lunar Orbiter 1`

## Time Window Used
- Launch/reference start: `1966-08-10 19:31:00 UTC`
- Orbit data start: `1966-08-14 15:39:55 UTC`
- Orbit data end: `1966-10-26 23:39:56 UTC`
- Sampling step: `60` seconds
- Coverage strategy: full public NAIF Lunar Orbiter 1 SPK with all public coverage intervals preserved.

## Primary Source References
- NAIF Lunar Orbiter kernels: `https://naif.jpl.nasa.gov/pub/naif/LUNARORBITER/kernels/spk/`
- NASA mission summary: `https://www.nasa.gov/mission/lunar-orbiter-1/`
- NASA history article: `https://www.nasa.gov/history/55-years-ago-lunar-orbiter-1-launches-to-survey-the-moon/`
- Source kernel used here: `lo1_ssd_lp150q.bsp`

## Generated Files
- `assets/lunarorbiter1/data/config.json`
- `assets/lunarorbiter1/data/ephemeris-manifest.json`
- `assets/lunarorbiter1/data/README-spice-export.md`

## Notes
- Public orbit coverage begins shortly after lunar-orbit insertion and ends before the final intentional impact, so both of those mission events remain explicit config metadata.
- The exported geocentric and selenocentric Chebyshev files preserve all `35` public SPICE coverage intervals.
- Runtime artifacts are staged under `../moon-mission-data/assets/lunarorbiter1/data/`.
