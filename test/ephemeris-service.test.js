import { describe, expect, it } from "vitest";
import { computeSunLongitude } from "../src/platform/js/services/ephemeris.js";

function buildConstantSunSeries({ x, y, z, tStart = 2440587.5, tEnd = 2440588.5 }) {
    return {
        segments: [
            {
                t_start: tStart,
                t_end: tEnd,
                cx: [x],
                cy: [y],
                cz: [z],
            },
        ],
    };
}

describe("ephemeris service sun longitude", () => {
    it("uses Sun Chebyshev vectors when configured", () => {
        const longitude = computeSunLongitude(12 * 60 * 60 * 1000, {
            config: "lunar",
            bodySources: { SUN: "chebyshev" },
            chebyshevDataLoaded: { geo: true },
            chebyshevData: {
                geo: {
                    sun: buildConstantSunSeries({ x: 1, y: 1, z: 0 }),
                },
            },
        });

        expect(longitude).toBeCloseTo(Math.PI / 4, 6);
    });

    it("throws a clear error when SUN source is not chebyshev", () => {
        expect(() =>
            computeSunLongitude(0, {
                config: "geo",
                bodySources: { SUN: "npz" },
                chebyshevDataLoaded: { geo: true },
                chebyshevData: {
                    geo: {
                        sun: buildConstantSunSeries({ x: 1, y: 0, z: 0 }),
                    },
                },
            }),
        ).toThrow("Configure SUN source as 'chebyshev' (no fallback enabled).");
    });

    it("throws a clear error when Sun Chebyshev data is unavailable", () => {
        expect(() =>
            computeSunLongitude(0, {
                config: "geo",
                bodySources: { SUN: "chebyshev" },
                chebyshevDataLoaded: { geo: true },
                chebyshevData: { geo: {} },
            }),
        ).toThrow("SUN Chebyshev series unavailable");
    });
});
