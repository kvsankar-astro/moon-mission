# SMART-1 SPICE Export

This mission uses public ESA SPICE kernels sampled with `scripts/export-spice-chebyshev.py`.

Primary source kernels:
- `ORMS__041111020517_00206.BSP`
- `ORMS_______________00233.BSP`
- `DE440`
- `latest_leapseconds.tls`

Coverage used here:
- Start UTC: `2004-11-11T02:04:13.797Z`
- End UTC: `2006-09-03T05:42:22Z`
- Sampling cadence: `600` seconds

Command run:

```bash
/home/sankar/sankar/projects/skyfield-ts/.venv-spice/bin/python scripts/export-spice-chebyshev.py \
  --mission smart1 \
  --mission-spk /home/sankar/sankar/projects/skyfield-ts/data/mirrors/smart1/spk/ORMS__041111020517_00206.BSP \
  --mission-spk /home/sankar/sankar/projects/skyfield-ts/data/mirrors/smart1/spk/ORMS_______________00233.BSP \
  --aux-spk /home/sankar/sankar/projects/skyfield-ts/data/dev/showcase/de440.bsp \
  --lsk /home/sankar/sankar/projects/skyfield-ts/data/mirrors/naif/generic_kernels/lsk/latest_leapseconds.tls \
  --target -238 \
  --label SM1 \
  --step-seconds 600 \
  --tolerance-km 5 \
  --end-utc 2006-09-03T05:42:22
```

Relative-mode command:

```bash
python scripts/generate-relative-orbits.py \
  --mission smart1 \
  --phase geo \
  --force \
  --source-cheb ../moon-mission-data/assets/smart1/data/geo-SM1-cheb.json \
  --sample-step-seconds 600
```

Notes:
- Public mission SPICE coverage in this workflow begins during the reconstructed lunar phase, after launch and transfer.
- The earlier Chandrayaan-1 precedent for SPICE conversion remains documented in `assets/chandrayaan1/data/README-spice-export.md`.
- SMART-1 public kernels use SPK types not currently handled by this checkout of `skyfield-ts`, so this mission is sampled with CSPICE and then compressed into the same runtime Chebyshev format.
