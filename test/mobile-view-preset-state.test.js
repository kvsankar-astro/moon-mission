import { describe, expect, it } from "vitest";

import {
    resolveMobileViewPresetState,
    shouldEnforceMobileViewPreset,
} from "../src/platform/js/core/domain/mobile-view-preset-state.js";

function createPresetMap() {
    return new Map([
        ["earth", { positionMode: "spacecraft", lookMode: "earth" }],
        ["moon", { positionMode: "spacecraft", lookMode: "moon" }],
    ]);
}

describe("mobile view preset state", () => {
    it("selects the exact matching preset when the desktop selectors match", () => {
        const state = resolveMobileViewPresetState({
            buttonPresetIds: ["earth", "moon"],
            presetById: createPresetMap(),
            activePresetId: "earth",
            positionMode: "spacecraft",
            lookMode: "moon",
        });

        expect(state.matchedPresetId).toBe("moon");
        expect(state.selectedPresetId).toBe("moon");
        expect(state.buttonStates).toEqual([
            { presetId: "earth", isActive: false },
            { presetId: "moon", isActive: true },
        ]);
    });

    it("falls back to the current active preset when there is no exact match", () => {
        const state = resolveMobileViewPresetState({
            buttonPresetIds: ["earth", "moon"],
            presetById: createPresetMap(),
            activePresetId: "moon",
            positionMode: "manual",
            lookMode: "manual",
        });

        expect(state.matchedPresetId).toBe("");
        expect(state.selectedPresetId).toBe("moon");
        expect(state.selectedPreset).toEqual({
            positionMode: "spacecraft",
            lookMode: "moon",
        });
    });

    it("falls back to the first visible preset when the current active preset is invalid", () => {
        const state = resolveMobileViewPresetState({
            buttonPresetIds: ["earth", "moon"],
            presetById: createPresetMap(),
            activePresetId: "unknown",
            positionMode: "manual",
            lookMode: "manual",
        });

        expect(state.selectedPresetId).toBe("earth");
        expect(state.buttonStates).toEqual([
            { presetId: "earth", isActive: true },
            { presetId: "moon", isActive: false },
        ]);
    });

    it("enforces the fallback preset only for the mobile views tab when selectors drift", () => {
        const selectedPreset = {
            positionMode: "spacecraft",
            lookMode: "moon",
        };

        expect(shouldEnforceMobileViewPreset({
            selectedPreset,
            enforceInProgress: false,
            isMobileViewport: true,
            activeTab: "views",
            positionMode: "manual",
            lookMode: "manual",
        })).toBe(true);

        expect(shouldEnforceMobileViewPreset({
            selectedPreset,
            enforceInProgress: true,
            isMobileViewport: true,
            activeTab: "views",
            positionMode: "manual",
            lookMode: "manual",
        })).toBe(false);

        expect(shouldEnforceMobileViewPreset({
            selectedPreset,
            enforceInProgress: false,
            isMobileViewport: false,
            activeTab: "views",
            positionMode: "manual",
            lookMode: "manual",
        })).toBe(false);

        expect(shouldEnforceMobileViewPreset({
            selectedPreset,
            enforceInProgress: false,
            isMobileViewport: true,
            activeTab: "mission",
            positionMode: "manual",
            lookMode: "manual",
        })).toBe(false);
    });
});
