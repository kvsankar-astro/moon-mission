# Gemini Code Assistant Notes

This file provides Gemini-oriented project context aligned with the current codebase.

## Primary references

- Workflow/conventions: `AGENTS.md`
- Repo workflow/build/CI conventions: `docs/developer.md`
- System design and architecture docs: `docs/design/design.md`
- Canonical runtime architecture/refactor record: `docs/design/architecture/target-architecture.md`
- Test strategy: `docs/guides/testing.md`

## Current code layout

- HTML entry points:
  - `mission.html`
  - `index.html`
- Shared app code:
  - `src/platform/js/`
  - `src/platform/css/`
- Mission-specific assets:
  - `assets/<mission>/data/` (`config.json5` source + compiled `config.json`)
  - `assets/<mission>/images/`
  - `assets/<mission>/models/`
- Shared authored landing content:
  - `assets/mission-briefs.json`
  - `assets/mission-images.json`

Avoid legacy assumptions such as `chandrayaan3.html` or `assets/platform/js/*`.

## Running locally

```bash
npm install
npm run dev
```

Open:

`http://localhost:7274/mission.html?mission=chandrayaan3`

## Orbit data workflow

Preferred end-to-end mission pipeline:

```bash
python scripts/run-mission-pipeline.py --missions <mission>
```

Manual recovery/partial rerun steps remain available:

```bash
python scripts/orbits.py --mission <mission>
python scripts/compress-orbits.py --mission <mission>
python scripts/generate-relative-orbits.py --mission <mission> --force
python scripts/compress-chebyshev-gzip.py --mission <mission> --force
```

Runtime defaults currently use Chebyshev for all key bodies (`SC`, `MOON`, `EARTH`, `SUN`), with provider support still present for `npz` and `astronomy`.
Multi-craft missions are supported through `crafts[]` in mission config, with CH3/CH2 as current proving cases.

Mission config workflow:
- edit `config.json5`
- run `npm run configs:compile`
- validate with `npm run configs:check`
- use `npm run configs:lint` before push when config timing/phase/event structure changed; CI runs that stricter check

## Landing brief notes

- Landing-page mission briefs use authored offline text from `assets/mission-briefs.json`.
- Curated CC BY-SA image carousel entries live in `assets/mission-images.json`.
- The panel structure is `Mission`, `HORIZONS Data`, and `Timelines`, with the image carousel rendered below the orbit preview.

## CI / deploy notes

- `.github/workflows/ci.yml` runs `npm run configs:lint` and `npm run test:unit` on push, pull request, and manual dispatch.
- `.github/workflows/deploy.yml` and `.github/workflows/deploy-hetzner.yml` are manual-only deploy workflows.
- Deploy/test staging pulls runtime data, including orbit-style sidecars, from `moon-mission-data`.
