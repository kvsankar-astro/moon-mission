import { describe, expect, it } from "vitest";
import { createRuntimeViewState } from "../src/platform/js/core/state/runtime-view-state.js";

describe("runtime-view-state", () => {
    it("tracks config and dimension state", () => {
        const state = createRuntimeViewState({
            initialConfig: "geo",
            initialCurrentDimension: "3D",
            initialPreviousDimension: null,
            initialDimensionChanged: false,
        });

        expect(state.getConfig()).toBe("geo");
        expect(state.getCurrentDimension()).toBe("3D");
        expect(state.getPreviousDimension()).toBe(null);
        expect(state.getDimensionChanged()).toBe(false);

        state.setConfig("lunar");
        state.setCurrentDimension("2D");
        state.setPreviousDimension("3D");
        state.setDimensionChanged(true);

        expect(state.getConfig()).toBe("lunar");
        expect(state.getCurrentDimension()).toBe("2D");
        expect(state.getPreviousDimension()).toBe("3D");
        expect(state.getDimensionChanged()).toBe(true);
    });

    it("applies view flag patches and single-flag setters", () => {
        const state = createRuntimeViewState({
            initialViewFlags: {
                viewOrbit: true,
                viewMoonSOI: false,
            },
        });

        expect(state.getViewOrbit()).toBe(true);
        expect(state.getViewMoonSOI()).toBe(false);

        state.setViewFlags({
            viewOrbit: false,
            viewMoonSOI: true,
            viewXYZAxes: false,
        });

        expect(state.getViewOrbit()).toBe(false);
        expect(state.getViewMoonSOI()).toBe(true);
        expect(state.getViewXYZAxes()).toBe(false);

        state.setViewEquatorialPlane(true);
        state.setViewFPS(false);

        const flags = state.getViewFlags();
        expect(flags.viewEquatorialPlane).toBe(true);
        expect(flags.viewFPS).toBe(false);
    });
});
