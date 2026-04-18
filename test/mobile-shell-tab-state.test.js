import { describe, expect, it } from "vitest";

import {
    buildMobileShellButtonStates,
    buildMobileShellCardStates,
    resolveMobileShellTabTransition,
} from "../src/platform/js/core/domain/mobile-shell-tab-state.js";

describe("mobile shell tab state", () => {
    it("falls back to mission when compose is unavailable or the requested tab is unknown", () => {
        const composeDisabled = resolveMobileShellTabTransition({
            requestedTab: "compose",
            availableTabs: ["mission", "views", "compose"],
            activeTab: "mission",
            composeFeatureEnabled: false,
            mobileViewport: true,
            isViewsVisualSimplificationTab: (tab) => tab === "views" || tab === "compose",
        });
        const unknownTab = resolveMobileShellTabTransition({
            requestedTab: "unknown",
            availableTabs: ["mission", "views", "compose"],
            activeTab: "views",
            composeFeatureEnabled: true,
            mobileViewport: true,
            isViewsVisualSimplificationTab: (tab) => tab === "views" || tab === "compose",
        });

        expect(composeDisabled.nextTab).toBe("mission");
        expect(composeDisabled.previousNeedsSimplification).toBe(false);
        expect(unknownTab.nextTab).toBe("mission");
        expect(unknownTab.previousNeedsSimplification).toBe(true);
    });

    it("builds nav-button and card visibility states for the active tab", () => {
        expect(buildMobileShellButtonStates({
            buttonTabs: ["mission", "views", "compose"],
            nextTab: "views",
            hiddenTabs: ["compose"],
        })).toEqual([
            { tabKey: "mission", isHidden: false, isActive: false },
            { tabKey: "views", isHidden: false, isActive: true },
            { tabKey: "compose", isHidden: true, isActive: false },
        ]);

        expect(buildMobileShellCardStates({
            cardTabs: ["mission", "views", "compose"],
            nextTab: "mission",
            composeFeatureEnabled: false,
        })).toEqual([
            { tabKey: "mission", isHidden: false },
            { tabKey: "views", isHidden: true },
            { tabKey: "compose", isHidden: true },
        ]);
    });
});
