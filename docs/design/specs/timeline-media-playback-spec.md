# Timeline And Media Playback Spec

Last updated: 2026-05-14

This spec defines how the mission clock, timeline controls, Frame and Shoot,
Mission Media playback, and Background Video playback coordinate. It is the
reference for behavior in:

- `src/platform/js/app/timeline-dock-controller.js`
- `src/platform/js/app/media-timeline-coordination.js`
- `src/platform/js/app/background-media-panel.js`
- `src/platform/js/app/auxiliary-camera-views.js`
- `src/platform/js/ui/control-panel-timeline-controller.js`

## Goals

- The mission clock is the authoritative simulation time.
- Animation, Background Video, and the selected Mission Media carousel item
  stay synchronized through the mission clock.
- Every time-control surface routes time changes into the same mission-clock
  path before fan-out to scene, media, labels, and panels.
- Media follows the current playback authority instead of independently
  fighting the mission clock.
- User-initiated seeks should be immediate and stable, even while browser media
  elements are buffering or emitting stale events.
- Foreground Mission Media and Background Video must not create confusing
  overlapping audio or competing visible playback states.

## Terms

- **Mission clock**: the current mission UTC timestamp in milliseconds.
- **Timeline dock**: the fullscreen bottom timeline and media lane.
- **Media lane**: the row of timeline media markers. Segment markers represent
  media with duration.
- **Frame and Shoot**: the composer-mode auxiliary panel and its phase-local
  flyby timeline controls.
- **Mission Media**: the regular media browser workflow panel for images,
  audio clips, and video clips.
- **Background Video**: a separate auxiliary panel for video items designated
  with a background playback role.
- **Foreground media**: Mission Media audio or video playback that is active,
  playing, or buffering. Image selection is not foreground playback.
- **Playback authority**: the subsystem whose explicit user action currently
  owns play/end behavior. Valid values are `animation` and `media`.

## Playback Authority

Default authority is `animation`.

Set authority to `animation` when the user directly manipulates mission time or
animation transport:

- main Play/Pause
- regular timeline click, slider, playhead drag, event marker, or media-lane
  time seek
- Frame and Shoot `+/-` transport controls, phase events, or timeline scrub
- programmatic time changes that represent mission-clock navigation

Set authority to `media` when the user directly uses media transport:

- media Play/Pause
- media Restart
- media seek slider
- media panel play controls that start a focused playable item

Media-driven calls to animation Play/Pause must not accidentally switch
authority back to `animation`. They are consequences of media authority, not a
new animation user intent.

Background Video does not take playback authority from Mission Media. It is a
mission-clock-following auxiliary surface. Its play/pause/mute decisions are
derived from mission playback state, its own enabled state, and the foreground
media policy below.

The same media asset must not play in Background Video and foreground Mission
Media at the same time. A video with the `background` playback role belongs to
the Background Video surface for playback. Mission Media may show it as
timeline context, but foreground transport controls, auto-start rules, and
selection clicks ignore it.

## Cause-Effect Rules

These are the canonical user-visible rules.

1. **Mission time changes.**
   - Cause: the user jumps, scrubs, clicks a timeline/event/media marker, uses
     Frame and Shoot time controls, presses `Jump to broadcast start`, or media
     playback advances the mission clock.
   - Effect: the selected Mission Media item becomes the latest item whose
     start time is less than or equal to the committed mission time.
   - Effect: Background Video seeks to the same mission time when a background
     video covers that time range.
   - Effect: if animation is running and Background Video is enabled/open/in
     range, Background Video runs; otherwise Background Video is paused.

2. **The user selects a Mission Media item.**
   - Cause: direct carousel selection, adjacent carousel navigation, media panel
     selection, or a timeline media marker selection.
   - Effect: mission time jumps to the selected item's authored mission time.
   - Effect: Background Video seeks to that same mission time.
   - Effect: if animation was running, it remains running.
   - Effect: if the selected item is an image/photo, any active foreground
     audio/video is stopped without pausing animation.
   - Effect: if the selected item is audio/video and animation is running, the
     foreground item starts from the matching mission-time offset.
   - Exception: a video with the `background` playback role is not a
     foreground playback candidate. Mission-time changes may make it the active
     contextual item, but it must not start in the Mission Media player.
   - Exception: selecting or clicking a background-role video itself is inert in
     Mission Media. It does not set animation time; use regular timeline
     controls or the Background Video panel to navigate broadcast time.
   - Effect: if the selected item is audio/video and animation is not running,
     only the mission time and media selection change; foreground playback does
     not auto-start.

3. **Animation play state changes.**
   - Cause: main Play/Pause, media authority, or a Background Video play/pause
     control.
   - Effect: Background Video follows animation state. Running animation runs
     in-range enabled Background Video; paused animation pauses Background
     Video.
   - Effect: pausing Background Video through its own play/pause control pauses
     animation too, because Background Video is not an independent clock.

