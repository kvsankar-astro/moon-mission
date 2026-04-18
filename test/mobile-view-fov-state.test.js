import { describe, expect, it } from "vitest";

import {
    buildMobileViewFovDisplayState,
    clampMobileViewFov,
    computeMobileAutoFovDegrees,
    resolveMobileTouchDistance,
    shouldSkipMobileAutoFovUpdate,
} from "../src/platform/js/core/domain/mobile-view-fov-state.js";

describe("mobile view fov state", () => {
    it("clamps FOV values into the supported range and falls back for invalid input", () => {
        expect(clampMobileViewFov(200)).toBe(179);
        expect(clampMobileViewFov(0)).toBe(1);
        expect(clampMobileViewFov("bad")).toBe(110);
    });

    it("builds a rounded display model for the current FOV", () => {
        expect(buildMobileViewFovDisplayState(72.6)).toEqual({
            fov: 72.6,
            rounded: 73,
            sliderValue: "73",
            text: "73°",
        });
    });

    it("computes an automatic FoV from target distance, radius, and aspect", () => {
        const autoFov = computeMobileAutoFovDegrees({
            distanceToTarget: 10,
            targetRadius: 1,
            aspect: 1,
        });

        expect(autoFov).toBeCloseTo(11.8239, 4);
        expect(shouldSkipMobileAutoFovUpdate({
            currentFov: autoFov,
            nextFov: autoFov + 1e-5,
        })).toBe(true);
    });

    it("resolves touch distances from two touch points", () => {
        expect(resolveMobileTouchDistance(
            { clientX: 10, clientY: 20 },
            { clientX: 13, clientY: 24 },
        )).toBe(5);
    });
});
