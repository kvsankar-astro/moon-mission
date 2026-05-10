# Critical Review: `wip/moon-render-terminator-isolation`

Date: 2026-05-10

Worktree: `C:\sankar\projects\moon-mission-moon-render`

Reviewed range: `master...wip/moon-render-terminator-isolation`

Branch head reviewed: `5beb670 Add numeric unit tests for moon Sun-disk visible-area formula`

Review method:
- Local source review of runtime shader, normal-map, texture/profile, aux panel, tests, and new tuning scripts.
- Subagent rendering/math review.
- Subagent integration/test review.
- Verification commands listed below.

## Summary

The branch adds substantial moon-rendering tuning, a smooth Sun-disk visibility term on the unperturbed lunar normal, half-float generated normal maps, composer/main-scene presentation parity work, deferred normal-map redraw fixes for profile switching, new moon tuning scripts, research notes, and focused tests.

The branch is test-green, but the review found several merge-risk issues. The most serious are shader-side: the Sun-disk subtraction reconstructs the Sun contribution after three.js has already applied shadow attenuation, and several later dark-side multipliers still affect earthshine/ambient light despite the new comments describing the visibility correction as Sun-only. There are also integration risks around startup deferred-normal-map redraw, fast-profile photo/composer overrides, aux WebGL fallback behavior, and `flipY=false` normal-map sign handling.

## Findings

### P1: Sun-disk correction ignores shadow attenuation and can subtract too much light

File: `src/platform/js/rendering/moon-renderer.js:253`

The shader reconstructs the Sun's Lambert contribution from `directionalLights[0].color`, `moonNdotL`, and `material.diffuseColor`, then subtracts `(1 - moonSunVisibility)` from `reflectedLight.directDiffuse`.

Three.js applies directional shadow attenuation inside the directional-light loop before adding to `reflectedLight.directDiffuse`. This reconstruction bypasses that shadow factor. In shadowed or partially shadowed pixels, the correction can subtract more Sun light than was actually added, which can push `directDiffuse` negative near the terminator.

Suggested fix: apply the visibility multiplier inside the directional-light path using the shadowed `directLight.color`, or explicitly include the same `getShadow(...)` factor when reconstructing directional light 0.

### P1/P2: Earthshine and indirect light are still globally crushed after the Sun-only visibility correction

Files:
- `src/platform/js/rendering/moon-renderer.js:237`
- `src/platform/js/rendering/moon-renderer.js:393`

The new comment says earthshine should survive across the terminator, and the visibility correction itself is applied only to the reconstructed Sun term. However, later multipliers still operate on accumulated lighting:

- `moonTerminatorScale` and other tone terms multiply `reflectedLight.directDiffuse`, which includes reflected-light directional contributions.
- `moonFinalShadowCrush` multiplies final `outgoingLight`, affecting direct earthshine, indirect diffuse, ambient fill, and emissive terms.

With the new floor of `0.18`, crescent/night-side earthshine can still be suppressed exactly where the branch is trying to isolate direct Sun terminator behavior.

Suggested fix: separate solar and non-solar accumulators, or avoid applying final dark-side crush to non-solar/indirect terms. The Sun-only guarantee should cover all terminator and phase multipliers, not only `moonSunVisibility`.

### P1: Initial high-resolution texture load still misses the deferred normal-map redraw

File: `src/platform/js/app/scene-3d-init-actions.js:74`

The explicit Standard/Detailed profile switch path forwards the new `requestRender` hook, but startup still calls:

```js
applyAndRefreshSceneTextures(scene, resolvedTextures, { disposePrevious: true })
```

For Artemis II's quality-profile startup path, the generated normal map can rebuild on idle without triggering the on-demand render loop. The upgraded normal map may not become visible until the next user interaction.

Related lifecycle risk: `src/platform/js/app/scene-texture-actions.js:153` schedules an idle callback that later calls `scene.moonRenderer.refreshGeneratedNormalMap(...)` without capturing/guarding the renderer instance. A scene/profile change before the idle callback can make the callback stale.

