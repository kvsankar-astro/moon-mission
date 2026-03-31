# SELENE / Kaguya SPICE Export

This mission uses the public JAXA DARTS SELENE SPICE archive sampled with `scripts/export-spice-chebyshev.py`.

Primary source kernels:
- `SEL_M_071020_090610_SGMH_02.BSP`
- `DE440`
- `latest_leapseconds.tls`

Coverage used here:
- Start UTC: `2007-10-20T02:30:00.000Z`
- End UTC: `2009-06-10T18:25:00Z`
- Coverage intervals: `13`
- Sampling cadence: `600` seconds

Command run:

```bash
/home/sankar/sankar/projects/skyfield-ts/.venv-spice/bin/python scripts/export-spice-chebyshev.py \
  --mission selene \
  --mission-spk /home/sankar/sankar/projects/skyfield-ts/data/mirrors/selene/spk/SEL_M_071020_090610_SGMH_02.BSP \
  --aux-spk /home/sankar/sankar/projects/skyfield-ts/data/dev/showcase/de440.bsp \
  --lsk /home/sankar/sankar/projects/skyfield-ts/data/mirrors/naif/generic_kernels/lsk/latest_leapseconds.tls \
  --target -131 \
  --label SEL \
  --step-seconds 600 \
  --tolerance-km 5 \
  --end-utc 2009-06-10T18:25:00
```

Relative-mode command:

```bash
python scripts/generate-relative-orbits.py \
  --mission selene \
  --phase geo \
  --force \
  --source-cheb ../moon-mission-data/assets/selene/data/geo-SEL-cheb.json \
  --sample-step-seconds 600
```

Notes:
- The public DARTS main-orbit kernel starts after launch and the first lunar-orbit-insertion burn, so those events are preserved in config metadata even though they predate the first orbit sample.
- SELENE public kernels use an SPK type not currently handled by this checkout of `skyfield-ts`, so this mission is sampled with CSPICE and then compressed into the same runtime Chebyshev format.
