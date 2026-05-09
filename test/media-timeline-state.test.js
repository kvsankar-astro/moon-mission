import { describe, expect, it } from "vitest";

import { buildMediaTimelineMarkers } from "../src/platform/js/core/domain/media-timeline-state.js";

describe("buildMediaTimelineMarkers", () => {
    it("keeps images as points and emits duration segments for audio and video", () => {
        const markers = buildMediaTimelineMarkers({
            items: [
                {
                    id: "photo",
                    kind: "image",
                    title: "Crew Photo",
                    cameraLabel: "D5",
                    startTimeMs: 1000,
                },
                {
                    id: "video",
                    kind: "videoClip",
                    title: "Crew Video",
                    cameraLabel: "iPhone",
                    startTimeMs: 2000,
                    durationSeconds: 19,
                },
                {
                    id: "audio",
                    kind: "audioClip",
                    title: "Mission Audio",
                    startTimeMs: 3000,
                },
            ],
            timeMs: 2200,
            rangeStartMs: 0,
            rangeEndMs: 10000,
        });

        expect(markers[0]).toEqual(expect.objectContaining({
            id: "photo",
            mediaDisplayMode: "point",
            endTimeMs: Number.NaN,
            durationEstimated: false,
        }));

        expect(markers[1]).toEqual(expect.objectContaining({
            id: "video",
            mediaDisplayMode: "segment",
            endTimeMs: 21000,
            durationEstimated: false,
        }));
        expect(markers[1].hoverText).toContain("19s");

        expect(markers[2]).toEqual(expect.objectContaining({
            id: "audio",
            mediaDisplayMode: "segment",
            endTimeMs: 33000,
            durationEstimated: true,
        }));
        expect(markers[2].hoverText).toContain("Approx. 30s");
    });
});
