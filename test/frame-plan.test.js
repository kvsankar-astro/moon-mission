import { describe, expect, it, vi } from "vitest";
import { planFrameStep } from "../src/platform/js/core/plans/frame-plan.js";
import { COMPARISON_REFERENCE_DISTANCE_KM } from "../src/platform/js/core/domain/comparison-display.js";

describe("planFrameStep", () => {
    it("returns non-running plan when scene is missing", () => {
        const plan = planFrameStep({
            config: "geo",
            animTime: 123,
            scene: null,
            computeSunLongitude: () => 0,
            computeSceneState: () => ({}),
        });

        expect(plan).toEqual({
            shouldRun: false,
            reason: "scene-missing",
        });
    });

    it("creates a 3D frame plan with render and ui intents", () => {
        const computeSunLongitude = vi.fn(() => 1.5);
        const computeSceneState = vi.fn((time, config, options) => ({
            time,
            config,
            phase: "earth-bound",
            activeEvent: null,
            telemetry: null,
            bodies: {},
            sunLongitude: options.sunLongitude + 0.25,
        }));

        const scene = {
            primaryBody: "EARTH",
            planetsForLocations: ["EARTH", "MOON"],
            initialized3D: true,
        };

        const plan = planFrameStep({
            config: "geo",
            animTime: 123456,
            scene,
            computeSunLongitude,
            computeSceneState,
            chebyshevData: { geo: true },
            chebyshevDataLoaded: { geo: true },
            npzData: { geo: false },
            npzDataLoaded: { geo: false },
            landingNpzData: { SC: [] },
            landingNpzLoaded: true,
            landingChebyshevData: { segments: [] },
            landingChebyshevLoaded: true,
            globalConfig: { mission: "cy3" },
            startLandingTime: 20000,
            endLandingTime: 30000,
            eventInfos: [{ id: "A" }],
            missionTimes: { timeTransLunarInjection: 1000 },
            frameMode: "inertial",
            bodySources: { SC: "chebyshev" },
            ephemerisSource: "chebyshev",
            craftId: "SC",
            pixelsPerAU: 250,
            updateCraftScale: () => {},
            currentDimension: "3D",
        });

        expect(computeSunLongitude).toHaveBeenCalledWith(123456);
        expect(computeSceneState).toHaveBeenCalledWith(
            123456,
            "geo",
            expect.objectContaining({
                frameMode: "inertial",
                ephemerisSource: "chebyshev",
                planetsForLocations: ["EARTH", "MOON"],
                includeNextState: true,
            }),
        );

        expect(plan.shouldRun).toBe(true);
        expect(plan.statePatchIntent).toEqual({
            sunLongitude: 1.75,
        });
        expect(plan.renderIntent.dimension).toBe("3D");
        expect(plan.renderIntent.shouldAdjustCameraProjection).toBe(true);
        expect(plan.renderIntent.renderOptions).toEqual(
            expect.objectContaining({
                craftId: "SC",
                pixelsPerAU: 250,
                primaryBody: "EARTH",
                planetsForLocations: ["EARTH", "MOON"],
                landingFreezeTime: 15000,
            }),
        );
        expect(plan.uiIntent).toEqual(
            expect.objectContaining({
                animTime: 123456,
                primaryBody: "EARTH",
                globalConfig: { mission: "cy3" },
            }),
        );
    });

    it("creates a 2D frame plan without 3D camera projection adjustment", () => {
        const scene = {
            primaryBody: "MOON",
            planetsForLocations: ["MOON", "SC"],
            initialized3D: false,
        };

        const computeSceneState = vi.fn(() => ({
            sunLongitude: 0.5,
            phase: "lunar-orbit",
            activeEvent: null,
            telemetry: null,
            bodies: {},
        }));

        const plan = planFrameStep({
            config: "lunar",
            animTime: 42,
            scene,
            computeSunLongitude: () => 0.5,
            computeSceneState,
            chebyshevData: {},
            chebyshevDataLoaded: {},
            npzData: {},
            npzDataLoaded: {},
            landingNpzData: {},
            landingNpzLoaded: false,
            landingChebyshevData: {},
            landingChebyshevLoaded: false,
            globalConfig: {},
            startLandingTime: null,
            endLandingTime: null,
            eventInfos: [],
            missionTimes: {},
            frameMode: "relative",
            bodySources: {},
            ephemerisSource: "npz",
            craftId: "SC",
            pixelsPerAU: 100,
            updateCraftScale: () => {},
            currentDimension: "2D",
        });

        expect(plan.shouldRun).toBe(true);
        expect(computeSceneState).toHaveBeenCalledWith(
            42,
            "lunar",
            expect.objectContaining({
                includeNextState: false,
            }),
        );
        expect(plan.renderIntent.dimension).toBe("2D");
        expect(plan.renderIntent.shouldAdjustCameraProjection).toBe(false);
        expect(plan.renderIntent.renderOptions.landingFreezeTime).toBeNull();
    });

    it("adds compare-mode render overrides without changing scene-state inputs", () => {
        const computeSceneState = vi.fn((time, config, options) => ({
            time,
            config,
            phase: "compare",
            activeEvent: null,
            telemetry: null,
            bodies: {
                MOON: {
                    available: true,
                    position: {
                        x: COMPARISON_REFERENCE_DISTANCE_KM / 2,
                        y: 0,
                        z: 0,
                    },
                    velocity: { vx: 1, vy: 0, vz: 0 },
                },
                SC: {
                    available: true,
                    position: {
                        x: COMPARISON_REFERENCE_DISTANCE_KM / 4,
                        y: 10,
                        z: 0,
                    },
                    nextPosition: {
                        x: COMPARISON_REFERENCE_DISTANCE_KM / 4 + 5,
                        y: 20,
                        z: 0,
                    },
                    velocity: { vx: 5, vy: 10, vz: 0 },
                    nextVelocity: { vx: 5, vy: 10, vz: 0 },
                },
            },
            sunLongitude: options.sunLongitude,
        }));

        const plan = planFrameStep({
            config: "geo",
            animTime: 999,
            scene: {
                primaryBody: "EARTH",
                planetsForLocations: ["EARTH", "MOON"],
                initialized3D: true,
            },
            computeSunLongitude: () => 0.25,
            computeSceneState,
            chebyshevData: {},
            chebyshevDataLoaded: {},
            npzData: {},
            npzDataLoaded: {},
            landingNpzData: {},
            landingNpzLoaded: false,
            landingChebyshevData: {},
            landingChebyshevLoaded: false,
            globalConfig: {},
            startLandingTime: null,
            endLandingTime: null,
            eventInfos: [],
            missionTimes: {},
            frameMode: "relative",
            bodySources: {},
            ephemerisSource: "chebyshev",
            compareMode: true,
            craftId: "SC",
            pixelsPerAU: 100,
            updateCraftScale: () => {},
            currentDimension: "3D",
        });

        expect(computeSceneState).toHaveBeenCalledWith(
            999,
            "geo",
            expect.not.objectContaining({
                compareMode: true,
            }),
        );
        expect(plan.renderIntent.renderOptions).toEqual(
            expect.objectContaining({
                compareMode: true,
                comparisonNormalizationScale: 2,
                compareDisplayProfile: expect.objectContaining({
                    freezeEarthRotation: true,
                    freezeMoonRotation: true,
                    freezeSkyOrientation: true,
                    disableEarthshine: true,
                }),
            }),
        );
        expect(plan.uiIntent.sceneState.bodies.MOON.position.x).toBeCloseTo(
            COMPARISON_REFERENCE_DISTANCE_KM / 2,
            6,
        );
        expect(plan.renderIntent.sceneState.bodies.MOON.position.x).toBeCloseTo(
            COMPARISON_REFERENCE_DISTANCE_KM,
            6,
        );
        expect(plan.renderIntent.sceneState.bodies.SC.position.y).toBeCloseTo(20, 12);
    });
});
