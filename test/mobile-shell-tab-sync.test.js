import { describe, expect, it } from "vitest";

import { createMobileShellTabSync } from "../src/platform/js/ui/mobile-shell-tab-sync.js";

function createClassList() {
    const values = new Set();
    return {
        toggle(value, force) {
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

function createNavButton(tabKey, { hidden = false, disabled = false, textContent = tabKey } = {}) {
    const listeners = new Map();
    const attributes = {};
    return {
        dataset: { mobileTab: tabKey },
        textContent,
        hidden,
        disabled,
        classList: createClassList(),
        addEventListener(type, handler) {
            const handlers = listeners.get(type) || [];
            handlers.push(handler);
            listeners.set(type, handlers);
        },
        setAttribute(name, value) {
            attributes[name] = String(value);
        },
        removeAttribute(name) {
            delete attributes[name];
        },
        getAttribute(name) {
            return attributes[name] || "";
        },
        dispatch(type = "click") {
            const handlers = listeners.get(type) || [];
            handlers.forEach((handler) => handler.call(this, { type }));
        },
    };
}

function createHarness({
    activeTab = "mission",
    composeFeatureEnabled = true,
} = {}) {
    const state = {
        activeTab,
        composeFeatureEnabled,
    };
    const log = [];
    const navButtons = [
        createNavButton("mission", { textContent: "Mission" }),
        createNavButton("views", { textContent: "Views" }),
        createNavButton("compose", { textContent: "Compose" }),
        createNavButton("future", { disabled: true, textContent: "Future" }),
    ];
    const mobileTabCards = {
        mission: { hidden: false },
        views: { hidden: true },
        compose: { hidden: true },
    };
    const documentBody = { dataset: {} };
    const sync = createMobileShellTabSync({
        navButtons,
        mobileTabCards,
        getActiveTab: () => state.activeTab,
        setActiveTab: (tab) => {
            state.activeTab = tab;
            log.push(`active:${tab}`);
        },
        isComposeFeatureEnabled: () => state.composeFeatureEnabled,
        isMobileViewport: () => true,
        isViewsVisualSimplificationTab: (tab) => tab === "views" || tab === "compose",
        documentBody,
        setMissionEventMessage: (message) => {
            log.push(`message:${message}`);
        },
        onEnterSimplifiedTab: () => {
            log.push("enter-simplified");
        },
        onExitSimplifiedTab: () => {
            log.push("exit-simplified");
        },
        onEnterMission: () => {
            log.push("enter-mission");
        },
        onEnterViews: () => {
            log.push("enter-views");
        },
        onEnterCompose: () => {
            log.push("enter-compose");
        },
        onLeaveViews: () => {
            log.push("leave-views");
        },
        onLeaveCompose: () => {
            log.push("leave-compose");
        },
        onAfterTransition: () => {
            log.push("after-transition");
        },
    });

    return {
        state,
        log,
        sync,
        navButtons,
        mobileTabCards,
        documentBody,
    };
}

describe("createMobileShellTabSync", () => {
    it("applies a tab transition, updates nav/card state, and runs enter/leave hooks", () => {
        const harness = createHarness();

        harness.sync.setActiveTab("views");
        harness.sync.setActiveTab("mission");

        expect(harness.state.activeTab).toBe("mission");
        expect(harness.documentBody.dataset.mobileActiveTab).toBe("mission");
        expect(harness.navButtons[0].classList.contains("is-active")).toBe(true);
        expect(harness.navButtons[0].getAttribute("aria-current")).toBe("page");
        expect(harness.mobileTabCards.mission.hidden).toBe(false);
        expect(harness.mobileTabCards.views.hidden).toBe(true);
        expect(harness.log).toEqual([
            "active:views",
            "enter-simplified",
            "enter-views",
            "after-transition",
            "active:mission",
            "exit-simplified",
            "enter-mission",
            "leave-views",
            "after-transition",
        ]);
    });

    it("falls back from compose to mission when the compose feature is disabled", () => {
        const harness = createHarness({
            composeFeatureEnabled: false,
        });

        harness.sync.setActiveTab("compose");

        expect(harness.state.activeTab).toBe("mission");
        expect(harness.mobileTabCards.compose.hidden).toBe(true);
        expect(harness.navButtons[2].classList.contains("is-active")).toBe(false);
    });

    it("binds nav buttons and reports disabled tabs instead of switching to them", () => {
        const harness = createHarness();
        harness.sync.bind();

        harness.navButtons[1].dispatch("click");
        harness.navButtons[3].dispatch("click");

        expect(harness.state.activeTab).toBe("views");
        expect(harness.log).toContain("message:");
        expect(harness.log).toContain("message:Future card coming next");
    });
});
