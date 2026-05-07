import { describe, expect, it } from "vitest";
import { createRuntimeInteractionState } from "../src/platform/js/core/state/runtime-interaction-state.js";

describe("runtime-interaction-state", () => {
    it("tracks mission/landing and mouse interaction flags", () => {
        const state = createRuntimeInteractionState({
            initialMissionStartCalled: false,
            initialStartLandingFlag: false,
            initialMouseDown: false,
            initialMouseDownTimeout: 200,
        });

        expect(state.getMissionStartCalled()).toBe(false);
        expect(state.getStartLandingFlag()).toBe(false);
        expect(state.getMouseDown()).toBe(false);
        expect(state.getMouseDownTimeout()).toBe(200);

        state.setMissionStartCalled(true);
        state.setStartLandingFlag(true);
        state.setMouseDown(true);
        state.setMouseDownTimeout(350);

        expect(state.getMissionStartCalled()).toBe(true);
        expect(state.getStartLandingFlag()).toBe(true);
        expect(state.getMouseDown()).toBe(true);
        expect(state.getMouseDownTimeout()).toBe(350);
    });

    it("tracks timeout handles independently", () => {
        const state = createRuntimeInteractionState({
            initialTimeoutHandleZoom: "zoom-handle",
            initialLegacyTimeoutHandle: "legacy-handle",
        });

        expect(state.getTimeoutHandleZoom()).toBe("zoom-handle");
        expect(state.getLegacyTimeoutHandle()).toBe("legacy-handle");

        state.setTimeoutHandleZoom("zoom-next");
        state.setLegacyTimeoutHandle("legacy-next");

        expect(state.getTimeoutHandleZoom()).toBe("zoom-next");
        expect(state.getLegacyTimeoutHandle()).toBe("legacy-next");
    });

    it("tracks input activity and idle windows", () => {
        const state = createRuntimeInteractionState({
            initialLastInputActivityMs: 1000,
        });

        expect(state.getLastInputActivityMs()).toBe(1000);
        expect(state.getInputIdleMs(1250)).toBe(250);
        expect(state.isInputRecentlyActive(300, 1250)).toBe(true);
        expect(state.isInputRecentlyActive(200, 1250)).toBe(false);

        state.markInputActivity(2000);

        expect(state.getLastInputActivityMs()).toBe(2000);
        expect(state.getInputIdleMs(2600)).toBe(600);
    });
});
