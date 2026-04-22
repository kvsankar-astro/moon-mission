import { describe, expect, it } from "vitest";
import {
    applySceneOrbitVisibility,
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
});
