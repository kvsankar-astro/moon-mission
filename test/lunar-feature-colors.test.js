import { describe, expect, it } from "vitest";

import {
    LUNAR_FEATURE_TYPE_COLORS,
    getLunarFeatureBoundaryColor,
    getLunarFeatureTypeColor,
} from "../src/platform/js/core/domain/lunar-feature-colors.js";

function srgbChannelToLinear(value) {
    const normalized = value / 255;
    return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
}

function hexToOklab(hex) {
    const normalized = hex.replace(/^#/, "");
    const r = srgbChannelToLinear(Number.parseInt(normalized.slice(0, 2), 16));
    const g = srgbChannelToLinear(Number.parseInt(normalized.slice(2, 4), 16));
    const b = srgbChannelToLinear(Number.parseInt(normalized.slice(4, 6), 16));

    const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
    const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
    const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
    const lRoot = Math.cbrt(l);
    const mRoot = Math.cbrt(m);
    const sRoot = Math.cbrt(s);

    return {
        l: 0.2104542553 * lRoot + 0.7936177850 * mRoot - 0.0040720468 * sRoot,
        a: 1.9779984951 * lRoot - 2.4285922050 * mRoot + 0.4505937099 * sRoot,
        b: 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.8086757660 * sRoot,
    };
}

function oklabDistance(a, b) {
    return Math.hypot(a.l - b.l, a.a - b.a, a.b - b.b);
}

describe("lunar feature colors", () => {
    it("assigns one perceptually separated color to every Lunar Features type", () => {
        const colors = Object.values(LUNAR_FEATURE_TYPE_COLORS);
        expect(colors).toHaveLength(12);
        expect(new Set(colors).size).toBe(12);

        const labColors = colors.map(hexToOklab);
        let minimumDistance = Infinity;
        for (let i = 0; i < labColors.length; i += 1) {
            for (let j = i + 1; j < labColors.length; j += 1) {
                minimumDistance = Math.min(minimumDistance, oklabDistance(labColors[i], labColors[j]));
            }
        }
        expect(minimumDistance).toBeGreaterThan(0.15);
    });

    it("uses feature-specific boundary colors for lit, unlit, and hover states", () => {
        expect(getLunarFeatureTypeColor("Crater, craters")).toBe("#127eee");
        expect(getLunarFeatureTypeColor("Mare, maria")).toBe("#3a9742");
        expect(getLunarFeatureBoundaryColor("Crater, craters")).not.toBe(
            getLunarFeatureBoundaryColor("Mare, maria"),
        );
        expect(getLunarFeatureBoundaryColor("Crater, craters", { sunlit: false })).not.toBe(
            getLunarFeatureBoundaryColor("Crater, craters", { sunlit: true }),
        );
        expect(getLunarFeatureBoundaryColor("Crater, craters", { hover: true })).not.toBe(
            getLunarFeatureBoundaryColor("Crater, craters", { hover: false }),
        );
    });
});
