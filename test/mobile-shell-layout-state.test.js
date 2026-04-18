import { describe, expect, it } from "vitest";

import {
    buildMobilePanelCollapseState,
    computeMobileRenderViewportLayout,
    countVisibleMobileNavButtons,
    shouldCenterMobileRenderViewport,
} from "../src/platform/js/core/domain/mobile-shell-layout-state.js";

describe("mobile-shell-layout-state", () => {
    it("builds mission and views collapse button state", () => {
        expect(buildMobilePanelCollapseState({
            activeTab: "mission",
            missionCollapsed: false,
        })).toEqual({
            hidden: false,
            collapsed: false,
            text: "−",
            ariaExpanded: "true",
            label: "Collapse mission panel",
        });

        expect(buildMobilePanelCollapseState({
            activeTab: "views",
            viewsCollapsed: true,
        })).toEqual({
            hidden: false,
            collapsed: true,
            text: "+",
            ariaExpanded: "false",
            label: "Expand views controls",
        });

        expect(buildMobilePanelCollapseState({
            activeTab: "compose",
        }).hidden).toBe(true);
    });

    it("counts only visible nav buttons", () => {
        expect(countVisibleMobileNavButtons([
            { hidden: false },
            { hidden: true },
            { hidden: false },
        ])).toBe(2);
    });

    it("computes the centered viewport shift and pill-strip top position", () => {
        expect(shouldCenterMobileRenderViewport("views")).toBe(true);
        expect(shouldCenterMobileRenderViewport("settings")).toBe(false);

        expect(computeMobileRenderViewportLayout({
            isMobileViewport: true,
            activeTab: "views",
            viewportHeight: 1000,
            activeCardBottomPx: 300,
            pillStripBottomPx: 350,
            bottomInsetPx: 900,
            mobileShellEnabled: true,
            headerBottomPx: 80,
        })).toEqual({
            shiftPx: 125,
            pillStripTopPx: 304,
        });

        expect(computeMobileRenderViewportLayout({
            isMobileViewport: false,
            activeTab: "views",
            viewportHeight: 1000,
            activeCardBottomPx: 300,
            pillStripBottomPx: 350,
            bottomInsetPx: 900,
            mobileShellEnabled: false,
            headerBottomPx: 80,
        })).toEqual({
            shiftPx: 0,
            pillStripTopPx: null,
        });
    });
});
