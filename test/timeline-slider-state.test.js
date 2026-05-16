import { describe, expect, it } from "vitest";

import {
    applyTimelineSliderMissionSeek,
    readTimelineSliderMissionState,
} from "../src/platform/js/core/domain/timeline-slider-state.js";

function createSlider({
    min = "400000",
    max = "500000",
    value = "500000",
    dataset = {},
} = {}) {
    return {
        min,
        max,
        value,
        dataset: { ...dataset },
    };
}

describe("timeline slider mission state", () => {
    it("reads precise mission time and full range from dataset when the visible thumb is clamped", () => {
        const slider = createSlider({
            dataset: {
                currentTimeMs: "900000",
                rangeMinMs: "0",
                rangeMaxMs: "1000000",
                viewMinMs: "400000",
                viewMaxMs: "500000",
            },
        });

        expect(readTimelineSliderMissionState(slider)).toMatchObject({
            min: 0,
            max: 1000000,
            viewMin: 400000,
            viewMax: 500000,
            value: 900000,
        });
    });

    it("stores the real seek target while keeping the visible slider thumb inside the zoomed view", () => {
        const slider = createSlider({
            dataset: {
                currentTimeMs: "900000",
                rangeMinMs: "0",
                rangeMaxMs: "1000000",
                viewMinMs: "400000",
                viewMaxMs: "500000",
            },
        });

        const result = applyTimelineSliderMissionSeek(slider, 840000, {
            source: "test-panel",
        });

        expect(result).toEqual({
            timeMs: 840000,
            visibleTimeMs: 500000,
        });
        expect(slider.value).toBe("500000");
        expect(slider.dataset.currentTimeMs).toBe("840000");
        expect(slider.dataset.programmaticSeekTimeMs).toBe("840000");
        expect(slider.dataset.programmaticSeekSource).toBe("test-panel");
    });
});
