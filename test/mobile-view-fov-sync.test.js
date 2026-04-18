import { describe, expect, it } from "vitest";

import { computeMobileAutoFovDegrees } from "../src/platform/js/core/domain/mobile-view-fov-state.js";
import { createMobileViewFovSync } from "../src/platform/js/ui/mobile-view-fov-sync.js";

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

function createButtonStub() {
    const listeners = new Map();
    const attributes = {};
    return {
        classList: createClassList(),
        title: "",
        addEventListener(type, handler) {
            const handlers = listeners.get(type) || [];
            handlers.push(handler);
            listeners.set(type, handlers);
        },
        setAttribute(name, value) {
            attributes[name] = String(value);
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

function createSliderStub({ value = "0" } = {}) {
    const listeners = new Map();
    return {
        value,
        addEventListener(type, handler) {
            const handlers = listeners.get(type) || [];
            handlers.push(handler);
            listeners.set(type, handlers);
        },
        dispatch(type, extra = {}) {
            const handlers = listeners.get(type) || [];
            const event = {
                type,
                currentTarget: this,
                ...extra,
            };
            handlers.forEach((handler) => handler.call(this, event));
        },
    };
}

function createOutputStub() {
    return {
        textContent: "",
        value: "",
    };
}

function createVector(x, y, z) {
    return {
        x,
        y,
        z,
        clone() {
            return createVector(this.x, this.y, this.z);
        },
        distanceTo(other) {
            return Math.hypot(this.x - other.x, this.y - other.y, this.z - other.z);
        },
    };
}

function createWorldObject(x, y, z) {
    return {
        getWorldPosition(target) {
            target.x = x;
            target.y = y;
            target.z = z;
            return target;
        },
    };
}

function createContentWrapper() {
    const listeners = new Map();
    return {
        id: "content-wrapper",
        addEventListener(type, handler) {
            const handlers = listeners.get(type) || [];
            handlers.push(handler);
            listeners.set(type, handlers);
        },
        dispatch(type, event = {}) {
            const handlers = listeners.get(type) || [];
            const nextEvent = {
                type,
                target: this,
                preventDefault() {
                    nextEvent.defaultPrevented = true;
                },
                ...event,
            };
            handlers.forEach((handler) => handler.call(this, nextEvent));
            return nextEvent;
        },
        closest(selector) {
            return selector === "#content-wrapper" ? this : null;
        },
    };
}

function createHarness({
    activeTab = "views",
    cameraFov = 60,
    initialAutoFovEnabled = true,
    tapPlaybackEnabled = false,
} = {}) {
    const state = {
        activeTab,
        activeViewPresetId: "moon",
        activeComposePresetId: "earth",
        composeFeatureEnabled: true,
    };
    const mobileViewsFovSlider = createSliderStub({ value: "60" });
    const mobileComposeFovSlider = createSliderStub({ value: "60" });
    const mobileViewsFovValue = createOutputStub();
    const mobileComposeFovValue = createOutputStub();
    const mobileViewsFovAuto = createButtonStub();
    const mobileComposeFovAuto = createButtonStub();
    const contentWrapper = createContentWrapper();
    const log = [];
    const windowRef = {
        innerWidth: 1000,
        innerHeight: 1000,
        requestAnimationFrame(callback) {
            callback();
        },
    };
    const scene = {
        camera: {
            fov: cameraFov,
            aspect: 1,
            position: createVector(0, 0, 0),
            updateProjectionMatrix() {
                log.push("projection");
            },
        },
        cameraController: {
            _freeFlyActive: false,
            setFov(nextFov) {
                scene.camera.fov = nextFov;
                log.push(["setFov", nextFov]);
            },
            controls: {
                update() {
                    log.push("controls-update");
                },
                dispatchEvent(event) {
                    log.push(`controls:${event.type}`);
                },
            },
        },
        primaryBody: "EARTH",
        primaryBodyRadius: 1,
        secondaryBody: "MOON",
        secondaryBodyRadius: 1,
        earth: createWorldObject(0, 0, 0),
        moon: createWorldObject(0, 0, 10),
        craft: createWorldObject(0, 0, 0),
    };

    const sync = createMobileViewFovSync({
        mobileViewsFovSlider,
        mobileComposeFovSlider,
        mobileViewsFovValue,
        mobileComposeFovValue,
        mobileViewsFovAuto,
        mobileComposeFovAuto,
        contentWrapper,
        mobileViewPresetById: new Map([
            ["moon", { positionMode: "earth", lookMode: "moon" }],
        ]),
        mobileComposePresetById: new Map([
            ["earth", { positionMode: "earth", lookMode: "moon" }],
        ]),
        resolveActiveScene: () => scene,
        resolveSceneObject: (activeScene, mode) => {
            if (mode === "earth") return activeScene.earth;
            if (mode === "moon") return activeScene.moon;
            if (mode === "spacecraft") return activeScene.craft;
            return null;
        },
        getActiveTab: () => state.activeTab,
        getActiveViewPresetId: () => state.activeViewPresetId,
        getActiveComposePresetId: () => state.activeComposePresetId,
        getComposeFeatureEnabled: () => state.composeFeatureEnabled,
        isMobileViewport: () => true,
        getTapPlaybackEnabled: () => tapPlaybackEnabled,
        onTapPlaybackToggle: () => {
            log.push("tap-playback");
        },
        onMoonVisibilityRefresh: (options = {}) => {
            log.push(["moon-visibility", options.force === true]);
        },
        onComposePresentationSync: () => {
            log.push("compose-presentation");
        },
        windowRef,
        performanceRef: { now: () => 1000 },
        initialAutoFovEnabled,
    });

    return {
        state,
        log,
        scene,
        sync,
        contentWrapper,
        mobileViewsFovSlider,
        mobileComposeFovSlider,
        mobileViewsFovValue,
        mobileComposeFovValue,
        mobileViewsFovAuto,
        mobileComposeFovAuto,
    };
}

describe("createMobileViewFovSync", () => {
    it("updates auto-FoV button state and applies manual slider changes", () => {
        const harness = createHarness();
        harness.sync.bind();
        harness.sync.setAutoFovEnabled(true);

        harness.mobileViewsFovSlider.value = "72";
        harness.mobileViewsFovSlider.dispatch("input");

        expect(harness.sync.isAutoFovEnabled()).toBe(false);
        expect(harness.mobileViewsFovAuto.classList.contains("is-active")).toBe(false);
        expect(harness.mobileComposeFovAuto.getAttribute("aria-pressed")).toBe("false");
        expect(harness.mobileViewsFovValue.textContent).toBe("72°");
        expect(harness.log).toContainEqual(["moon-visibility", true]);
    });

    it("applies auto FoV for the active preset and updates the shared display", () => {
        const harness = createHarness();

        const changed = harness.sync.applyAutoFovForActivePreset();
        const expectedAutoFov = computeMobileAutoFovDegrees({
            distanceToTarget: 10,
            targetRadius: 1,
            aspect: 1,
        });

        expect(changed).toBe(true);
        expect(harness.scene.camera.fov).toBeCloseTo(expectedAutoFov, 4);
        expect(harness.mobileViewsFovValue.textContent).toBe(`${Math.round(expectedAutoFov)}°`);
        expect(harness.mobileComposeFovSlider.value).toBe(String(Math.round(expectedAutoFov)));
    });

    it("applies the compose default FoV only once and disables auto mode", () => {
        const harness = createHarness({
            activeTab: "compose",
        });
        harness.sync.setAutoFovEnabled(true);

        expect(harness.sync.ensureComposeDefaultFov()).toBe(true);
        expect(harness.sync.ensureComposeDefaultFov()).toBe(false);
        expect(harness.sync.isAutoFovEnabled()).toBe(false);
        expect(harness.scene.camera.fov).toBe(110);
    });

    it("binds pinch zoom and tap-to-playback gestures on the render area", () => {
        const harness = createHarness({
            tapPlaybackEnabled: true,
        });
        harness.sync.bind();

        harness.contentWrapper.dispatch("touchstart", {
            touches: [
                { clientX: 0, clientY: 0 },
                { clientX: 100, clientY: 0 },
            ],
        });
        harness.contentWrapper.dispatch("touchmove", {
            touches: [
                { clientX: 0, clientY: 0 },
                { clientX: 50, clientY: 0 },
            ],
        });
        harness.contentWrapper.dispatch("touchstart", {
            touches: [{ clientX: 5, clientY: 5 }],
        });
        harness.contentWrapper.dispatch("touchend", {
            changedTouches: [{ clientX: 5, clientY: 5 }],
            target: harness.contentWrapper,
        });

        expect(harness.scene.camera.fov).toBe(120);
        expect(harness.log).toContain("tap-playback");
    });
});
