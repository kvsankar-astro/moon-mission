# Performance Workstream

Last updated: 2026-05-16

This is the current workstream doc for animation responsiveness, panel interaction latency, and runtime optimization follow-ups.

## Authority Split

- Current optimization queue and next actions: this document
- Original 2026-05-16 investigation: [performance-regression-investigation-2026-05-16.md](performance-regression-investigation-2026-05-16.md)
- Live planning rollup: [current-plan.md](current-plan.md)
- Benchmark method and tooling: [../design/research/runtime-animation-benchmark.md](../design/research/runtime-animation-benchmark.md)
- Timeline/media playback behavior: [../design/specs/timeline-media-playback-spec.md](../design/specs/timeline-media-playback-spec.md)
- Panel behavior: [../design/specs/panel-system-v1-spec.md](../design/specs/panel-system-v1-spec.md)

## Current Findings

1. Mission Media and Broadcast panels can affect both clickability and main-thread work.
   - A panel can physically cover controls at some viewport/layout states.
   - Open media panels add render and media-element work during animation.
2. Hidden Earth/Moon guide overlays used to do per-frame camera work even when inactive.
   - This was fixed first.
3. The large lunar features catalog used to be statically imported.
   - It is now dynamic runtime data staged from `../moon-mission-data` and served through the public asset base.
4. The 1920x1080 desktop default is the intended primary optimization target.
   - Smaller viewports still matter, but default panel layout should be optimized around 1080p desktop behavior.

## Landed Mitigations

- Inactive Earth/Moon guide overlays now return early from camera-update work.
- `assets/lunar-features.json` moved to data repo/runtime asset delivery, loaded dynamically.
- The default desktop control panel sits fully above the timeline dock at 1920x1080.
- Mission Media render work has been split so playback-only ticks can update playback state without rebuilding the full panel structure.
- Focused Mission Media tests cover playback-only sync behavior.

## Pending Optimization Queue

1. Run Chrome Performance measurement on `/artemis2/`.
   - Compare panels closed, Mission Media open, Broadcast open/enabled, and high-speed playback.
   - Confirm whether the cache/render-split changes reduced long tasks and click delay.
2. Coalesce geometry and layout work.
   - Batch filter drawer placement, drilldown flyout placement, thumbnail reveal, and image transform/layout reads into scheduled frame work.
   - Only run placement when drawers/flyouts are open, active thumbnail needs reveal, or panel dimensions changed.
3. Coalesce media/HLS event rerenders.
   - Avoid immediate duplicate renders from HLS/video readiness events.
   - Schedule one pending rerender for a burst of media readiness events.
4. Add performance regression tests.
   - No structural Mission Media render on playback-only ticks.
   - No repeated registry sync on playback ticks.
   - Bounded Broadcast seek/startLoad calls.
   - No marker rebuild when media data is unchanged.
5. Run runtime smoke/performance check.
   - Start the local dev server.
   - Smoke `/artemis2/` with animation running.
   - Exercise Mission Media open, Broadcast open/enabled, and playback/frame controls.

## Regression Risks To Watch

- Play/frame controls becoming covered by timeline or panel hit areas.
- Media readiness events triggering multiple full renders.
- HLS state transitions causing repeated seek or start-load calls.
- Hidden panels or closed drawers doing layout work.
- Timeline marker rebuilds on unchanged media data.
- New work optimized for a narrow viewport while regressing the 1920x1080 default layout.

## Verification Notes

Use unit tests for deterministic render/state contracts, then use browser smoke/performance traces for actual click delay and frame-time behavior. Unit tests alone cannot prove the UI feels responsive under video/HLS load.
