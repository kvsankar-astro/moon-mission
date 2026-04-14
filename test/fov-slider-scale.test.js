import { describe, expect, it } from "vitest";

import {
    DEFAULT_FOV_SLIDER_MIDPOINT_DEGREES,
    FOV_SLIDER_SCALE_MAX,
    FOV_SLIDER_SCALE_MIN,
    clampFovDegrees,
    formatFovDegreesLabel,
    fovDegreesToZoomSliderValue,
    zoomSliderValueToFovDegrees,
} from "../src/platform/js/app/fov-slider-scale.js";

describe("fov slider scale", () => {
    it("round-trips FoV degrees through the zoom slider scale", () => {
        const samples = [0.1, 0.4, 1, 5, 27.3, 50, 90, 140, 179];

        for (const sample of samples) {
            const sliderValue = fovDegreesToZoomSliderValue(sample, {
                minDegrees: 0.1,
                maxDegrees: 179,
                fallbackDegrees: 50,
            });
            const nextFov = zoomSliderValueToFovDegrees(sliderValue, {
                minDegrees: 0.1,
                maxDegrees: 179,
                fallbackDegrees: 50,
            });
            expect(nextFov).toBeCloseTo(sample, 6);
        }
    });

    it("maps the slider midpoint to a useful framing FoV instead of 90 degrees", () => {
        const midpointFov = zoomSliderValueToFovDegrees(500, {
            minDegrees: 1,
            maxDegrees: 179,
            fallbackDegrees: 50,
        });

        expect(midpointFov).toBeCloseTo(DEFAULT_FOV_SLIDER_MIDPOINT_DEGREES, 6);
    });

    it("places the preferred midpoint FoV at the center of the slider", () => {
        const sliderValue = fovDegreesToZoomSliderValue(DEFAULT_FOV_SLIDER_MIDPOINT_DEGREES, {
            minDegrees: 0.1,
            maxDegrees: 179,
            fallbackDegrees: 50,
        });

        expect(sliderValue).toBeCloseTo(500, 6);
    });

    it("formats readonly FoV labels with one decimal place", () => {
        expect(formatFovDegreesLabel(27, {
            minDegrees: 0.1,
            maxDegrees: 179,
            fallbackDegrees: 50,
            digits: 1,
        })).toBe("27.0°");
    });

    it("clamps the slider bounds and FoV values safely", () => {
        expect(zoomSliderValueToFovDegrees(FOV_SLIDER_SCALE_MIN - 200)).toBeCloseTo(0.1, 6);
        expect(zoomSliderValueToFovDegrees(FOV_SLIDER_SCALE_MAX + 200)).toBeCloseTo(179, 6);
        expect(clampFovDegrees(-40)).toBe(0.1);
        expect(clampFovDegrees(400)).toBe(179);
    });
});
