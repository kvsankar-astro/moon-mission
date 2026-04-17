import { describe, expect, it, vi } from "vitest";

import { createMobileViewPresetSync } from "../src/platform/js/ui/mobile-view-preset-sync.js";

function createClassList(initialValues = []) {
    const values = new Set(initialValues);
    return {
        add(value) {
            values.add(value);
        },
        remove(value) {
            values.delete(value);
        },
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

function createPresetButton(presetId) {
    const listeners = new Map();
    const attributes = {};
    return {
        dataset: { mobileViewPreset: presetId },
        classList: createClassList(),
        addEventListener(type, handler) {
            const handlers = listeners.get(type) || [];
            handlers.push(handler);
            listeners.set(type, handlers);
        },
        dispatch(type = "click") {
            const handlers = listeners.get(type) || [];
            handlers.forEach((handler) => handler.call(this));
        },
        setAttribute(name, value) {
            attributes[name] = String(value);
        },
        getAttribute(name) {
            return attributes[name] || "";
        },
    };
}

function createSelectStub(initialValue) {
    const listeners = new Map();
    return {
        value: initialValue,
        addEventListener(type, handler) {
            const handlers = listeners.get(type) || [];
            handlers.push(handler);
            listeners.set(type, handlers);
        },
        dispatchEvent(event) {
            const handlers = listeners.get(event.type) || [];
            handlers.forEach((handler) => handler.call(this, event));
            return true;
        },
    };
}

function createPresetMap() {
    return new Map([
        ["earth", { positionMode: "spacecraft", lookMode: "earth" }],
        ["moon", { positionMode: "spacecraft", lookMode: "moon" }],
    ]);
}

function createSyncHarness({
    positionMode = "spacecraft",
    lookMode = "moon",
    activePresetId = "moon",
    activeTab = "mission",
    mobileViewport = true,
} = {}) {
    const state = {
        activePresetId,
        enforceInProgress: false,
        activeTab,
    };
    const mobileViewButtons = [createPresetButton("earth"), createPresetButton("moon")];
    const desktopPosition = createSelectStub(positionMode);
    const desktopLook = createSelectStub(lookMode);
    const log = [];
    const sync = createMobileViewPresetSync({
        mobileViewButtons,
        mobileViewPresetById: createPresetMap(),
        desktopPosition,
        desktopLook,
        getActivePresetId: () => state.activePresetId,
        setActivePresetId: (presetId) => {
            state.activePresetId = presetId;
        },
        getEnforceInProgress: () => state.enforceInProgress,
        setEnforceInProgress: (inProgress) => {
            state.enforceInProgress = inProgress;
        },
        isMobileViewport: () => mobileViewport,
        getActiveTab: () => state.activeTab,
        createChangeEvent: () => ({ type: "change" }),
        onAfterApply: () => {
            log.push("after-apply");
        },
        onAfterEnforcedSync: () => {
            log.push("after-enforced-sync");
        },
        onAfterButtonClick: () => {
            log.push("button-click");
        },
        onAfterDesktopChange: () => {
            log.push("desktop-change");
        },
    });

    return {
        state,
        sync,
        log,
        mobileViewButtons,
        desktopPosition,
        desktopLook,
    };
}

describe("createMobileViewPresetSync", () => {
    it("marks the exact matching preset active during sync", () => {
        const harness = createSyncHarness({
            positionMode: "spacecraft",
            lookMode: "moon",
            activePresetId: "earth",
            activeTab: "mission",
        });

        harness.sync.syncState();

        expect(harness.state.activePresetId).toBe("moon");
        expect(harness.mobileViewButtons[0].classList.contains("is-active")).toBe(false);
        expect(harness.mobileViewButtons[1].classList.contains("is-active")).toBe(true);
        expect(harness.mobileViewButtons[1].getAttribute("aria-selected")).toBe("true");
        expect(harness.log).toEqual([]);
    });

    it("enforces the fallback preset once when the views tab drifts off a known preset", () => {
        const harness = createSyncHarness({
            positionMode: "manual",
            lookMode: "manual",
            activePresetId: "moon",
            activeTab: "views",
            mobileViewport: true,
        });
        harness.sync.bind();

        harness.sync.syncState();

        expect(harness.state.activePresetId).toBe("moon");
        expect(harness.desktopPosition.value).toBe("spacecraft");
        expect(harness.desktopLook.value).toBe("moon");
        expect(harness.state.enforceInProgress).toBe(false);
        expect(harness.mobileViewButtons[1].classList.contains("is-active")).toBe(true);
        expect(harness.log).toEqual([
            "desktop-change",
            "after-apply",
            "after-enforced-sync",
        ]);
    });

    it("does not enforce the fallback preset outside the mobile views tab", () => {
        const harness = createSyncHarness({
            positionMode: "manual",
            lookMode: "manual",
            activePresetId: "moon",
            activeTab: "mission",
            mobileViewport: true,
        });

        harness.sync.syncState();

        expect(harness.state.activePresetId).toBe("moon");
        expect(harness.desktopPosition.value).toBe("manual");
        expect(harness.desktopLook.value).toBe("manual");
        expect(harness.log).toEqual([]);
    });

    it("updates desktop selectors and preserves the click-change callback order", () => {
        const harness = createSyncHarness({
            positionMode: "spacecraft",
            lookMode: "moon",
            activePresetId: "moon",
            activeTab: "mission",
        });
        harness.sync.bind();

        harness.mobileViewButtons[0].dispatch("click");

        expect(harness.state.activePresetId).toBe("earth");
        expect(harness.desktopPosition.value).toBe("spacecraft");
        expect(harness.desktopLook.value).toBe("earth");
        expect(harness.mobileViewButtons[0].classList.contains("is-active")).toBe(true);
        expect(harness.mobileViewButtons[1].classList.contains("is-active")).toBe(false);
        expect(harness.log).toEqual([
            "desktop-change",
            "after-apply",
            "button-click",
        ]);
    });
});
