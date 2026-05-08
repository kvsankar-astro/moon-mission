import { describe, expect, it } from "vitest";

import { normalizeMissionMediaManifest } from "../src/platform/js/core/domain/media-manifest.js";

describe("normalizeMissionMediaManifest", () => {
    it("derives mission time from capture time plus camera-profile offset", () => {
        const manifest = normalizeMissionMediaManifest({
            cameraProfiles: {
                iphone: {
                    label: "Crew iPhone",
                    timeOffsetSeconds: 120,
                    timeOffsetNote: "Clock correction",
                },
            },
            mediaItems: [
                {
                    id: "earthrise",
                    captureTime: "2026-04-06T23:23:00Z",
                    cameraId: "iphone",
                    title: "Earthrise",
                    asset: "../../../images/social/artemis2-mobile.png",
                },
            ],
        }, {
            dataPath: "assets/artemis2/data",
        });

        expect(manifest.mediaItems).toHaveLength(1);
        expect(manifest.mediaItems[0].startTimeMs).toBe(Date.parse("2026-04-06T23:25:00Z"));
        expect(manifest.mediaItems[0].cameraLabel).toBe("Crew iPhone");
        expect(manifest.mediaItems[0].effectiveTimeOffsetSeconds).toBe(120);
        expect(manifest.mediaItems[0].timeSource).toBe("captureTime+offset");
        expect(manifest.mediaItems[0].thumbnailAssetUrl).toBe(
            "assets/artemis2/data/../../../images/social/artemis2-mobile.png",
        );
    });

    it("prefers explicit timeline time over capture-time correction", () => {
        const manifest = normalizeMissionMediaManifest({
            cameraProfiles: {
                d5: {
                    label: "D5 #1",
                    timeOffsetSeconds: 300,
                },
            },
            mediaItems: [
                {
                    id: "flyby",
                    startTime: "2026-04-06T23:05:12Z",
                    captureTime: "2026-04-06T23:00:12Z",
                    cameraId: "d5",
                    title: "Flyby",
                },
            ],
        });

        expect(manifest.mediaItems[0].startTimeMs).toBe(Date.parse("2026-04-06T23:05:12Z"));
        expect(manifest.mediaItems[0].effectiveTimeOffsetSeconds).toBe(0);
        expect(manifest.mediaItems[0].timeSource).toBe("timelineTime");
    });

    it("normalizes Artemis Timeline-style photo metadata with remote media URLs", () => {
        const manifest = normalizeMissionMediaManifest({
            mediaBase: "https://pub-example.r2.dev/",
            timelineTimezoneOffset: "-04:00",
            photos: [
                {
                    time: "2026-04-01 13:35:39",
                    file: "KSC-20260401-PH-KLS01_0198.jpg",
                    photographer: "NASA/Kim Shiflett",
                    location: "Kennedy Space Center",
                    camera: "Canon EOS R5",
                    settings: "EF24-70mm f/2.8L II",
                    spacecraft: false,
                    title: "Artemis II Crew Portrait in the Suit-Up Room",
                    flickr_desc: "The Artemis II crew poses in the suit-up room.",
                    enabled: true,
                },
                {
                    time: "2026-04-06 18:45:00",
                    file: "ig-earthset-wiseman.mp4",
                    photographer: "Artemis II Crew",
                    location: "Orion Spacecraft",
                    camera: "NIKON D5",
                    camera_id: "d5a",
                    spacecraft: true,
                    video: true,
                    title: "Only One Chance in This Lifetime",
                    desc: "Crew-recorded clip during Earthset.",
                    enabled: true,
                },
            ],
            audio: [
                {
                    time: "2026-04-06 18:58:45",
                    file: "audio/artemis-ii-closest-point-to-moon.wav",
                    desc: "Closest approach to Moon",
                    enabled: true,
                },
            ],
        }, {
            dataPath: "assets/artemis2/data",
        });

        expect(manifest.mediaItems).toHaveLength(2);
        expect(manifest.mediaItems[0].startTimeMs).toBe(Date.parse("2026-04-01T17:35:39Z"));
        expect(manifest.mediaItems[0].assetUrl).toBe(
            "https://pub-example.r2.dev/web/KSC-20260401-PH-KLS01_0198.jpg",
        );
        expect(manifest.mediaItems[0].description).toBe(
            "The Artemis II crew poses in the suit-up room.",
        );

        expect(manifest.mediaItems[1].kind).toBe("videoClip");
        expect(manifest.mediaItems[1].cameraId).toBe("d5a");
        expect(manifest.mediaItems[1].crewCaptured).toBe(true);
        expect(manifest.mediaItems[1].posterAssetUrl).toBe(
            "https://pub-example.r2.dev/web/ig-earthset-wiseman-poster.jpg",
        );
        expect(manifest.mediaItems[1].batch).toBe(0);

        expect(manifest.audioItems).toHaveLength(1);
        expect(manifest.audioItems[0].startTimeMs).toBe(Date.parse("2026-04-06T22:58:45Z"));
        expect(manifest.audioItems[0].assetUrl).toBe(
            "https://pub-example.r2.dev/audio/artemis-ii-closest-point-to-moon.wav",
        );
    });
});
