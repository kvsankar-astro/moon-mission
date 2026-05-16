# Current Plan

Last updated: 2026-05-16

This is the live planning surface for active work. Feature docs, investigations, and handoff notes may explain context, but open TODOs should roll up here or into a linked workstream doc.

## Active Workstreams

- Artemis II media, stream sync, transcript, attribution, and launch media work: [artemis2-media-workstream.md](artemis2-media-workstream.md)
- Performance, responsiveness, and optimization follow-ups: [performance-workstream.md](performance-workstream.md)
- Timekeeping, mission-clock sync, UTC/TDB, and media clock mapping: [../design/architecture/time-synchronization-and-timekeeping.md](../design/architecture/time-synchronization-and-timekeeping.md)

## Parking Lot

These items came from the 2026-05-16 context switch. Treat them as queued work, not necessarily started.

| Item | Status | Owning Doc |
|------|--------|------------|
| Move Moon render work to a branch. Current Moon render changes are risky to keep on `master`; issues were visible during smoke testing. | Open | [moon-render-assets.md](moon-render-assets.md) |
| Investigate Flyby Broadcast panel going totally dark. | Open | [artemis2-media-workstream.md](artemis2-media-workstream.md) |
| Fix Media panel overlap with events. | Open / partly mitigated by default-layout work | [performance-workstream.md](performance-workstream.md) |
| Adjust Earth exposure during lunar eclipse so it cuts down to normal when only Earth is in view. | Open | [../design/specs/frame-and-shoot-lighting-exposure-spec.md](../design/specs/frame-and-shoot-lighting-exposure-spec.md) |
| Integrate diarization artifacts. | Open | [artemis2-media-workstream.md](artemis2-media-workstream.md) |
| Change crater search and filter settings. | Open | [lunar-feature-and-artemis2-reference-sources.md](lunar-feature-and-artemis2-reference-sources.md) |
| Explore diarization -> LLM -> search and other AI-assisted discovery features. | Open | [artemis2-media-workstream.md](artemis2-media-workstream.md) |
| Fix play, media, and control bugs. | Open | [performance-workstream.md](performance-workstream.md) |
| Add attribution page for Hank Green, NASA media files, and other required media/source credits. | Open | [artemis2-media-workstream.md](artemis2-media-workstream.md) |
| Prepare blog post, Reddit post, email to Hank, and related launch communications. | Open | [artemis2-media-workstream.md](artemis2-media-workstream.md) |
| Plan deployment and testing, including SSIM testing and broader regression testing. | Open | [performance-workstream.md](performance-workstream.md) |

## Optimization Queue

The performance workstream owns these items. They are listed here so active planning has one entry point.

1. Run Chrome Performance measurement on `/artemis2/`.
   - Compare panels closed, Mission Media open, Broadcast open/enabled, and high-speed playback.
   - Use the trace to confirm whether the recent cache/render-split changes reduced long tasks and click delay.
2. Coalesce geometry and layout work.
   - Batch `syncFilterDrawerPlacement`, `syncDrilldownFlyoutPlacement`, thumbnail reveal, and image transform/layout reads into scheduled frame work.
   - Only run placement when drawers/flyouts are open, active thumbnail needs reveal, or panel dimensions changed.
3. Coalesce media/HLS event rerenders.
   - Avoid immediate duplicate renders from HLS/video readiness events such as manifest parsed, level loaded, canplay, and loadedmetadata.
   - Schedule one pending rerender for a burst of media readiness events.
4. Add performance regression tests.
   - Assert no structural Mission Media render on playback-only ticks.
   - Assert no repeated registry sync on playback ticks.
   - Assert bounded Broadcast seek/startLoad calls.
   - Assert no marker rebuild when media data is unchanged.
5. Run runtime smoke/performance check.
   - Start the local dev server and smoke `/artemis2/` with animation running.
   - Exercise Mission Media open, Broadcast open/enabled, and playback/frame controls.

## Reference Notes

- Original dated parking lot: [open-todos-2026-05-16.md](open-todos-2026-05-16.md)
- Dryscope consolidation findings: [docs-consolidation-dryscope-2026-05-16.md](docs-consolidation-dryscope-2026-05-16.md)
