import { describe, expect, it, vi } from "vitest";

import { renderWithSurfacePointView } from "../src/platform/js/app/surface-point-view-renderer.js";

describe("renderWithSurfacePointView", () => {
    it("applies a temporary surface point state and restores the scene state after render", () => {
        const scene = {
            surfacePointMarkerVisibility: {
                viewSubSolarEarth: true,
                viewSolarGlintEarth: false,
            },
            setSurfacePointMarkersVisible: vi.fn(function (state) {
                this.surfacePointMarkerVisibility = { ...state };
            }),
        };
        const render = vi.fn(() => {
            expect(scene.surfacePointMarkerVisibility.viewSubSolarEarth).toBe(false);
            expect(scene.surfacePointMarkerVisibility.viewSolarGlintEarth).toBe(true);
        });

        renderWithSurfacePointView({
            animationScene: scene,
            viewState: {
                viewSolarGlintEarth: true,
            },
            render,
        });

        expect(render).toHaveBeenCalledTimes(1);
        expect(scene.setSurfacePointMarkersVisible).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                viewSubSolarEarth: false,
                viewSolarGlintEarth: true,
            }),
            { renderNow: false },
        );
        expect(scene.setSurfacePointMarkersVisible).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                viewSubSolarEarth: true,
                viewSolarGlintEarth: false,
            }),
            { renderNow: false },
        );
        expect(scene.surfacePointMarkerVisibility.viewSubSolarEarth).toBe(true);
        expect(scene.surfacePointMarkerVisibility.viewSolarGlintEarth).toBe(false);
    });
});
