import { describe, expect, it } from "vitest";

import {
    computeControlPanelVisualHeight,
    computeTimelineDockVisualHeight,
    resolveTimelineEventCarouselPresentation,
    resolveUpcomingTimelineEventIndex,
} from "../src/platform/js/core/domain/control-panel-timeline-state.js";

describe("control-panel-timeline-state", () => {
    it("computes clamped layout heights", () => {
        expect(computeControlPanelVisualHeight({ collapsed: false, panelHeight: 62.6 })).toBe(63);
        expect(computeControlPanelVisualHeight({ collapsed: true, panelHeight: 62.6 })).toBe(0);
        expect(computeTimelineDockVisualHeight(91.2)).toBe(91);
        expect(computeTimelineDockVisualHeight(Number.NaN)).toBe(0);
    });

    it("returns the correct timeline carousel labels", () => {
        expect(resolveTimelineEventCarouselPresentation(true)).toEqual({
            expanded: true,
            ariaExpanded: "true",
            ariaLabel: "Hide event track",
            title: "Hide event track",
        });
        expect(resolveTimelineEventCarouselPresentation(false)).toEqual({
            expanded: false,
            ariaExpanded: "false",
            ariaLabel: "Show event track",
            title: "Show event track",
        });
    });

    it("prefers the nearest future event and falls back to the nearest overall event", () => {
        expect(resolveUpcomingTimelineEventIndex([1000, 2000, 5000], 2100)).toBe(2);
        expect(resolveUpcomingTimelineEventIndex([1000, 2000, 5000], 6000)).toBe(2);
        expect(resolveUpcomingTimelineEventIndex([Number.NaN, 4000], 1000)).toBe(1);
        expect(resolveUpcomingTimelineEventIndex([], 1000)).toBe(-1);
        expect(resolveUpcomingTimelineEventIndex([1000, 2000], Number.NaN)).toBe(0);
    });
});
