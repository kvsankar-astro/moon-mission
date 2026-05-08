# Artemis II Media Assets

Last updated: 2026-05-08

This note documents the current Artemis II media browser asset model. Use it when updating the Mission Media panel, refreshing metadata, or deciding whether media files should be mirrored into a repo.

## Current Runtime Model

- The app stores media metadata locally in `assets/artemis2/data/media-manifest.json5`.
- Runtime consumes the compiled `assets/artemis2/data/media-manifest.json`.
- The media browser is enabled by the mission panel config key `workflow:media-browser`.
- Image and clip preview assets are loaded directly from the public Artemis Timeline R2 bucket recorded in the manifest `mediaBase`.
- Compare mode intentionally disables the media browser because media timestamps are real mission chronology, not compare-mode aligned time.

## Source Chain

The current manifest was seeded from the public Artemis Timeline project:

- viewer: `https://artemistimeline.com/`
- project: `https://github.com/hankmt/Artemis-Timeline`
- source metadata: `https://raw.githubusercontent.com/hankmt/Artemis-Timeline/main/photos.js`
- remote media base: `https://pub-6f67061aecce4413aa83975cba06595d.r2.dev/`

The manifest records this provenance under its `provenance` block. Keep that block current when refreshing the metadata source.

## Ownership And Boundary

In this repo:

- Track `media-manifest.json5` as the authored source.
- Track `media-manifest.json` as the compiled runtime artifact.
- Do not copy the R2 media payload into `assets/artemis2/data/`.

In `../moon-mission-data`:

- Do not mirror the Artemis Timeline R2 bucket by default.
- Only add hosted media files if we deliberately decide to self-host, compress, or replace a source asset.
- If we self-host later, document the source URL, transform, license/provenance check, and CORS behavior before committing the asset.

## Known Import Notes

- The current import stores upstream metadata and remote asset references; it does not store original Flickr URLs.
- Many image filenames look like public NASA/Flickr/DVIDS-derived file identifiers, but the manifest should not be treated as a license ledger.
- During the import review, no separate photo thumbnails were identified in the remote bucket. The browser currently uses the main photo asset for image previews.
- Video clips can use poster images derived as `web/<mp4-basename>-poster.jpg`.
- The referenced R2 media set was roughly 206 MiB at import time. Recalculate before making cache, hosting, or deploy-size decisions.
- Some audio references from the upstream project were unavailable during import review; do not assume all upstream media paths are live without checking.

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
