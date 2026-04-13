# Panel System V1 Implementation Plan

> Implementation note: the current V1 target is no standalone `Panel Manager` panel. The lifecycle surface is being simplified to a header `Panels` menu plus minimized chips, with the registry/persistence work retained underneath.

## Immediate Sequence

1. Land the design spec and baseline the current UI with SSIM tests.
2. Introduce shared panel data helpers and lifecycle vocabulary without changing panel visuals yet.
3. Build a lightweight `Panels` launcher and minimized-chip restore path.
4. Migrate existing panel metadata into the new registry.
5. Incrementally move auxiliary panels and splashdown panel onto shared shell behavior.
6. Add `Create View`, rename, info, close, and delete actions.
7. Persist per-mission layouts and validate restore behavior.

## First Implementation Slice

The first code slice should create the minimum shared panel foundation that can coexist with current code:

- add shared panel-state helpers
- add a lightweight `Panels` launcher surface
- expose current auxiliary panels and splashdown panel to the launcher as tracked instances
- support minimized chips without a dedicated manager panel
- keep existing panel rendering logic in place for now

This keeps the initial change set focused while giving the app a new central place to manage lifecycle.

## Migration Notes

- Auxiliary camera panels already have partial layout state and minimized chip behavior. Reuse these concepts, but move toward a mission-scoped panel layout model.
- Splashdown panel currently duplicates drag and placement logic. It should be one of the first consumers of shared shell behavior after the manager lands.
- Mission config-driven defaults now hang off `ui.panels.defaults`, keyed by panel registry id, so built-in panel availability/default state is mission-owned rather than hardcoded in panel modules.

## Verification Approach

- Run `make test` before implementation as the baseline.
- After each major panel migration slice, rerun targeted UI checks.
- When shell styling changes land, rerun full SSIM coverage and update baselines only if the visual change is intentional.
