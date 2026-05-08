import { describe, expect, it } from "vitest";

import {
    clampMediaImagePan,
    createDefaultMediaImageViewState,
    zoomMediaImageViewState,
} from "../src/platform/js/app/media-browser-panel.js";

describe("media browser image view state", () => {
    it("resets pan when zoom returns to the fit view", () => {
        expect(clampMediaImagePan({
            zoom: 1,
            panX: 120,
            panY: -80,
        }, {
            width: 400,
            height: 300,
        })).toEqual(createDefaultMediaImageViewState());
    });

    it("clamps pan to the visible overflow created by zoom", () => {
        expect(clampMediaImagePan({
            zoom: 2,
            panX: 500,
            panY: -500,
        }, {
            width: 400,
            height: 300,
        })).toEqual({
            zoom: 2,
            panX: 200,
            panY: -150,
        });
    });

    it("keeps zoom inside the supported range while preserving valid pan", () => {
        expect(zoomMediaImageViewState({
            zoom: 5,
            panX: 60,
            panY: -30,
        }, 2, {
            width: 400,
            height: 300,
        })).toEqual({
            zoom: 6,
            panX: 60,
            panY: -30,
        });
    });
});
