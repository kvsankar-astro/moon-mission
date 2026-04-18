import { describe, expect, it } from "vitest";

import { createMobileComposeControlsSync } from "../src/platform/js/ui/mobile-compose-controls-sync.js";

function createSliderStub({ value = "0" } = {}) {
    const listeners = new Map();
    return {
        value,
        addEventListener(type, handler) {
            const handlers = listeners.get(type) || [];
            handlers.push(handler);
            listeners.set(type, handlers);
        },
        dispatch(type) {
            const handlers = listeners.get(type) || [];
            handlers.forEach((handler) => handler.call(this, {
                type,
                currentTarget: this,
            }));
        },
    };
}

function createOutputStub() {
    return {
        textContent: "",
        value: "",
    };
}

function createButtonStub() {
    const listeners = new Map();
    return {
        addEventListener(type, handler) {
            const handlers = listeners.get(type) || [];
            handlers.push(handler);
            listeners.set(type, handlers);
        },
        dispatch(type = "click") {
            const handlers = listeners.get(type) || [];
            handlers.forEach((handler) => handler.call(this, { type }));
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

function createHarness({
    activeTab = "compose",
    activePresetId = "earth",
    storedEarthshineGain = "1.8",
} = {}) {
    const state = {
        activeTab,
        activePresetId,
        composeFeatureEnabled: true,
    };
    const mobileComposeEarthshineSlider = createSliderStub({ value: "1.2" });
    const mobileComposeEarthshineValue = createOutputStub();
    const mobileComposeRollSlider = createSliderStub({ value: "90" });
    const mobileComposeRollValue = createOutputStub();
    const desktopPosition = createSelectStub("manual");
    const desktopLook = createSelectStub("manual");
    const log = [];
    desktopPosition.addEventListener("change", () => {
        log.push("desktop-change");
    });
    const craft = { visible: true };
    const mountOffsetCalls = [];
    const mountedManualRollCalls = [];
    const lightSettings = {
        EARTHSHINE_INTENSITY: 0.08,
        EARTHSHINE_MIN_INTENSITY: 0.015,
        EARTHSHINE_MAX_INTENSITY: 0.08,
    };
    const storageWrites = [];
    const storage = {
        getItem() {
            return storedEarthshineGain;
        },
        setItem(key, value) {
            storageWrites.push([key, value]);
        },
    };
    const mobileComposeLockSync = {
        syncState() {
            log.push("lock-sync");
        },
    };
    const mobileComposeTimelineSync = {
        sync() {
            log.push("timeline-sync");
        },
    };
    const scene = {
        camera: {
            position: {
                clone: () => ({}),
            },
            up: {
                copy: () => {},
            },
        },
        cameraController: {
            lookMode: "manual",
            positionMode: "spacecraft",
            mountOffset: {
                set: (...args) => {
                    mountOffsetCalls.push(args);
                },
            },
            setMountedManualRollRad: (value) => {
                mountedManualRollCalls.push(value);
            },
            controls: {
                target: {
                    copy: () => {},
                },
            },
        },
    };
    const sync = createMobileComposeControlsSync({
        mobileComposeEarthshineSlider,
        mobileComposeEarthshineValue,
        mobileComposeRollSlider,
        mobileComposeRollValue,
        desktopPosition,
        desktopLook,
        mobileComposePresetById: new Map([
            ["free", { positionMode: "spacecraft", lookMode: "manual" }],
            ["earth", { positionMode: "spacecraft", lookMode: "earth" }],
        ]),
        mobileComposeLockSync,
        mobileComposeTimelineSync,
        resolveActiveScene: () => scene,
        resolveActiveCraft: () => craft,
        resolveSceneObject: () => null,
        getActiveTab: () => state.activeTab,
        isMobileViewport: () => true,
        getComposeFeatureEnabled: () => state.composeFeatureEnabled,
        getActivePresetId: () => state.activePresetId,
        createChangeEvent: () => ({ type: "change" }),
        storage,
        lightSettings,
    });

    return {
        state,
        sync,
        craft,
        desktopPosition,
        desktopLook,
        lightSettings,
        log,
        mobileComposeEarthshineSlider,
        mobileComposeEarthshineValue,
        mobileComposeRollSlider,
        mobileComposeRollValue,
        mountOffsetCalls,
        mountedManualRollCalls,
        storageWrites,
    };
}

describe("createMobileComposeControlsSync", () => {
    it("initializes earthshine gain from storage without writing it back", () => {
        const harness = createHarness();

        harness.sync.initialize();

        expect(harness.mobileComposeEarthshineSlider.value).toBe("1.80");
        expect(harness.mobileComposeEarthshineValue.textContent).toBe("1.80");
        expect(harness.lightSettings.EARTHSHINE_INTENSITY).toBeCloseTo(0.144);
        expect(harness.storageWrites).toEqual([]);
    });

    it("binds compose control listeners for earthshine and roll", () => {
        const harness = createHarness();
        harness.sync.bind();

        harness.mobileComposeEarthshineSlider.value = "1.6";
        harness.mobileComposeEarthshineSlider.dispatch("input");
        harness.mobileComposeRollSlider.value = "90";
        harness.mobileComposeRollSlider.dispatch("input");

        expect(harness.mobileComposeEarthshineValue.textContent).toBe("1.60");
        expect(harness.storageWrites).toContainEqual([
            "moon-mission:mobile-earthshine-gain:v1",
            "1.6",
        ]);
        expect(harness.mobileComposeRollValue.textContent).toBe("E 90°");
        expect(harness.mountedManualRollCalls[0]).toBeCloseTo(Math.PI / 2);
    });

    it("syncs compose preset state, timeline state, and presentation visibility", () => {
        const harness = createHarness();

        harness.sync.syncControls();

        expect(harness.desktopPosition.value).toBe("spacecraft");
        expect(harness.desktopLook.value).toBe("earth");
        expect(harness.log).toEqual([
            "desktop-change",
            "lock-sync",
            "timeline-sync",
        ]);
        expect(harness.craft.visible).toBe(false);
        expect(harness.mountOffsetCalls).toEqual([[0, 0, 0]]);

        harness.state.activeTab = "mission";
        harness.sync.syncPresentation();
        expect(harness.craft.visible).toBe(true);
    });
});
