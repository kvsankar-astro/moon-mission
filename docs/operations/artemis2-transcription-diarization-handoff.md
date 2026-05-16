# Artemis II Transcription And Diarization Handoff

> Status: context-switch handoff. Current transcript integration planning lives in [artemis2-media-workstream.md](artemis2-media-workstream.md). Time-base decisions live in [../design/architecture/time-synchronization-and-timekeeping.md](../design/architecture/time-synchronization-and-timekeeping.md).

This note captures the transcription/diarization context discussed on 2026-05-16 so the work can resume after a context switch.

## Verified Local Artifacts

The transcription work is in the sibling repo:

- `C:\sankar\projects\transcribe`

That repo is separate from `moon-mission`, and its `recordings/` and `transcripts/` directories are git-ignored. The useful Artemis II outputs are local generated files, not committed artifacts.

Preferred transcript files to consume:

- Part 1 timestamped, diarized, and manually disambiguated:
  - `C:\sankar\projects\transcribe\transcripts\artemis2-lunar-flyby-broadcast-part1_transcript_timestamped_disambiguated.txt`
- Part 1 grouped plain text, manually disambiguated:
  - `C:\sankar\projects\transcribe\transcripts\artemis2-lunar-flyby-broadcast-part1_transcript_disambiguated.txt`
- Part 2 timestamped and diarized, not yet manually disambiguated:
  - `C:\sankar\projects\transcribe\transcripts\artemis2-lunar-flyby-broadcast-part2_transcript_timestamped.txt`
- Part 2 grouped plain text, not yet manually disambiguated:
  - `C:\sankar\projects\transcribe\transcripts\artemis2-lunar-flyby-broadcast-part2_transcript.txt`

Source broadcast videos were found locally at:

- `C:\tmp\moon-mission-artemis2-media\source\artemis2-lunar-flyby-broadcast-part1.webm`
- `C:\tmp\moon-mission-artemis2-media\source\artemis2-lunar-flyby-broadcast-part2.webm`

Local HLS derivatives also exist under:

