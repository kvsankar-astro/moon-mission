import { describe, expect, it } from "vitest";

import { resolveMobileComposeLockState } from "../src/platform/js/core/domain/mobile-compose-lock-state.js";

function createPresetMap() {
    return new Map([
        ["free", { positionMode: "spacecraft", lookMode: "manual" }],
        ["earth", { positionMode: "spacecraft", lookMode: "earth" }],
        ["moon", { positionMode: "spacecraft", lookMode: "moon" }],
    ]);
}

describe("mobile compose lock state", () => {
    it("selects the exact matching compose preset", () => {
        const state = resolveMobileComposeLockState({
            buttonPresetIds: ["free", "earth", "moon"],
            presetById: createPresetMap(),
            activePresetId: "free",
            positionMode: "spacecraft",
            lookMode: "earth",
        });

        expect(state.matchedPresetId).toBe("earth");
        expect(state.selectedPresetId).toBe("earth");
        expect(state.buttonStates).toEqual([
            { presetId: "free", isActive: false },
            { presetId: "earth", isActive: true },
            { presetId: "moon", isActive: false },
        ]);
    });

    it("falls back to the active preset when there is no exact match", () => {
        const state = resolveMobileComposeLockState({
            buttonPresetIds: ["free", "earth", "moon"],
            presetById: createPresetMap(),
            activePresetId: "moon",
            positionMode: "manual",
            lookMode: "manual",
        });

        expect(state.matchedPresetId).toBe("");
        expect(state.selectedPresetId).toBe("moon");
    });

    it("falls back to free when the current preset is invalid", () => {
        const state = resolveMobileComposeLockState({
            buttonPresetIds: ["free", "earth", "moon"],
            presetById: createPresetMap(),
            activePresetId: "unknown",
            positionMode: "manual",
            lookMode: "manual",
        });

        expect(state.selectedPresetId).toBe("free");
        expect(state.buttonStates).toEqual([
            { presetId: "free", isActive: true },
            { presetId: "earth", isActive: false },
            { presetId: "moon", isActive: false },
        ]);
    });
});
