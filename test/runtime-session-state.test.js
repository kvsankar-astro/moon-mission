import { describe, expect, it } from "vitest";
import { createRuntimeSessionState } from "../src/platform/js/core/state/runtime-session-state.js";

describe("runtime-session-state", () => {
    it("tracks animation timing and play state", () => {
        const state = createRuntimeSessionState({
            initialAnimTime: 1234,
            initialAnimationRunning: false,
        });

        expect(state.getAnimTime()).toBe(1234);
        expect(state.getAnimationRunning()).toBe(false);

        state.setAnimTime(5678);
        state.setAnimationRunning(true);

        expect(state.getAnimTime()).toBe(5678);
        expect(state.getAnimationRunning()).toBe(true);
    });

    it("keeps runtime flag proxy in sync with explicit getters/setters", () => {
        const state = createRuntimeSessionState({
            initialJoyRide: false,
            initialLanding: true,
        });
        const flags = state.getRuntimeFlags();

        expect(flags.joyRide).toBe(false);
        expect(flags.landing).toBe(true);

        state.setJoyRideFlag(true);
        state.setLandingFlag(false);
        expect(flags.joyRide).toBe(true);
        expect(flags.landing).toBe(false);

        flags.joyRide = false;
        flags.landing = true;
        expect(state.getJoyRideFlag()).toBe(false);
        expect(state.getLandingFlag()).toBe(true);
    });
});
