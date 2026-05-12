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
    displayLimit = 120,
    hoverLabelsEnabled = true,
} = {}) {
    const animationScene = {
        lunarCraterGroup: { name: "lunar-crater-annotations", visible },
        lunarCraterDisplayMode: displayMode,
        lunarCraterDisplayLimit: displayLimit,
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
            displayLimit: 75,
            hoverLabelsEnabled: true,
        });
        const renderedPresentation = [];

        renderWithLunarCraterView({
            viewId: LUNAR_CRATER_VIEW_IDS.FRAME_AND_SHOOT,
            viewState: {
                viewLunarCraters: true,
                lunarCraterDisplayMode: LUNAR_CRATER_DISPLAY_MODE_ALWAYS,
                lunarCraterHoverLabels: false,
                lunarCraterLimit: 250,
            },
            animationScene,
            scene,
            render: () => {
                renderedPresentation.push({
                    visible: animationScene.lunarCraterGroup.visible,
                    displayMode: animationScene.lunarCraterDisplayMode,
                    displayLimit: animationScene.lunarCraterDisplayLimit,
                    hoverLabelsEnabled: animationScene.lunarCraterHoverLabelsEnabled,
                });
            },
        });

        expect(renderedPresentation).toEqual([{
            visible: true,
            displayMode: LUNAR_CRATER_DISPLAY_MODE_ALWAYS,
            displayLimit: 250,
            hoverLabelsEnabled: false,
        }]);
        expect(animationScene.lunarCraterDisplayMode).toBe(LUNAR_CRATER_DISPLAY_MODE_HOVER);
        expect(animationScene.lunarCraterDisplayLimit).toBe(75);
        expect(animationScene.lunarCraterHoverLabelsEnabled).toBe(true);
        expect(animationScene.lunarCraterGroup.visible).toBe(true);
        expect(animationScene.updateLunarCraterLabelScales).toHaveBeenCalledWith({
            camera: null,
            rendererDomElement: null,
        });
    });

    it("uses the Frame and Shoot pointer only for hover-mode crater renders", () => {
        const { animationScene, scene } = makeCraterScene();
        const camera = {};
        const rendererDomElement = {};

        renderWithLunarCraterView({
            viewId: LUNAR_CRATER_VIEW_IDS.FRAME_AND_SHOOT,
            viewState: {
                viewLunarCraters: true,
                lunarCraterDisplayMode: LUNAR_CRATER_DISPLAY_MODE_HOVER,
                lunarCraterHoverLabels: true,
                lunarCraterLimit: 120,
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
        });
    });
});
