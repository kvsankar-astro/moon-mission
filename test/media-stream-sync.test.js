import { describe, expect, it } from "vitest";

import { buildMediaStreamSyncPlan } from "../src/platform/js/core/domain/media-stream-sync.js";

const STREAM = {
    enabled: true,
    startTimeMs: Date.parse("2026-04-06T23:00:00Z"),
    endTimeMs: Date.parse("2026-04-07T00:00:00Z"),
    timeOffsetSeconds: 0,
};

describe("buildMediaStreamSyncPlan", () => {
    it("requests a hard seek when playback drift is large", () => {
        const plan = buildMediaStreamSyncPlan({
            stream: STREAM,
            missionTimeMs: Date.parse("2026-04-06T23:10:00Z"),
            isMissionPlaying: true,
            currentPlaybackTimeSeconds: 50,
        });

        expect(plan.mode).toBe("hard-seek");
        expect(plan.shouldPlay).toBe(true);
        expect(plan.targetPlaybackTimeSeconds).toBe(600);
    });

    it("uses soft correction for small but meaningful drift", () => {
        const plan = buildMediaStreamSyncPlan({
            stream: STREAM,
            missionTimeMs: Date.parse("2026-04-06T23:10:00Z"),
            isMissionPlaying: true,
            currentPlaybackTimeSeconds: 599.3,
        });

        expect(plan.mode).toBe("soft-correct");
        expect(plan.shouldPlay).toBe(true);
        expect(plan.playbackRate).toBeGreaterThan(1);
    });
});
