import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

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
                    settings: "720x1280 · 19s",
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
        expect(manifest.mediaItems[1].durationSeconds).toBe(19);
        expect(manifest.mediaItems[1].endTimeMs).toBe(Date.parse("2026-04-06T22:45:19Z"));
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

    it("derives generated thumbnail URLs from manifest conventions", () => {
        const manifest = normalizeMissionMediaManifest({
            mediaBase: "https://pub-example.r2.dev/",
            timelineTimezoneOffset: "-04:00",
            thumbnails: {
                basePath: "../media/thumbnails",
                imagePattern: "images/{key}.webp",
                videoPattern: "videos/{key}.webp",
                audioFallbackAsset: "audio/waveform.svg",
            },
            photos: [
                {
                    time: "2026-04-01 13:35:39",
                    file: "KSC-20260401-PH-KLS01_0198.jpg",
                    enabled: true,
                },
                {
                    time: "2026-04-06 18:45:00",
                    file: "ig-earthset-wiseman.mp4",
                    video: true,
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

        expect(manifest.mediaItems[0].thumbnailAssetUrl).toBe(
            "assets/artemis2/data/../media/thumbnails/images/KSC-20260401-PH-KLS01_0198.webp",
        );
        expect(manifest.mediaItems[1].thumbnailAssetUrl).toBe(
            "assets/artemis2/data/../media/thumbnails/videos/ig-earthset-wiseman.webp",
        );
        expect(manifest.audioItems[0].thumbnailAssetUrl).toBe(
            "assets/artemis2/data/../media/thumbnails/audio/waveform.svg",
        );
    });

    it("allows Artemis Timeline videos to override a missing conventional poster", () => {
        const manifest = normalizeMissionMediaManifest({
            mediaBase: "https://pub-example.r2.dev/",
            photos: [
                {
                    time: "2026-04-02 20:28:00",
                    file: "loop.mp4",
                    video: true,
                    posterAsset: "../media/thumbnails/videos/loop.webp",
                    enabled: true,
                },
            ],
        }, {
            dataPath: "assets/artemis2/data",
        });

        expect(manifest.mediaItems[0].posterAssetUrl).toBe(
            "assets/artemis2/data/../media/thumbnails/videos/loop.webp",
        );
    });

    it("attaches curated thumbnail metadata to normalized Artemis photos", () => {
        const manifest = normalizeMissionMediaManifest({
            mediaBase: "https://pub-example.r2.dev/",
            timelineTimezoneOffset: "-04:00",
            thumbnails: {
                basePath: "../media/thumbnails",
                imagePattern: "images/{key}.webp",
            },
            mediaMetadata: [
                {
                    file: "ART002-E-21257.JPG",
                    shortDescription: "Earth rises over the cratered lunar horizon.",
                    tags: ["earthrise", "lunar horizon"],
                    subjects: ["Earth", "Moon", "lunar surface"],
                    sceneType: "moon",
                    bodies: ["Earth", "Moon"],
                    mainBody: "Earth",
                    compositionHints: {
                        suggestedLockTarget: "earth",
                        confidence: 0.96,
                        reason: "Earth is the focal point.",
                    },
                    qualityNotes: "Good thumbnail candidate.",
                },
            ],
            photos: [
                {
                    time: "2026-04-06 18:45:00",
                    file: "ART002-E-21257.JPG",
                    title: "Earthrise",
                    enabled: true,
                },
            ],
        }, {
            dataPath: "assets/artemis2/data",
        });

        expect(manifest.mediaItems[0]).toMatchObject({
            shortDescription: "Earth rises over the cratered lunar horizon.",
            tags: ["earthrise", "lunar horizon"],
            subjects: ["Earth", "Moon", "lunar surface"],
            sceneType: "moon",
            bodies: ["Earth", "Moon"],
            mainBody: "Earth",
            qualityNotes: "Good thumbnail candidate.",
        });
        expect(manifest.mediaItems[0].description).toBe("Earth rises over the cratered lunar horizon.");
        expect(manifest.mediaItems[0].compositionHints).toEqual({
            suggestedLockTarget: "earth",
            confidence: 0.96,
            reason: "Earth is the focal point.",
        });
    });

    it("normalizes long-form media stream metadata and sync anchors", () => {
        const manifest = normalizeMissionMediaManifest({
            mediaStreams: [
                {
                    id: "flyby-broadcast",
                    title: "Lunar flyby broadcast",
                    description: "Mission-long stream.",
                    enabled: false,
                    streamKind: "video",
                    sourceType: "hls",
                    sourceUrl: "https://media.example.test/artemis2/flyby/master.m3u8",
                    sourceLabel: "NASA broadcast",
                    sourcePageUrl: "https://commons.wikimedia.org/wiki/Category:Videos_of_Artemis_2",
                    sourceCredit: "NASA",
                    license: "Public domain",
                    captionTracks: [
                        {
                            kind: "subtitles",
                            label: "English transcript",
                            srclang: "en",
                            sourceUrl: "../media/streams/lunar-flyby/v1/flyby.en.webvtt",
                            default: true,
                            attribution: "Auto-generated transcript.",
                        },
                    ],
                    startTime: "2026-04-06T17:56:00Z",
                    endTime: "2026-04-07T04:06:00Z",
                    durationSeconds: 36600.13,
                    syncStatus: "provisional",
                    syncAnchors: [
                        {
                            label: "Closest approach",
                            missionTime: "2026-04-06T23:00:00Z",
                            streamTimeSeconds: 18240,
                            note: "Initial estimate from NASA broadcast description.",
                        },
                    ],
                },
            ],
        }, {
            dataPath: "assets/artemis2/data",
        });

        expect(manifest.mediaStreams).toHaveLength(1);
        expect(manifest.mediaStreams[0]).toMatchObject({
            id: "flyby-broadcast",
            description: "Mission-long stream.",
            enabled: false,
            sourceType: "hls",
            sourceUrl: "https://media.example.test/artemis2/flyby/master.m3u8",
            durationSeconds: 36600.13,
            syncStatus: "provisional",
            sourceLabel: "NASA broadcast",
            sourcePageUrl: "https://commons.wikimedia.org/wiki/Category:Videos_of_Artemis_2",
            sourceCredit: "NASA",
            license: "Public domain",
            captionTracks: [
                {
                    id: "caption-track-1",
                    kind: "subtitles",
                    label: "English transcript",
                    srclang: "en",
                    sourceUrl: "assets/artemis2/data/../media/streams/lunar-flyby/v1/flyby.en.webvtt",
                    default: true,
                    attribution: "Auto-generated transcript.",
                },
            ],
        });
        expect(manifest.mediaStreams[0].syncAnchors).toEqual([
            {
                label: "Closest approach",
                missionTimeMs: Date.parse("2026-04-06T23:00:00Z"),
                streamTimeSeconds: 18240,
                note: "Initial estimate from NASA broadcast description.",
            },
        ]);
    });

    it("preserves background playback roles on stream-backed video items", () => {
        const manifest = normalizeMissionMediaManifest({
            mediaStreams: [
                {
                    id: "flyby-broadcast",
                    title: "Lunar flyby broadcast",
                    enabled: true,
                    streamKind: "video",
                    sourceType: "hls",
                    sourceUrl: "https://media.example.test/artemis2/flyby/master.m3u8",
                    startTime: "2026-04-06T17:56:00Z",
                    endTime: "2026-04-07T04:06:00Z",
                    captionTracks: [
                        {
                            kind: "subtitles",
                            label: "English transcript",
                            srclang: "en",
                            sourceUrl: "../media/streams/lunar-flyby/v1/flyby.en.webvtt",
                            default: true,
                            attribution: "Auto-generated transcript.",
                        },
                    ],
                    playbackRoles: ["background"],
                    backgroundPlayback: {
                        enabled: true,
                        muted: true,
                        priority: 100,
                        fit: "cover",
                    },
                },
            ],
        }, {
            dataPath: "assets/artemis2/data",
        });

        expect(manifest.mediaItems).toContainEqual(expect.objectContaining({
            id: "flyby-broadcast",
            kind: "videoClip",
            mediaStream: true,
            playbackRoles: ["background"],
            backgroundPlayback: {
                enabled: true,
                muted: true,
                priority: 100,
                fit: "cover",
            },
            captionTracks: [
                {
                    id: "caption-track-1",
                    kind: "subtitles",
                    label: "English transcript",
                    srclang: "en",
                    sourceUrl: "assets/artemis2/data/../media/streams/lunar-flyby/v1/flyby.en.webvtt",
                    default: true,
                    attribution: "Auto-generated transcript.",
                },
            ],
        }));
    });

    it("keeps Artemis II foreground playable media durations explicit or derivable", () => {
        const sourceManifest = JSON.parse(readFileSync(
            new URL("../assets/artemis2/data/media-manifest.json", import.meta.url),
            "utf8",
        ));
        const missingExplicitAudioDurations = (sourceManifest.audio || [])
            .filter((item) => item.enabled !== false)
            .filter((item) => !(Number(item.durationSeconds) > 0))
            .map((item) => item.file);
        const missingExplicitVideoDurations = (sourceManifest.photos || [])
            .filter((item) => item.enabled !== false && item.video === true)
            .filter((item) => !(Number(item.durationSeconds) > 0))
            .map((item) => item.file);

        expect(missingExplicitAudioDurations).toEqual([]);
        expect(missingExplicitVideoDurations).toEqual([]);

        const manifest = normalizeMissionMediaManifest(sourceManifest, {
            dataPath: "assets/artemis2/data",
        });
        const foregroundPlayableItems = [
            ...manifest.mediaItems,
            ...manifest.audioItems,
        ].filter((item) => (
            item.enabled !== false
            && (item.kind === "audioClip" || item.kind === "videoClip")
            && item.backgroundPlayback?.enabled !== true
        ));
        const missingDurationIds = foregroundPlayableItems
            .filter((item) => !(Number(item.durationSeconds) > 0))
            .map((item) => item.id);

        expect(missingDurationIds).toEqual([]);
    });
});
