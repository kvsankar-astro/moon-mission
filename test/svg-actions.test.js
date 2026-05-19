import { afterEach, describe, expect, it } from "vitest";

import { createSvgActions } from "../src/platform/js/app/svg-actions.js";

function createActionsWithState({ surfaceRect } = {}) {
    const state = {};
    const surface = surfaceRect
        ? {
            getBoundingClientRect: () => surfaceRect,
        }
        : null;
    const baseline = {
        getBoundingClientRect: () => ({ top: surfaceRect?.top || 0 }),
    };

    globalThis.window = {
        innerWidth: 1600,
        innerHeight: 900,
    };
    globalThis.document = {
        getElementById(id) {
            if (id === "mission-main-view-surface") return surface;
            if (id === "svg-top-baseline") return baseline;
            return null;
        },
    };

    const actions = createSvgActions({
        d3: {},
        getConfig: () => "artemis2",
        getCurrentDimension: () => "3D",
        setSvgContainer: (value) => { state.svgContainer = value; },
        setDataLoaded: (value) => { state.dataLoaded = value; },
        setSvgX: (value) => { state.svgX = value; },
        setSvgY: (value) => { state.svgY = value; },
        setSvgWidth: (value) => { state.svgWidth = value; },
        setSvgHeight: (value) => { state.svgHeight = value; },
        setOffsetX: (value) => { state.offsetX = value; },
        setOffsetY: (value) => { state.offsetY = value; },
        getOffsetX: () => state.offsetX,
        getOffsetY: () => state.offsetY,
        updateProgressLabel: () => {},
    });

    return { actions, state };
}

describe("svg actions", () => {
    afterEach(() => {
        delete globalThis.window;
        delete globalThis.document;
    });

    it("uses the full docked main view dimensions for the render surface", () => {
        const { actions, state } = createActionsWithState({
            surfaceRect: {
                left: 370,
                top: 91,
                width: 640,
                height: 662,
            },
        });

        actions.computeSVGDimensions();

        expect(state.svgWidth).toBe(640);
        expect(state.svgHeight).toBe(662);
    });
});
