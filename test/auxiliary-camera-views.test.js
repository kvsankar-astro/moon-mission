import { describe, expect, it } from "vitest";

import {
    AUXILIARY_VIEW_CAMERA_PRESETS,
    resolveLunarFlybyWindowMs,
} from "../src/platform/js/app/auxiliary-camera-views.js";

describe("AUXILIARY_VIEW_CAMERA_PRESETS", () => {
    it("exposes the three desktop auxiliary view semantics for mobile reuse", () => {
        expect(AUXILIARY_VIEW_CAMERA_PRESETS).toEqual([
            {
                id: "earth",
                label: "Craft \u2192 Earth",
                positionMode: "spacecraft",
                lookMode: "earth",
            },
            {
                id: "moon",
                label: "Craft \u2192 Moon",
                positionMode: "spacecraft",
                lookMode: "moon",
            },
            {
                id: "earth-to-moon",
                label: "Earth \u2192 Moon",
                positionMode: "earth",
                lookMode: "moon",
            },
        ]);
    });
});

describe("resolveLunarFlybyWindowMs", () => {
    it("returns SOI entry/exit bounds when present in mission events", () => {
        const paddingMs = 5 * 60 * 1000;
        const startMs = Date.UTC(2026, 3, 6, 4, 43, 12);
        const endMs = Date.UTC(2026, 3, 7, 17, 27, 12);
        const window = resolveLunarFlybyWindowMs([
            {
                key: "lunarSoiEntry",
                label: "Lunar SOI In",
                startTime: new Date(startMs),
            },
            {
                key: "closestApproach",
                label: "Lunar Flyby",
                startTime: new Date(Date.UTC(2026, 3, 6, 23, 6, 12)),
            },
            {
                key: "lunarSoiExit",
                label: "Lunar SOI Out",
                startTime: new Date(endMs),
            },
        ]);

        expect(window.startMs).toBe(startMs - paddingMs);
        expect(window.endMs).toBe(endMs + paddingMs);
    });

    it("returns NaN bounds when SOI entry/exit events are missing", () => {
        const window = resolveLunarFlybyWindowMs([
            {
                key: "closestApproach",
                label: "Lunar Flyby",
                startTime: new Date(Date.UTC(2026, 3, 6, 23, 6, 12)),
            },
        ]);

        expect(Number.isNaN(window.startMs)).toBe(true);
        expect(Number.isNaN(window.endMs)).toBe(true);
    });
});
