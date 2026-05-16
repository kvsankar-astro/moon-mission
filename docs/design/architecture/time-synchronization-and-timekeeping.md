# Time Synchronization And Timekeeping

Last updated: 2026-05-16

This document is the hub for mission-clock semantics across ephemeris data, event navigation, media playback, broadcast stream sync, and transcript timing.

## Why This Exists

Time questions currently appear in several places:

- UTC/TDB and eclipse timing investigations
- mission event timestamps
- media timeline playback
- long-form broadcast stream anchors
- diarized transcript timestamps
- compare and relative modes

Those are related but not identical. This document defines the vocabulary and points to the authoritative detail docs.

## Time Domains

| Domain | Meaning | Typical Source | Notes |
|--------|---------|----------------|-------|
| UTC | Civil timestamp used by mission events, source publications, and user-facing labels. | mission configs, HORIZONS outputs, NASA references | Preferred display/reference time unless a source requires otherwise. |
| TDB / ephemeris time | Dynamical time used by ephemeris calculations. | astronomy/HORIZONS/SPICE-like data | Must not be silently substituted for UTC in UI or event logic. |
| Mission elapsed time | Duration relative to a mission launch epoch. | mission-specific source material | Useful for broadcast/NASA operational references. |
| Animation time | Runtime mission clock used by the app. | animation controller and timeline state | This is the UI authority for scene state. |
| Media item time | Timestamp or interval for discrete images, audio, and short videos. | `mediaItems[]` metadata | Resolved against mission chronology. |
| Stream video time | Seconds relative to the start of a long-form video stream. | HLS/video element | Needs explicit mapping to mission time. |
| Transcript time | Seconds or HH:MM:SS relative to the source transcript part. | generated transcript artifacts | Needs offset/mapping before synchronized runtime use. |

## Runtime Rules

1. Mission animation time is the runtime source of truth for scene state.
2. Discrete media selection may request a mission-time seek, but media does not create an independent mission clock.
3. Long-form streams need an explicit stream-video-time to mission-time mapping.
4. Broadcast mappings may be piecewise. Do not assume one global offset unless anchors prove it.
5. Transcript segment times are source-relative until converted into a manifest or sidecar with an explicit time base.
6. Compare mode uses aligned/derived time and should not automatically expose real mission media unless a feature explicitly defines those semantics.
7. UTC/TDB conversion decisions should be documented at the data boundary and surfaced in tests for event-sensitive behavior.

## Canonical Detail Docs

- Timeline/media playback behavior: [../specs/timeline-media-playback-spec.md](../specs/timeline-media-playback-spec.md)
- Artemis II media workstream: [../../operations/artemis2-media-workstream.md](../../operations/artemis2-media-workstream.md)
- Artemis II stream anchor ledger: [../../operations/artemis2-video-sync-anchors.md](../../operations/artemis2-video-sync-anchors.md)
- Artemis II transcription handoff: [../../operations/artemis2-transcription-diarization-handoff.md](../../operations/artemis2-transcription-diarization-handoff.md)
- Eclipse timing investigation: [../../investigations/eclipse-timing-tdb-2026-04.md](../../investigations/eclipse-timing-tdb-2026-04.md)
- Commit review for TDB/time-scale behavior: [../../investigations/commit-review-tdb-timescale-2026-04-08.md](../../investigations/commit-review-tdb-timescale-2026-04-08.md)
- Chebyshev format and ephemeris transport: [chebyshev-format-spec.md](chebyshev-format-spec.md)

## Open Questions

- Where should finalized stream segment maps live: inside `media-manifest.json5` or as data repo sidecars?
- Should transcript tracks use video-relative seconds, mission UTC, or both?
- What UI should expose uncertain or piecewise stream sync?
- Which tests should be the canonical guard for event UTC/TDB regressions?
