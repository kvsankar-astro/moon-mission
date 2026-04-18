import { describe, expect, it } from "vitest";

import {
    buildMobileComposeEarthshineState,
    buildMobileComposeRollState,
    clampMobileComposeEarthshineGain,
} from "../src/platform/js/core/domain/mobile-compose-controls-state.js";

describe("mobile compose controls state", () => {
    it("clamps earthshine gain within the supported range and falls back for non-numeric input", () => {
        expect(clampMobileComposeEarthshineGain(-2)).toBe(0);
        expect(clampMobileComposeEarthshineGain(3.2)).toBe(2.4);
        expect(clampMobileComposeEarthshineGain("bad")).toBe(1);
    });

    it("builds a normalized earthshine display state", () => {
        expect(buildMobileComposeEarthshineState({ value: 1.234 })).toEqual({
            gain: 1.234,
            sliderValue: "1.23",
            text: "1.23",
        });
    });

    it("normalizes compose roll radians and formats the cardinal label", () => {
        const rollState = buildMobileComposeRollState({
            rollRad: (5 * Math.PI) / 2,
        });

        expect(rollState.rollRad).toBeCloseTo(Math.PI / 2);
        expect(rollState.degrees).toBe(90);
        expect(rollState.label).toBe("E 90°");
    });
});
