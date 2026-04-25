# CLAUDE.md

Assistant-facing notes for this repository.

## Source of truth

- Contributor/agent workflow: `AGENTS.md`
- Repo workflow/build/CI conventions: `docs/developer.md`
- System design and architecture docs: `docs/design/design.md`
- Test strategy and commands: `docs/guides/testing.md`

## Current project shape (important)

- Entry points:
  - `mission.html`
  - `index.html`
- Shared runtime code:
  - `src/platform/css/*`
  - `src/platform/js/*`
- Mission assets/config:
  - `assets/<mission>/data/config.json5` (source) + `config.json` (compiled runtime file)
  - `assets/<mission>/data/ephemeris-manifest.json`
- Shared authored landing content:
  - `assets/mission-briefs.json`
  - `assets/mission-images.json`

Do not use legacy paths like `assets/platform/js/*` in new changes.

## Runtime ephemeris behavior

- Runtime supports `chebyshev`, `npz`, `astronomy` body sources.
- Current mission configs are set to Chebyshev for `SC`, `MOON`, `EARTH`, and `SUN`.
- Relative mode uses precomputed `relative-<ID>-cheb.json` and is enabled by URL `mode=relative`.
- Multi-craft missions are supported via `crafts[]`, with CH3/CH2 as current examples.
- Compare mode (`mode=compare&compareMission=<other>`) overlays two missions in a single relative-frame scene and injects a synthetic compare craft `CMP_<MISSION>_<CRAFT>` into the primary's runtime. Reference: `docs/design/architecture/orbit-comparison-mode.md`.

## Testing quick reference

- Default UI + visual regression run:
  - `make test`
- Unit tests:
  - `npm run test:unit`
- Production smoke tests against sankara.net:
  - `npm run test:prod:missions`
  - Narrow to specific missions with `PROD_MISSION_FILTER='^(artemis2|chandrayaan3)$'`
- Baseline regeneration:
  - `make baseline`

SSIM thresholds and visual assertions are defined in `test/ui.test.js`.

## Mission controls UI

- On desktop, the header pill strip is the primary quick-control surface for origin/dimension/view toggles.
- The Settings panel remains a fallback/advanced surface and may be hidden in layouts where the pill strip is visible.
- Production/browser automation should prefer the visible pill controls before assuming `#settings-panel-button` is interactable.

## Mission config workflow

- Edit `config.json5`, then run `npm run configs:compile`.
- `config.json` must remain in sync (`npm run configs:check`).
- Current CI uses the stricter `npm run configs:lint` gate (sync + required `time_scale` annotations).

## CI quick reference

- `.github/workflows/ci.yml`: `npm run configs:lint` + `npm run test:unit`
- `.github/workflows/deploy.yml`: manual GitHub Pages deploy with staged data repo assets
- `.github/workflows/deploy-hetzner.yml`: manual Hetzner deploy + parity audit

## Production redirect rules

Production `sankara.net` is served by nginx on the Hetzner VPS. nginx does not
read `.htaccess`, so repo `.htaccess` files are inert on production and are kept
only for cache-header behavior on Apache-like hosts.

The live legacy mission redirect from:

- `/astro/lunar-missions/mission.html?mission=<slug>`

to:

- `/astro/lunar-missions/<slug>/`

is implemented outside this repo in nginx config on the Hetzner host:

- `/etc/nginx/conf.d/sankara-mission-redirects.conf`
- `/etc/nginx/sites-available/sankara.net`

Current production behavior:

- allowlisted mission slugs return a real server-side `301`
- unknown slugs and bare `mission.html` stay `200`
- `mission.html` in this repo remains a `noindex,follow` compatibility shell as
  defense in depth

When adding or renaming a mission slug:

1. Update the repo mission slug source, usually `assets/mission-catalog.json`.
2. Update the nginx allowlist on the Hetzner host in
   `/etc/nginx/conf.d/sankara-mission-redirects.conf`.
3. Validate and reload nginx:
   `sudo nginx -t && sudo systemctl reload nginx`

Verification commands:

```bash
curl -ILs "https://sankara.net/astro/lunar-missions/mission.html?mission=artemis2&view=relative&foo=1"
curl -ILs "https://sankara.net/astro/lunar-missions/mission.html?mission=bogus-unknown-slug"
curl -ILs "https://sankara.net/astro/lunar-missions/artemis2/"
```

Expected results:

- known legacy slug: `301` then `200`
- unknown legacy slug: `200`
- canonical clean URL: `200`

Future cleanup:

- generate the nginx slug map from repo mission data during deploy instead of
  maintaining the server allowlist separately

## Landing brief quick reference

- The mission selector/landing UI reads authored brief copy from `assets/mission-briefs.json`.
- Curated CC BY-SA image carousel entries live in `assets/mission-images.json`.
- The brief panel keeps the `Mission`, `HORIZONS Data`, and `Timelines` structure, with the image carousel displayed below the orbit preview.

## Data staging

Deploy/test workflows stage runtime data from `kvsankar/moon-mission-data` (or repo variable override) via:

- `scripts/stage-ephemeris-data.py`

Staged categories: orbit artifacts, orbit-style sidecars, shared images, mission screenshots, optional `third-party/`.
