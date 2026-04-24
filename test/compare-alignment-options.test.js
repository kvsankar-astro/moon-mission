import { describe, expect, it } from "vitest";

import {
    buildCompareAlignmentOptions,
    collectCompareAlignmentOptions,
} from "../src/platform/js/core/domain/compare-alignment-options.js";

describe("compare alignment options", () => {
    it("separates primary and comparison options from timeline event infos", () => {
        const timelineEventInfos = [
            {
                key: "timeline:primary:launch",
                timelineRole: "primary",
                timelineSourceKey: "launch",
                timelineLabel: "PM: Launch",
            },
            {
                key: "timeline:primary:tli",
                timelineRole: "primary",
                timelineSourceKey: "tli",
                timelineLabel: "PM: TLI",
            },
            {
                key: "timeline:comparison:launch",
                timelineRole: "comparison",
                timelineSourceKey: "launch",
                timelineLabel: "CM: Launch",
            },
            {
                key: "timeline:comparison:loi",
                timelineRole: "comparison",
                timelineSourceKey: "loi",
                timelineLabel: "CM: LOI",
            },
        ];

        expect(buildCompareAlignmentOptions(timelineEventInfos)).toEqual({
            primaryOptions: [
                { value: "launch", label: "PM: Launch" },
                { value: "tli", label: "PM: TLI" },
            ],
            comparisonOptions: [
                { value: "launch", label: "CM: Launch" },
                { value: "loi", label: "CM: LOI" },
            ],
        });
    });

    it("deduplicates by source event key and skips synthetic now markers", () => {
        const comparisonOptions = collectCompareAlignmentOptions([
            {
                key: "timeline:comparison:launch:1",
                timelineRole: "comparison",
                timelineSourceKey: "launch",
                timelineLabel: "CM: Launch",
            },
            {
                key: "timeline:comparison:launch:2",
                timelineRole: "comparison",
                timelineSourceKey: "launch",
                timelineLabel: "CM: Launch Duplicate",
            },
            {
                key: "timeline:comparison:now",
                kind: "now",
                timelineRole: "comparison",
                timelineSourceKey: "now",
                timelineLabel: "Now",
            },
        ], {
            comparison: true,
        });

        expect(comparisonOptions).toEqual([
            { value: "launch", label: "CM: Launch" },
        ]);
    });
});