4. **Foreground audio/video becomes active while animation is running.**
   - Cause: direct media play, selecting a playable carousel item while
     animation is running, or entering an explicitly selected playable media
     range while animation is running.
   - Effect: foreground media plays.
   - Effect: Background Video keeps time with the mission clock but is
     temporarily muted and shows `Muted for Foreground Media`.
   - Effect: when foreground media pauses/ends/buffers out of foreground
     activity, the prior Background Video mute preference is restored and a
     toast is shown. If audio is restored, show `Background video audio
     restored`; if the user preference remains muted, show that the background
     video remains muted.

5. **Foreground audio/video is selected while animation is not running.**
   - Cause: direct or indirect selection of a playable Mission Media item.
   - Effect: mission time and Background Video time change to the selected
     item, but foreground media and Background Video remain paused until
     animation or media transport is explicitly started.

Implementation note: the coordination layer should keep these rules in a
functional core wherever practical. The core receives current state plus a
cause, returns effect/action descriptions, and the imperative shell applies
DOM, timeline, audio, video, and toast effects.

## Time Change Fan-In

All user-visible time changes must converge on the mission clock, then fan out:

1. A control computes a target mission time.
2. The timeline or animation controller commits that time.
3. Scene state, timeline labels, event highlights, media focus, and panel state
   update from that committed time.

Time controls should not directly update media as the primary action. Media
sync is a downstream effect of the mission-clock commit.

## Timeline Dock Semantics

The timeline dock separates click-to-seek and drag-to-pan regions:

- regular timeline click lane: click sets mission time
- media lane: click sets mission time and selects matching media when relevant
- playhead: drag sets mission time continuously
- scrub/pan region: drag pans the visible timeline window, not mission time

The expanded Events track is an event-inspection layer over the same time axis:

- The Events track is hidden when collapsed. Event hover text is shown only
  while the Events track is expanded.
- The event hover caption lives in the timeline dock between event pills and
  the time axis. The caption lane reserves its height while Events is expanded
  so hovering an event cannot move the transport controls.
- Hovering or focusing an event pill highlights the corresponding timeline
  marker with an extended vertical indicator. Hovering or focusing the marker
  itself uses the same visual state.
- Hovering or focusing the event strip shows a subtle range band on the
  timeline scrub bar. The band spans the earliest to latest mission event time
  represented by the event pills currently visible in the horizontal strip.
  The band disappears when the event strip loses hover/focus.

Timeline dock seek events use `mission-timeline-user-seek` with:

- `phase: "start" | "update" | "end" | "commit" | "cancel"`
- `source`: stable source string such as `timeline-click`, `timeline-slider`,
  `timeline-playhead`, `timeline-media-marker`, `timeline-event-marker`,
  `frame-shoot`, or `media-sync`
- `commit`: whether this is final enough for media/end behavior
- `timeMs`: target mission time

`media-sync` events are generated by media playback and must not be reprocessed
as user timeline seeks.

## Frame And Shoot Timeline Semantics

Frame and Shoot has two timeline concepts:

- The visible composer timeline is phase-local. It shows the active flyby phase
  and may auto-advance as mission time crosses phase boundaries.
- The `+/-` transport buttons are absolute mission-clock nudges. They add or
  subtract the requested delta from the current mission clock and clamp only to
  the full mission range, not to the active phase range.

The phase-local slider may remain bounded to the active phase. After any
mission-clock seek lands, Frame and Shoot should recompute the displayed phase
from the new mission time.

## Mission Media Selection

Mission Media focus can come from:

- explicit user selection in the media panel
- timeline media marker selection
- current mission time proximity
- currently active playable media

Mission-time proximity selects the latest media item with `startTimeMs <=
missionTimeMs`. It does not select a future item just because it is closer by
absolute distance. For example, with photos at `10:00` and `10:05`, the `10:00`
photo remains selected until the mission clock reaches `10:05`.

Explicit selection stays pinned while the selected item still covers the current
mission time. If mission time leaves the item range, focus returns to
mission-time proximity.

Selecting a playable item can seek mission time to the item start or preserve
the current offset when the current mission time is inside the item.

## Media Sync During Playback

When authority is `animation`, media follows mission time:

- If animation enters a playable media range and the item is explicitly
  selected, media may auto-start from the corresponding offset.
- Timeline and Frame and Shoot seeks move the mission clock first; active media
  seeks to the matching media offset.
- If auto-started media reaches its end, media stops but animation continues.

When authority is `media`, mission time follows media time:

- Media `timeupdate` advances the mission clock.
- Media Pause pauses animation.
- Media End stops media and pauses animation.
- Media Restart begins from the media start and seeks mission time.

At high animation speeds above the media transport limit, video uses
frame-scrub preview mode instead of normal transport playback. Animation stays
authoritative in that mode.

## Foreground Media And Background Video

