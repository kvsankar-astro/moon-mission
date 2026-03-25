import { describe, expect, it, vi } from "vitest";
import {
    applyModeSwitchForOrigin,
    buildOriginFlagMap,
    getConfiguredOriginKeys,
    getDefaultOriginKey,
    resolveLandingDataOriginKeys,
    resolveOriginDescriptor,
} from "../src/platform/js/core/domain/origin-compat.js";

describe("origin-compat", () => {
    it("uses configured origins and defaults when missing", () => {
        expect(getConfiguredOriginKeys({ origins: ["geo", "lunar"] })).toEqual([
            "geo",
            "lunar",
        ]);
        expect(getConfiguredOriginKeys(null)).toEqual(["geo", "lunar"]);
        expect(getDefaultOriginKey({ origins: ["lunar"] })).toBe("lunar");
    });

    it("builds origin state maps", () => {
        expect(buildOriginFlagMap(["geo", "lunar"], false)).toEqual({
            geo: false,
            lunar: false,
        });
    });

    it("resolves origin descriptors", () => {
        expect(resolveOriginDescriptor("geo", {})).toEqual(
            expect.objectContaining({
                primaryBody: "EARTH",
                secondaryBody: "MOON",
                modeSwitchTarget: "geo",
            }),
        );
        expect(resolveOriginDescriptor("lunar", {})).toEqual(
            expect.objectContaining({
                primaryBody: "MOON",
                secondaryBody: "EARTH",
                modeSwitchTarget: "lunar",
            }),
        );
    });

    it("resolves landing-data origin keys from explicit or fallback config", () => {
        expect(
            resolveLandingDataOriginKeys({
                landing: { origin_sources: ["geo", "lunar"] },
            }),
        ).toEqual(["geo", "lunar"]);

        expect(
            resolveLandingDataOriginKeys({
                origins: ["geo", "lunar"],
            }),
        ).toEqual(["geo", "lunar"]);
    });

    it("applies origin mode switches through compatibility mapping", () => {
        const switchToGeo = vi.fn();
        const switchToLunar = vi.fn();

        applyModeSwitchForOrigin({
            originKey: "lunar",
            globalConfig: null,
            switchToGeo,
            switchToLunar,
        });
        expect(switchToLunar).toHaveBeenCalledTimes(1);

        applyModeSwitchForOrigin({
            originKey: "geo",
            globalConfig: null,
            switchToGeo,
            switchToLunar,
        });
        expect(switchToGeo).toHaveBeenCalledTimes(1);
    });
});
