import { describe, expect, it } from "vitest";
import {
    applySceneOrbitVisibility,
    getSceneOrbitBuildOrder,
    getSceneVisibleCraftIds,
    setSceneVisibleCraftIds,
} from "../src/platform/js/app/scene-craft-helpers.js";

function createScene() {
    const orbLine = { visible: true, userData: { bodyId: "ORB" } };
    const landLine = { visible: true, userData: { bodyId: "LAND" } };
    const orphanLandLine = { visible: true, userData: { bodyId: "LAND" } };

    return {
        planetsForLocations: ["ORB", "LAND"],
        primaryCraftId: "ORB",
        activeCraftId: "ORB",
        visibleCraftIds: ["ORB"],
        orbitLinesByBodyId: {
            ORB: [orbLine],
            LAND: [landLine],
        },
        orbitLines: [orbLine, landLine, orphanLandLine],
    };
}

const globalConfig = {
    primaryCraftId: "ORB",
    crafts: [{ id: "ORB", primary: true }, { id: "LAND" }],
};

describe("scene-craft-helpers orbit visibility", () => {
    it("hides orbit lines for crafts that are not currently visible", () => {
        const scene = createScene();

        applySceneOrbitVisibility(scene, globalConfig, true);

        expect(scene.orbitLinesByBodyId.ORB[0].visible).toBe(true);
        expect(scene.orbitLinesByBodyId.LAND[0].visible).toBe(false);
        expect(scene.orbitLines[2].visible).toBe(false);
    });

    it("hides all orbit lines when orbit view is disabled", () => {
        const scene = createScene();
        setSceneVisibleCraftIds(scene, globalConfig, ["ORB", "LAND"]);

        applySceneOrbitVisibility(scene, globalConfig, false);

        expect(scene.orbitLines.every((orbitLine) => orbitLine.visible === false)).toBe(true);
    });

    it("defaults to the comparison overlay craft pair when compare mode injects a second mission", () => {
        const scene = {
            ...createScene(),
            planetsForLocations: ["ORB", "LAND", "CMP_ARTEMIS1_ORION"],
            visibleCraftIds: null,
        };
        const compareGlobalConfig = {
            ...globalConfig,
            crafts: [
                ...globalConfig.crafts,
                { id: "CMP_ARTEMIS1_ORION", primary: false },
            ],
            comparisonOverlay: {
                defaultVisibleCraftIds: ["ORB", "CMP_ARTEMIS1_ORION"],
            },
        };

        expect(getSceneVisibleCraftIds(scene, compareGlobalConfig)).toEqual([
            "ORB",
            "CMP_ARTEMIS1_ORION",
        ]);
    });

    it("prioritizes the active visible craft when building orbit lines", () => {
        const scene = {
            ...createScene(),
            planetsForLocations: ["CH3O", "CH3L"],
            primaryCraftId: "CH3L",
            activeCraftId: "CH3L",
            visibleCraftIds: ["CH3L"],
        };
        const multiCraftGlobalConfig = {
            primaryCraftId: "CH3L",
            crafts: [{ id: "CH3O" }, { id: "CH3L", primary: true }],
        };

        expect(getSceneOrbitBuildOrder(scene, multiCraftGlobalConfig)).toEqual([
            "CH3L",
            "CH3O",
        ]);
    });

    it("builds compare mode's visible mission pair before hidden support craft", () => {
        const scene = {
            ...createScene(),
            planetsForLocations: ["ORB", "LAND", "CMP_ARTEMIS1_ORION"],
            primaryCraftId: "ORB",
            activeCraftId: "ORB",
            visibleCraftIds: ["ORB", "CMP_ARTEMIS1_ORION"],
        };
        const compareGlobalConfig = {
            ...globalConfig,
            crafts: [
                ...globalConfig.crafts,
                { id: "CMP_ARTEMIS1_ORION", primary: false },
            ],
        };

        expect(getSceneOrbitBuildOrder(scene, compareGlobalConfig)).toEqual([
            "ORB",
            "CMP_ARTEMIS1_ORION",
            "LAND",
        ]);
    });
});