Suggested fix: pass `{ disposePrevious: true, requestRender: render }` from startup, capture the renderer before scheduling, and guard with `if (scene.moonRenderer !== renderer) return;`.

### P2: Photo/composer "no-op" moon overrides only match the quality profile

Files:
- `src/platform/js/core/domain/flyby-lighting-presentation.js:68`
- `src/platform/js/app/moon-render-asset-profiles.js:6`
- `src/platform/js/app/photo-mode-render-presentation.js:130`

`computePhotoModeLightingPresentation()` hard-codes the moon presentation fields to the quality defaults. The branch comments describe this as a no-op, but the fast profile uses different values, including `highlightBoost`, `shadowWeightExponent`, `terminatorReliefStrength`, `terminatorShadowFloor`, and `terminatorIndirectOcclusion`.

Because photo/composer presentation writes those fields onto the moon material, Standard/Fast profile renders are silently retuned instead of being visual no-ops.

Suggested fix: either stop writing moon photometric overrides when the intended behavior is a no-op, or derive the values from the active material/profile settings. Add a fast-profile test asserting the moon material fields remain unchanged.

### P2: Normal-map Y sign fix does not account for `heightTexture.flipY === false`

File: `src/platform/js/rendering/moon-normal-map.js:131`

The new tangent-space green-channel sign assumes the height texture uploads with `flipY=true`, while the generated normal texture explicitly inherits `heightTexture.flipY !== false`.

For any non-flipped height texture, the Y sign should be different. Otherwise crater slopes can invert north/south for that source.

Suggested fix: derive the Y sign from `heightTexture.flipY !== false`, and add a small normal-map test with `flipY=false` that checks decoded green-channel direction.

### P2: Aux panel renderer now requires antialiasing without the main renderer fallback path

Files:
- `src/platform/js/app/auxiliary-camera-views.js:2728`
- `src/platform/js/app/scene-handler-init.js:16`

Aux panels now construct `WebGLRenderer({ antialias: true })`. The main renderer tries antialiasing first but has fallback attempts for lower-cost contexts. Aux panel creation catches failure by removing the panel, so low-end or context-constrained browsers can silently lose composer/Craft-to-Moon panels.

Suggested fix: reuse the main renderer's fallback strategy for aux renderers, or make antialias conditional. Add a unit test with a fake `WebGLRenderer` that throws for `{ antialias: true }` and succeeds on fallback.

### Coverage note: GLSL formula test is useful but duplicated

File: `test/moon-sun-disk-visibility.test.js:3`

The new numeric test reproduces the GLSL formula in JavaScript. It catches formula/sign mistakes in the copied function, but it will not catch drift between `moon-renderer.js`, `moon-render-tuner.js`, and the test unless future edits keep all copies synchronized.

Suggested fix: extract shared constants/formula text where practical, or add shader-source assertions for both renderer and tuner.

## Positive Notes

- The branch includes focused unit coverage for the Sun-disk visible-area formula and shader-source assertions that the correction is not a blind `directDiffuse *= moonSunVisibility`.
- The profile-switch redraw fix closes a real on-demand-render-loop issue for interactive Standard/Detailed switching.
- The code is careful about program-cache-key invalidation for the shader changes.
- Research notes provide unusually good context for the rendering model and tradeoffs.

## Verification

Commands run locally in `C:\sankar\projects\moon-mission-moon-render`:

```powershell
git diff --check master...wip/moon-render-terminator-isolation
npm run configs:lint
npm run test:unit
```

Results:
- `git diff --check`: passed.
- `npm run configs:lint`: passed. All compiled mission artifacts are in sync and time-scale lint passes.
- `npm run test:unit`: passed. 172 test files, 1023 tests passed, 31 skipped.

Subagents also ran focused Vitest subsets and `configs:check`, all passing.

Not run:
- Playwright UI smoke/visual regression.
- `make test`.
- Browser screenshot verification of the shader changes.
- The new `scripts/moon-tune/*.mjs` probes, which require a running Vite server and visual/runtime inspection.

## Merge Note

This report was written before merging the branch. The branch is mechanically test-green, but the P1 findings above should be treated as follow-up work before relying on the new rendering behavior in production screenshots or visual baselines.
