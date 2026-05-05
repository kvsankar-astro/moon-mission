import { describe, expect, it, vi } from "vitest";

import {
    configureBodyRenderLayers,
    configureCraftRenderLayers,
    configureSkyRenderLayers,
} from "../src/platform/js/app/scene-render-layers.js";
import { LIGHT_SETTINGS as LT } from "../src/platform/js/core/constants.js";

function createCamera() {
    return {
        layers: {
            set: vi.fn(),
            enable: vi.fn(),
        },
    };
}

describe("scene-render-layers", () => {
    it("configures sky renders on the sky-only layer", () => {
        const camera = createCamera();
        configureSkyRenderLayers(camera);
        expect(camera.layers.set).toHaveBeenCalledWith(2);
        expect(camera.layers.enable).not.toHaveBeenCalled();
    });

    it("configures body renders with reflected-light layers enabled", () => {
        const camera = createCamera();
        configureBodyRenderLayers(camera);
        expect(camera.layers.set).toHaveBeenCalledWith(0);
        expect(camera.layers.enable).toHaveBeenCalledWith(LT.EARTH_REFLECTED_LIGHT_LAYER);
        expect(camera.layers.enable).toHaveBeenCalledWith(LT.MOON_REFLECTED_LIGHT_LAYER);
    });

    it("configures craft renders on the craft-only layer", () => {
        const camera = createCamera();
        configureCraftRenderLayers(camera);
        expect(camera.layers.set).toHaveBeenCalledWith(1);
        expect(camera.layers.enable).not.toHaveBeenCalled();
    });
});
