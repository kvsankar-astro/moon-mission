# Testing (UI + Visual Regression)

This project uses Vitest + Playwright for automated UI testing, with SSIM-based visual regression (robust against minor anti-aliasing differences).

## Quick Start

```bash
npm install
make test
```

## What Runs

- **Main UI suite**: `test/ui.test.js` (currently 48 tests)
- **Smoke suite**: `test/mission-smoke.test.js` (loads multiple missions/configs; asserts no console/page errors)
- **SSIM tracking**: committed SSIM baseline in `test/screenshots/ssim-history.json` + latest-run scores in `test/screenshots/ssim-latest.json` (git-ignored)

## Running Tests

Recommended (manages the test server on port 8111):

```bash
make test
```

If you already have a server running:

```bash
# Default baseUrl is http://localhost:8111
npx vitest test/ui.test.js --run

# Override server URL if needed
HEADLESS=true VITE_TEST_BASE_URL=http://localhost:8000 npx vitest test/ui.test.js --run
```

Manual server management (no `make` required):

```bash
node test/server-manager.js start
HEADLESS=true VITE_TEST_BASE_URL=http://localhost:8111 npx vitest test/ui.test.js --run
node test/server-manager.js stop
```

## Baselines and SSIM

- Baselines live in `test/screenshots/baseline/` (tracked by git).
- Each run writes current screenshots to `test/screenshots/current/`.
- If a baseline image is missing, the current screenshot is copied into baseline (convenient for adding new tests).
- Regenerate all baselines (intentional visual changes):

```bash
make baseline
```

SSIM baseline (`test/screenshots/ssim-history.json`) stores:
- `committed`: SSIM scores from the committed baseline (reference for drift)
- `committedAt`: timestamp for when the baseline was recorded

Latest-run SSIM scores are written to `test/screenshots/ssim-latest.json` (git-ignored).

## File Layout (Relevant)

```
	test/
	├── ui.test.js
	├── mission-smoke.test.js
	├── server-manager.js
	└── screenshots/
	    ├── baseline/          # committed reference images
	    ├── current/           # latest run screenshots (usually git-ignored)
	    ├── diff/              # optional/manual artifacts (not required by ui.test.js)
	    ├── ssim-history.json  # committed SSIM baseline (tracked)
	    └── ssim-latest.json   # latest-run SSIM scores (ignored)
	```

## Troubleshooting

- **Port conflicts**: tests default to `http://localhost:8111`; stop existing servers or override `VITE_TEST_BASE_URL`.
- **Slow rendering / timeouts**: try `HEADLESS=false` for debugging, or set `CI=true` to use longer timeouts.
- **Baseline mismatch**: if the visual change is intentional, regenerate baselines with `make baseline`.
