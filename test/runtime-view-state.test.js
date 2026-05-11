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
        expect(state.getViewLunarCraters()).toBe(false);
        expect(state.getLunarCraterHoverLabels()).toBe(true);
        expect(state.getLunarCraterDisplayMode()).toBe("hover");
        expect(state.getLunarCraterLimit()).toBe(120);
        expect(state.getViewBodyHalos()).toBe(true);
        expect(state.getViewMoonOsculatingOrbit()).toBe(true);
        expect(state.getViewConstellationLines()).toBe(false);

        state.setViewFlags({
            viewPhotoMode: true,
            viewEarthClouds: false,
            viewOrbit: false,
            viewLunarCraters: true,
            lunarCraterHoverLabels: false,
            lunarCraterDisplayMode: "always",
            lunarCraterLimit: 250,
            viewMoonSOI: true,
            viewBodyHalos: false,
            viewMoonOsculatingOrbit: true,
            viewXYZAxes: false,
            viewConstellationLines: false,
        });

        expect(state.getViewPhotoMode()).toBe(true);
        expect(state.getViewEarthClouds()).toBe(false);
        expect(state.getViewOrbit()).toBe(false);
        expect(state.getViewLunarCraters()).toBe(true);
        expect(state.getLunarCraterHoverLabels()).toBe(false);
        expect(state.getLunarCraterDisplayMode()).toBe("always");
        expect(state.getLunarCraterLimit()).toBe(250);
        expect(state.getViewMoonSOI()).toBe(true);
        expect(state.getViewBodyHalos()).toBe(false);
        expect(state.getViewMoonOsculatingOrbit()).toBe(true);
        expect(state.getViewXYZAxes()).toBe(false);
        expect(state.getViewConstellationLines()).toBe(false);

        state.setViewEquatorialPlane(true);
        state.setViewLunarCraters(false);
        state.setLunarCraterHoverLabels(true);
        state.setLunarCraterDisplayMode("hover");
        state.setLunarCraterLimit(75);
        state.setViewEarthClouds(true);
        state.setViewFPS(false);

        const flags = state.getViewFlags();
        expect(flags.viewEarthClouds).toBe(true);
        expect(flags.viewLunarCraters).toBe(false);
        expect(flags.lunarCraterHoverLabels).toBe(true);
        expect(flags.lunarCraterDisplayMode).toBe("hover");
        expect(flags.lunarCraterLimit).toBe(75);
        expect(flags.viewEquatorialPlane).toBe(true);
        expect(flags.viewFPS).toBe(false);
    });
});


