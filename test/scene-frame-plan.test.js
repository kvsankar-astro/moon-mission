import { describe, expect, it, vi } from "vitest";

import {
    createFrameSunLongitudeCalculator,
    planSceneFrame,
    resolveSceneFrameCraftId,
} from "../src/platform/js/app/scene-frame-plan.js";

describe("scene frame plan", () => {
    it("prefers the scene active craft id before falling back", () => {
        expect(resolveSceneFrameCraftId({
            scene: { activeCraftId: "ORION", primaryCraftId: "SC" },
            fallbackCraftId: "LEGACY",
        })).toBe("ORION");

        expect(resolveSceneFrameCraftId({
            scene: { primaryCraftId: "SC" },
            fallbackCraftId: "LEGACY",
        })).toBe("SC");

        expect(resolveSceneFrameCraftId({
            scene: {},
            fallbackCraftId: "LEGACY",
        })).toBe("LEGACY");
    });

    it("threads ephemeris source and spacecraft mnemonic into sun-longitude calculation", () => {
        const computeSunLongitude = vi.fn(() => 1.25);
        const calculator = createFrameSunLongitudeCalculator({
            computeSunLongitude,
            config: "geo",
            chebyshevData: { geo: true },
            chebyshevDataLoaded: { geo: true },
            npzData: { geo: false },
            npzDataLoaded: { geo: false },
            bodySources: { SC: "npz" },
            ephemerisSource: "npz",
            globalConfig: { spacecraft_mnemonic: "ORION" },
        });

        expect(calculator(123456)).toBe(1.25);
        expect(computeSunLongitude).toHaveBeenCalledWith(123456, {
            config: "geo",
            chebyshevData: { geo: true },
            chebyshevDataLoaded: { geo: true },
            npzData: { geo: false },
            npzDataLoaded: { geo: false },
            bodySources: { SC: "npz" },
            defaultSpacecraftSource: "npz",
            spacecraftMnemonic: "ORION",
        });
    });

    it("plans a frame with the active scene craft id and selected ephemeris source", () => {
        const computeSunLongitude = vi.fn(() => 2);
        const computeSceneState = vi.fn((time, config, options) => ({
            sunLongitude: options.sunLongitude + 0.5,
            phase: "coast",
            activeEvent: null,
            telemetry: null,
            bodies: {},
        }));
        const scene = {
            activeCraftId: "ACTIVE",
            primaryBody: "MOON",
            planetsForLocations: ["EARTH", "MOON"],
            initialized3D: true,
        };

        const plan = planSceneFrame({
            config: "lunar",
            animTime: 4242,
            scene,
            computeSunLongitude,
            computeSceneState,
            chebyshevData: { lunar: true },
            chebyshevDataLoaded: { lunar: true },
            npzData: { lunar: false },
            npzDataLoaded: { lunar: false },
            landingNpzData: { SC: [] },
            landingNpzLoaded: false,
            landingChebyshevData: { segments: [] },
            landingChebyshevLoaded: false,
            globalConfig: { spacecraft_mnemonic: "ORION" },
            startLandingTime: null,
            endLandingTime: null,
            eventInfos: [{ key: "burn-a" }],
            missionTimes: { timeTransLunarInjection: 1000 },
            frameMode: "inertial",
            bodySources: { SC: "npz" },
            activeEphemerisSource: "npz",
            craftId: "LEGACY",
            pixelsPerAU: 150,
            updateCraftScale: () => {},
            currentDimension: "3D",
        });

        expect(computeSunLongitude).toHaveBeenCalledWith(
            4242,
            expect.objectContaining({
                defaultSpacecraftSource: "npz",
                spacecraftMnemonic: "ORION",
            }),
        );
        expect(computeSceneState).toHaveBeenCalledWith(
            4242,
            "lunar",
            expect.objectContaining({
                craftId: "ACTIVE",
                ephemerisSource: "npz",
            }),
        );
        expect(plan.renderIntent.renderOptions.craftId).toBe("ACTIVE");
        expect(plan.statePatchIntent.sunLongitude).toBe(2.5);
    });
});
