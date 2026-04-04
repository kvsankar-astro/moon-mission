import { describe, expect, it } from "vitest";

import { AUXILIARY_VIEW_CAMERA_PRESETS } from "../src/platform/js/app/auxiliary-camera-views.js";

describe("AUXILIARY_VIEW_CAMERA_PRESETS", () => {
    it("exposes the three desktop auxiliary view semantics for mobile reuse", () => {
        expect(AUXILIARY_VIEW_CAMERA_PRESETS).toEqual([
            {
                id: "earth",
                label: "Craft -> Earth",
                positionMode: "spacecraft",
                lookMode: "earth",
            },
            {
                id: "moon",
                label: "Craft -> Moon",
                positionMode: "spacecraft",
                lookMode: "moon",
            },
            {
                id: "earth-to-moon",
                label: "Earth -> Moon",
                positionMode: "earth",
                lookMode: "moon",
            },
        ]);
    });
});
