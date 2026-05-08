# Artemis II Media Timeline Plan

> Status: proposed implementation plan for Artemis II mission media features.

## Purpose

Add Artemis II mission media context to the runtime without breaking the
existing architecture direction:

- keep the mission playback clock, event model, and panel system as the
  primary runtime spine
- add photo support first without hard-coding a one-off gallery app into
  `mission.html`
- leave a clean path for later audio clips and one or more time-synced video
  stream panels
- preserve the functional core / imperative shell split described in
  `docs/design/architecture/target-architecture.md`

This plan intentionally does **not** mirror `artemistimeline.com` literally.
That site is an excellent reference for product shape, but this repo already
has a richer mission-runtime architecture, so the right move is to add a media
layer that plugs into our existing time, event, and panel seams.

## Product Goal

For Artemis II in normal mission mode:

1. The runtime can load an authored mission-media manifest.
2. The timeline can show dense media markers without turning media into
   hundreds of event carousel chips.
3. A dedicated media workflow panel can show the current or nearby photo at the
   current mission time, plus filters and metadata.
4. Selecting a media item can seek the mission clock when the target time is
   inside the animation range.
5. Later, one or more built-in video stream panels can play synchronized
   streams in separate panels, all driven by the same mission clock.

## Guiding Tenets

### 1. Mission time remains the source of truth

The existing mission playback clock stays authoritative.

- Photos, audio clips, and video streams are all resolved against mission time.
- Video panels are synchronized to mission time; they do not become independent
  clocks by default.
- If a video panel is allowed to scrub later, it should emit a seek intent back
  to the mission clock instead of silently drifting on its own.

### 2. Mission events and mission media stay separate

The current `eventInfos` model is sparse, semantic, and mission-operational.
Media is dense, filterable, and often many-to-one at the same timestamp.

Therefore:

- keep `eventInfos` for mission events
- add a distinct media manifest and media derivation path
- render media markers as their own timeline layer or lane
- do not overload the burn/event carousel with photo/video items

### 3. Discrete media and continuous streams are different models

Photos and short clips behave like timestamped assets. Continuous or long-form
video behaves like synchronized transport media.

Therefore the plan uses two related but distinct data families:

- `mediaItems`: discrete images, short videos, audio clips, bounded media
- `mediaStreams`: continuous or long-window synchronized video feeds

This separation avoids forcing stream playback semantics into a photo model.

### 4. Functional core computes; shell plays

The core should decide:

- what media is visible
- what media is active at a given mission time
- how markers cluster or filter
- whether a stream should be playing, paused, or seek-corrected

The shell should own:

- DOM panel rendering
- image loading and prefetch
- `HTMLVideoElement` / HLS / player adapter control
- `play()`, `pause()`, `currentTime`, captions, buffering UI

## Recommended Data Model

### Mission-authored source files

Add an authored source file in the app repo:

`assets/artemis2/data/media-manifest.json5`

Compile it to:

`assets/artemis2/data/media-manifest.json`

This matches the existing config workflow and keeps authored metadata in the
app repo. Large runtime assets should remain staged from `moon-mission-data`.

Recommended staged asset buckets in the data repo:

- mission photos / thumbnails
- short local video clips if we host them ourselves
- poster images
- caption files / transcripts
- optional audio clips

### Manifest shape

Recommended top-level sections:

- `mediaItems[]`
- `mediaStreams[]`
- `filters`
- `ui`
- `provenance`

### `mediaItems[]`

Use for photos, short video clips, and audio clips.

Recommended fields:

- `id`
- `kind`: `image` | `videoClip` | `audioClip`
- `startTime`
- `endTime` optional for bounded clips
- `title`
- `description`
- `source`
- `asset`
- `posterAsset` optional
- `thumbnailAsset` optional
- `photographer`
- `camera`
- `cameraId`
- `location`
- `tags`
- `crewCaptured`
- `external`
- `availabilityStartPolicy`
- `enabled`

### `mediaStreams[]`

Use for long-form synchronized feeds intended for separate panels.

Recommended fields:

