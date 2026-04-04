# Repository Guidelines

## Project Structure & Module Organization

- Agent/Contributor reference docs:
  - `docs/developer.md` (repo workflow, commands, CI, conventions)
  - `docs/design/design.md` (system design and architecture map)
- Entry points: `mission.html` (mission selector + app; shows landing view when `mission` is omitted), `index.html` (landing page).
- Shared platform code: `src/platform/` (`css/` + `js/` ES modules).
- Shared authored landing content: `assets/mission-briefs.json`, `assets/mission-images.json`.
- Mission content: `assets/<mission>/`
  - `data/` (`config.json5` source + compiled `config.json`, `ephemeris-manifest.json`; staged runtime data may also include `*-cheb.json`, `*-meta.json`, `*-style.json`)
  - `models/`, `images/`, optional `js/`, `html/`
- Shared media: `images/` (Earth/Moon/sky textures), `third-party/` (vendored libs).
- Tooling: `scripts/` (Python data/build/deploy utilities).
- Tests: `test/` (Vitest + Playwright UI tests, screenshot baselines).

## Data Repo Boundary

- Runtime app code, mission config, and UI assets are worked on in this repo.
- Generated ephemeris artifacts such as `*-cheb.json`, `*-cheb.json.gz`, `*.npz`, `*-meta.json`, and authored orbit-style sidecars like `geo-style.json` / `lunar-style.json` are tracked in the sibling repo `../moon-mission-data`, not here.
- If you regenerate orbit/ephemeris files locally while working in `moon-mission`, sync and commit those generated files in `moon-mission-data`.
- Do not assume a regenerated file under `assets/<mission>/data/` in this repo is tracked here; verify with `git ls-files` before committing.

## Build, Test, and Development Commands

- `npm install` — install JS dependencies.
- `npm run dev` — run Vite dev server (default `http://localhost:7274/`).
- `npm run configs:bootstrap` — create `assets/*/data/config.json5` from existing `config.json` (one-time/backfill utility).
- `npm run configs:compile` — compile all `config.json5` files into runtime `config.json`.
- `npm run configs:check` — verify `config.json` files are in sync with `config.json5` (CI-safe).
- `npm run hooks:install` — set `core.hooksPath` to `.githooks` to enable local pre-commit checks.
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
- Deploy workflows are manual-only; pushing does not publish to GitHub Pages or sankara.net by itself.