- `C:\tmp\moon-mission-artemis2-media\hls\artemis2-lunar-flyby\v1\`

## Current Transcript Format

The timestamped transcript format is plain text, one segment per line:

```text
[00:02:50 --> 00:02:58] [SPEAKER_11]  Welcome to Artemis Mission Control here at Johnson Space Center in Houston, Texas.
```

Useful parse regex:

```regex
^\[(\d{2}):(\d{2}):(\d{2}) --> (\d{2}):(\d{2}):(\d{2})\]\s+\[([^\]]+)\]\s+(.*)$
```

Parsed fields:

- `start`: segment start, `HH:MM:SS`
- `end`: segment end, `HH:MM:SS`
- `speaker`: diarization/display label
- `text`: transcript text

Timing is seconds precision and relative to the start of each video part. No mission-clock offset is encoded in these files.

## Generation Notes

The tooling is in:

- `C:\sankar\projects\transcribe\transcribe.py`
- `C:\sankar\projects\transcribe\disambiguate_speaker04.py`

Observed generation settings from logs and project files:

- CLI used `faster-whisper` with model `large-v3`
- Language forced to `en`
- Device was CUDA with `float16`
- `faster-whisper` was locked at `1.2.1`
- Diarization used `pyannote/speaker-diarization-3.1`
- `pyannote-audio` was locked at `3.4.0`
- The transcription run used pre-conversion from `.webm` to 16 kHz mono wav to reduce Opus timestamp drift
- Logs are local:
  - `C:\tmp\moon-mission-artemis2-media\transcribe_v2.log`
  - `C:\tmp\moon-mission-artemis2-media\disambiguate.log`

## Part 1 State

Part 1 has an extra manual disambiguation pass. `SPEAKER_04` was split using voice embeddings and known anchor timestamps into:

- `VICTOR_GLOVER`
- `JEREMY_HANSEN`
- `SPEAKER_04_short` for short segments that could not be embedded confidently

The disambiguation log reported:

- 586 original `SPEAKER_04` segments
- 571 eligible segments at least 1 second long
- 452 assigned to `VICTOR_GLOVER`
- 119 assigned to `JEREMY_HANSEN`
- 37 low-confidence segments by the script's margin threshold

Part 1 should use the `_disambiguated` files unless a newer hand-curated output appears.

## Part 2 State

Part 2 is usable but less curated than Part 1. It has diarization labels, but only generic `SPEAKER_XX` IDs plus `UNKNOWN`.

Important caveat: speaker IDs are stable within a file but should not be assumed stable across files. For example, `SPEAKER_11` in Part 1 is not guaranteed to be the same person as `SPEAKER_11` in Part 2.

Part 2 still needs curation from the other agent:

- identify key speakers and roles
- map important `SPEAKER_XX` labels to real names or display roles where possible
- identify whether any clusters merge multiple real speakers
- identify whether one real speaker was split across multiple clusters
- review noisy or hallucinated spans

One obvious issue seen in Part 2: an `UNKNOWN` block near the early loss-of-signal commentary contains garbled/hallucinated text and should be reviewed before exposing in the app.

## Suggested Integration Direction

The likely app integration point is Artemis II Mission Media:

- authored manifest: `assets/artemis2/data/media-manifest.json5`
- compiled manifest: `assets/artemis2/data/media-manifest.json`
- runtime normalizer: `src/platform/js/core/domain/media-manifest.js`

The current media stream schema has a `captions` field, but it is normalized as a simple string array. For richer transcript/diarization use, prefer converting the timestamped text into app-friendly JSON and referencing it from the manifest with a richer field, such as `transcripts`, `captionTracks`, or `transcriptTracks`.

Likely JSON shape:

```json
{
  "id": "artemis2-lunar-flyby-broadcast-part1",
  "source": "artemis2-lunar-flyby-broadcast-part1.webm",
  "timeBase": "video-relative-seconds",
  "segments": [
    {
      "startSeconds": 170,
      "endSeconds": 178,
      "speaker": "SPEAKER_11",
      "displaySpeaker": "SPEAKER_11",
      "text": "Welcome to Artemis Mission Control here at Johnson Space Center in Houston, Texas."
    }
  ]
}
```

Use separate transcript JSON files for Part 1 and Part 2 unless the app has a single media stream that concatenates both parts. If concatenating, Part 2 timestamps need an offset equal to Part 1 media duration, and the speaker maps should still retain original part-local IDs.

## Open Questions

- What final Part 2 file will the other agent produce?
- Will Part 2 get a `_disambiguated` variant similar to Part 1?
- What is the recommended Part 2 speaker map?
- Which Part 2 speakers are crew voices, NASA hosts/commentators, CAPCOM/Mission Control, or pre-produced package/interview voices?
- Which transcript spans should be hidden, marked uncertain, or manually corrected?
- Should transcript/caption artifacts be committed as authored mission metadata in this repo, or staged as generated media data in `../moon-mission-data`?
- What are the exact video-stream manifest entries that the transcript tracks should attach to?
- Are there mission-clock sync anchors between video-relative transcript time and Artemis II mission time?
- Should the UI expose searchable transcript, subtitles, a speaker timeline, mission-event annotations, or only video-synchronized captions first?
- What licensing/provenance text is required for the source broadcast and generated transcript?

## Prompt For The Other Agent

Ask the other agent for this when it finishes Part 2:

```text
For Part 2, please produce a curation handoff:

1. Speaker map
- List each SPEAKER_XX label that appears in Part 2.
- For each, identify the person/role if known, or mark unknown.
- Include 2-3 representative timestamped lines per speaker.

2. Important speakers
- Which labels are crew voices?
- Which are NASA hosts/commentators?
- Which are CAPCOM / Mission Control?
- Which are pre-produced package/interview voices?

3. Problem spans
- List transcript spans that are hallucinated, garbled, duplicated, or low confidence.
- Include start/end timestamps and recommended action: keep, edit, hide, or mark uncertain.

4. Diarization issues
- Did pyannote merge multiple real speakers into one SPEAKER_XX?
- Did it split one person across multiple SPEAKER_XX labels?
- Which clusters need disambiguation like Part 1 SPEAKER_04?

5. Final recommended labels
- Provide a JSON-style mapping from raw speaker IDs to display labels.

6. Integration-ready outputs
- Confirm which Part 2 transcript file should be consumed.
- If you produce a revised/disambiguated Part 2 file, give its exact path.
```
