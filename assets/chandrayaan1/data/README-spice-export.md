# Chandrayaan-1 DE440 Trimmed 60s Export

This folder uses a trimmed Chandrayaan-1 visualization window (through a short period after MIP impact), generated from mission SPK + `DE440`.

Source kernels:
- Mission SPK: `/home/sankar/sankar/projects/skyfield-ts-mission-kernel-postprocess/data/mirrors/chandrayaan1/spk/isro_full_mission_predict_00.bsp`
- Planetary SPK: `/home/sankar/sankar/projects/skyfield-ts-mission-kernel-postprocess/data/mirrors/naif/generic_kernels/spk/planets/de440.bsp`

Coverage:
- Start JD: `2454761.5498178634` (`2008-10-22T01:11:44.263Z`)
- End JD: `2454785.2922453703` (`2008-11-14T19:00:49.999Z`)
- Sampling cadence: `60` seconds

Commands run in `skyfield-ts-mission-kernel-postprocess`:

```bash
npx tsx scripts/export_spice_mission_ephemeris.ts \
  --mission-spk data/mirrors/chandrayaan1/spk/isro_full_mission_predict_00.bsp \
  --aux-spk data/mirrors/naif/generic_kernels/spk/planets/de440.bsp \
  --target -86 \
  --out-dir data/mirrors/chandrayaan1/ready-de440-60s-mipplus2orbits \
  --origins geo,lunar \
  --step-seconds 60 \
  --max-degree 8 \
  --tolerance-km 5 \
  --start-jd 2454761.549702123 \
  --end-jd 2454785.292361111 \
  --label CH1
```

```bash
npx tsx scripts/build_spice_mission_body_bundles.ts \
  --mission-spk data/mirrors/chandrayaan1/spk/isro_full_mission_predict_00.bsp \
  --aux-spk data/mirrors/naif/generic_kernels/spk/planets/de440.bsp \
  --out-dir data/mirrors/chandrayaan1/ready-de440-60s-mipplus2orbits \
  --label CH1 \
  --origins geo,lunar \
  --step-seconds 60 \
  --max-degree 8 \
  --tolerance-km 5 \
  --start-jd 2454761.5498178634 \
  --end-jd 2454785.2922453703
```

Files used by `moon-mission`:
- `geo-CH1-bodies-cheb.json` (+ `.gz`)
- `lunar-CH1-bodies-cheb.json` (+ `.gz`)
- `relative-CH1-cheb.json` (+ `.gz`)
- `ephemeris-manifest.json`

Relative build command in `moon-mission` (from body Chebyshev source):

```bash
python scripts/generate-relative-orbits.py \
  --mission chandrayaan1 \
  --phase geo \
  --force \
  --source-cheb assets/chandrayaan1/data/geo-CH1-bodies-cheb.json \
  --sample-step-seconds 60
```

Per-body segment counts:
- `geo-CH1-bodies-cheb.json`: `SC=207`, `MOON=3`, `EARTH=1`, `SUN=2`
- `lunar-CH1-bodies-cheb.json`: `SC=201`, `MOON=1`, `EARTH=3`, `SUN=3`

SHA-256:
- `0098416d36dd5484f4f521099de6dcd8baa1900679c7ebbfb3d8b82f2bf41325`  `geo-CH1-bodies-cheb.json`
- `099d6d0849f3f87dbe6fa2aaf7c4cd1bc20a8d25befd97bacd55db0f0a8620f8`  `lunar-CH1-bodies-cheb.json`
- `7b5eec490ad061370f0b8c9c931cead6b41770306c53f282f801535f43cc5e08`  `geo-CH1-bodies-cheb.json.gz`
- `5940448b2e0bd6e1fe967b394b39d27dc1b6089445bd54b126989b6bdb07c60d`  `lunar-CH1-bodies-cheb.json.gz`
- `7a9df2fd3e4bd29f23a9bdd7971bcc9bcac3c1539b6d73aa011d45c4e3a18039`  `relative-CH1-cheb.json`
- `99074df1d5da9c187204017e464652e69e56dee81debb38a2d67bc5f961fdfe8`  `relative-CH1-cheb.json.gz`
