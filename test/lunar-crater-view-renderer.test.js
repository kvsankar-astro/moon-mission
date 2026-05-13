import { describe, expect, it, vi } from "vitest";

import { renderWithLunarCraterView } from "../src/platform/js/app/lunar-crater-view-renderer.js";
import {
    LUNAR_CRATER_DISPLAY_MODE_ALWAYS,
    LUNAR_CRATER_DISPLAY_MODE_HOVER,
    LUNAR_CRATER_VIEW_IDS,
} from "../src/platform/js/core/domain/lunar-crater-view.js";

function makeCraterScene({
    visible = true,
    displayMode = LUNAR_CRATER_DISPLAY_MODE_HOVER,
    minDiameterKm = 80,
    maxDiameterKm = 600,
    hoverLabelsEnabled = true,
} = {}) {
    const animationScene = {
        lunarCraterGroup: { name: "lunar-crater-annotations", visible },
        lunarCraterDisplayMode: displayMode,
        lunarCraterMinDiameterKm: minDiameterKm,
        lunarCraterMaxDiameterKm: maxDiameterKm,
        lunarCraterHoverLabelsEnabled: hoverLabelsEnabled,
        addLunarCraterAnnotations: vi.fn(function addLunarCraterAnnotations() {
            this.lunarCraterGroup = {
                name: "lunar-crater-annotations",
                visible: false,
            };
        }),
        setLunarCraterHoverLabelsEnabled: vi.fn(function setLunarCraterHoverLabelsEnabled(enabled) {
            this.lunarCraterHoverLabelsEnabled = enabled !== false;
        }),
        updateLunarCraterHoverFromPointer: vi.fn(),
        clearLunarCraterHover: vi.fn(),
        updateLunarCraterLabelScales: vi.fn(),
        disposeLunarCraterAnnotations: vi.fn(function disposeLunarCraterAnnotations() {
            this.lunarCraterGroup = null;
        }),
    };
    const scene = {
        getObjectByName: vi.fn((name) =>
            name === "lunar-crater-annotations" ? animationScene.lunarCraterGroup : null,
        ),
    };
    return { animationScene, scene };
}

