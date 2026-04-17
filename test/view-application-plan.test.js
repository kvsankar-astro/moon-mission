import { describe, expect, it } from "vitest";

import {
    buildSceneViewPlan,
    extractSkyParameterPatch,
} from "../src/platform/js/app/view-application-plan.js";

function createGlobalConfig() {
    return {
        is_lunar: true,
        landing: {
            enabled: true,
        },
        crafts: [
            {
                id: "PM",
                mnemonic: "PM",
                primary: true,
            },
            {
                id: "VIKRAM",
                mnemonic: "VIKRAM",
                primary: false,
            },
        ],
    };
}

function createScene() {
    return {
        activeCraftId: "VIKRAM",
        primaryCraftId: "PM",
        viewAdditionalCrafts: true,
        visibleCraftIds: ["PM", "VIKRAM"],
        planetsForLocations: ["EARTH", "MOON", "PM", "VIKRAM"],
    };
}

function createRequestedView(overrides = {}) {
    return {
        viewOrbit: true,
        viewOrbitDescent: true,
        viewMoonOsculatingOrbit: true,
        trailTrackBrightness2D: 0.6,
        trailTrackBrightness3D: 0.8,
        trailTailBrightness2D: 0.5,
        trailTailBrightness3D: 1.2,
        ...overrides,
    };
}

describe("view application plan", () => {
    it("resolves a single active craft when additional crafts are disabled", () => {
        const plan = buildSceneViewPlan({
            configKey: "geo",
            requestedView: createRequestedView({
                viewAdditionalCrafts: false,
            }),
            scene: createScene(),
            globalConfig: createGlobalConfig(),
            isRelativeOriginSelected: false,
        });

        expect(plan.view.activeCraftId).toBe("VIKRAM");
        expect(plan.visibleCraftIds).toEqual(["VIKRAM"]);
        expect(plan.nextActiveCraftId).toBe("VIKRAM");
        expect(plan.nextViewAdditionalCrafts).toBe(false);
    });

    it("normalizes explicit visible craft ids and preserves the requested active craft", () => {
        const plan = buildSceneViewPlan({
            configKey: "lunar",
            requestedView: createRequestedView({
                activeCraftId: "PM",
                visibleCraftIds: ["VIKRAM", "EARTH", "VIKRAM", "NOPE"],
            }),
            scene: createScene(),
            globalConfig: createGlobalConfig(),
            isRelativeOriginSelected: false,
        });

        expect(plan.view.activeCraftId).toBe("PM");
        expect(plan.visibleCraftIds).toEqual(["VIKRAM"]);
        expect(plan.nextActiveCraftId).toBe("VIKRAM");
        expect(plan.nextViewAdditionalCrafts).toBe(false);
    });

    it("keeps secondary-body osculating orbits hidden in relative mode", () => {
        const relativePlan = buildSceneViewPlan({
            configKey: "geo",
            requestedView: createRequestedView({
                viewOrbit: false,
            }),
            scene: createScene(),
            globalConfig: createGlobalConfig(),
            isRelativeOriginSelected: true,
        });
        const absolutePlan = buildSceneViewPlan({
            configKey: "geo",
            requestedView: createRequestedView({
                viewOrbit: false,
            }),
            scene: createScene(),
            globalConfig: createGlobalConfig(),
            isRelativeOriginSelected: false,
        });

        expect(relativePlan.orbitVisibilityByBodyId.MOON).toBe(false);
        expect(relativePlan.showMoonOsculatingOrbit).toBe(false);
        expect(absolutePlan.orbitVisibilityByBodyId.MOON).toBe(true);
        expect(absolutePlan.showMoonOsculatingOrbit).toBe(true);
        expect(absolutePlan.orbitVisibilityByBodyId.PM).toBe(false);
    });

    it("extracts only supported numeric and boolean sky parameters", () => {
        expect(extractSkyParameterPatch({
            atmosphere_enabled: true,
            bloom_strength: 1.5,
            star_size_scale: 0.75,
            observer_lon: 12,
            sky_time_ms: 12345,
            ignored: "value",
        })).toEqual({
            atmosphere_enabled: true,
            bloom_strength: 1.5,
            star_size_scale: 0.75,
            observer_lon: 12,
            sky_time_ms: 12345,
        });

        expect(extractSkyParameterPatch({
            atmosphere_enabled: "yes",
            bloom_strength: NaN,
        })).toBe(null);
    });
});
