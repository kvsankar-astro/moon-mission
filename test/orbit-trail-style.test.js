import { describe, expect, it } from "vitest";

import {
    buildCurveTimes,
    mixColors,
    resolveTrailWindow,
} from "../src/platform/js/app/orbit-trail-style.js";

describe("orbit trail style helpers", () => {
    it("prefers vector time metadata and falls back to fixed steps", () => {
        expect(buildCurveTimes([
            { timeMs: 1000 },
            { timeMs: 2500 },
            {},
        ], 0, 500)).toEqual([1000, 2500, 1000]);

        expect(buildCurveTimes([
            {},
            {},
            {},
        ], 4000, 200)).toEqual([4000, 4200, 4400]);
    });

    it("returns a bounded tail/head window around the current time", () => {
        const times = [
            0,
            30 * 60 * 1000,
            60 * 60 * 1000,
            90 * 60 * 1000,
            120 * 60 * 1000,
        ];

        const window = resolveTrailWindow(times, 80 * 60 * 1000, {
            tailDurationMs: 50 * 60 * 1000,
            headDurationMs: 20 * 60 * 1000,
        });

        expect(window.currentIndex).toBe(3);
        expect(window.tailStartIndex).toBe(2);
        expect(window.headStartIndex).toBe(3);
    });

    it("lightens orbit head colors toward white", () => {
        expect(mixColors("#204080", "#ffffff", 0.5)).toBe("#90a0c0");
    });
});
