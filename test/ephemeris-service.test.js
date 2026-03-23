import { afterEach, describe, expect, it } from "vitest";
import { computeSunLongitude } from "../src/platform/js/services/ephemeris.js";

function installLegacySunGlobals(apparentLongitudeDeg = 90) {
    const legacySun = { position: { apparentLongitude: 0 } };
    globalThis.$const = {};
    globalThis.$processor = {
        init: () => {},
        calc: (_date, body) => {
            body.position.apparentLongitude = apparentLongitudeDeg;
        },
    };
    globalThis.$moshier = {
        body: {
            sun: legacySun,
        },
    };
}

function clearLegacySunGlobals() {
    delete globalThis.$const;
    delete globalThis.$processor;
    delete globalThis.$moshier;
}

describe("ephemeris service sun longitude", () => {
    afterEach(() => {
        clearLegacySunGlobals();
    });

    it("uses NPZ Sun vectors when configured", () => {
        installLegacySunGlobals(10);

        const longitude = computeSunLongitude(12 * 60 * 60 * 1000, {
            config: "lunar",
            bodySources: { SUN: "npz" },
            npzDataLoaded: { geo: true },
            npzData: {
                geo: {
                    SUN: {
                        jd: Float64Array.from([2440587.5, 2440588.5]),
                        x: Float64Array.from([1, 0]),
                        y: Float64Array.from([0, 1]),
                        z: Float64Array.from([0, 0]),
                        vx: Float64Array.from([0, 0]),
                        vy: Float64Array.from([0, 0]),
                        vz: Float64Array.from([0, 0]),
                        timeRange: { start: 2440587.5, end: 2440588.5 },
                    },
                },
            },
        });

        expect(longitude).toBeCloseTo(Math.PI / 4, 6);
    });

    it("falls back to legacy ephemeris when NPZ Sun data is unavailable", () => {
        installLegacySunGlobals(90);

        const longitude = computeSunLongitude(0, {
            config: "geo",
            bodySources: { SUN: "npz" },
            npzDataLoaded: { geo: true },
            npzData: { geo: {} },
        });

        expect(longitude).toBeCloseTo(Math.PI / 2, 9);
    });

    it("throws a clear error when no NPZ Sun data exists and legacy globals are missing", () => {
        expect(() =>
            computeSunLongitude(0, {
                config: "geo",
                bodySources: { SUN: "npz" },
                npzDataLoaded: { geo: true },
                npzData: { geo: {} },
            }),
        ).toThrow("Legacy ephemeris globals are unavailable for sun longitude fallback");
    });
});
