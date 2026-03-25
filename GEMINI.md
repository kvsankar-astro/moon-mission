# Gemini Code Assistant Notes

This file provides Gemini-oriented project context aligned with the current codebase.

## Primary references

- Workflow/conventions: `AGENTS.md`
- Architecture/data pipeline: `docs/developer.md`
- Test strategy: `docs/testing/README.md`

## Current code layout

- HTML entry points:
  - `mission.html`
  - `index.html`
- Shared app code:
  - `src/platform/js/`
  - `src/platform/css/`
- Mission-specific assets:
  - `assets/<mission>/data/`
  - `assets/<mission>/images/`
  - `assets/<mission>/models/`

Avoid legacy assumptions such as `chandrayaan3.html` or `assets/platform/js/*`.

## Running locally

```bash
npm install
npm run dev
```

Open:

`http://localhost:7274/mission.html?mission=cy3`

## Orbit data workflow

```bash
python scripts/orbits.py --mission <mission>
python scripts/compress-orbits.py --mission <mission>
python scripts/generate-relative-orbits.py --mission <mission>
```

Runtime defaults currently use Chebyshev for all key bodies (`SC`, `MOON`, `EARTH`, `SUN`), with provider support still present for `npz` and `astronomy`.
