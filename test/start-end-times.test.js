import { describe, expect, it } from "vitest";

import {
    createStartEndTimesResolver,
    resolveMissionBodyTimeRange,
} from "../src/platform/js/app/start-end-times.js";

function createUTCTimestamp(year, month, day, hour, minute) {
    return Date.UTC(year, month - 1, day, hour, minute, 0, 0);
}

describe("createStartEndTimesResolver", () => {
    it("returns the phase window for legacy single-craft missions", () => {
        const getStartAndEndTimes = createStartEndTimesResolver({
            getGlobalConfig: () => ({
                spacecraft_mnemonic: "CH3",
                geo: {
                    start_year: "2023",
                    start_month: "07",
                    start_day: "14",
                    start_hour: "09",
                    start_minute: "23",
                    stop_year: "2023",
                    stop_month: "09",
                    stop_day: "06",
                    stop_hour: "12",
                    stop_minute: "33",
                },
            }),
            getConfig: () => "geo",
            createUTCTimestamp,
            oneMinuteMs: 60000,
        });

        const [startTime, endTime] = getStartAndEndTimes("CH3");
        expect(startTime).toBe(Date.UTC(2023, 6, 14, 9, 23, 0, 0));
        expect(endTime).toBe(Date.UTC(2023, 8, 6, 12, 32, 0, 0));
    });

    it("returns a configured craft span when one exists for the active origin", () => {
        const getStartAndEndTimes = createStartEndTimesResolver({
            getGlobalConfig: () => ({
                primaryCraftId: "ORB",
                crafts: [
                    {
                        id: "ORB",
                        mnemonic: "CH2O",
                        primary: true,
                        aliases: ["SC"],
                        spans: {
                            lunar: {
                                startTime: "2019-08-20T00:00:00Z",
                                endTime: "2019-09-02T07:44:00Z",
                            },
                        },
                    },
                    {
                        id: "VIK",
                        mnemonic: "C2V",
                        spans: {
                            lunar: {
                                startTime: "2019-09-02T07:45:00Z",
                                endTime: "2019-09-07T00:00:00Z",
                            },
                        },
                    },
                ],
                lunar: {
                    start_year: "2019",
                    start_month: "07",
                    start_day: "22",
                    start_hour: "09",
                    start_minute: "31",
                    stop_year: "2019",
                    stop_month: "09",
                    stop_day: "07",
                    stop_hour: "00",
                    stop_minute: "00",
                },
            }),
            getConfig: () => "lunar",
            createUTCTimestamp,
            oneMinuteMs: 60000,
        });

        const [orbStart, orbEnd] = getStartAndEndTimes("ORB");
        expect(orbStart).toBe(Date.parse("2019-08-20T00:00:00Z"));
        expect(orbEnd).toBe(Date.parse("2019-09-02T07:44:00Z"));

        const [vikStart, vikEnd] = getStartAndEndTimes("C2V");
        expect(vikStart).toBe(Date.parse("2019-09-02T07:45:00Z"));
        expect(vikEnd).toBe(Date.parse("2019-09-07T00:00:00Z"));
    });

    it("resolves mission body time ranges with phase fallback for timeline bands", () => {
        const globalConfig = {
            primaryCraftId: "ORB",
            crafts: [
                {
                    id: "ORB",
                    mnemonic: "CH3O",
                    primary: true,
                    spans: {},
                },
                {
                    id: "LAN",
                    mnemonic: "CH3L",
                    spans: {
                        lunar: {
                            start_year: "2023",
                            start_month: "08",
                            start_day: "17",
                            start_hour: "12",
                            start_minute: "00",
                            stop_year: "2023",
                            stop_month: "08",
                            stop_day: "23",
                            stop_hour: "12",
                            stop_minute: "35",
                        },
                    },
                },
            ],
            lunar: {
                start_year: "2023",
                start_month: "07",
                start_day: "14",
                start_hour: "09",
                start_minute: "23",
                stop_year: "2023",
                stop_month: "09",
                stop_day: "06",
                stop_hour: "12",
                stop_minute: "33",
            },
        };

        const [orbStart, orbEnd] = resolveMissionBodyTimeRange({
            globalConfig,
            config: "lunar",
            bodyId: "ORB",
            createUTCTimestamp,
            oneMinuteMs: 60000,
        });
        expect(orbStart).toBe(Date.UTC(2023, 6, 14, 9, 23, 0, 0));
        expect(orbEnd).toBe(Date.UTC(2023, 8, 6, 12, 32, 0, 0));

        const [lanStart, lanEnd] = resolveMissionBodyTimeRange({
            globalConfig,
            config: "lunar",
            bodyId: "LAN",
            createUTCTimestamp,
            oneMinuteMs: 60000,
        });
        expect(lanStart).toBe(Date.UTC(2023, 7, 17, 12, 0, 0, 0));
        expect(lanEnd).toBe(Date.UTC(2023, 7, 23, 12, 34, 0, 0));
    });
});
