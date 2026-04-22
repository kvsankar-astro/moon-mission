import { describe, expect, it } from "vitest";

import {
    buildTimelineEventInfos,
    resolveTimelineEventHoverText,
    resolveTimelineEventInfoText,
    resolveTimelineEventLabel,
} from "../src/platform/js/app/comparison-timeline.js";

describe("comparison timeline", () => {
    it("returns the primary mission events unchanged outside compare mode", () => {
        const primaryEventInfos = [{ key: "launch", label: "Launch" }];

        expect(buildTimelineEventInfos({
            compareMode: false,
            globalConfig: null,
            config: "geo",
            primaryEventInfos,
        })).toBe(primaryEventInfos);
    });

    it("defaults to launch-aligned comparison timing when both missions expose launch events", () => {
        const primaryEventInfos = [
            {
                key: "launch",
                label: "Launch",
                startTime: new Date(100),
                durationSeconds: 0,
                hoverText: "Launch event",
            },
            {
                key: "now",
                kind: "now",
                label: "Now",
                startTime: new Date(150),
            },
            {
                key: "loi",
                label: "LOI",
                startTime: new Date(600),
                durationSeconds: 120,
                burnFlag: true,
                hoverText: "Lunar orbit insertion",
            },
        ];
        const timelineEventInfos = buildTimelineEventInfos({
            compareMode: true,
            config: "geo",
            primaryEventInfos,
            globalConfig: {
                mission_name: "Primary Mission",
                mission_name_short: "PM",
                comparisonOverlay: {
                    missionName: "Compare Mission",
                    missionShortLabel: "CM",
                    missionKey: "compare-mission",
                    compareCraftId: "CMP_MISSION_CM",
                    primaryTimelineEventInfosByOrigin: {
                        geo: [
                            {
                                key: "launch",
                                label: "Launch",
                                startTime: new Date(100),
                            },
                            {
                                key: "loi",
                                label: "LOI",
                                startTime: new Date(600),
                            },
                        ],
                    },
                    displayTimeRangesByOrigin: {
                        geo: { startMs: 0, endMs: 2000 },
                    },
                    sourceTimeRangesByOrigin: {
                        geo: { startMs: 2000, endMs: 3000 },
                    },
                    timelineSourceEventInfosByOrigin: {
                        geo: [
                            {
                                key: "launch",
                                label: "Launch",
                                startTime: new Date(2200),
                            },
                            {
                                key: "tli",
                                label: "TLI",
                                startTime: new Date(2350),
                                durationSeconds: 90,
                                burnFlag: true,
                                hoverText: "Trans-lunar injection",
                            },
                            {
                                key: "landing",
                                label: "Landing",
                                startTime: new Date(2900),
                                hoverText: "Touchdown",
                            },
                        ],
                    },
                },
            },
        });

        expect(timelineEventInfos.map((eventInfo) => [
            resolveTimelineEventLabel(eventInfo),
            eventInfo.startTime.getTime(),
            eventInfo.timelineRole,
        ])).toEqual([
            ["PM: Launch", 100, "primary"],
            ["CM: Launch", 100, "comparison"],
            ["CM: TLI", 250, "comparison"],
            ["PM: LOI", 600, "primary"],
            ["CM: Landing", 800, "comparison"],
        ]);
        expect(timelineEventInfos.every((eventInfo) => eventInfo.key !== "now")).toBe(true);
        expect(timelineEventInfos[2]).toMatchObject({
            comparisonEvent: true,
            body: "CMP_MISSION_CM",
            timelineMissionLabel: "CM",
        });
        expect(timelineEventInfos[2].sourceStartTime.getTime()).toBe(2350);
        expect(resolveTimelineEventHoverText(timelineEventInfos[2])).toContain("CM");
        expect(resolveTimelineEventHoverText(timelineEventInfos[2])).toContain("Trans-lunar injection");
        expect(resolveTimelineEventInfoText(timelineEventInfos[3])).toContain("PM");
    });

    it("aligns any selected event pair without scaling and keeps primary events first on exact timeline ties", () => {
        const primaryEventInfos = [
            {
                key: "launch",
                label: "Launch",
                startTime: new Date(1000),
            },
            {
                key: "burn",
                label: "Burn",
                startTime: new Date(1500),
            },
        ];

        const timelineEventInfos = buildTimelineEventInfos({
            compareMode: true,
            config: "geo",
            primaryEventInfos,
            globalConfig: {
                mission_name: "Primary Mission",
                mission_name_short: "PM",
                comparisonOverlay: {
                    missionName: "Compare Mission",
                    missionShortLabel: "CM",
                    missionKey: "compare-mission",
                    compareCraftId: "CMP_MISSION_CM",
                    selectedPrimaryAlignmentEventKey: "burn",
                    selectedComparisonAlignmentEventKey: "burn",
                    primaryTimelineEventInfosByOrigin: {
                        geo: [
                            {
                                key: "launch",
                                label: "Launch",
                                startTime: new Date(1000),
                            },
                            {
                                key: "burn",
                                label: "Burn",
                                startTime: new Date(1500),
                            },
                        ],
                    },
                    displayTimeRangesByOrigin: {
                        geo: { startMs: 1000, endMs: 4000 },
                    },
                    sourceTimeRangesByOrigin: {
                        geo: { startMs: 3000, endMs: 7000 },
                    },
                    timelineSourceEventInfosByOrigin: {
                        geo: [
                            {
                                key: "launch",
                                label: "Launch",
                                startTime: new Date(3000),
                            },
                            {
                                key: "burn",
                                label: "Burn",
                                startTime: new Date(3500),
                            },
                        ],
                    },
                },
            },
        });

        expect(timelineEventInfos.map((eventInfo) => [
            resolveTimelineEventLabel(eventInfo),
            eventInfo.startTime.getTime(),
            eventInfo.timelineRole,
        ])).toEqual([
            ["PM: Launch", 1000, "primary"],
            ["CM: Launch", 1000, "comparison"],
            ["PM: Burn", 1500, "primary"],
            ["CM: Burn", 1500, "comparison"],
        ]);
    });
});
