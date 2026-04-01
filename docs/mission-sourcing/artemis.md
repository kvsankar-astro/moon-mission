# ARTEMIS (artemis) sourcing

## Mission Identity
- Slug: `artemis`
- Folder: `assets/artemis`
- HORIZONS IDs: `-192` (`ARTEMIS-P1`), `-193` (`ARTEMIS-P2`)
- Canonical mission name used here: `ARTEMIS`
- Repo shape decision: combined multi-craft mission, matching the single Wikipedia mission row and the repo's `GRAIL` pattern.

## Time Window Used
- Launch/reference start: `2007-02-17 23:01:00 UTC`
- Orbit data start: `2011-06-01 00:00:00 UTC`
- Orbit data end: `2011-09-01 00:00:00 UTC`
- Sampling step: `60` seconds
- Original trajectory coverage from source begins `2007-Feb-18` and continues through current definitive plus short-term solution ranges.
- Selected interesting window strategy: a custom `92`-day lunar-operations slice centered on the 2011 lunar-orbit phase, because the mission's most relevant Moon story is the paired lunar-orbit era rather than the earlier THEMIS launch phase.

## Primary Source References
- `docs/horizons-blurbs/raw/artemis-p1.txt` and `docs/horizons-blurbs/raw/artemis-p2.txt`: definitive-trajectory ranges and identity of the two lunar spacecraft.
- Explorer audit notes preserved in the config: `ARTEMIS-P1` reaches Earth-Moon `L2` on `2010-08-25` and lunar orbit on `2011-06-27`; `ARTEMIS-P2` reaches Earth-Moon `L1` on `2010-10-22` and lunar orbit on `2011-07-17`.
- Generated trajectory from `data-generated/artemis/lunar-ARTP1.npz` validates the paired lunar-orbit window and supports the combined multi-craft artifact set.

## Generated Files
- `assets/artemis/data/config.json`
- `assets/artemis/data/ephemeris-manifest.json`

## Notes
- This mission is another explicit use of the pre-data-event rule: the original THEMIS launch remains an event even though the selected animation window begins years later in the lunar phase.
- The L1/L2 and lunar-orbit milestones are currently documented as date-only events because the saved source bundle does not yet provide exact timestamps for those milestones.
- Generated runtime artifacts are staged under `../moon-mission-data/assets/artemis/data/`.
