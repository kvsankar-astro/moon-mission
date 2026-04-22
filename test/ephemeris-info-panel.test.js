import { describe, expect, it, vi } from "vitest";

import { createEphemerisInfoPanelActions } from "../src/platform/js/app/ephemeris-info-panel.js";

describe("ephemeris info panel", () => {
    it("switches to compare-aware title and summary when a comparison overlay is active", () => {
        const panelBody = { innerHTML: "" };
        const panelTitle = { textContent: "" };
        const originalDocument = globalThis.document;

        globalThis.document = {
            getElementById(id) {
                if (id === "info-panel-body") return panelBody;
                if (id === "info-panel-title") return panelTitle;
                return null;
            },
        };

        try {
            createEphemerisInfoPanelActions({
                getGlobalConfig: () => ({
                    mission_name: "Chandrayaan 3",
                    mission_name_short: "CH3",
                    spacecraft_mnemonic: "SC",
                    primaryCraftId: "SC",
                    ephemeris_source: "chebyshev",
                    origins: ["geo", "lunar"],
                    geo: {
                        center: "earth_center",
                        planets: ["SC", "MOON"],
                        orbits_file: "geo-SC",
                        step_size_in_seconds: 60,
                    },
                    lunar: {
                        center: "moon_center",
                        planets: ["SC", "EARTH"],
                        orbits_file: "lunar-SC",
                        step_size_in_seconds: 60,
                    },
                    crafts: [
                        {
                            id: "SC",
                            mnemonic: "SC",
                            viewLabel: "Vikram",
                            primary: true,
                        },
                        {
                            id: "CMP_ART1_CM",
                            mnemonic: "CMP_ART1_CM",
                            viewLabel: "ART1 Orion",
                            primary: false,
                        },
                    ],
                    comparisonOverlay: {
                        missionName: "Artemis I",
                        missionShortLabel: "ART1",
                        compareCraftId: "CMP_ART1_CM",
                        displayTimeRangesByOrigin: {
                            geo: { startMs: 1, endMs: 2 },
                            lunar: { startMs: 1, endMs: 2 },
                            relative: { startMs: 1, endMs: 2 },
                        },
                        defaultVisibleCraftIds: ["SC", "CMP_ART1_CM"],
                    },
                }),
                getEphemerisSource: () => "chebyshev",
                getEphemerisRecords: () => ({}),
                getEphemerisStatuses: () => ({}),
                getBodyEphemerisSources: () => ({}),
                resolveBodySource: vi.fn(() => "chebyshev"),
            }).updateEphemerisPanel();

            expect(panelTitle.textContent).toBe("Mission & Compare Info");
            expect(panelBody.innerHTML).toContain("Comparison Overlay");
            expect(panelBody.innerHTML).toContain("Artemis I");
            expect(panelBody.innerHTML).toContain("ART1 Orion");
            expect(panelBody.innerHTML).toContain("Shared start, native elapsed pace");
        } finally {
            globalThis.document = originalDocument;
        }
    });
});