describe("renderWithLunarCraterView", () => {
    it("hides crater annotations for unsupported auxiliary views only during render", () => {
        const { animationScene, scene } = makeCraterScene({ visible: true });
        const renderedVisibility = [];

        renderWithLunarCraterView({
            viewId: "craft_to_moon",
            viewState: { viewLunarCraters: true },
            animationScene,
            scene,
            render: () => {
                renderedVisibility.push(animationScene.lunarCraterGroup.visible);
            },
        });

        expect(renderedVisibility).toEqual([false]);
        expect(animationScene.lunarCraterGroup.visible).toBe(true);
        expect(animationScene.addLunarCraterAnnotations).not.toHaveBeenCalled();
    });

    it("applies Frame and Shoot crater state and restores the shared scene presentation", () => {
        const { animationScene, scene } = makeCraterScene({
            visible: true,
            displayMode: LUNAR_CRATER_DISPLAY_MODE_HOVER,
            minDiameterKm: 60,
            maxDiameterKm: 240,
            hoverLabelsEnabled: true,
        });
        const renderedPresentation = [];

        renderWithLunarCraterView({
            viewId: LUNAR_CRATER_VIEW_IDS.FRAME_AND_SHOOT,
            viewState: {
                viewLunarCraters: true,
                lunarCraterDisplayMode: LUNAR_CRATER_DISPLAY_MODE_ALWAYS,
                lunarCraterHoverLabels: false,
                lunarCraterMinDiameterKm: 40,
                lunarCraterMaxDiameterKm: 120,
            },
            animationScene,
            scene,
            render: () => {
                renderedPresentation.push({
                    visible: animationScene.lunarCraterGroup.visible,
                    displayMode: animationScene.lunarCraterDisplayMode,
                    minDiameterKm: animationScene.lunarCraterMinDiameterKm,
                    maxDiameterKm: animationScene.lunarCraterMaxDiameterKm,
                    hoverLabelsEnabled: animationScene.lunarCraterHoverLabelsEnabled,
                });
            },
        });

        expect(renderedPresentation).toEqual([{
            visible: true,
            displayMode: LUNAR_CRATER_DISPLAY_MODE_ALWAYS,
            minDiameterKm: 40,
            maxDiameterKm: 120,
            hoverLabelsEnabled: false,
        }]);
        expect(animationScene.lunarCraterDisplayMode).toBe(LUNAR_CRATER_DISPLAY_MODE_HOVER);
        expect(animationScene.lunarCraterMinDiameterKm).toBe(60);
        expect(animationScene.lunarCraterMaxDiameterKm).toBe(240);
        expect(animationScene.lunarCraterHoverLabelsEnabled).toBe(true);
        expect(animationScene.lunarCraterGroup.visible).toBe(true);
        expect(animationScene.updateLunarCraterLabelScales).toHaveBeenCalledWith({
            camera: null,
            rendererDomElement: null,
            freezeScale: false,
        });
    });

    it("uses the Frame and Shoot pointer for hover-mode crater renders", () => {
        const { animationScene, scene } = makeCraterScene();
        const camera = {};
        const rendererDomElement = {};

        renderWithLunarCraterView({
            viewId: LUNAR_CRATER_VIEW_IDS.FRAME_AND_SHOOT,
            viewState: {
                viewLunarCraters: true,
                lunarCraterDisplayMode: LUNAR_CRATER_DISPLAY_MODE_HOVER,
                lunarCraterHoverLabels: true,
                lunarCraterMinDiameterKm: 80,
                lunarCraterMaxDiameterKm: 600,
            },
            animationScene,
            scene,
            camera,
            rendererDomElement,
            pointer: { clientX: 12, clientY: 34 },
            render: vi.fn(),
        });

        expect(animationScene.updateLunarCraterHoverFromPointer).toHaveBeenCalledWith({
            camera,
            rendererDomElement,
            clientX: 12,
            clientY: 34,
        });
        expect(animationScene.clearLunarCraterHover).not.toHaveBeenCalled();
        expect(animationScene.updateLunarCraterLabelScales).toHaveBeenCalledWith({
            camera,
            rendererDomElement,
            freezeScale: false,
        });
    });

    it("can freeze crater label scale updates while a view camera is being dragged", () => {
        const { animationScene, scene } = makeCraterScene();
        const camera = {};
        const rendererDomElement = {};

        renderWithLunarCraterView({
            viewId: LUNAR_CRATER_VIEW_IDS.FRAME_AND_SHOOT,
            viewState: {
                viewLunarCraters: true,
                lunarCraterDisplayMode: LUNAR_CRATER_DISPLAY_MODE_ALWAYS,
                lunarCraterHoverLabels: true,
            },
            animationScene,
            scene,
            camera,
            rendererDomElement,
            freezeLabelScale: true,
            render: vi.fn(),
        });

        expect(animationScene.updateLunarCraterLabelScales).toHaveBeenCalledWith({
            camera,
            rendererDomElement,
            freezeScale: true,
        });
    });

    it("uses the Frame and Shoot pointer for Show Always hover inspection", () => {
        const { animationScene, scene } = makeCraterScene();
        const camera = {};
        const rendererDomElement = {};

        renderWithLunarCraterView({
            viewId: LUNAR_CRATER_VIEW_IDS.FRAME_AND_SHOOT,
            viewState: {
                viewLunarCraters: true,
                lunarCraterDisplayMode: LUNAR_CRATER_DISPLAY_MODE_ALWAYS,
                lunarCraterHoverLabels: true,
                lunarCraterMinDiameterKm: 80,
                lunarCraterMaxDiameterKm: 600,
            },
            animationScene,
            scene,
            camera,
            rendererDomElement,
            pointer: { clientX: 56, clientY: 78 },
            render: vi.fn(),
        });

        expect(animationScene.setLunarCraterHoverLabelsEnabled).toHaveBeenCalledWith(true);
        expect(animationScene.updateLunarCraterHoverFromPointer).toHaveBeenCalledWith({
            camera,
            rendererDomElement,
            clientX: 56,
            clientY: 78,
        });
        expect(animationScene.clearLunarCraterHover).not.toHaveBeenCalled();
    });
});
