# Repository Guidelines

## Project Structure & Module Organization

- Entry points: `mission.html` (mission selector + app), `index.html` (redirect).
- Shared platform code: `src/platform/` (`css/` + `js/` ES modules).
- Mission content: `assets/<mission>/`
  - `data/` (`config.json`, `*-cheb.json`, `*-meta.json`)
  - `models/`, `images/`, optional `js/`, `html/`
- Shared media: `images/` (Earth/Moon/sky textures), `third-party/` (vendored libs).
- Tooling: `scripts/` (Python data/build/deploy utilities).
- Tests: `test/` (Vitest + Playwright UI tests, screenshot baselines).

## Build, Test, and Development Commands

- `npm install` — install JS dependencies.
- `npm run dev` — run Vite dev server (default `http://localhost:7274/`).
- `make test` — recommended UI test run (starts server on `8111`, runs Vitest, stops server).
- `make baseline` — regenerate visual baselines (use only when changes are intentional).
- `python scripts/build.py` — create a deployable static folder in `dist/`.

## Coding Style & Naming Conventions

- JavaScript (ES modules) lives under `src/platform/js/` and `assets/<mission>/js/`.
- Keep diffs focused; avoid reformat-only changes unless necessary.
- Prefer small, single-purpose modules and pure functions where practical.
- Tests are `*.test.js` under `test/`.

## Testing Guidelines

- Frameworks: Vitest + Playwright; visual regression uses SSIM comparisons.
- Baselines are tracked in `test/screenshots/baseline/`; `current/`, `diff/`, and latest-run SSIM output are git-ignored.
- If you change visuals intentionally, update baselines and explain why in the PR.

## Commit & Pull Request Guidelines

- Commit messages in this repo are short and imperative; common patterns include `docs: ...`, `Add ...`, `Refactor ...`.
- PRs should include: what changed, how to test (commands + URLs), and screenshots/gifs for UI changes (plus baseline update rationale if applicable).

## Security & Configuration Tips

- Don’t commit credentials or deployment config: `deploy-config.json` is intentionally git-ignored.
- Don’t commit generated artifacts: `dist/`, `data-generated/`, `.test-server.*`, and `node_modules/` are ignored by design.
