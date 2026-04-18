import { describe, expect, it } from "vitest";

import {
    buildMobileMoonVisibilitySignature,
    computeMobileMoonVisibilityInfoFromSceneState,
    resolveBodyPositionFromSceneState,
    resolveCraftPositionFromSceneState,
    shouldRunMobileMoonVisibilityLoop,
    shouldShowMobileMoonVisibility,
    shouldSkipMobileMoonVisibilityUpdate,
} from "../src/platform/js/core/domain/mobile-moon-visibility-state.js";

describe("mobile-moon-visibility-state", () => {
    it("falls back to the origin for the primary body when it is omitted from scene state", () => {
        const sceneState = {
            bodies: {
                MOON: { position: { x: 3, y: 4, z: 5 } },
            },
        };

        expect(resolveBodyPositionFromSceneState(sceneState, "EARTH", "EARTH")).toEqual({ x: 0, y: 0, z: 0 });
        expect(resolveBodyPositionFromSceneState(sceneState, "MOON", "MOON")).toEqual({ x: 3, y: 4, z: 5 });
    });

    it("prefers the requested craft id and otherwise falls back to SC", () => {
        const sceneState = {
            bodies: {
                SC: { position: { x: 1, y: 2, z: 3 } },
                EAGLE: { position: { x: 4, y: 5, z: 6 } },
            },
        };

        expect(resolveCraftPositionFromSceneState(sceneState, "EAGLE")).toEqual({ x: 4, y: 5, z: 6 });
        expect(resolveCraftPositionFromSceneState(sceneState, "MISSING")).toEqual({ x: 1, y: 2, z: 3 });
    });

    it("computes rounded moon visibility percentages from scene state samples", () => {
        const samples = new Float32Array([
            1, 1, 0,
            1, -1, 0,
            1, 0, 1,
        ]);
        const sceneState = {
            bodies: {
                EARTH: { position: { x: 10, y: 0, z: 0 } },
                MOON: { position: { x: 0, y: 0, z: 0 } },
                SC: { position: { x: 10, y: 0, z: 0 } },
            },
            sunDirection: { x: 0, y: 1, z: 0 },
        };

        const visibility = computeMobileMoonVisibilityInfoFromSceneState({
            sceneState,
            primaryBody: "MOON",
            samples,
        });

        expect(visibility).toEqual({
            nearPct: 100,
            farPct: 0,
            nearDayPct: 67,
            nearNightPct: 33,
            farDayPct: 0,
            farNightPct: 0,
        });
        expect(buildMobileMoonVisibilitySignature(visibility)).toBe("67|33|0|0");
    });

    it("returns null when the scene state does not provide the required bodies", () => {
        const visibility = computeMobileMoonVisibilityInfoFromSceneState({
            sceneState: {
                bodies: {
                    MOON: { position: { x: 0, y: 0, z: 0 } },
                },
            },
            primaryBody: "MOON",
        });

        expect(visibility).toBeNull();
    });

    it("captures the visibility gating rules for panel display and refresh cadence", () => {
        expect(shouldShowMobileMoonVisibility({
            isMobileViewport: true,
            activeTab: "views",
            activeViewPresetId: "moon",
        })).toBe(true);
        expect(shouldShowMobileMoonVisibility({
            isMobileViewport: true,
            activeTab: "compose",
            activeViewPresetId: "moon",
        })).toBe(false);
        expect(shouldRunMobileMoonVisibilityLoop({
            isMobileViewport: true,
            activeTab: "views",
        })).toBe(true);
        expect(shouldRunMobileMoonVisibilityLoop({
            isMobileViewport: false,
            activeTab: "views",
        })).toBe(false);
        expect(shouldSkipMobileMoonVisibilityUpdate({
            force: false,
            nowMs: 200,
            lastUpdateMs: 100,
            minIntervalMs: 180,
        })).toBe(true);
        expect(shouldSkipMobileMoonVisibilityUpdate({
            force: true,
            nowMs: 200,
            lastUpdateMs: 100,
            minIntervalMs: 180,
        })).toBe(false);
    });
});
