import { describe, expect, it } from "vitest";
import {
    normalizeFromTo,
    planCameraPairTransition,
    resolveAllowedLooks,
    resolveAllowedPositions,
    resolveLockAvailability,
    resolvePairFromValue,
    resolvePairKey,
} from "../src/platform/js/core/domain/camera-policy.js";

describe("camera-policy", () => {
    it("resolves allowed look/position modes", () => {
        expect(resolveAllowedLooks("earth")).toEqual(["moon", "spacecraft"]);
        expect(resolveAllowedPositions("manual")).toEqual(["manual", "moon"]);
        expect(resolveAllowedLooks("unknown")).toEqual(["manual"]);
        expect(resolveAllowedPositions("unknown")).toEqual(["manual"]);
    });

    it("normalizes invalid camera combinations based on source", () => {
        expect(
            normalizeFromTo({
                positionMode: "earth",
                lookMode: "earth",
                sourceId: "camera-position",
            }),
        ).toEqual({ positionMode: "earth", lookMode: "moon" });

        expect(
            normalizeFromTo({
                positionMode: "earth",
                lookMode: "earth",
                sourceId: "camera-look",
            }),
        ).toEqual({ positionMode: "moon", lookMode: "earth" });

        expect(
            normalizeFromTo({
                positionMode: "earth",
                lookMode: "earth",
            }),
        ).toEqual({ positionMode: "earth", lookMode: "moon" });
    });

    it("resolves pair values and keys", () => {
        expect(resolvePairFromValue("spacecraft__moon")).toEqual({
            positionMode: "spacecraft",
            lookMode: "moon",
        });
        expect(resolvePairFromValue("invalid")).toBeNull();
        expect(resolvePairKey("moon", "earth")).toBe("moon__earth");
        expect(resolvePairKey("invalid", "invalid")).toBe("manual__manual");
    });

    it("resolves lock-on availability in manual look mode only", () => {
        expect(resolveLockAvailability("earth", "manual")).toEqual(["sc", "moon"]);
        expect(resolveLockAvailability("earth", "moon")).toEqual([]);
    });

    it("plans transitions with normalized output and metadata", () => {
        const plan = planCameraPairTransition({
            positionMode: "earth",
            lookMode: "earth",
            sourceId: "camera-position",
        });

        expect(plan.positionMode).toBe("earth");
        expect(plan.lookMode).toBe("moon");
        expect(plan.pairKey).toBe("earth__moon");
        expect(plan.allowedLookModes).toEqual(["moon", "spacecraft"]);
        expect(plan.allowedPositionModes).toEqual(["manual", "earth", "spacecraft"]);
        expect(plan.lockAvailability).toEqual([]);
    });
});
