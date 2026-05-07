import { describe, expect, it } from "vitest";

import {
    buildTimelinePhases,
    resolveActiveTimelinePhaseIndex,
    resolveTimelinePhaseSeekTimeMs,
} from "../src/platform/js/core/domain/timeline-phases.js";

const events = [
    { key: "launch", label: "Launch", startTime: new Date("2026-04-01T00:00:00Z") },
    { key: "tli", label: "TLI", startTime: new Date("2026-04-02T00:00:00Z") },
    { key: "soiIn", label: "SOI In", startTime: new Date("2026-04-03T00:00:00Z") },
    { key: "soiOut", label: "SOI Out", startTime: new Date("2026-04-04T00:00:00Z") },
    { key: "splashdown", label: "Splashdown", startTime: new Date("2026-04-05T00:00:00Z") },
];

describe("timeline phases", () => {
    it("resolves config-authored phases using closed-left/open-right intervals", () => {
        const phases = buildTimelinePhases({
            eventInfos: events,
            phaseConfig: {
                intervalSemantics: "closed-open",
                items: [
                    { id: "earth", label: "Earth Orbit", startEvent: "launch", endEvent: "tli" },
                    { id: "outbound", label: "Outbound", startEvent: "tli", endEvent: "soiIn" },
                    { id: "flyby", label: "Flyby", startEvent: "soiIn", endEvent: "soiOut" },
                    { id: "return", label: "Return", startEvent: "soiOut", endEvent: "splashdown" },
                ],
            },
        });

        expect(phases.map((phase) => [phase.id, phase.events.map((eventInfo) => eventInfo.key)])).toEqual([
            ["earth", ["launch"]],
            ["outbound", ["tli"]],
            ["flyby", ["soiIn"]],
            ["return", ["soiOut", "splashdown"]],
        ]);
    });

    it("selects the phase containing the current time and includes the final right edge", () => {
        const phases = buildTimelinePhases({
            eventInfos: events,
            phaseConfig: {
                items: [
                    { id: "earth", label: "Earth Orbit", startEvent: "launch", endEvent: "tli" },
                    { id: "return", label: "Return", startEvent: "tli", endEvent: "splashdown" },
                ],
            },
        });

        expect(resolveActiveTimelinePhaseIndex(phases, Date.parse("2026-04-02T00:00:00Z"))).toBe(1);
        expect(resolveActiveTimelinePhaseIndex(phases, Date.parse("2026-04-05T00:00:00Z"))).toBe(1);
    });

    it("falls back to one mission phase when no phase config exists", () => {
        const phases = buildTimelinePhases({ eventInfos: events, phaseConfig: null });

        expect(phases).toHaveLength(1);
        expect(phases[0].id).toBe("mission");
        expect(phases[0].events.map((eventInfo) => eventInfo.key)).toEqual([
            "launch",
            "tli",
            "soiIn",
            "soiOut",
            "splashdown",
        ]);
    });

    it("seeks just inside a selected phase to avoid falling back to the previous boundary interval", () => {
        const phases = buildTimelinePhases({
            eventInfos: events,
            phaseConfig: {
                items: [
                    { id: "earth", label: "Earth Orbit", startEvent: "launch", endEvent: "tli" },
                    { id: "outbound", label: "Outbound", startEvent: "tli", endEvent: "soiIn" },
                ],
            },
        });

        const targetMs = resolveTimelinePhaseSeekTimeMs({
            phase: phases[1],
            timelineMinMs: events[0].startTime.getTime(),
            timelineMaxMs: events[events.length - 1].startTime.getTime(),
            stepMs: 60000,
        });

        expect(targetMs).toBeGreaterThan(phases[1].startMs);
        expect(resolveActiveTimelinePhaseIndex(phases, targetMs)).toBe(1);
    });
});
