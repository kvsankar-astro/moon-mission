import { describe, expect, it } from "vitest";
import {
    completeAllLoadProgressStages,
    completeLoadProgressStage,
    computeLoadProgressPercent,
    createLoadProgressState,
    setLoadProgressStage,
} from "../assets/platform/js/core/domain/load-progress.js";

describe("load-progress domain helpers", () => {
    it("starts at 0% and reaches 100% when all stages complete", () => {
        let state = createLoadProgressState();
        expect(computeLoadProgressPercent(state)).toBe(0);

        state = completeAllLoadProgressStages(state);
        expect(computeLoadProgressPercent(state)).toBe(100);
    });

    it("respects stage weights for partial progress", () => {
        let state = createLoadProgressState();
        state = completeLoadProgressStage(state, "config");
        state = setLoadProgressStage(state, "orbit", 0.5);
        // 10 + (45 * 0.5) = 32.5
        expect(computeLoadProgressPercent(state)).toBeCloseTo(32.5, 6);
    });

    it("treats landing stage as complete when landing is excluded", () => {
        const state = createLoadProgressState({ includeLanding: false });
        // landing contributes its full 15% immediately
        expect(computeLoadProgressPercent(state)).toBeCloseTo(15, 6);
    });
});
