import { describe, expect, it } from "vitest";

import {
    buildMediaStreamSyncPlan,
    resolveTargetPlaybackTimeSeconds,
} from "../src/platform/js/core/domain/media-stream-sync.js";

const STREAM = {
    enabled: true,
    startTimeMs: Date.parse("2026-04-06T23:00:00Z"),
    endTimeMs: Date.parse("2026-04-07T00:00:00Z"),
    timeOffsetSeconds: 0,
};

describe("buildMediaStreamSyncPlan", () => {
    it("does not play disabled or out-of-range streams", () => {
        expect(buildMediaStreamSyncPlan({
            stream: { ...STREAM, enabled: false },
            missionTimeMs: Date.parse("2026-04-06T23:10:00Z"),
            isMissionPlaying: true,
            currentPlaybackTimeSeconds: 0,
        })).toEqual(expect.objectContaining({
            mode: "inactive",
            shouldPlay: false,
            inRange: false,
        }));

        expect(buildMediaStreamSyncPlan({
            stream: STREAM,
            missionTimeMs: Date.parse("2026-04-07T01:00:00Z"),
            isMissionPlaying: true,
            currentPlaybackTimeSeconds: 0,
        })).toEqual(expect.objectContaining({
            mode: "out-of-range",
            shouldPlay: false,
            inRange: false,
        }));
    });

    it("keeps a paused mission from playing an in-sync stream", () => {
        const plan = buildMediaStreamSyncPlan({
            stream: STREAM,
            missionTimeMs: Date.parse("2026-04-06T23:10:00Z"),
            isMissionPlaying: false,
            currentPlaybackTimeSeconds: 600,
        });

        expect(plan).toEqual(expect.objectContaining({
            mode: "pause",
            shouldPlay: false,
            targetPlaybackTimeSeconds: 600,
        }));
    });

    it("applies stream time offsets before drift correction", () => {
        const plan = buildMediaStreamSyncPlan({
            stream: {
                ...STREAM,
                timeOffsetSeconds: 12,
            },
            missionTimeMs: Date.parse("2026-04-06T23:10:00Z"),
            isMissionPlaying: true,
            currentPlaybackTimeSeconds: 612,
        });

        expect(plan).toEqual(expect.objectContaining({
            mode: "play",
            targetPlaybackTimeSeconds: 612,
            shouldPlay: true,
        }));
    });

    it("clamps offset targets to the valid media range", () => {
        expect(resolveTargetPlaybackTimeSeconds({
            ...STREAM,
            timeOffsetSeconds: -120,
            durationSeconds: 60,
        }, STREAM.startTimeMs + 30000)).toBe(0);

        expect(resolveTargetPlaybackTimeSeconds({
            ...STREAM,
            timeOffsetSeconds: 120,
            durationSeconds: 60,
        }, STREAM.startTimeMs + 30000)).toBe(60);
    });

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

    it("soft-corrects negative drift and clamps playback rate", () => {
        const plan = buildMediaStreamSyncPlan({
            stream: STREAM,
            missionTimeMs: Date.parse("2026-04-06T23:10:00Z"),
            isMissionPlaying: true,
            currentPlaybackTimeSeconds: 600.8,
        });

        expect(plan.mode).toBe("soft-correct");
        expect(plan.playbackRate).toBeLessThan(1);
        expect(plan.playbackRate).toBeGreaterThanOrEqual(0.5);
    });
});
