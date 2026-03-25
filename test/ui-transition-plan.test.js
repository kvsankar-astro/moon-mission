import { describe, expect, it } from "vitest";
import {
    planDimensionTransition,
    planOriginModeTransition,
    planRuntimeModeToggle,
} from "../src/platform/js/core/domain/ui-transition-plan.js";

describe("ui-transition-plan", () => {
    describe("planOriginModeTransition", () => {
        it("returns a no-op plan when the origin config is unchanged", () => {
            expect(planOriginModeTransition({
                currentConfig: "geo",
                requestedConfig: "geo",
                currentSceneState: "any",
                addCurveDoneState: "done",
            })).toEqual({
                shouldSwitch: false,
                previousConfig: "geo",
                nextConfig: "geo",
                shouldDisposeCurrentScene: false,
            });
        });

        it("requests scene disposal only when switching away from an in-progress scene", () => {
            const keepScenePlan = planOriginModeTransition({
                currentConfig: "geo",
                requestedConfig: "lunar",
                currentSceneState: "done",
                addCurveDoneState: "done",
            });
            expect(keepScenePlan.shouldSwitch).toBe(true);
            expect(keepScenePlan.shouldDisposeCurrentScene).toBe(false);

            const disposeScenePlan = planOriginModeTransition({
                currentConfig: "geo",
                requestedConfig: "lunar",
                currentSceneState: "initializing",
                addCurveDoneState: "done",
            });
            expect(disposeScenePlan.shouldSwitch).toBe(true);
            expect(disposeScenePlan.shouldDisposeCurrentScene).toBe(true);
        });
    });

    describe("planRuntimeModeToggle", () => {
        it("plans joyride enable/disable transitions with matching view presets", () => {
            const enablePlan = planRuntimeModeToggle({
                intent: "joyride",
                joyRideActive: false,
                landingActive: false,
                landingEnabled: true,
            });

            expect(enablePlan.allowed).toBe(true);
            expect(enablePlan.nextFlags).toEqual({ joyRide: true, landing: false });
            expect(enablePlan.craftVisibility).toEqual({
                craftVisible: false,
                craftEdgesVisible: false,
            });
            expect(enablePlan.shouldResetMotherContainer).toBe(true);
            expect(enablePlan.viewSettings).toEqual(expect.objectContaining({
                viewOrbit: false,
                viewOrbitDescent: false,
                viewSky: true,
                viewConstellationLines: false,
            }));

            const disablePlan = planRuntimeModeToggle({
                intent: "joyride",
                joyRideActive: true,
                landingActive: false,
                landingEnabled: true,
            });
            expect(disablePlan.allowed).toBe(true);
            expect(disablePlan.nextFlags).toEqual({ joyRide: false, landing: false });
            expect(disablePlan.craftVisibility).toEqual({
                craftVisible: true,
                craftEdgesVisible: true,
            });
            expect(disablePlan.shouldResetMotherContainer).toBe(false);
            expect(disablePlan.viewSettings).toEqual(expect.objectContaining({
                viewOrbit: true,
                viewOrbitDescent: true,
                viewSky: true,
                viewConstellationLines: false,
            }));
        });

        it("rejects landing toggles when landing mode is disabled", () => {
            expect(planRuntimeModeToggle({
                intent: "landing",
                joyRideActive: false,
                landingActive: false,
                landingEnabled: false,
            })).toEqual({
                allowed: false,
                reason: "landing-disabled",
            });
        });

        it("plans landing transitions with joyride cleared", () => {
            const enablePlan = planRuntimeModeToggle({
                intent: "landing",
                joyRideActive: true,
                landingActive: false,
                landingEnabled: true,
            });
            expect(enablePlan.allowed).toBe(true);
            expect(enablePlan.nextFlags).toEqual({ joyRide: false, landing: true });
            expect(enablePlan.shouldResetMotherContainer).toBe(true);
            expect(enablePlan.craftVisibility).toEqual({
                craftVisible: true,
                craftEdgesVisible: true,
            });
            expect(enablePlan.viewSettings).toEqual(expect.objectContaining({
                viewOrbit: false,
                viewOrbitDescent: true,
                viewSky: true,
                viewConstellationLines: false,
            }));

            const disablePlan = planRuntimeModeToggle({
                intent: "landing",
                joyRideActive: false,
                landingActive: true,
                landingEnabled: true,
            });
            expect(disablePlan.allowed).toBe(true);
            expect(disablePlan.nextFlags).toEqual({ joyRide: false, landing: false });
            expect(disablePlan.shouldResetMotherContainer).toBe(false);
            expect(disablePlan.viewSettings).toEqual(expect.objectContaining({
                viewOrbit: true,
                viewOrbitDescent: true,
                viewSky: true,
                viewConstellationLines: false,
            }));
        });

        it("returns a guard plan for unknown intents", () => {
            expect(planRuntimeModeToggle({
                intent: "unknown",
                joyRideActive: false,
                landingActive: false,
                landingEnabled: true,
            })).toEqual({
                allowed: false,
                reason: "unknown-intent",
            });
        });
    });

    describe("planDimensionTransition", () => {
        it("computes dimension transition flags", () => {
            expect(planDimensionTransition({
                requestedDimension: "3D",
                previousDimension: "2D",
            })).toEqual({
                requestedDimension: "3D",
                nextCurrentDimension: "3D",
                nextPreviousDimension: "3D",
                dimensionChanged: true,
                is3D: true,
            });

            expect(planDimensionTransition({
                requestedDimension: "2D",
                previousDimension: "2D",
            })).toEqual({
                requestedDimension: "2D",
                nextCurrentDimension: "2D",
                nextPreviousDimension: "2D",
                dimensionChanged: false,
                is3D: false,
            });
        });
    });
});
