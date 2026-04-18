import { describe, expect, it } from "vitest";

import {
    buildComposeTimelineDisplay,
    resolveComposeTimelineRange,
    resolveComposeTimelineSliderValue,
    resolveComposeTimelineTime,
} from "../src/platform/js/core/domain/mobile-compose-timeline-state.js";

describe("mobile compose timeline state", () => {
    it("uses a valid flyby window when one is available", () => {
        const range = resolveComposeTimelineRange({
            timelineState: { min: 100, max: 1000, value: 450 },
            flybyWindow: { startMs: 150, endMs: 250 },
            flybyTimeMs: Number.NaN,
            windowMs: 200,
        });

        expect(range).toEqual({
            startMs: 150,
            endMs: 250,
        });
    });

    it("falls back to a centered window around the flyby time and clamps to the timeline bounds", () => {
        const range = resolveComposeTimelineRange({
            timelineState: { min: 100, max: 1000, value: 450 },
            flybyWindow: { startMs: Number.NaN, endMs: Number.NaN },
            flybyTimeMs: 150,
            windowMs: 200,
        });

        expect(range).toEqual({
            startMs: 100,
            endMs: 300,
        });
    });

    it("maps between slider values and timeline times using the active range", () => {
        const range = { startMs: 400, endMs: 600 };
        const sliderValue = resolveComposeTimelineSliderValue({
            timelineState: { value: 450 },
            range,
            resolution: 1000,
        });
        const timeMs = resolveComposeTimelineTime({
            sliderValue: 750,
            range,
            resolution: 1000,
        });

        expect(sliderValue).toBe("250");
        expect(timeMs).toBe(550);
    });

    it("builds the UTC and local display strings from the current timeline value", () => {
        const display = buildComposeTimelineDisplay({
            timelineState: { value: 450 },
            formatLocalDateTimeShort: (timeMs) => `Local ${timeMs}`,
        });

        expect(display).toEqual({
            utcText: new Date(450).toUTCString(),
            localText: "Local: Local 450",
        });
    });
});
