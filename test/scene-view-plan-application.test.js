import { describe, expect, it, vi } from "vitest";

import { applySceneViewPlanToScene } from "../src/platform/js/app/scene-view-plan-application.js";

function createOrbitElement() {
    return {
        attributes: {},
        setAttribute(name, value) {
            this.attributes[name] = value;
        },
    };
}

describe("scene view plan application", () => {
    it("applies shared scene state and orbit element visibility", () => {
        const earthOrbit = createOrbitElement();
        const moonOrbit = createOrbitElement();
        const scene = {
            planetsForLocations: ["EARTH", "MOON"],
        };
        const plan = {
            view: {
                trailTrackBrightness2D: 0.5,
                trailTailBrightness2D: 0.6,
            },
            trailContextOpacity2D: 0.1,
            trailContextOpacity3D: 0.2,
            trailTailProminence2D: 0.3,
            trailTailProminence3D: 0.4,
            visibleCraftIds: ["SC"],
            nextViewAdditionalCrafts: false,
            nextActiveCraftId: "SC",
            effectiveOrbitStyle: "trail",
            orbitVisibilityByBodyId: {
                EARTH: true,
                MOON: false,
            },
        };
        const setSceneVisibleCraftIds = vi.fn();
        const syncSceneActiveCraft = vi.fn();
        const refreshSceneOrbitStyleOpacities = vi.fn();
        const applySceneTailProminence = vi.fn();
        const applyOrbitSvgStyle = vi.fn();

        applySceneViewPlanToScene({
            scene,
            configKey: "geo",
            plan,
            globalConfig: {},
            documentRef: {
                getElementById(id) {
                    return id === "orbit-EARTH"
                        ? earthOrbit
                        : id === "orbit-MOON"
                            ? moonOrbit
                            : null;
                },
            },
            applyOrbitSvgStyle,
            applySceneTailProminence,
            applySceneOrbitVisibility: vi.fn(),
            setSceneVisibleCraftIds,
            syncSceneActiveCraft,
            refreshSceneOrbitStyleOpacities,
            applySkyLayerVisibility: vi.fn(),
        });

        expect(scene.trailContextOpacity2D).toBe(0.1);
        expect(scene.trailContextOpacity3D).toBe(0.2);
        expect(scene.trailTailProminence2D).toBe(0.3);
        expect(scene.trailTailProminence3D).toBe(0.4);
        expect(scene.viewAdditionalCrafts).toBe(false);
        expect(setSceneVisibleCraftIds).toHaveBeenCalledWith(scene, {}, ["SC"]);
        expect(syncSceneActiveCraft).toHaveBeenCalledWith(scene, {}, "SC");
        expect(refreshSceneOrbitStyleOpacities).toHaveBeenCalledWith(scene);
        expect(applySceneTailProminence).toHaveBeenCalledWith(scene, 0.3, 0.4);
        expect(applyOrbitSvgStyle).toHaveBeenNthCalledWith(1, earthOrbit, "trail", 0.5, 0.6);
        expect(applyOrbitSvgStyle).toHaveBeenNthCalledWith(2, moonOrbit, "trail", 0.5, 0.6);
        expect(earthOrbit.attributes.visibility).toBe("visible");
        expect(moonOrbit.attributes.visibility).toBe("hidden");
    });

    it("applies 3D helper visibility for lunar scenes", () => {
        const applySceneOrbitVisibility = vi.fn();
        const applySkyLayerVisibility = vi.fn();
        const scene = {
            initialized3D: true,
            locations: [{ visible: false }],
            axesHelper: { visible: false },
            earthNorthPoleSphere: { visible: false },
            earthSouthPoleSphere: { visible: false },
            earthAxis: { visible: false },
            moonNorthPoleSphere: { visible: false },
            moonSouthPoleSphere: { visible: false },
            moonAxis: { visible: false },
            moonSOISphere: { visible: false },
            moonHillSphere: { visible: false },
            moonOsculatingOrbitLine: { visible: false },
            moonRenderer: {
                setLatLonGridVisible: vi.fn(),
                setLatLonLabelsVisible: vi.fn(),
                setLatLonHoverEnabled: vi.fn(),
            },
            landingOrbitLine: { visible: false },
            sceneHelpers: {
                setBodyHalosVisible: vi.fn(),
                setEclipticPlaneVisible: vi.fn(),
                setEquatorialPlaneVisible: vi.fn(),
            },
            skyRenderer: {
                setParameters: vi.fn(),
                setTime: vi.fn(),
            },
            eclipticPlaneHelper: { visible: false },
            eclipticPolarGridHelper: { visible: false },
            equatorialPlaneHelper: { visible: false },
            equatorialPolarGridHelper: { visible: false },
            setLunarCraterAnnotationsVisible: vi.fn(),
            setLunarCraterDiameterRange: vi.fn(),
            setLunarCraterDisplayMode: vi.fn(),
            setLunarCraterHoverLabelsEnabled: vi.fn(),
        };
        const plan = {
            view: {
                viewOrbit: true,
                trailTrackBrightness3D: 0.8,
                trailTailBrightness3D: 0.9,
                viewCraters: true,
                viewLunarCraters: true,
                lunarCraterMinDiameterKm: 40,
                lunarCraterMaxDiameterKm: 120,
                lunarCraterHoverLabels: true,
                lunarCraterDisplayMode: "always",
                viewXYZAxes: true,
                viewPoles: true,
                viewBodyHalos: true,
                viewPolarAxes: true,
                viewMoonLatLonGrid: true,
                viewMoonLatLonLabels: false,
                viewMoonLatLonHover: true,
                viewMoonSOI: true,
                viewMoonHillSphere: true,
                viewSky: true,
                viewConstellationLines: false,
                viewEclipticPlane: true,
                viewEquatorialPlane: false,
            },
            effectiveOrbitStyle: "trail",
            showLandingOrbit: true,
            showMoonOsculatingOrbit: true,
            skyPatch: {
                sky_time_ms: 1234,
                star_exposure: 0.5,
            },
        };

        applySceneViewPlanToScene({
            scene,
            configKey: "lunar",
            plan,
            globalConfig: {
                is_lunar: true,
                landing: {
                    enabled: true,
                },
            },
            documentRef: null,
            applyOrbitSvgStyle: vi.fn(),
            applySceneTailProminence: vi.fn(),
            applySceneOrbitVisibility,
            setSceneVisibleCraftIds: vi.fn(),
            syncSceneActiveCraft: vi.fn(),
            refreshSceneOrbitStyleOpacities: vi.fn(),
            applySkyLayerVisibility,
        });

        expect(applySceneOrbitVisibility).toHaveBeenCalledWith(
            scene,
            {
                is_lunar: true,
                landing: {
                    enabled: true,
                },
            },
            true,
            "trail",
            0.8,
            0.9,
        );
        expect(scene.locations[0].visible).toBe(true);
        expect(scene.setLunarCraterDisplayMode).toHaveBeenCalledWith("always");
        expect(scene.setLunarCraterDiameterRange).toHaveBeenCalledWith({
            lunarCraterMinDiameterKm: 40,
            lunarCraterMaxDiameterKm: 120,
        });
        expect(scene.setLunarCraterHoverLabelsEnabled).toHaveBeenCalledWith(true);
        expect(scene.setLunarCraterAnnotationsVisible).toHaveBeenCalledWith(true);
        expect(scene.axesHelper.visible).toBe(true);
        expect(scene.earthNorthPoleSphere.visible).toBe(true);
        expect(scene.earthSouthPoleSphere.visible).toBe(true);
        expect(scene.earthAxis.visible).toBe(true);
        expect(scene.moonNorthPoleSphere.visible).toBe(true);
        expect(scene.moonSouthPoleSphere.visible).toBe(true);
        expect(scene.moonAxis.visible).toBe(true);
        expect(scene.moonRenderer.setLatLonGridVisible).toHaveBeenCalledWith(true);
        expect(scene.moonRenderer.setLatLonLabelsVisible).toHaveBeenCalledWith(false);
        expect(scene.moonRenderer.setLatLonHoverEnabled).toHaveBeenCalledWith(true);
        expect(scene.moonSOISphere.visible).toBe(true);
        expect(scene.moonHillSphere.visible).toBe(true);
        expect(scene.moonOsculatingOrbitLine.visible).toBe(true);
        expect(scene.landingOrbitLine.visible).toBe(true);
        expect(scene.sceneHelpers.setBodyHalosVisible).toHaveBeenCalledWith(true);
        expect(applySkyLayerVisibility).toHaveBeenCalledWith(scene, {
            viewSky: true,
            viewConstellationLines: false,
        });
        expect(scene.skyRenderer.setParameters).toHaveBeenCalledWith(plan.skyPatch);
        expect(scene.skyRenderer.setTime).toHaveBeenCalledWith(1234);
        expect(scene.sceneHelpers.setEclipticPlaneVisible).toHaveBeenCalledWith(true);
        expect(scene.sceneHelpers.setEquatorialPlaneVisible).toHaveBeenCalledWith(false);
        expect(scene.eclipticPlaneHelper.visible).toBe(true);
        expect(scene.eclipticPolarGridHelper.visible).toBe(true);
        expect(scene.equatorialPlaneHelper.visible).toBe(false);
        expect(scene.equatorialPolarGridHelper.visible).toBe(false);
    });
});
