import { describe, expect, it, vi } from "vitest";

import { createSceneViewStateActions } from "../src/platform/js/app/scene-view-state.js";

const defaultViewState = {
    planeSelection: "DEFAULT",
    plane: "xy",
    xFactor: 1,
    yFactor: 2,
    zFactor: 3,
    xVariable: "x",
    yVariable: "y",
    zVariable: "z",
    vxVariable: "vx",
    vyVariable: "vy",
    vzVariable: "vz",
    zoomFactor: 4,
    panx: 5,
    pany: 6,
};

function createActions({
    currentConfig = { id: "current" },
    scenes = new Map(),
    legacyZoomFactor = 1,
    legacyPanX = 2,
    legacyPanY = 3,
} = {}) {
    return createSceneViewStateActions({
        defaultViewState,
        getConfig: () => currentConfig,
        getGlobalConfig: () => ({}),
        getSceneForConfig: (cfg) => scenes.get(cfg) || null,
        normalizePlaneSelection: (value) => value,
        getPlaneVariablesForSelection: vi.fn(),
        syncPlaneSelectionControls: (value) => value,
        setChecked: vi.fn(),
        getLegacyPlaneSelection: () => defaultViewState.planeSelection,
        setLegacyPlaneSelection: vi.fn(),
        getLegacyPlaneVariables: () => null,
        setLegacyPlaneVariables: vi.fn(),
        getLegacyZoomFactor: () => legacyZoomFactor,
        setLegacyZoomFactor: vi.fn(),
        getLegacyPanX: () => legacyPanX,
        setLegacyPanX: vi.fn(),
        getLegacyPanY: () => legacyPanY,
        setLegacyPanY: vi.fn(),
    });
}

describe("scene-view-state", () => {
    it("reads zoom and pan from the active scene before falling back to legacy globals", () => {
        const currentConfig = { id: "current" };
        const scene = {
            zoomFactor: 12,
            panx: 13,
            pany: 14,
        };
        const actions = createActions({
            currentConfig,
            scenes: new Map([[currentConfig, scene]]),
            legacyZoomFactor: 1,
            legacyPanX: 2,
            legacyPanY: 3,
        });

        expect(actions.getZoomFactorState(currentConfig)).toBe(12);
        expect(actions.getPanXState(currentConfig)).toBe(13);
        expect(actions.getPanYState(currentConfig)).toBe(14);
    });

    it("falls back to legacy globals when no scene state exists", () => {
        const actions = createActions({
            legacyZoomFactor: 21,
            legacyPanX: 22,
            legacyPanY: 23,
        });

        expect(actions.getZoomFactorState()).toBe(21);
        expect(actions.getPanXState()).toBe(22);
        expect(actions.getPanYState()).toBe(23);
    });
});
