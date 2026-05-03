import { describe, expect, it } from "vitest";

import { createMobileShellLayoutSync } from "../src/platform/js/ui/mobile-shell-layout-sync.js";

function createClassList(initial = []) {
    const values = new Set(initial);
    return {
        add(value) {
            values.add(value);
        },
        remove(value) {
            values.delete(value);
        },
        toggle(value, force) {
            if (force === undefined) {
                if (values.has(value)) {
                    values.delete(value);
                    return false;
                }
                values.add(value);
                return true;
            }
            if (force) {
                values.add(value);
                return true;
            }
            values.delete(value);
            return false;
        },
        contains(value) {
            return values.has(value);
        },
    };
}

function createStyle() {
    const values = new Map();
    return {
        setProperty(name, value) {
            values.set(name, value);
        },
        removeProperty(name) {
            values.delete(name);
        },
        getPropertyValue(name) {
            return values.get(name) || "";
        },
    };
}

function createElement({
    hidden = false,
    classNames = [],
    rect = { top: 0, bottom: 0, width: 100, height: 100 },
} = {}) {
    const attributes = {};
    return {
        hidden,
        classList: createClassList(classNames),
        style: createStyle(),
        textContent: "",
        title: "",
        setAttribute(name, value) {
            attributes[name] = String(value);
        },
        getAttribute(name) {
            return attributes[name] || "";
        },
        getBoundingClientRect() {
            return rect;
        },
    };
}

function createHarness({
    activeTab = "mission",
    isMobile = true,
    missionStored = "false",
    viewsStored = "true",
} = {}) {
    const state = {
        activeTab,
        isMobile,
    };
    const panelCollapseButton = createElement();
    const missionCard = createElement();
    const missionCardBody = createElement();
    const viewsCard = createElement();
    const viewsCardBody = createElement();
    const missionCardRect = { top: 80, bottom: 320, width: 300, height: 240 };
    const viewsCardRect = { top: 80, bottom: 420, width: 300, height: 340 };
    missionCard.getBoundingClientRect = () => missionCardRect;
    viewsCard.getBoundingClientRect = () => viewsCardRect;
    const mobileShellNav = createElement({ rect: { top: 880, bottom: 980, width: 300, height: 100 } });
    const timelineDock = createElement({ rect: { top: 820, bottom: 900, width: 300, height: 80 } });
    const contentWrapper = createElement();
    const header = createElement({ rect: { top: 0, bottom: 60, width: 300, height: 60 } });
    const pillStrip = createElement({ rect: { top: 50, bottom: 150, width: 300, height: 100 } });
    const navButtons = [{ hidden: false }, { hidden: true }, { hidden: false }];
    const localStorageData = new Map([
        ["mission-collapsed", missionStored],
        ["views-collapsed", viewsStored],
    ]);
    let enteredMobile = 0;
    let exitedMobile = 0;

    const documentRef = {
        body: { classList: createClassList() },
        documentElement: { style: createStyle() },
        getElementById(id) {
            if (id === "timeline-dock") return timelineDock;
            if (id === "header") return header;
            if (id === "header-pill-strip") return pillStrip;
            return null;
        },
    };
    const windowRef = {
        innerHeight: 1000,
        getComputedStyle(element) {
            if (element.hidden) {
                return { display: "none", visibility: "hidden", opacity: "0" };
            }
            return { display: "block", visibility: "visible", opacity: "1" };
        },
    };
    const localStorageRef = {
        getItem(key) {
            return localStorageData.get(key) || null;
        },
        setItem(key, value) {
            localStorageData.set(key, String(value));
        },
    };

    const sync = createMobileShellLayoutSync({
        panelCollapseButton,
        missionCard,
        missionCardBody,
        viewsCard,
        viewsCardBody,
        mobileShellNav,
        navButtons,
        contentWrapper,
        mobileTabCards: {
            mission: missionCard,
            views: viewsCard,
        },
        getActiveTab: () => state.activeTab,
        isMobileViewport: () => state.isMobile,
        missionPanelCollapseStorageKey: "mission-collapsed",
        viewsPanelCollapseStorageKey: "views-collapsed",
        windowRef,
        documentRef,
        localStorageRef,
        onEnterMobileMode: () => {
            enteredMobile += 1;
        },
        onExitMobileMode: () => {
            exitedMobile += 1;
        },
    });

    return {
        state,
        sync,
        documentRef,
        contentWrapper,
        panelCollapseButton,
        missionCard,
        viewsCard,
        mobileShellNav,
        localStorageData,
        get enteredMobile() {
            return enteredMobile;
        },
        get exitedMobile() {
            return exitedMobile;
        },
    };
}

