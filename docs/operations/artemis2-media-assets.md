# Artemis II Media Assets

Last updated: 2026-05-09

This note documents the current Artemis II media browser asset model. Use it when updating the Mission Media panel, refreshing metadata, or deciding whether media files should be mirrored into a repo.

## Current Runtime Model

- The app stores media metadata locally in `assets/artemis2/data/media-manifest.json5`.
- Runtime consumes the compiled `assets/artemis2/data/media-manifest.json`.
- The media browser is enabled by the mission panel config key `workflow:media-browser`.
- Full image and playable clip assets are loaded directly from the public Artemis Timeline R2 bucket recorded in the manifest `mediaBase`.
- Thumbnail cards use generated derivatives declared by the manifest `thumbnails` block. Runtime falls back to the full remote image or video poster if a generated thumbnail is missing.
- Videos use the upstream `web/*.mp4` asset as the playable source and generated `assets/artemis2/media/thumbnails/videos/*.webp` thumbnails in the picker.
- Audio clips use direct remote audio paths from the manifest. Selecting a playable video or audio item aligns the mission timeline to that item, starts realtime animation, and pauses animation when the media pauses or ends.
- Compare mode intentionally disables the media browser because media timestamps are real mission chronology, not compare-mode aligned time.

## Source Chain

The current manifest was seeded from the public Artemis Timeline project:

- viewer: `https://artemistimeline.com/`
- project: `https://github.com/hankmt/Artemis-Timeline`
- source metadata: `https://raw.githubusercontent.com/hankmt/Artemis-Timeline/main/photos.js`
- remote media base: `https://pub-6f67061aecce4413aa83975cba06595d.r2.dev/`

The manifest records this provenance under its `provenance` block. Keep that block current when refreshing the metadata source.

## Related Mission Reference Files

For Artemis II flyby map/feature reference files (for example the labeled Moon map, Lunar Fifteen cards, and Lunar Targeting Plan), use:

- [lunar-feature-and-artemis2-reference-sources.md](lunar-feature-and-artemis2-reference-sources.md)

## Ownership And Boundary

In this repo:

- Track `media-manifest.json5` as the authored source.
- Track `media-manifest.json` as the compiled runtime artifact.
- Do not copy the R2 media payload into `assets/artemis2/data/`.

In `../moon-mission-data`:

- Store generated thumbnail derivatives under `assets/artemis2/media/thumbnails/`, including image/video thumbnail WebPs and the shared audio waveform SVG.
- Do not mirror the Artemis Timeline R2 bucket originals by default.
- Only add hosted original media files if we deliberately decide to self-host, compress, or replace a source asset.
- If we self-host later, document the source URL, transform, license/provenance check, and CORS behavior before committing the asset.

## Generated Thumbnails

The Artemis II manifest declares:

```json5
"thumbnails": {
  "basePath": "../media/thumbnails",
  "imagePattern": "images/{key}.webp",
  "videoPattern": "videos/{key}.webp",
  "audioFallbackAsset": "audio/waveform.svg"
}
```

- Generate thumbnails with `node scripts/generate-media-thumbnails.mjs --mission artemis2 --data-root ../moon-mission-data --kind all`.
- Image and video thumbnails are `320x180` WebP derivatives created with `ffmpeg`.
- Audio uses one shared waveform symbol at `assets/artemis2/media/thumbnails/audio/waveform.svg`.
- Stage generated thumbnail derivatives into local/dev/deploy targets with `python scripts/stage-ephemeris-data.py --data-root ../moon-mission-data --target-root <target>`.
- Local staged `assets/*/media/` files are ignored in this app repo and should be committed from `../moon-mission-data`.

## Known Import Notes

- The current import stores upstream metadata and remote asset references; it does not store original Flickr URLs.
- Many image filenames look like public NASA/Flickr/DVIDS-derived file identifiers, but the manifest should not be treated as a license ledger.
- During the import review, no separate photo thumbnails were identified in the remote bucket, so local thumbnail derivatives are generated from the remote assets.
- Video clips may still use remote poster images as runtime fallback when a generated derivative is missing.
- The referenced R2 media set was roughly 206 MiB at import time. Recalculate before making cache, hosting, or deploy-size decisions.
- Some audio references from the upstream project were unavailable during import review; do not assume all upstream media paths are live without checking.

## Open TODOs

- [ ] Maintain the official long-form stream sync anchor ledger and segment-map workup.
  - See [artemis2-video-sync-anchors.md](artemis2-video-sync-anchors.md).
  - Current direction: use piecewise (segment-based) UTC/MET <-> video-time mapping, not one global offset.

- [ ] Investigate intermittent browser warning for `55196663265_ef59978360_o.jpg` ("Image corrupt or truncated").
  - Context: file is present in upstream Artemis Timeline manifest and on Flickr page `https://www.flickr.com/photos/nasa2explore/55196663265/`.
  - Current finding (2026-05-12): R2 derivative URL is reachable and decodes in local validation, but browser console still reports occasional truncation/corruption in app runtime.
  - Follow-up actions:
    1. Re-test on target browsers with network throttling and cache disabled to capture exact failing response behavior.
    2. Compare R2 derivative against Flickr-served variants (`_b.jpg` / original) and decide whether to pin this asset to a different source URL.
    3. If warning persists, add resilient fallback logic for image load/decode failure on this item class.

## Policy Notes

- The upstream application code is separate from the media files. Do not infer media redistribution rights from the source-code license alone.
- Treat NASA, DVIDS, Flickr, and any other upstream media pages as the authority for per-item usage rules if assets are mirrored or transformed.
- The current runtime depends on browser-loadable remote media. If the media host changes, verify CORS headers and direct image/video loading in the mission page before release.

## Update Workflow

1. Refresh or edit `assets/artemis2/data/media-manifest.json5`.
2. Run `npm run configs:compile`.
3. Review both the JSON5 source and compiled `media-manifest.json`.
4. Run `npm run configs:check`.
5. For behavior changes, run targeted media tests such as `npm run test:unit -- media` or the full `npm run test:unit`.
6. Smoke-check `mission.html?mission=artemis2` with the `Mission Media` panel enabled.

The pre-commit hook runs `configs:compile`, but it currently auto-stages only compiled `config.json` files. When media metadata changes, stage both `media-manifest.json5` and `media-manifest.json` explicitly.
