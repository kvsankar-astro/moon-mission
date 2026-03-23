import { describe, expect, it, vi } from "vitest";
import {
    applyModeSwitchForPhase,
    buildPhaseFlagMap,
    getConfiguredPhaseKeys,
    getDefaultPhaseKey,
    resolveLandingDataPhaseKeys,
    resolvePhaseDescriptor,
} from "../src/platform/js/core/domain/phase-compat.js";

describe("phase-compat", () => {
    it("provides configured and fallback phase keys", () => {
        expect(getConfiguredPhaseKeys({ phases: ["geo", "lunar", "landing"] })).toEqual([
            "geo",
            "lunar",
            "landing",
        ]);
        expect(getConfiguredPhaseKeys(null)).toEqual(["geo", "lunar"]);
        expect(getDefaultPhaseKey({ phases: ["lunar"] })).toBe("lunar");
    });

    it("builds phase state maps", () => {
        expect(buildPhaseFlagMap(["geo", "lunar"], false)).toEqual({
            geo: false,
            lunar: false,
        });
    });

    it("resolves descriptors with compatibility defaults", () => {
        expect(resolvePhaseDescriptor("geo", {})).toEqual(
            expect.objectContaining({
                primaryBody: "EARTH",
                secondaryBody: "MOON",
                modeSwitchTarget: "geo",
            }),
        );
        expect(resolvePhaseDescriptor("landing", {})).toEqual(
            expect.objectContaining({
                primaryBody: "MOON",
                secondaryBody: "EARTH",
                modeSwitchTarget: "lunar",
            }),
        );
    });

    it("resolves landing-data phase keys from explicit or fallback config", () => {
        expect(
            resolveLandingDataPhaseKeys({
                landing: { phase_sources: ["geo", "lunar", "landing"] },
            }),
        ).toEqual(["geo", "lunar", "landing"]);

        expect(
            resolveLandingDataPhaseKeys({
                phases: ["geo", "lunar", "landing"],
            }),
        ).toEqual(["geo", "lunar"]);
    });

    it("applies phase mode switches through compatibility mapping", () => {
        const switchToGeo = vi.fn();
        const switchToLunar = vi.fn();

        applyModeSwitchForPhase({
            phaseKey: "landing",
            globalConfig: null,
            switchToGeo,
            switchToLunar,
        });
        expect(switchToLunar).toHaveBeenCalledTimes(1);

        applyModeSwitchForPhase({
            phaseKey: "geo",
            globalConfig: null,
            switchToGeo,
            switchToLunar,
        });
        expect(switchToGeo).toHaveBeenCalledTimes(1);
    });
});