describe("createMobileShellLayoutSync", () => {
    it("syncs the collapse button state and persists card collapse changes", () => {
        const harness = createHarness();

        harness.sync.syncPanelCollapseButton();
        expect(harness.panelCollapseButton.textContent).toBe("−");
        expect(harness.panelCollapseButton.getAttribute("aria-expanded")).toBe("true");
        expect(harness.panelCollapseButton.title).toBe("Collapse mission panel");

        harness.sync.setMissionCardCollapsed(true);
        expect(harness.missionCard.classList.contains("mobile-shell__card--collapsed")).toBe(true);
        expect(harness.localStorageData.get("mission-collapsed")).toBe("true");

        harness.state.activeTab = "views";
        harness.sync.setViewsCardCollapsed(true);
        harness.sync.syncPanelCollapseButton();
        expect(harness.panelCollapseButton.textContent).toBe("+");
        expect(harness.panelCollapseButton.getAttribute("aria-expanded")).toBe("false");
        expect(harness.panelCollapseButton.title).toBe("Expand views controls");
    });

    it("restores stored collapse state, updates the nav layout, and writes viewport CSS vars", () => {
        const harness = createHarness({
            activeTab: "views",
            missionStored: "true",
            viewsStored: "false",
        });
        harness.documentRef.body.classList.add("mobile-shell-enabled");

        harness.sync.initializeCollapsedState();
        harness.sync.syncNavLayout();
        harness.sync.applyRenderViewportCentering();

        expect(harness.missionCard.classList.contains("mobile-shell__card--collapsed")).toBe(true);
        expect(harness.viewsCard.classList.contains("mobile-shell__card--collapsed")).toBe(false);
        expect(harness.mobileShellNav.style.getPropertyValue("--mobile-shell-tab-count")).toBe("2");
        expect(harness.contentWrapper.style.getPropertyValue("--mobile-render-shift-y")).toBe("120px");
        expect(harness.documentRef.documentElement.style.getPropertyValue("--mobile-pill-strip-top")).toBe("424px");
    });

    it("toggles mobile shell mode and delegates enter/exit behavior", () => {
        const harness = createHarness();

        harness.sync.toggleMode({ disableTransition: true });
        expect(harness.documentRef.body.classList.contains("mobile-shell-enabled")).toBe(true);
        expect(harness.enteredMobile).toBe(1);
        expect(harness.exitedMobile).toBe(0);
        expect(harness.contentWrapper.classList.contains("content-wrapper--mobile-render-shift-no-transition")).toBe(true);

        harness.sync.toggleMode();
        expect(harness.documentRef.body.classList.contains("mobile-shell-enabled")).toBe(true);
        expect(harness.enteredMobile).toBe(1);
        expect(harness.exitedMobile).toBe(0);

        harness.state.isMobile = false;
        harness.sync.toggleMode();
        expect(harness.documentRef.body.classList.contains("mobile-shell-enabled")).toBe(false);
        expect(harness.enteredMobile).toBe(1);
        expect(harness.exitedMobile).toBe(1);

        harness.sync.toggleMode();
        expect(harness.documentRef.body.classList.contains("mobile-shell-enabled")).toBe(false);
        expect(harness.enteredMobile).toBe(1);
        expect(harness.exitedMobile).toBe(1);
    });

    it("re-enables animated recentering for non-resize layout updates", () => {
        const harness = createHarness({
            activeTab: "views",
        });

        harness.sync.toggleMode({ disableTransition: true });
        expect(harness.contentWrapper.classList.contains("content-wrapper--mobile-render-shift-no-transition")).toBe(true);

        harness.sync.applyRenderViewportCentering();
        expect(harness.contentWrapper.classList.contains("content-wrapper--mobile-render-shift-no-transition")).toBe(false);
    });
});
