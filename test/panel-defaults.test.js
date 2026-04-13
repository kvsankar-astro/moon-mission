import { describe, expect, it } from "vitest";

import {
    getMissionPanelDefaultState,
    isMissionPanelEnabled,
    normalizeMissionPanelState,
    shouldMissionPanelAutoOpenBeforeEvent,
} from "../src/platform/js/app/panel-defaults.js";

describe("normalizeMissionPanelState", () => {
    it("normalizes supported lifecycle states", () => {
        expect(normalizeMissionPanelState("MINIMIZED")).toBe("minimized");
        expect(normalizeMissionPanelState(" deleted ")).toBe("deleted");
    });

    it("allows an empty fallback when probing persisted state", () => {
        expect(normalizeMissionPanelState("not-a-state", "")).toBe("");
    });
});

describe("panel defaults", () => {
    const missionConfig = {
        ui: {
            panels: {
                defaults: {
                    "aux:earth": {
                        enabled: true,
                        defaultState: "open",
                    },
                    "workflow:splashdown": {
                        enabled: false,
                        defaultState: "closed",
                        autoOpenBeforeEvent: false,
                    },
                },
            },
        },
    };

    it("reads configured panel state", () => {
        expect(
            getMissionPanelDefaultState(missionConfig, "workflow:splashdown", { fallbackState: "open" }),
        ).toBe("closed");
    });

    it("falls back when a panel has no explicit config", () => {
        expect(
            getMissionPanelDefaultState(missionConfig, "aux:moon", { fallbackState: "minimized" }),
        ).toBe("minimized");
    });

    it("reads enabled and auto-open flags", () => {
        expect(
            isMissionPanelEnabled(missionConfig, "workflow:splashdown", { fallbackEnabled: true }),
        ).toBe(false);
        expect(
            shouldMissionPanelAutoOpenBeforeEvent(
                missionConfig,
                "workflow:splashdown",
                { fallback: true },
            ),
        ).toBe(false);
    });
});
