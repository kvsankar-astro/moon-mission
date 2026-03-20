import { describe, expect, it } from "vitest";
import {
    EVENT_KIND,
    inferLegacyEventKind,
    resolveEventInstant,
} from "../assets/platform/js/core/domain/event-time-resolver.js";

describe("event-time-resolver", () => {
    it("resolves fixed event time", () => {
        const resolved = resolveEventInstant(
            { kind: "fixed", startTime: "2023-01-01T00:00:00Z" },
            { eventKey: "launch" },
        );
        expect(resolved.ok).toBe(true);
        expect(resolved.kind).toBe(EVENT_KIND.FIXED);
        expect(resolved.timestampMs).toBe(new Date("2023-01-01T00:00:00Z").getTime());
    });

    it("resolves now and data_end event kinds", () => {
        const nowResolved = resolveEventInstant(
            { kind: "now", startTime: "dynamic" },
            { eventKey: "now", nowDate: new Date("2024-01-01T00:00:00Z") },
        );
        expect(nowResolved.ok).toBe(true);
        expect(nowResolved.kind).toBe(EVENT_KIND.NOW);
        expect(nowResolved.timestampMs).toBe(new Date("2024-01-01T00:00:00Z").getTime());

        const dataEndResolved = resolveEventInstant(
            {
                kind: "data_end",
                startTime: "dynamic",
                timeSource: { spacecraftMnemonic: "CY3" },
            },
            {
                eventKey: "cy3DataEnd",
                getDataEndTimeMs: (mnemonic) =>
                    mnemonic === "CY3"
                        ? new Date("2023-09-06T12:33:00Z").getTime()
                        : NaN,
            },
        );
        expect(dataEndResolved.ok).toBe(true);
        expect(dataEndResolved.kind).toBe(EVENT_KIND.DATA_END);
        expect(dataEndResolved.timestampMs).toBe(new Date("2023-09-06T12:33:00Z").getTime());
    });

    it("supports mission_marker kind", () => {
        const resolved = resolveEventInstant(
            {
                kind: "mission_marker",
                timeSource: { markerKey: "timeTransLunarInjection" },
            },
            {
                eventKey: "marker1",
                missionTimes: { timeTransLunarInjection: 12345 },
            },
        );
        expect(resolved.ok).toBe(true);
        expect(resolved.kind).toBe(EVENT_KIND.MISSION_MARKER);
        expect(resolved.timestampMs).toBe(12345);
    });

    it("provides legacy fallback inference for dynamic events", () => {
        expect(inferLegacyEventKind("now", { startTime: "dynamic" })).toBe(EVENT_KIND.NOW);
        expect(inferLegacyEventKind("cy3DataEnd", { startTime: "dynamic" })).toBe(EVENT_KIND.DATA_END);
        expect(inferLegacyEventKind("launch", { startTime: "2023-01-01T00:00:00Z" })).toBe(EVENT_KIND.FIXED);
    });
});
