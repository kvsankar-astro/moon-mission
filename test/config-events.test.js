import { describe, expect, it } from "vitest";
import { computeEventsUpdate } from "../src/platform/js/app/config-events.js";

describe("computeEventsUpdate", () => {
    it("resolves typed event kinds and keeps sorted timeline", () => {
        const update = computeEventsUpdate({
            globalConfig: {
                spacecraft_mnemonic: "CY3",
                events: {
                    launch: {
                        kind: "fixed",
                        startTime: "2023-01-01T00:00:00Z",
                        durationSeconds: 0,
                        label: "Launch",
                        burnFlag: false,
                        infoText: "Launch",
                        body: "SC",
                    },
                    now: {
                        kind: "now",
                        startTime: "dynamic",
                        durationSeconds: 0,
                        label: "Now",
                        burnFlag: false,
                        infoText: "Now",
                        body: "",
                    },
                    dataEnd: {
                        kind: "data_end",
                        startTime: "dynamic",
                        timeSource: { spacecraftMnemonic: "CY3" },
                        durationSeconds: 0,
                        label: "Data End",
                        burnFlag: false,
                        infoText: "End",
                        body: "",
                    },
                },
                eventConfigs: {
                    geo: ["dataEnd", "launch", "now"],
                },
            },
            config: "geo",
            nowDate: new Date("2023-01-03T00:00:00Z"),
            getDataEndTimeMs: () => new Date("2023-01-02T00:00:00Z").getTime(),
        });

        expect(update.shouldUpdate).toBe(true);
        expect(update.warnings).toEqual([]);
        expect(update.eventInfos.map((event) => event.kind)).toEqual(["fixed", "data_end", "now"]);
        expect(update.eventInfos.map((event) => event.key)).toEqual(["launch", "dataEnd", "now"]);
    });

    it("injects a Now event when current time falls within the mission data span", () => {
        const update = computeEventsUpdate({
            globalConfig: {
                spacecraft_mnemonic: "CY3",
                geo: {
                    start_year: "2023",
                    start_month: "01",
                    start_day: "01",
                    start_hour: "00",
                    start_minute: "00",
                },
                events: {
                    launch: {
                        kind: "fixed",
                        startTime: "2023-01-01T00:00:00Z",
                        durationSeconds: 0,
                        label: "Launch",
                        burnFlag: false,
                        infoText: "Launch",
                        body: "SC",
                    },
                    dataEnd: {
                        kind: "data_end",
                        startTime: "dynamic",
                        timeSource: { spacecraftMnemonic: "CY3" },
                        durationSeconds: 0,
                        label: "Data End",
                        burnFlag: false,
                        infoText: "End",
                        body: "",
                    },
                },
                eventConfigs: {
                    geo: ["launch", "dataEnd"],
                },
            },
            config: "geo",
            nowDate: new Date("2023-01-02T12:00:00Z"),
            getDataEndTimeMs: () => new Date("2023-01-03T00:00:00Z").getTime(),
        });

        expect(update.eventInfos.map((event) => event.key)).toEqual(["launch", "now", "dataEnd"]);
        expect(update.eventInfos.map((event) => event.kind)).toEqual(["fixed", "now", "data_end"]);
    });

    it("hides a Now event when current time is outside the mission data span", () => {
        const update = computeEventsUpdate({
            globalConfig: {
                spacecraft_mnemonic: "CY3",
                geo: {
                    start_year: "2023",
                    start_month: "01",
                    start_day: "10",
                    start_hour: "00",
                    start_minute: "00",
                },
                events: {
                    launch: {
                        kind: "fixed",
                        startTime: "2023-01-10T00:00:00Z",
                        durationSeconds: 0,
                        label: "Launch",
                        burnFlag: false,
                        infoText: "Launch",
                        body: "SC",
                    },
                    now: {
                        kind: "now",
                        startTime: "dynamic",
                        durationSeconds: 0,
                        label: "Now",
                        burnFlag: false,
                        infoText: "Now",
                        body: "",
                    },
                    dataEnd: {
                        kind: "data_end",
                        startTime: "dynamic",
                        timeSource: { spacecraftMnemonic: "CY3" },
                        durationSeconds: 0,
                        label: "Data End",
                        burnFlag: false,
                        infoText: "End",
                        body: "",
                    },
                },
                eventConfigs: {
                    geo: ["launch", "now", "dataEnd"],
                },
            },
            config: "geo",
            nowDate: new Date("2023-01-05T00:00:00Z"),
            getDataEndTimeMs: () => new Date("2023-01-20T00:00:00Z").getTime(),
        });

        expect(update.eventInfos.map((event) => event.key)).toEqual(["launch", "dataEnd"]);
    });

    it("supports legacy dynamic fallback when kind is missing", () => {
        const update = computeEventsUpdate({
            globalConfig: {
                spacecraft_mnemonic: "CY2",
                events: {
                    now: {
                        startTime: "dynamic",
                        durationSeconds: 0,
                        label: "Now",
                        burnFlag: false,
                        infoText: "Now",
                        body: "",
                    },
                    cy2DataEnd: {
                        startTime: "dynamic",
                        durationSeconds: 0,
                        label: "Data End",
                        burnFlag: false,
                        infoText: "End",
                        body: "",
                    },
                },
                eventConfigs: {
                    lunar: ["now", "cy2DataEnd"],
                },
            },
            config: "lunar",
            nowDate: new Date("2023-01-03T00:00:00Z"),
            getDataEndTimeMs: () => new Date("2023-01-04T00:00:00Z").getTime(),
        });

        expect(update.shouldUpdate).toBe(true);
        expect(update.warnings).toEqual([]);
        expect(update.eventInfos.map((event) => event.kind)).toEqual(["now", "data_end"]);
    });

    it("marks pre-ephemeris craft events non-clickable until the craft span begins", () => {
        const update = computeEventsUpdate({
            globalConfig: {
                spacecraft_mnemonic: "ORION",
                primaryCraftId: "SC",
                crafts: [
                    {
                        id: "SC",
                        mnemonic: "ORION",
                        primary: true,
                        spans: {
                            geo: {
                                startTime: "2026-04-02T01:49:00Z",
                                endTime: "2026-04-10T23:52:00Z",
                            },
                        },
                    },
                ],
                geo: {
                    start_year: "2026",
                    start_month: "04",
                    start_day: "02",
                    start_hour: "01",
                    start_minute: "49",
                },
                events: {
                    separation: {
                        startTime: "2026-04-02T01:48:18Z",
                        durationSeconds: 0,
                        label: "ICPS Sep",
                        burnFlag: false,
                        body: "SC",
                        requiresEphemeris: true,
                    },
                    dataStart: {
                        startTime: "2026-04-02T01:49:00Z",
                        durationSeconds: 0,
                        label: "Data Start",
                        burnFlag: false,
                        body: "SC",
                        requiresEphemeris: true,
                    },
                },
                eventConfigs: {
                    geo: ["separation", "dataStart"],
                },
            },
            config: "geo",
            nowDate: new Date("2026-04-02T00:00:00Z"),
            getDataEndTimeMs: () => new Date("2026-04-10T23:52:00Z").getTime(),
        });

        expect(update.shouldUpdate).toBe(true);
        expect(update.warnings).toEqual([]);
        expect(update.eventInfos.map((event) => event.key)).toEqual(["separation", "dataStart"]);
        expect(update.eventInfos.map((event) => event.clickable)).toEqual([false, true]);
        expect(update.eventInfos.map((event) => event.preEphemeris)).toEqual([true, false]);
    });
});
