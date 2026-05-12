import { describe, expect, it } from "vitest";

import {
    LUNAR_CRATER_DISPLAY_MODE_ALWAYS,
    LUNAR_CRATER_DISPLAY_MODE_HOVER,
    LUNAR_CRATER_SUPPORTED_VIEW_IDS,
    LUNAR_CRATER_VIEW_IDS,
    createDefaultLunarCraterViewState,
    normalizeLunarCraterDisplayMode,
    patchLunarCraterViewState,
    supportsLunarCraterView,
} from "../src/platform/js/core/domain/lunar-crater-view.js";

describe("lunar crater view domain", () => {
    it("declares the explicit crater-capable view identities", () => {
        expect(LUNAR_CRATER_SUPPORTED_VIEW_IDS).toEqual([
            LUNAR_CRATER_VIEW_IDS.MAIN,
            LUNAR_CRATER_VIEW_IDS.FRAME_AND_SHOOT,
        ]);
        expect(supportsLunarCraterView(LUNAR_CRATER_VIEW_IDS.MAIN)).toBe(true);
        expect(supportsLunarCraterView(LUNAR_CRATER_VIEW_IDS.FRAME_AND_SHOOT)).toBe(true);
        expect(supportsLunarCraterView("craft_to_moon")).toBe(false);
        expect(supportsLunarCraterView(null)).toBe(false);
    });

    it("normalizes and patches crater controls as per-view state", () => {
        const defaultState = createDefaultLunarCraterViewState();
        expect(defaultState).toEqual({
            viewLunarCraters: false,
            lunarCraterHoverLabels: true,
            lunarCraterDisplayMode: LUNAR_CRATER_DISPLAY_MODE_HOVER,
            lunarCraterMinDiameterKm: 80,
            lunarCraterMaxDiameterKm: 600,
        });

        const alwaysState = patchLunarCraterViewState(defaultState, {
            viewLunarCraters: true,
            lunarCraterHoverLabels: false,
            lunarCraterDisplayMode: LUNAR_CRATER_DISPLAY_MODE_ALWAYS,
            lunarCraterMinDiameterKm: 40,
            lunarCraterMaxDiameterKm: 120,
        });
        expect(alwaysState).toEqual({
            viewLunarCraters: true,
            lunarCraterHoverLabels: false,
            lunarCraterDisplayMode: LUNAR_CRATER_DISPLAY_MODE_ALWAYS,
            lunarCraterMinDiameterKm: 40,
            lunarCraterMaxDiameterKm: 120,
        });

        expect(normalizeLunarCraterDisplayMode("bogus")).toBe(LUNAR_CRATER_DISPLAY_MODE_HOVER);
        expect(patchLunarCraterViewState(alwaysState, { viewLunarCraters: false }).viewLunarCraters).toBe(false);
    });
});
