import { describe, expect, it } from "vitest";

import {
    planActiveEventUiState,
    resolveActiveEventButtonMatchIndex,
} from "../src/platform/js/core/domain/active-event-ui-state.js";

describe("active event ui state", () => {
    it("returns the default empty state when no active event exists", () => {
        expect(planActiveEventUiState({
            activeEvent: null,
            currentTimeMs: 1000,
            nowWallTimeMs: 2000,
        })).toEqual({
            hasActiveEvent: false,
            showBurnIndicator: false,
            eventText: "",
            mobileEventText: "No active event",
        });
    });

    it("builds event text and burn visibility for an active burn", () => {
        const state = planActiveEventUiState({
            activeEvent: {
                key: "tli-burn",
                label: "TLI",
                infoText: "Trans-lunar injection",
                burnFlag: true,
                durationSeconds: 10,
                startTime: 1000,
            },
            currentTimeMs: 1005,
            nowWallTimeMs: 5000,
        });

        expect(state.hasActiveEvent).toBe(true);
        expect(state.showBurnIndicator).toBe(true);
        expect(state.eventText).toContain("Trans-lunar injection");
        expect(state.mobileEventText).toContain("Trans-lunar injection");
    });

    it("matches buttons by event key first", () => {
        const matchedIndex = resolveActiveEventButtonMatchIndex({
            activeEvent: {
                key: "burn-b",
                label: "Burn B",
            },
            buttonDescriptors: [
                { eventKey: "burn-a", label: "Burn A", title: "" },
                { eventKey: "burn-b", label: "Burn B", title: "" },
            ],
        });

        expect(matchedIndex).toBe(1);
    });

    it("falls back to label and hover text matching when the event key is unavailable", () => {
        expect(resolveActiveEventButtonMatchIndex({
            activeEvent: {
                label: "LOI Burn",
            },
            buttonDescriptors: [
                { eventKey: "", label: "TLI Burn", title: "" },
                { eventKey: "", label: "LOI Burn", title: "" },
            ],
        })).toBe(1);

        expect(resolveActiveEventButtonMatchIndex({
            activeEvent: {
                label: "No Match",
                hoverText: "Hover copy",
            },
            buttonDescriptors: [
                { eventKey: "", label: "Something else", title: "Hover copy" },
            ],
        })).toBe(0);
    });
});
