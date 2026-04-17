import { describe, expect, it } from "vitest";

import { createMobileComposeLockSync } from "../src/platform/js/ui/mobile-compose-lock-sync.js";

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
        dataset: { mobileComposeLock: presetId },
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
        ["free", { positionMode: "spacecraft", lookMode: "manual" }],
        ["earth", { positionMode: "spacecraft", lookMode: "earth" }],
        ["moon", { positionMode: "spacecraft", lookMode: "moon" }],
    ]);
}

function createHarness({
    positionMode = "spacecraft",
    lookMode = "manual",
    activePresetId = "free",
} = {}) {
    const state = {
        activePresetId,
    };
    const mobileComposeLockButtons = [
        createPresetButton("free"),
        createPresetButton("earth"),
        createPresetButton("moon"),
    ];
    const desktopPosition = createSelectStub(positionMode);
    const desktopLook = createSelectStub(lookMode);
    const log = [];
    const mountOffsetCalls = [];
    desktopPosition.addEventListener("change", () => {
        log.push("desktop-change");
    });
    const sync = createMobileComposeLockSync({
        mobileComposeLockButtons,
        mobileComposePresetById: createPresetMap(),
        desktopPosition,
        desktopLook,
        resolveActiveScene: () => ({
            cameraController: {
                mountOffset: {
                    set: (...args) => {
                        mountOffsetCalls.push(args);
                    },
                },
            },
        }),
        getActivePresetId: () => state.activePresetId,
        setActivePresetId: (presetId) => {
            state.activePresetId = presetId;
        },
        createChangeEvent: () => ({ type: "change" }),
        onAfterApply: () => {
            log.push("after-apply");
        },
        onAfterButtonClick: () => {
            log.push("button-click");
        },
    });

    return {
        state,
        sync,
        log,
        mountOffsetCalls,
        mobileComposeLockButtons,
        desktopPosition,
        desktopLook,
    };
}

describe("createMobileComposeLockSync", () => {
    it("marks the exact matching compose lock button active during sync", () => {
        const harness = createHarness({
            positionMode: "spacecraft",
            lookMode: "earth",
            activePresetId: "free",
        });

        harness.sync.syncState();

        expect(harness.state.activePresetId).toBe("earth");
        expect(harness.mobileComposeLockButtons[0].classList.contains("is-active")).toBe(false);
        expect(harness.mobileComposeLockButtons[1].classList.contains("is-active")).toBe(true);
        expect(harness.mobileComposeLockButtons[1].getAttribute("aria-selected")).toBe("true");
    });

    it("falls back to the active preset or free when selectors do not match a preset", () => {
        const harness = createHarness({
            positionMode: "manual",
            lookMode: "manual",
            activePresetId: "moon",
        });

        harness.sync.syncState();
        expect(harness.state.activePresetId).toBe("moon");

        const fallbackHarness = createHarness({
            positionMode: "manual",
            lookMode: "manual",
            activePresetId: "unknown",
        });

        fallbackHarness.sync.syncState();
        expect(fallbackHarness.state.activePresetId).toBe("free");
        expect(fallbackHarness.mobileComposeLockButtons[0].classList.contains("is-active")).toBe(true);
    });

    it("clicking a compose lock preset clears mount offset, updates the selectors, and keeps callback order", () => {
        const harness = createHarness({
            positionMode: "spacecraft",
            lookMode: "manual",
            activePresetId: "free",
        });
        harness.sync.bind();

        harness.mobileComposeLockButtons[2].dispatch("click");

        expect(harness.mountOffsetCalls).toEqual([[0, 0, 0]]);
        expect(harness.state.activePresetId).toBe("moon");
        expect(harness.desktopPosition.value).toBe("spacecraft");
        expect(harness.desktopLook.value).toBe("moon");
        expect(harness.mobileComposeLockButtons[2].classList.contains("is-active")).toBe(true);
        expect(harness.log).toEqual([
            "desktop-change",
            "after-apply",
            "button-click",
        ]);
    });
});
