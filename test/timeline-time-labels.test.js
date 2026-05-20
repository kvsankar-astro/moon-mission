import { describe, expect, it } from "vitest";

import {
    buildTimelineTimeScale,
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

    it("keeps multi-day mobile ranges oriented with more than one tick", () => {
        const startTimeMs = new Date(2026, 3, 2, 7, 27, 23).getTime();
        const endTimeMs = new Date(2026, 3, 11, 5, 37, 11).getTime();

        const labels = buildTimelineTimeLabels({
            startTimeMs,
            endTimeMs,
            widthPx: 342,
        });

        expect(labels.length).toBeGreaterThanOrEqual(2);
        expect(labels.every((label) => label.intervalUnit === "day")).toBe(true);
    });

    it("adds minor ticks only when major label spacing can support them", () => {
        const startTimeMs = new Date(2026, 3, 1, 0, 0, 0).getTime();
        const endTimeMs = new Date(2026, 3, 12, 0, 0, 0).getTime();

        const wide = buildTimelineTimeScale({
            startTimeMs,
            endTimeMs,
            widthPx: 1200,
        });
        const narrow = buildTimelineTimeScale({
            startTimeMs,
            endTimeMs,
            widthPx: 140,
        });

        expect(wide.labels.length).toBeGreaterThan(1);
        expect(wide.minorTicks.length).toBeGreaterThan(0);
        expect(wide.minorTicks.every((tick) => tick.percent > 0 && tick.percent < 100)).toBe(true);
        expect(narrow.minorTicks.length).toBe(0);
    });

    it("uses calendar ticks for month-scale ranges", () => {
        const startTimeMs = new Date(2026, 0, 15, 0, 0, 0).getTime();
        const endTimeMs = new Date(2026, 6, 15, 0, 0, 0).getTime();

        const labels = buildTimelineTimeLabels({
            startTimeMs,
            endTimeMs,
            widthPx: 900,
        });

        expect(labels.length).toBeGreaterThan(0);
        expect(labels.every((label) => label.intervalUnit === "month")).toBe(true);
        expect(labels.map((label) => label.label)).toContain("Apr");
    });
});
