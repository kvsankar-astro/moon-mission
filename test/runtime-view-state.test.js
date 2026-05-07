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

        expect(state.getViewAuxiliaryPanels()).toBe(false);
        expect(state.getViewPhotoMode()).toBe(false);
        expect(state.getViewEarthClouds()).toBe(true);
        expect(state.getViewOrbit()).toBe(true);
        expect(state.getViewMoonSOI()).toBe(false);
        expect(state.getViewBodyHalos()).toBe(true);
        expect(state.getViewMoonOsculatingOrbit()).toBe(true);
        expect(state.getViewConstellationLines()).toBe(false);

        state.setViewFlags({
            viewPhotoMode: true,
            viewEarthClouds: false,
            viewOrbit: false,
            viewMoonSOI: true,
            viewBodyHalos: false,
            viewMoonOsculatingOrbit: true,
            viewXYZAxes: false,
            viewConstellationLines: false,
        });

        expect(state.getViewPhotoMode()).toBe(true);
        expect(state.getViewEarthClouds()).toBe(false);
        expect(state.getViewOrbit()).toBe(false);
        expect(state.getViewMoonSOI()).toBe(true);
        expect(state.getViewBodyHalos()).toBe(false);
        expect(state.getViewMoonOsculatingOrbit()).toBe(true);
        expect(state.getViewXYZAxes()).toBe(false);
        expect(state.getViewConstellationLines()).toBe(false);

        state.setViewEquatorialPlane(true);
        state.setViewEarthClouds(true);
        state.setViewFPS(false);

        const flags = state.getViewFlags();
        expect(flags.viewEarthClouds).toBe(true);
        expect(flags.viewEquatorialPlane).toBe(true);
        expect(flags.viewFPS).toBe(false);
    });
});


