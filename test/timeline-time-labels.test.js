import { describe, expect, it } from "vitest";

import {
    buildTimelineTimeLabels,
    selectTimelineTimeLabelInterval,
} from "../src/platform/js/core/domain/timeline-time-labels.js";

describe("timeline time labels", () => {
    it("chooses day-scale labels for a multi-day mission range", () => {
        const startTimeMs = new Date(2026, 3, 1, 12, 0, 0).getTime();
        const endTimeMs = new Date(2026, 3, 10, 12, 0, 0).getTime();

        const labels = buildTimelineTimeLabels({
            startTimeMs,
            endTimeMs,
            widthPx: 900,
        });

        expect(labels.length).toBeGreaterThan(2);
        expect(labels.every((label) => label.intervalUnit === "day")).toBe(true);
        expect(labels[0].label).toMatch(/^Apr \d+$/);
        expect(labels[0].label).not.toContain(":");
    });

    it("adds time detail as the range resolution gets shorter", () => {
        const startTimeMs = new Date(2026, 3, 9, 10, 0, 0).getTime();
        const endTimeMs = new Date(2026, 3, 9, 16, 0, 0).getTime();

        const labels = buildTimelineTimeLabels({
            startTimeMs,
            endTimeMs,
            widthPx: 720,
        });

        expect(labels.length).toBeGreaterThan(0);
        expect(labels[0].label).toMatch(/^\d{2}:\d{2}$/);
    });

    it("includes years when the visible range crosses years", () => {
        const startTimeMs = new Date(2025, 10, 1, 0, 0, 0).getTime();
        const endTimeMs = new Date(2026, 4, 1, 0, 0, 0).getTime();

        const labels = buildTimelineTimeLabels({
            startTimeMs,
            endTimeMs,
            widthPx: 720,
        });

        expect(labels.some((label) => /\b2026\b/.test(label.label))).toBe(true);
    });

    it("uses the density offset to contract or expand the label cadence", () => {
        const startTimeMs = new Date(2026, 3, 1, 0, 0, 0).getTime();
        const endTimeMs = new Date(2026, 3, 12, 0, 0, 0).getTime();

        const contracted = buildTimelineTimeLabels({
            startTimeMs,
            endTimeMs,
            widthPx: 860,
            densityOffset: -2,
        });
        const expanded = buildTimelineTimeLabels({
            startTimeMs,
            endTimeMs,
            widthPx: 860,
            densityOffset: 2,
        });

        expect(expanded.length).toBeGreaterThan(contracted.length);
    });

    it("selects coarser intervals on narrow tracks", () => {
        const startTimeMs = new Date(2026, 3, 1, 0, 0, 0).getTime();
        const endTimeMs = new Date(2026, 3, 12, 0, 0, 0).getTime();

        const narrow = selectTimelineTimeLabelInterval({
            startTimeMs,
            endTimeMs,
            widthPx: 260,
        });
        const wide = selectTimelineTimeLabelInterval({
            startTimeMs,
            endTimeMs,
            widthPx: 960,
        });

        expect(narrow.ms || narrow.approximateMs).toBeGreaterThanOrEqual(wide.ms || wide.approximateMs);
    });
});
