# Test Requirements Documentation

This file is the index for test documentation and assets in this repository.

## Documentation In `docs/testing/`

- **`README.md`**: Practical guide for running tests and working with SSIM baselines.
- **`test-specification.md`**: Detailed expected behavior and test-case intent for the CY3 UI/visual suite.
- **`test-ids-reference.md`**: Naming reference for test IDs and screenshot IDs.
- **`config.md`**: Notes about files under `test/config/`.

## Test Suites In `test/`

- **`ui.test.js`**: Main UI + visual regression suite (Vitest + Playwright + SSIM).
- **`mission-smoke.test.js`**: Functional smoke coverage for non-CY3 missions across mode combinations (no screenshot comparison).
- **`chebyshev-accuracy.test.js`**: Data-accuracy acceptance tests for Chebyshev/NPZ comparisons; some describe-blocks are skipped automatically when required NPZ data files are unavailable.

## Runtime Configuration And Artifacts

- Base URL is controlled by `VITE_TEST_BASE_URL` (default `http://localhost:8111` in tests).
- Test server helper: `test/server-manager.js`.
- `test/config/directional-controls-baseline.json` exists as a legacy config artifact and is not currently consumed by `ui.test.js`.

### Screenshot/SSIM files (`test/screenshots/`)

- `baseline/`: committed visual baselines (tracked).
- `current/`, `diff/`, `analysis/`: runtime artifacts (ignored).
- `ssim-history.json`: committed SSIM reference (tracked).
- `ssim-latest.json`: latest run SSIM scores (ignored).
- `ssim-diff-report.json` / `ssim-diff-report.csv`: generated reports (ignored).

### Reports

- `test/reports/` contains generated logs/reports and is git-ignored.

## Source-Of-Truth Rule

If documentation and code diverge, treat test code and config as source of truth:

- `test/ui.test.js`
- `test/mission-smoke.test.js`
- `test/chebyshev-accuracy.test.js`
- `.gitignore` test artifact rules

Then update docs to match.

## Maintenance Checklist

- When adding/removing test suites, update this file and `docs/testing/README.md`.
- When adding/removing docs in `docs/testing/`, update the "Documentation" section above.
- Avoid referencing non-existent research files from this document.