Background Video is enabled by the user with a "Play background videos"
control. When enabled, it plays an in-range background-role video only while the
mission animation is running and the Background Video panel is open. It is
paused whenever animation is paused.

Background Video has an independent mute/unmute preference. Mission Media also
has an independent mute/unmute control for its own audio/video playback. These
preferences are not shared.

Mission Media image/photo selection affects Background Video only through the
mission clock: selecting the image jumps mission time, and Background Video
seeks to that same time. Image/photo selection never mutes Background Video and
never pauses animation.

Mission Media audio or video playback does affect Background Video. A Mission
Media video counts as foreground media even if the clip has no audio track,
because simultaneous visible video playback is confusing.

Foreground policy:

- Foreground Mission Media playback wins.
- While Mission Media audio/video is playing or buffering, Background Video
  keeps running with the mission clock but is temporarily muted.
- The Background Video panel shows `Muted for Foreground Media`.
- When foreground playback pauses or ends, Background Video restores its prior
  mute preference if all of these are true:
  - Background Video is still enabled.
  - Mission animation is still running.
  - Mission time is still inside the background video range.
  - The Background Video panel is open.
- If Background Video audio is restored after foreground media releases it,
  show a toast: `Background video audio restored`.
- If Background Video remains muted because that was the user's own preference,
  show a toast that foreground media ended and Background Video remains muted.

This foreground policy is scoped to current Mission Media playback. Future
audio/video panels can plug into the same policy later, but they are not part
of this spec yet.

## Media End Behavior

Media end behavior depends on playback authority:

- `media`: the user explicitly used media transport, so media end pauses
  animation.
- `animation`: media was started as a consequence of animation/timeline
  playback, so media end does not pause animation.

In both cases, media looping must be disabled. Ended media is marked inactive
and no longer drives mission time.

## Buffering And Stale Media Events

Browser media and HLS playback can emit `pause`, `waiting`, `stalled`,
`ended`, or old `timeupdate` events while a seek is in flight.

For mission-driven seeks, especially `source: "frame-shoot"`, the target
mission time is authoritative for a short suppression window. During that
window:

- stale media events must not pause animation
- stale media `timeupdate` must not move the mission clock backward
- stale media `ended` must not mark playback ended
- buffering state may be shown so the user knows media is catching up

Once media reports a time matching the target offset, the suppression state can
clear and normal media event handling resumes.

Foreground media buffering is still foreground media. Background Video should
remain temporarily muted while Mission Media is buffering.

## Panel Visibility

Mission Media panel visibility and the media timeline lane are one workflow
surface:

- opening Mission Media shows the media lane
- closing Mission Media hides the media lane
- the Mission Media pill and timeline Media control toggle the same panel/lane
  state
- closing the panel stops active media playback and pauses animation

## Required Regression Coverage

Keep tests close to any behavior changes in:

- `test/media-timeline-coordination.test.js`
- `test/timeline-dock-controller.test.js`
- `test/auxiliary-camera-views.test.js`
- `test/control-panel-timeline-controller.test.js`

Minimum scenarios:

- Frame and Shoot `+/-` nudges absolute mission time, independent of phase
  bounds.
- Frame and Shoot seek while media is playing ignores stale `pause`,
  `waiting`, `timeupdate`, and `ended` events.
- Media-initiated playback end pauses animation.
- Animation-initiated media end does not pause animation.
- Media panel open/close and media lane visibility stay synchronized.
- Click-to-seek and drag-to-pan timeline regions remain distinct.
- Background Video is temporarily muted with `Muted for Foreground Media` when
  Mission Media audio/video plays or buffers while animation is running.
- The audio-restored toast appears after foreground media releases Background
  Video when the user's prior Background Video preference was unmuted.
- Mission Media image/photo selection seeks mission time and Background Video
  time, but does not pause animation or mute Background Video.
- Mission Media mute state and Background Video mute state remain independent.
- Mission-time proximity selects the latest media item at or before the mission
  clock, not the future item that is nearest by absolute distance.
- Background-role videos are ignored by foreground Mission Media auto-start and
  foreground transport controls, so the same stream cannot play in both panels.
- Background-role video markers are visible on the media timeline but are not
  clickable seek targets.

## Consistency Review

- The mission clock has a single downstream fan-out: scene, carousel
  selection, foreground media sync, and Background Video sync.
- Background Video has no independent clock. Its play/pause state follows
  animation and its current frame follows mission time.
- Mission Media selection is allowed to change mission time; it is not allowed
  to pause animation unless the user explicitly pauses media transport or
  Background Video.
- Foreground audio/video is the only Mission Media state that mutes Background
  Video. Image/photo selection never does.
- Background Video muting for foreground media is temporary and must restore
  the user's own Background Video mute preference afterward.
- Background-role video playback is owned by Background Video, not by the
  foreground Mission Media transport.
