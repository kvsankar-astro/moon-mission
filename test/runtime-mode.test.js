import { describe, expect, it } from "vitest";

import {
    isCompareRuntimeMode,
    isRelativeFrameRuntimeMode,
    normalizeCompareOriginMode,
    normalizeRuntimeMode,
    resolveCompareOriginMode,
    resolveCompareDisplayProfile,
    resolveFrameModeForRuntimeMode,
} from "../src/platform/js/core/domain/runtime-mode.js";

describe("runtime mode", () => {
    it("defaults compare mode into the relative-frame family", () => {
        expect(normalizeRuntimeMode(" compare ")).toBe("compare");
        expect(isCompareRuntimeMode("COMPARE")).toBe(true);
        expect(isRelativeFrameRuntimeMode("compare")).toBe(true);
        expect(resolveFrameModeForRuntimeMode("compare")).toBe("relative");
        expect(resolveFrameModeForRuntimeMode("bogus")).toBe("inertial");
    });

    it("keeps compare mode pinned to relative regardless of requested origin", () => {
        expect(normalizeCompareOriginMode("earth")).toBe("geo");
        expect(normalizeCompareOriginMode("moon")).toBe("lunar");
        expect(resolveCompareOriginMode({ mode: "compare", origin: "geo" })).toBe("relative");
        expect(resolveCompareOriginMode({ mode: "compare", origin: "lunar" })).toBe("relative");
        expect(resolveCompareOriginMode({ mode: "compare", origin: "" })).toBe("relative");
        expect(isRelativeFrameRuntimeMode({ mode: "compare", compareOrigin: "geo" })).toBe(true);
        expect(isRelativeFrameRuntimeMode({ mode: "compare", compareOrigin: "lunar" })).toBe(true);
        expect(resolveFrameModeForRuntimeMode({ mode: "compare", compareOrigin: "geo" })).toBe("relative");
        expect(resolveFrameModeForRuntimeMode({ mode: "compare", compareOrigin: "lunar" })).toBe("relative");
    });

    it("builds a compare display profile with defaults and a normalized sun direction", () => {
        const profile = resolveCompareDisplayProfile({});

        expect(profile.freezeEarthRotation).toBe(true);
        expect(profile.freezeMoonRotation).toBe(true);
        expect(profile.freezeSkyOrientation).toBe(true);
        expect(profile.disableEarthshine).toBe(true);
        expect(Math.hypot(
            profile.fixedSunDirection.x,
            profile.fixedSunDirection.y,
            profile.fixedSunDirection.z,
        )).toBeCloseTo(1, 8);
    });

    it("accepts compare-mode display overrides from mission config", () => {
        const profile = resolveCompareDisplayProfile({
            ui: {
                compareMode: {
                    freezeSkyOrientation: false,
                    disableEarthshine: false,
                    fixedSunDirection: [0, 10, 0],
                },
            },
        });

        expect(profile.freezeEarthRotation).toBe(true);
        expect(profile.freezeMoonRotation).toBe(true);
        expect(profile.freezeSkyOrientation).toBe(false);
        expect(profile.disableEarthshine).toBe(false);
        expect(profile.fixedSunDirection).toEqual({ x: 0, y: 1, z: 0 });
    });
});
