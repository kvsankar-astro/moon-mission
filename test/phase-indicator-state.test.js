import { describe, expect, it } from "vitest";

import { buildPhaseIndicatorModel } from "../src/platform/js/core/domain/phase-indicator-state.js";

describe("phase indicator state", () => {
    it("builds highlighted desktop and mobile labels for lunar missions", () => {
        expect(buildPhaseIndicatorModel({
            phase: "lunar-bound",
            isLunarMission: true,
        })).toEqual({
            desktopPhases: [
                {
                    id: "phase-1",
                    label: "Earth Bound Phase",
                    isActive: false,
                },
                {
                    id: "phase-2",
                    label: "Lunar Bound Phase",
                    isActive: true,
                },
                {
                    id: "phase-3",
                    label: "Lunar Orbit Phase",
                    isActive: false,
                },
            ],
            mobilePhaseText: "Lunar Bound",
        });
    });

    it("keeps desktop updates empty for non-lunar missions but still resolves mobile text", () => {
        expect(buildPhaseIndicatorModel({
            phase: "earth-bound",
            isLunarMission: false,
        })).toEqual({
            desktopPhases: [],
            mobilePhaseText: "Earth Bound",
        });
    });

    it("falls back to placeholders when the phase is unknown", () => {
        expect(buildPhaseIndicatorModel({
            phase: "unknown-phase",
            isLunarMission: true,
        })).toEqual({
            desktopPhases: [
                {
                    id: "phase-1",
                    label: "Earth Bound Phase",
                    isActive: false,
                },
                {
                    id: "phase-2",
                    label: "Lunar Bound Phase",
                    isActive: false,
                },
                {
                    id: "phase-3",
                    label: "Lunar Orbit Phase",
                    isActive: false,
                },
            ],
            mobilePhaseText: "--",
        });
    });
});
