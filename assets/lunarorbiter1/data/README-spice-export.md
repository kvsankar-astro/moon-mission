# Lunar Orbiter 1 SPICE Export

This mission uses the public NAIF Lunar Orbiter SPK sampled with `scripts/export-spice-chebyshev.py`.

Primary source kernels:
- `lo1_ssd_lp150q.bsp`
- `DE440`
- `latest_leapseconds.tls`

Coverage used here:
- Start UTC: `1966-08-14T15:39:55.898Z`
- End UTC: `1966-10-26T23:39:56.088Z`
- Coverage intervals: `35`
- Sampling cadence: `600` seconds

Command run:

```bash
/home/sankar/sankar/projects/skyfield-ts/.venv-spice/bin/python scripts/export-spice-chebyshev.py \
  --mission lunarorbiter1 \
  --mission-spk /home/sankar/sankar/projects/skyfield-ts/data/mirrors/lunarorbiter1/spk/lo1_ssd_lp150q.bsp \
  --aux-spk /home/sankar/sankar/projects/skyfield-ts/data/dev/showcase/de440.bsp \
  --lsk /home/sankar/sankar/projects/skyfield-ts/data/mirrors/naif/generic_kernels/lsk/latest_leapseconds.tls \
  --target -531 \
  --label LO1 \
  --step-seconds 600 \
  --tolerance-km 5
```

Relative-mode command:

```bash
python scripts/generate-relative-orbits.py \
  --mission lunarorbiter1 \
  --phase geo \
  --force \
  --source-cheb ../moon-mission-data/assets/lunarorbiter1/data/geo-LO1-cheb.json \
  --sample-step-seconds 600
```

Notes:
- The public NAIF SPK begins shortly after lunar-orbit insertion and ends several days before the final intentional impact, so those events are preserved separately in config metadata.
- This mission does not require the CSPICE fallback because the current `skyfield-ts` loader can read the LO1 kernel, but the shared exporter here is used so the output format and handling of coverage gaps stay consistent across the SPICE batch.
