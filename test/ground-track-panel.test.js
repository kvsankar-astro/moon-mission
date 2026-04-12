import { describe, expect, it } from "vitest";

import { shouldAutoOpenSplashdownPanel } from "../src/platform/js/app/ground-track-panel.js";

describe("shouldAutoOpenSplashdownPanel", () => {
    it("returns false after the configured splashdown time", () => {
        const configData = {
            mission_name: "Artemis 2",
            events: {
                splashdown: {
                    startTime: "2026-04-11T00:07:12Z",
                },
            },
        };

        expect(
            shouldAutoOpenSplashdownPanel(
                configData,
                Date.parse("2026-04-12T06:00:00Z"),
            ),
        ).toBe(false);
    });

    it("returns true before the configured splashdown time", () => {
        const configData = {
            mission_name: "Artemis 2",
            events: {
                splashdown: {
                    startTime: "2026-04-11T00:07:12Z",
                },
            },
        };

        expect(
            shouldAutoOpenSplashdownPanel(
                configData,
                Date.parse("2026-04-10T23:00:00Z"),
            ),
        ).toBe(true);
    });
});