- `id`
- `title`
- `streamKind`: `video`
- `sourceType`: `mp4` | `hls` | `youtube` | `iframe`
- `sourceUrl`
- `posterAsset`
- `captions[]`
- `startTime`
- `endTime`
- `syncMode`: `missionClock`
- `timeOffsetSeconds`
- `defaultPanelState`
- `enabled`

## Architectural Placement

### Functional core

Add pure modules for normalization and time-based derivation, for example:

- `src/platform/js/core/domain/media-manifest.js`
- `src/platform/js/core/domain/media-filter-state.js`
- `src/platform/js/core/domain/media-timeline-state.js`
- `src/platform/js/core/domain/media-selection-state.js`
- `src/platform/js/core/domain/media-stream-sync.js`

Core responsibilities:

- validate and normalize media manifest records
- compute derived availability flags, including pre-ephemeris items
- filter media by type/source/camera/tag
- derive visible timeline markers and cluster summaries
- resolve active, nearest, previous, and next media items for a mission time
- build panel view-model data
- produce per-stream sync plans:
  - target playback time
  - whether to play or pause
  - whether drift requires soft correction or hard seek

### State ports

Add a narrow runtime media state port, for example:

- `src/platform/js/core/state/runtime-media-state.js`

State should include only mutable runtime intent and selection, such as:

- loaded manifest reference
- active filters
- selected media item id
- selected stream ids
- panel-local presentation state
- user mute / autoplay preferences if needed

This state port should not mutate the DOM or media elements directly.

### Application services

Add a coordination layer, for example:

- `src/platform/js/app/media-timeline-coordination.js`
- `src/platform/js/app/media-panel-coordination.js`
- `src/platform/js/app/media-stream-panel-coordination.js`

Service responsibilities:

- load media manifest alongside mission config
- translate mission-time changes into media-state updates
- coordinate timeline marker updates with the existing timeline dock
- route panel intents into state changes and seek intents
- translate core stream-sync plans into shell effect commands

### Shell and effects

Add effect-heavy modules for browser work, for example:

- `src/platform/js/shell/ui/media-panel-effects.js`
- `src/platform/js/shell/media/media-element-effects.js`
- `src/platform/js/shell/media/media-prefetch-effects.js`

Shell responsibilities:

- render media panel DOM
- manage `<img>`, `<audio>`, and `<video>` elements
- integrate HLS or provider-specific players if needed
- handle buffering, failed loads, and poster fallback
- prefetch nearby thumbnails or posters

## Panel Strategy

### Phase-1 panel

Introduce one Artemis II workflow panel:

- `workflow:media-browser`

This panel should be built on the shared panel shell and show:

- current or nearest media item
- metadata
- filter controls
- thumbnail strip or nearby-item list
- explicit provenance when media time is outside trajectory coverage

### Later stream panels

For synchronized video streams, do **not** wait on future user-created panel
support. Instead, use mission-declared built-in workflow panels such as:

- `workflow:stream-main`
- `workflow:stream-cabin`
- `workflow:stream-external`

These stay compatible with Panel System V1 because they are built-in panel
instances, not arbitrary user-generated duplicates.

If future panel work adds `Create View` or user-created workflow panels, the
stream-panel layer can expand then without changing the core media model.

## Timeline Strategy

Keep the current mission event UI semantics intact:

- event carousel remains for sparse mission events
- timeline markers remain the primary semantic event anchors

Add media as a separate dense layer:

- a marker rail, density rail, or clustered strip tied to the same mission time
- filter-aware coloring or glyphs by media type
- hover/selection logic routed through media services, not event services

This keeps mission operations readable while still supporting media-heavy
moments like lunar flyby photography bursts.

## Pre-Ephemeris and Post-Ephemeris Policy

Artemis II media includes important moments before public Orion ephemeris
coverage begins and after it ends.

Recommended rule:

- media may exist outside the animation sample span
- selecting such media still shows the media asset and metadata
- the runtime surfaces a clear "trajectory unavailable at this media time"
  note instead of pretending the scene is sampled there
- timeline and panel view models should expose this explicitly as derived state

