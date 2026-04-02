import { describe, expect, it } from "vitest";

import { shouldShowSecondaryBodyHighlight } from "../src/platform/js/core/domain/secondary-body-highlight-policy.js";

describe("secondary-body-highlight-policy", () => {
    it("shows the ring for manual geo views around the Moon", () => {
        expect(
            shouldShowSecondaryBodyHighlight({
                isLunarMission: true,
                configName: "geo",
                secondaryBody: "MOON",
                frameMode: "geo",
                viewMoonHighlightRing: true,
                cameraPositionMode: "manual",
                cameraLookMode: "manual",
            }),
        ).toBe(true);
    });

    it("suppresses the ring for lunar-origin Earth highlight", () => {
        expect(
            shouldShowSecondaryBodyHighlight({
                isLunarMission: true,
                configName: "lunar",
                secondaryBody: "EARTH",
                frameMode: "lunar",
                viewMoonHighlightRing: true,
                cameraPositionMode: "manual",
                cameraLookMode: "manual",
            }),
        ).toBe(false);
    });

    it("suppresses the ring in relative mode", () => {
        expect(
            shouldShowSecondaryBodyHighlight({
                isLunarMission: true,
                configName: "geo",
                secondaryBody: "MOON",
                frameMode: "relative",
                viewMoonHighlightRing: true,
            }),
        ).toBe(false);
    });

    it("suppresses the ring for mounted or targeted camera pairs", () => {
        expect(
            shouldShowSecondaryBodyHighlight({
                isLunarMission: true,
                configName: "geo",
                secondaryBody: "MOON",
                frameMode: "geo",
                viewMoonHighlightRing: true,
                cameraPositionMode: "earth",
                cameraLookMode: "moon",
            }),
        ).toBe(false);

        expect(
            shouldShowSecondaryBodyHighlight({
                isLunarMission: true,
                configName: "lunar",
                secondaryBody: "EARTH",
                frameMode: "lunar",
                viewMoonHighlightRing: true,
                cameraPositionMode: "manual",
                cameraLookMode: "earth",
            }),
        ).toBe(false);
    });

    it("suppresses the ring for special-camera modes", () => {
        expect(
            shouldShowSecondaryBodyHighlight({
                isLunarMission: true,
                configName: "geo",
                secondaryBody: "MOON",
                frameMode: "geo",
                viewMoonHighlightRing: true,
                suppress: true,
            }),
        ).toBe(false);
    });
});
