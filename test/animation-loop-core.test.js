import { describe, expect, it, vi } from "vitest";
import {
    computeAnimationStepState,
    updateFpsCounterState,
    updateFrameDeltaState,
} from "../assets/platform/js/app/animation-loop.js";

describe("animation-loop core helpers", () => {
    it("initializes fpsLastTime from the first frame when it is zero", () => {
        const updateFPSCounter = vi.fn();

        const next = updateFpsCounterState({
            curFrameTime: 1000,
            fpsFrameCount: 0,
            fpsLastTime: 0,
            fpsUpdateInterval: 500,
            updateFPSCounter,
        });

        expect(next).toEqual({
            fpsFrameCount: 1,
            fpsLastTime: 1000,
        });
        expect(updateFPSCounter).not.toHaveBeenCalled();
    });

    it("increments frame count without publishing FPS when interval is not reached", () => {
        const updateFPSCounter = vi.fn();

        const next = updateFpsCounterState({
            curFrameTime: 1200,
            fpsFrameCount: 2,
            fpsLastTime: 1000,
            fpsUpdateInterval: 500,
            updateFPSCounter,
        });

        expect(next).toEqual({
            fpsFrameCount: 3,
            fpsLastTime: 1000,
        });
        expect(updateFPSCounter).not.toHaveBeenCalled();
    });

    it("publishes rounded FPS and resets counters when interval is reached", () => {
        const updateFPSCounter = vi.fn();

        const next = updateFpsCounterState({
            curFrameTime: 2002,
            fpsFrameCount: 4,
            fpsLastTime: 1000,
            fpsUpdateInterval: 1000,
            updateFPSCounter,
        });

        expect(updateFPSCounter).toHaveBeenCalledTimes(1);
        expect(updateFPSCounter).toHaveBeenCalledWith(5);
        expect(next).toEqual({
            fpsFrameCount: 0,
            fpsLastTime: 2002,
        });
    });

    it("preserves the previous delta when prevFrameTime is null", () => {
        const next = updateFrameDeltaState({
            curFrameTime: 5000,
            prevFrameTime: null,
            deltaFrameTime: 16,
        });

        expect(next).toEqual({
            prevFrameTime: 5000,
            deltaFrameTime: 16,
        });
    });

    it("computes delta from current and previous frame times when previous exists", () => {
        const next = updateFrameDeltaState({
            curFrameTime: 33,
            prevFrameTime: 0,
            deltaFrameTime: 999,
        });

        expect(next).toEqual({
            prevFrameTime: 33,
            deltaFrameTime: 33,
        });
    });

    it("increments animation loop count when step boundary is not reached", () => {
        const next = computeAnimationStepState({
            animateLoopCount: 0,
            ticksPerAnimationStep: 4,
        });

        expect(next).toEqual({
            animateLoopCount: 1,
            shouldAdvance: false,
        });
    });

    it("signals advance and resets the counter at an exact step boundary", () => {
        const next = computeAnimationStepState({
            animateLoopCount: 2,
            ticksPerAnimationStep: 3,
        });

        expect(next).toEqual({
            animateLoopCount: 0,
            shouldAdvance: true,
        });
    });

    it("treats tiny floating-point modulo residue as an animation step boundary", () => {
        const next = computeAnimationStepState({
            animateLoopCount: Number.EPSILON,
            ticksPerAnimationStep: 1,
        });

        expect(next).toEqual({
            animateLoopCount: 0,
            shouldAdvance: true,
        });
    });
});
