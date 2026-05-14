import { describe, expect, it } from "vitest";

import {
    buildForegroundMediaPlaybackState,
    clampMediaCurrentTimeSeconds,
    isBackgroundPlaybackMediaItem,
    isForegroundPlayableMediaItem,
    isMediaItemActiveAtTime,
    planMissionMediaSelectionSync,
    resolveMediaItemEndTimeMs,
} from "../src/platform/js/core/domain/media-playback-policy.js";

describe("media playback policy", () => {
    it("keeps background-role video out of foreground playback ownership", () => {
        const broadcast = {
            id: "broadcast",
            kind: "videoClip",
            assetUrl: "broadcast.mp4",
            playbackRoles: ["background"],
        };
        const clip = {
            id: "crew-clip",
            kind: "videoClip",
            assetUrl: "clip.mp4",
        };

        expect(isBackgroundPlaybackMediaItem(broadcast)).toBe(true);
        expect(isForegroundPlayableMediaItem(broadcast)).toBe(false);
        expect(isForegroundPlayableMediaItem(clip)).toBe(true);
    });

    it("resolves active ranges and clamped playback offsets from one policy", () => {
        const clip = {
            kind: "videoClip",
            assetUrl: "clip.mp4",
            startTimeMs: 1000,
            durationSeconds: 10,
        };

        expect(resolveMediaItemEndTimeMs(clip)).toBe(11000);
        expect(isMediaItemActiveAtTime(clip, 11000)).toBe(true);
        expect(isMediaItemActiveAtTime(clip, 11001)).toBe(false);
        expect(clampMediaCurrentTimeSeconds(clip, 12)).toBe(10);
    });

    it("plans selection without starting background-owned playable media", () => {
        const startTimeMs = 1000;
        const broadcast = {
            id: "broadcast",
            kind: "videoClip",
            assetUrl: "broadcast.mp4",
            startTimeMs,
            durationSeconds: 30,
            playbackRoles: ["background"],
        };
        const clip = {
            id: "clip",
            kind: "videoClip",
            assetUrl: "clip.mp4",
            startTimeMs,
            durationSeconds: 30,
        };

        expect(planMissionMediaSelectionSync({
            item: broadcast,
            currentMissionTimeMs: startTimeMs + 5000,
            preserveCurrentPlayableOffset: true,
            autoStartPlayable: true,
        })).toEqual(expect.objectContaining({
            playable: false,
            shouldStartPlayable: false,
            shouldStopExistingPlayable: true,
            targetTimeMs: startTimeMs,
        }));

        expect(planMissionMediaSelectionSync({
            item: clip,
            currentMissionTimeMs: startTimeMs + 5000,
            preserveCurrentPlayableOffset: true,
            autoStartPlayable: true,
        })).toEqual(expect.objectContaining({
            playable: true,
            shouldStartPlayable: true,
            shouldStopExistingPlayable: false,
            targetTimeMs: startTimeMs + 5000,
        }));
    });

    it("only treats paused foreground video as active during frame-scrub preview", () => {
        const item = {
            id: "clip",
            kind: "videoClip",
            assetUrl: "clip.mp4",
        };
        const pausedPlaybackState = {
            itemId: "clip",
            kind: "videoClip",
            active: true,
            playing: false,
            buffering: false,
        };

        expect(buildForegroundMediaPlaybackState({
            playbackState: pausedPlaybackState,
            animationRunning: true,
            frameScrubMode: false,
            item,
        })).toEqual(expect.objectContaining({
            active: false,
            previewing: false,
        }));
        expect(buildForegroundMediaPlaybackState({
            playbackState: pausedPlaybackState,
            animationRunning: true,
            frameScrubMode: true,
            item,
        })).toEqual(expect.objectContaining({
            active: true,
            previewing: true,
        }));
        expect(buildForegroundMediaPlaybackState({
            playbackState: {
                ...pausedPlaybackState,
                playing: true,
            },
            animationRunning: true,
            frameScrubMode: false,
            item,
        })).toEqual(expect.objectContaining({
            active: true,
            previewing: false,
        }));
    });
});
