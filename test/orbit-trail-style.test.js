import { describe, expect, it } from "vitest";

import {
    buildCurveTimes,
    mixColors,
    resolveTailVisualStyle,
    resolveTrailLayerWindow,
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

    it("uses metadata interval period when available", () => {
        const times = [
            0,
            30 * 60 * 1000,
            60 * 60 * 1000,
            90 * 60 * 1000,
            120 * 60 * 1000,
        ];

        const metadata = {
            regime_intervals: [{
                start_jd: 2440587.5,
                end_jd: 2440587.5 + (3 / 24),
                period_s_local: 2 * 60 * 60,
                regime: "moon_orbit",
                period_status: "meaningful",
            }],
        };

        const window = resolveTrailWindow(times, 90 * 60 * 1000, {
            orbitStyleMetadata: metadata,
        });

        expect(window.currentIndex).toBe(3);
        expect(window.tailStartIndex).toBe(1);
        expect(window.headStartIndex).toBe(3);
    });

    it("falls back to fixed phase durations when metadata period is unavailable", () => {
        const times = [
            0,
            60 * 60 * 1000,
            2 * 60 * 60 * 1000,
            3 * 60 * 60 * 1000,
            4 * 60 * 60 * 1000,
            5 * 60 * 60 * 1000,
            6 * 60 * 60 * 1000,
            7 * 60 * 60 * 1000,
        ];

        const window = resolveTrailWindow(times, 7 * 60 * 60 * 1000, {
            phaseKey: "lunar",
        });

        expect(window.currentIndex).toBe(7);
        expect(window.tailStartIndex).toBe(1);
        expect(window.headStartIndex).toBe(6);
    });

    it("lightens orbit head colors toward white", () => {
        expect(mixColors("#204080", "#ffffff", 0.5)).toBe("#90a0c0");
    });

    it("derives stronger 3D tail visuals from prominence", () => {
        const soft = resolveTailVisualStyle({ dimension: "3D", prominence: 0.5 });
        const strong = resolveTailVisualStyle({ dimension: "3D", prominence: 2 });

        expect(soft.tailOpacity).toBeLessThan(strong.tailOpacity);
        expect(soft.midOpacity).toBeLessThan(strong.midOpacity);
        expect(soft.headGlowOpacity).toBeLessThanOrEqual(strong.headGlowOpacity);
        expect(soft.headOpacity).toBeLessThanOrEqual(strong.headOpacity);
        expect(soft.tailWidth).toBe(strong.tailWidth);
        expect(soft.midWidth).toBe(strong.midWidth);
        expect(soft.headGlowWidth).toBe(strong.headGlowWidth);
        expect(soft.headWidth).toBe(strong.headWidth);
    });

    it("derives layered trail ranges in order from tail to head", () => {
        const layers = resolveTrailLayerWindow({
            tailStartIndex: 10,
            headStartIndex: 24,
            currentIndex: 30,
        });

        expect(layers.tailStartIndex).toBe(10);
        expect(layers.midStartIndex).toBeGreaterThanOrEqual(10);
        expect(layers.headGlowStartIndex).toBeGreaterThanOrEqual(layers.midStartIndex);
        expect(layers.headStartIndex).toBeGreaterThanOrEqual(layers.headGlowStartIndex);
        expect(layers.currentIndex).toBe(30);
    });
});
