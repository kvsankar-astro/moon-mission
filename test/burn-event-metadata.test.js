import { describe, expect, it } from "vitest";
import {
    buildEventHoverText,
    buildEventInfoText,
    formatBurnDuration,
    isBurnIndicatorVisibleAtTime,
    resolveBurnIndicatorAngle,
    resolveBurnIndicatorFill,
    resolveBurnIndicatorShape,
    resolveBurnMetadata,
} from "../src/platform/js/app/burn-event-metadata.js";

describe("burn event metadata helpers", () => {
    it("formats known burn durations and unknown durations", () => {
        expect(formatBurnDuration(18)).toBe("18 s");
        expect(formatBurnDuration(300)).toBe("5 m");
        expect(formatBurnDuration(0)).toBe("Duration unpublished");
    });

    it("resolves explicit Artemis-style burn metadata", () => {
        const metadata = resolveBurnMetadata({
            burnFlag: true,
            burnDirection: "prograde",
            burnTypeLabel: "Trajectory-correction burn",
            durationSeconds: 18,
        });

        expect(metadata.direction).toBe("prograde");
        expect(metadata.typeLabel).toBe("Trajectory-correction burn");
        expect(metadata.durationLabel).toBe("18 s");
        expect(metadata.summaryLabel).toContain("Trajectory-correction burn");
    });

    it("builds event hover/info text with burn type and duration", () => {
        const event = {
            burnFlag: true,
            burnDirection: "prograde",
            burnTypeLabel: "Trans-lunar injection burn",
            durationSeconds: 300,
            hoverText: "Major translunar burn",
            infoText: "TLI begins",
            label: "TLI",
        };

        expect(buildEventHoverText(event)).toContain("Trans-lunar injection burn");
        expect(buildEventHoverText(event)).toContain("5 m");
        expect(buildEventInfoText(event)).toContain("Trans-lunar injection burn");
    });

    it("maps prograde, retrograde, and attitude burns to indicator semantics", () => {
        expect(resolveBurnIndicatorAngle({ burnFlag: true, burnDirection: "prograde" }, 35)).toBe(215);
        expect(resolveBurnIndicatorAngle({ burnFlag: true, burnDirection: "retrograde" }, 35)).toBe(35);
        expect(resolveBurnIndicatorShape({ burnFlag: true, burnDirection: "attitude" })).toBe("0 -14 14 0 0 14 -14 0");
        expect(resolveBurnIndicatorFill({ burnFlag: true, burnDirection: "attitude" })).toBe("#ffcf6a");
    });

    it("shows burn indicators only during the configured animation-time burn duration", () => {
        const timedBurn = {
            burnFlag: true,
            startTime: new Date("2026-04-10T01:53:12Z"),
            durationSeconds: 9,
        };
        expect(isBurnIndicatorVisibleAtTime(timedBurn, Date.parse("2026-04-10T01:53:12Z"))).toBe(true);
        expect(isBurnIndicatorVisibleAtTime(timedBurn, Date.parse("2026-04-10T01:53:20Z"))).toBe(true);
        expect(isBurnIndicatorVisibleAtTime(timedBurn, Date.parse("2026-04-10T01:53:21Z"))).toBe(false);

        const unpublishedBurn = {
            burnFlag: true,
            startTime: new Date("2026-04-10T17:53:12Z"),
            durationSeconds: 0,
        };
        expect(isBurnIndicatorVisibleAtTime(unpublishedBurn, Date.parse("2026-04-10T17:53:12Z"))).toBe(true);
        expect(isBurnIndicatorVisibleAtTime(unpublishedBurn, Date.parse("2026-04-10T17:53:13Z"))).toBe(false);
        expect(
            isBurnIndicatorVisibleAtTime(
                {
                    ...unpublishedBurn,
                    _shownAtWallTimeMs: 1_000,
                },
                Date.parse("2026-04-10T17:53:13Z"),
                { nowWallTimeMs: 1_300, minimumInstantWallTimeMs: 500 },
            ),
        ).toBe(true);
        expect(
            isBurnIndicatorVisibleAtTime(
                {
                    ...unpublishedBurn,
                    _shownAtWallTimeMs: 1_000,
                },
                Date.parse("2026-04-10T17:53:13Z"),
                { nowWallTimeMs: 1_600, minimumInstantWallTimeMs: 500 },
            ),
        ).toBe(false);
    });
});
