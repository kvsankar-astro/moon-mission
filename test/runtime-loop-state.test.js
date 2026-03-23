import { describe, expect, it } from "vitest";
import { createRuntimeLoopState } from "../src/platform/js/core/state/runtime-loop-state.js";

describe("runtime-loop-state", () => {
    it("tracks loop counters and timing fields", () => {
        const state = createRuntimeLoopState({
            initialFpsFrameCount: 1,
            initialFpsLastTime: 1000,
            initialPrevFrameTime: 950,
            initialDeltaFrameTime: 50,
            initialAnimateLoopCount: 7,
        });

        expect(state.getLoopState()).toEqual({
            fpsFrameCount: 1,
            fpsLastTime: 1000,
            prevFrameTime: 950,
            deltaFrameTime: 50,
            animateLoopCount: 7,
        });

        state.setLoopState({
            fpsFrameCount: 2,
            fpsLastTime: 1100,
            prevFrameTime: 1000,
            deltaFrameTime: 100,
            animateLoopCount: 8,
        });

        expect(state.getLoopState()).toEqual({
            fpsFrameCount: 2,
            fpsLastTime: 1100,
            prevFrameTime: 1000,
            deltaFrameTime: 100,
            animateLoopCount: 8,
        });
    });

    it("supports partial updates without resetting other fields", () => {
        const state = createRuntimeLoopState({
            initialFpsFrameCount: 3,
            initialFpsLastTime: 2000,
            initialPrevFrameTime: 1900,
            initialDeltaFrameTime: 100,
            initialAnimateLoopCount: 11,
        });

        state.setLoopState({
            deltaFrameTime: 120,
            animateLoopCount: 12,
        });

        expect(state.getLoopState()).toEqual({
            fpsFrameCount: 3,
            fpsLastTime: 2000,
            prevFrameTime: 1900,
            deltaFrameTime: 120,
            animateLoopCount: 12,
        });
    });
});
