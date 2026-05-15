import { describe, expect, it } from "vitest";

import {
    resolveMediaThumbnailAssetUrl,
    resolveMediaThumbnailFallbackAssetUrl,
} from "../src/platform/js/core/domain/media-thumbnail-assets.js";

describe("media thumbnail asset helpers", () => {
    it("uses the same thumbnail precedence for panels and timeline markers", () => {
        expect(resolveMediaThumbnailAssetUrl({
            kind: "image",
            thumbnailAssetUrl: "thumb.webp",
            posterAssetUrl: "poster.webp",
            assetUrl: "image.jpg",
        })).toBe("thumb.webp");

        expect(resolveMediaThumbnailAssetUrl({
            kind: "videoClip",
            posterAssetUrl: "poster.webp",
            assetUrl: "video.mp4",
        })).toBe("poster.webp");

        expect(resolveMediaThumbnailAssetUrl({
            kind: "audioClip",
            assetUrl: "audio.mp3",
        })).toBe("");
    });

    it("resolves fallback thumbnails without creating image previews for audio", () => {
        expect(resolveMediaThumbnailFallbackAssetUrl({
            kind: "image",
            assetUrl: "image.jpg",
            posterAssetUrl: "poster.webp",
        })).toBe("image.jpg");

        expect(resolveMediaThumbnailFallbackAssetUrl({
            kind: "videoClip",
            assetUrl: "video.mp4",
            posterAssetUrl: "poster.webp",
        })).toBe("poster.webp");

        expect(resolveMediaThumbnailFallbackAssetUrl({
            kind: "audioClip",
            posterAssetUrl: "poster.webp",
        })).toBe("");
    });
});
