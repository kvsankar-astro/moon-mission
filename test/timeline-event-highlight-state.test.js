import { describe, expect, it } from "vitest";

import {
    isSameTimelineMillisecond,
    resolveTimelineEventHighlightState,
} from "../src/platform/js/core/domain/timeline-event-highlight-state.js";

describe("timeline event highlight state", () => {
    it("marks the surrounding events as dashed boundaries between event times", () => {
        const state = resolveTimelineEventHighlightState({
            events: [
                { timeMs: 1000 },
                { timeMs: 2000 },
                { timeMs: 3000 },
            ],
            currentTimeMs: 2500,
        });

        expect(state.currentIndexes).toEqual([]);
        expect(state.boundaryIndexes).toEqual([1, 2]);
    });

    it("keeps same-time event groups together when they bracket the current time", () => {
        const state = resolveTimelineEventHighlightState({
            events: [
                { timeMs: 1000 },
                { timeMs: 1000 },
                { timeMs: 2000 },
            ],
            currentTimeMs: 1500,
        });

        expect(state.currentIndexes).toEqual([]);
        expect(state.boundaryIndexes).toEqual([0, 1, 2]);
    });

    it("marks only exact event-time matches as current", () => {
        const state = resolveTimelineEventHighlightState({
            events: [
                { timeMs: 1000 },
                { timeMs: 2000 },
            ],
            currentTimeMs: 1000,
        });

        expect(state.currentIndexes).toEqual([0]);
        expect(state.boundaryIndexes).toEqual([]);
    });

    it("does not mark an edge event when the current time is outside the event span", () => {
        expect(resolveTimelineEventHighlightState({
            events: [
                { timeMs: 1000 },
                { timeMs: 2000 },
            ],
            currentTimeMs: 500,
        })).toEqual({
            currentIndexes: [],
            boundaryIndexes: [],
        });
    });

    it("compares event times at millisecond precision", () => {
        expect(isSameTimelineMillisecond(1000.4, 1000.49)).toBe(true);
        expect(isSameTimelineMillisecond(1000.4, 1001.4)).toBe(false);
    });
});
