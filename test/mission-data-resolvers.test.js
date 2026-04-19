import { describe, expect, it } from "vitest";

import {
    deepMergeObjects,
    getEphemerisSource,
    getMissionConfigProfileUrl,
} from "../src/platform/js/core/domain/mission-data-resolvers.js";

describe("mission-data-resolvers", () => {
    it("builds profile config URLs from trimmed data paths and profile names", () => {
        expect(getMissionConfigProfileUrl("assets/ch3/data/", "night")).toBe(
            "assets/ch3/data/config.night.json",
        );
        expect(getMissionConfigProfileUrl("assets/ch3/data", " night ")).toBe(
            "assets/ch3/data/config.night.json",
        );
        expect(getMissionConfigProfileUrl("", "night")).toBeNull();
        expect(getMissionConfigProfileUrl("assets/ch3/data/", "")).toBeNull();
    });

    it("deep merges nested objects without mutating the base value", () => {
        const base = {
            ui: {
                viewDefaults: {
                    planeSelection: "DEFAULT",
                    relativeDefaultPlaneSelection: "XY",
                },
                theme: "dark",
            },
            preserve: true,
        };
        const patch = {
            ui: {
                viewDefaults: {
                    relativeDefaultPlaneSelection: "YZ",
                },
            },
            preserve: false,
        };

        const merged = deepMergeObjects(base, patch);

        expect(merged).toEqual({
            ui: {
                viewDefaults: {
                    planeSelection: "DEFAULT",
                    relativeDefaultPlaneSelection: "YZ",
                },
                theme: "dark",
            },
            preserve: false,
        });
        expect(base.ui.viewDefaults.relativeDefaultPlaneSelection).toBe("XY");
        expect(base.preserve).toBe(true);
    });

    it("normalizes the ephemeris source with a chebyshev default", () => {
        expect(getEphemerisSource({ ephemeris_source: "NPZ" })).toBe("npz");
        expect(getEphemerisSource({ ephemeris: { source: "Chebyshev" } })).toBe("chebyshev");
        expect(getEphemerisSource({})).toBe("chebyshev");
    });
});
