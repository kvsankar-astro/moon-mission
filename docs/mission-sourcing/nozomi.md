# Nozomi (nozomi) sourcing

## Mission Identity
- Slug: `nozomi`
- Folder: `assets/nozomi`
- HORIZONS ID: `-178`
- Canonical mission name used here: `Nozomi`

## Time Window Used
- Launch/reference start: `1998-07-03 18:12:00 UTC`
- Orbit data start: `1999-02-08 12:02:00 UTC`
- Orbit data end: `1999-05-11 12:02:00 UTC`
- Sampling step: `120` seconds
- Original trajectory window from source: `1999-Feb-08 12:01` to `2003-Dec-14 00:00`
- Selected interesting window strategy: earliest `92` days of the replanned post-flyby mission extension, because HORIZONS does not provide ephemeris for the 1998 launch and lunar-flyby phase.

## Primary Source References
- `docs/horizons-blurbs/raw/nozomi.txt`: launch time, the two `1998` lunar flyby dates, and the note that the published HORIZONS planning trajectory begins only after the failed Earth-flyby sequence and mission replan.
- HORIZONS vector query for `-178` reports no ephemeris before `1999-Feb-08 12:01:04.1850 TDB`, so the orbit window begins at `12:02 UTC`.

## Generated Files
- `assets/nozomi/data/config.json`
- `assets/nozomi/data/ephemeris-manifest.json`

## Notes
- The two `1998` lunar flyby events are preserved from the HORIZONS background, but the source text does not provide exact times; config labels make that limitation explicit.
- This mission is an example of the pre-data-event rule: the lunar flybys matter historically even though the available HORIZONS orbit stream starts later.
- Generated runtime artifacts are staged under `../moon-mission-data/assets/nozomi/data/`.
