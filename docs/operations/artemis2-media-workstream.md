# Artemis II Media Workstream

Last updated: 2026-05-16

This is the current workstream doc for Artemis II mission media, long-form broadcast streams, video sync anchors, transcripts, attribution, and launch communications. Detailed specs and handoffs remain in their original docs, but active decisions and next actions should roll up here.

## Authority Split

- Current work and decisions: this document
- Runtime media asset model and update workflow: [artemis2-media-assets.md](artemis2-media-assets.md)
- Long-form HLS packaging and hosting details: [../artemis2-media-streaming.md](../artemis2-media-streaming.md)
- Stream anchor ledger: [artemis2-video-sync-anchors.md](artemis2-video-sync-anchors.md)
- Transcript and diarization handoff: [artemis2-transcription-diarization-handoff.md](artemis2-transcription-diarization-handoff.md)
- Product and architecture roadmap: [../design/roadmap/artemis2-media-timeline-plan.md](../design/roadmap/artemis2-media-timeline-plan.md)
- Playback behavior spec: [../design/specs/timeline-media-playback-spec.md](../design/specs/timeline-media-playback-spec.md)
- Timekeeping and clock semantics: [../design/architecture/time-synchronization-and-timekeeping.md](../design/architecture/time-synchronization-and-timekeeping.md)

## Current Runtime State

- Artemis II has a config-gated `workflow:media-browser` Mission Media panel.
- Authored media metadata lives in `assets/artemis2/data/media-manifest.json5`; runtime consumes compiled `media-manifest.json`.
- Discrete images, short videos, and audio clips are normalized through the media domain modules and coordinated by `media-timeline-coordination.js`.
- Mission Media is disabled in compare mode because media uses real mission chronology.
- Long-form stream metadata exists in the manifest, but production readiness depends on hosting verification, stream sync validation, and panel/playback behavior.

## Current Decisions

- Media metadata belongs in this app repo when it is authored mission metadata.
- Generated thumbnails, large stream payloads, and generated transcript artifacts belong in `../moon-mission-data` or external generated-data storage unless deliberately promoted as authored metadata.
- Long-form stream delivery should use object storage/CDN, with repository-relative paths in manifests and runtime resolution through the public asset base.
- Stream timing should be piecewise, not one global offset, because observed broadcast anchors are not globally linear.
- Rich transcript/diarization data should be JSON track data referenced from the manifest, not overloaded into the current simple `captions` string-array field.

## Active TODOs

1. Investigate Flyby Broadcast panel going totally dark.
   - Confirm whether this is media element state, HLS loading state, panel lifecycle, z-index/visibility, or source URL failure.
   - Add a targeted regression once the failure mode is understood.
2. Upload and verify the long-form HLS stream.
   - Upload `assets/artemis2/media/streams/lunar-flyby/v1/` from the data workspace to the public media host.
   - Verify `.m3u8`, `.m4s`, `.mp4`, and `.vtt` content types.
   - Verify CORS and cache behavior through `assets.sankara.net`.
3. Build the stream sync segment map.
   - Collect at least two anchors per continuous broadcast segment.
   - Solve local affine mappings from video time to mission time.
   - Persist the segment map in Artemis II media metadata or an attached sidecar.
4. Integrate diarization artifacts.
   - First-pass subtitle MVP is implemented with a combined WebVTT track generated from the canonical Part 1 and Part 2 JSON artifacts.
   - Runtime attaches the WebVTT as a native video text track and renders the transcript attribution in the Flyby Broadcast panel.
   - Keep JSON/YAML artifacts available for later searchable transcript, speaker filters, confidence styling, and raw transcript mode.
5. Add transcript/search discovery.
   - Start with synchronized captions or transcript panel behavior.
   - Later explore diarization -> LLM -> search, speaker timeline, and mission-event annotation features.
6. Add attribution coverage.
   - Cover Hank Green / Artemis Timeline provenance.
   - Cover NASA media and broadcast source credit.
   - Cover generated thumbnails, transcripts, and any mirrored or transformed assets.
7. Prepare launch communications.
   - Blog post.
   - Reddit post.
   - Email to Hank.
   - Any source/license acknowledgements needed before public promotion.
8. Investigate intermittent corrupt/truncated browser warning for `55196663265_ef59978360_o.jpg`.
   - Re-test target browsers with cache disabled and network throttling.
   - Compare R2 derivative against Flickr variants.
   - Decide whether to pin a different source URL or add fallback handling.

## Stream Sync Anchors

The current high-value anchors remain in [artemis2-video-sync-anchors.md](artemis2-video-sync-anchors.md). Treat that file as the ledger until the mapping is promoted into manifest metadata.

Known issue: the anchor set is not globally linear. Likely causes include archive edits, feed switches, replayed broadcast segments, and DVR timeline discontinuities.

## Transcript State

Part 1 and Part 2 now have canonical app-facing JSON artifacts in `C:\sankar\projects\transcribe\transcripts\`:

- `artemis2-lunar-flyby-broadcast-part1.json`
- `artemis2-lunar-flyby-broadcast-part2.json`

Both are post-disambiguation and include segment `status`, `speakerConfidence`, and a top-level `speakers` map. WebVTT subtitle tracks and YAML label/provenance files sit alongside them.

Transcript timestamps are video-relative to each original per-part `.webm`; each part starts at 0. If the runtime concatenates both parts, add `22373` seconds (`06:12:53`) to Part 2 timestamps.

Default display policy should hide `silent` and `garbled`, hide `hallucination` outside raw transcript mode, and collapse consecutive `duplicate` cues. Speaker labels are inferred and should be treated as non-authoritative.

The subtitle MVP uses `scripts/build-artemis2-broadcast-captions.mjs` to generate:

- `../moon-mission-data/assets/artemis2/media/streams/lunar-flyby/v1/artemis2-lunar-flyby-broadcast.en.vtt`

The generated WebVTT is staged locally under `assets/artemis2/media/streams/lunar-flyby/v1/` and referenced from the Artemis II media manifest as a `captionTracks[]` entry.

Before runtime integration, decide:

- storage location for JSON transcript tracks beyond the generated WebVTT subtitle MVP
- whether the next UI exposure is searchable transcript, speaker timeline, mission-event annotations, or raw transcript mode

## Reference Details To Keep Out Of This File

- Full HLS packaging command: [../artemis2-media-streaming.md](../artemis2-media-streaming.md)
- Full transcript parse regex and local paths: [artemis2-transcription-diarization-handoff.md](artemis2-transcription-diarization-handoff.md)
- Full media manifest update workflow: [artemis2-media-assets.md](artemis2-media-assets.md)
