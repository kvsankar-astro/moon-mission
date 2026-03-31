# Artemis II (artemis2) sourcing

## Mission Identity
- Slug: `artemis2`
- Folder: `assets/artemis2`
- HORIZONS ID: `-1024`
- Canonical mission name used here: `Artemis II`

## Time Window Used
- Launch/reference start: `2026-04-01 22:24:00 UTC`
- Orbit data start: `2026-04-02 01:49:00 UTC`
- Orbit data end: `2026-04-10 23:52:00 UTC`
- Sampling step: `60` seconds
- Original trajectory window from source: `2026-Apr-02 01:49` to `2026-Apr-10 23:52`
- Selected interesting window strategy: full currently published HORIZONS trajectory, because the public data set already corresponds to the complete post-separation lunar-flyby mission arc.

## Primary Source References
- `docs/horizons-blurbs/raw/artemis-2-orion.txt`: launch at `2026-04-01 22:24 UTC`, the post-launch major-event timeline, and the note that trajectory data begins `3h24m18s` after launch following nominal ICPS separation.
- `docs/horizons-blurbs/raw/artemis-2-orion.txt`: trajectory table with `2026-Apr-02 01:49` to `2026-Apr-10 23:52`.
- The mission config preserves major events like launch, translunar injection, lunar sphere-of-influence entry, closest approach, and splashdown even when they occur outside the public data span.

## Generated Files
- `assets/artemis2/data/config.json`
- `assets/artemis2/data/ephemeris-manifest.json`

## Notes
- This is the clearest current example of the pre-data-event rule: launch and early mission events matter even though public orbit samples begin later.
- Splashdown is also preserved as a post-data event because the published HORIZONS stop time ends shortly before the mission timeline concludes.
- Generated runtime artifacts are staged under `../moon-mission-data/assets/artemis2/data/`.
