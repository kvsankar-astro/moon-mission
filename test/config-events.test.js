import { describe, expect, it } from "vitest";
import { computeEventsUpdate } from "../assets/platform/js/app/config-events.js";

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
});