This is similar in spirit to current pre-ephemeris event handling, but media
selection should remain useful even when the scene cannot seek to the exact
instant.

## Compare-Mode Scope

Initial media work should be **out of scope** for compare mode.

Rationale:

- compare mode uses a fictional aligned clock
- mission media is tied to a real mission clock and real source chronology
- forcing media into compare mode would create confusing semantics early

Recommended first rule:

- media timeline and stream panels are enabled only in standard single-mission
  Artemis II runtime modes
- compare mode hides or disables media surfaces cleanly

## Staged Implementation Plan

### Phase 1: Foundation

Goal: land data and derivation seams without large UI risk.

1. Add `media-manifest.json5` + compiled `media-manifest.json`.
2. Add manifest normalization and validation in the core.
3. Add a mission-media loader and runtime media state port.
4. Add unit tests for normalization, filtering, availability, and active-item
   resolution.

Exit condition:

- Artemis II can load a normalized media manifest in runtime code without yet
  rendering a shipped media panel.

### Phase 2: Photo Timeline MVP

Goal: ship the first useful user-facing feature with photos only.

1. Add a `workflow:media-browser` panel.
2. Add a timeline media-marker layer separate from `eventInfos`.
3. Show current/nearest photo and metadata at mission time.
4. Support photo filters such as:
   - all
   - crew
   - external
   - camera
5. Allow photo selection to seek mission time when in range.

Exit condition:

- Artemis II can be scrubbed through a synchronized photo experience inside the
  existing mission runtime.

### Phase 3: Richer Discrete Media

Goal: widen the manifest and panel model without changing the core shape.

1. Add short `videoClip` and `audioClip` support to `mediaItems`.
2. Extend filter and marker derivation for kind-specific rendering.
3. Add poster/thumbnail handling and optional inline clip playback inside the
   media browser panel.
4. Keep playback coordination mission-clock-aware, even for short clips.

Exit condition:

- the media browser can represent mixed discrete media types while still using
  one normalized item model.

### Phase 4: Time-Synced Video Stream Panels

Goal: add one or more separate synchronized video panels.

1. Add `mediaStreams[]` manifest support.
2. Add core stream-sync planning logic with drift thresholds.
3. Add one built-in workflow panel per declared stream.
4. Drive playback from mission time:
   - play when the mission is playing and the stream is in-range
   - pause when the mission is paused
   - hard-seek on large drift
   - optionally use soft correction for small drift
5. Add provider adapters as shell-only code.

Exit condition:

- two or more Artemis II video streams can run in separate panels and remain
  synchronized to the mission timeline.

## Suggested File/Module Map

Likely additions:

- `assets/artemis2/data/media-manifest.json5`
- `assets/artemis2/data/media-manifest.json`
- `src/platform/js/core/domain/media-manifest.js`
- `src/platform/js/core/domain/media-filter-state.js`
- `src/platform/js/core/domain/media-timeline-state.js`
- `src/platform/js/core/domain/media-selection-state.js`
- `src/platform/js/core/domain/media-stream-sync.js`
- `src/platform/js/core/state/runtime-media-state.js`
- `src/platform/js/data/mission-media.js`
- `src/platform/js/app/media-timeline-coordination.js`
- `src/platform/js/app/media-browser-panel.js`
- `src/platform/js/app/media-stream-panel.js`
- `src/platform/js/shell/media/media-element-effects.js`
- `src/platform/js/shell/media/media-prefetch-effects.js`

## Verification Plan

- unit tests for core media normalization and filtering
- unit tests for stream sync planning and drift correction decisions
- browser smoke checks on `mission.html?mission=artemis2`
- panel-state regression checks for open/minimized/closed behavior
- targeted UI tests for:
  - media marker rendering
  - photo selection
  - pre-ephemeris media behavior
  - video pause/play/seek synchronization

## Recommended First Slice

The best first implementation slice is:

1. land the media manifest format
2. ship the pure media core
3. add a single `workflow:media-browser` photo panel
4. add a separate media marker rail to the existing timeline

That gives us a real Artemis II feature quickly while preserving a clean path
to later mixed discrete media and synchronized multi-panel video.
