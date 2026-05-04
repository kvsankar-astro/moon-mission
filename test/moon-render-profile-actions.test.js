import { describe, expect, it, vi } from "vitest";

import { createMoonRenderProfileActions } from "../src/platform/js/app/moon-render-profile-actions.js";

function createHarness(globalObject = {}) {
    return createMoonRenderProfileActions({
        THREE: { LinearFilter: "LinearFilter" },
        animationScenes: {},
        loadSceneTextures: vi.fn(),
        applyAndRefreshSceneTextures: vi.fn(),
        render: vi.fn(),
        globalObject,
    });
}

describe("moon-render-profile-actions", () => {
    it("uses the Artemis II mission default when no explicit override is present", () => {
        const actions = createHarness({
            location: {
                search: "?mission=artemis2",
                pathname: "/astro/lunar-missions/mission.html",
            },
            localStorage: {
                getItem: vi.fn(() => null),
            },
        });

        expect(actions.getMoonRenderProfile()).toBe("quality");
    });

    it("keeps an explicit global override ahead of the mission default", () => {
        const actions = createHarness({
            MOON_RENDER_ASSET_PROFILE: "fast",
            location: {
                search: "?mission=artemis2",
                pathname: "/astro/lunar-missions/mission.html",
            },
            localStorage: {
                getItem: vi.fn(() => null),
            },
        });

        expect(actions.getMoonRenderProfile()).toBe("fast");
    });
});
