import { describe, expect, it } from "vitest";

import { createMobileMoonVisibilitySync } from "../src/platform/js/ui/mobile-moon-visibility-sync.js";

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
        textContent: "",
        addEventListener(type, handler) {
            const handlers = listeners.get(type) || [];
            handlers.push(handler);
            listeners.set(type, handlers);
        },
        dispatch(type = "click") {
            const handlers = listeners.get(type) || [];
            handlers.forEach((handler) => handler({ type, currentTarget: this }));
        },
        setAttribute(name, value) {
            attributes[name] = String(value);
        },
        getAttribute(name) {
            return attributes[name] || "";
        },
    };
}

function createCanvasStub() {
    const context = {
        cleared: [],
        setTransform() {},
        clearRect(...args) {
            this.cleared.push(args);
        },
    };
    return {
        width: 0,
        height: 0,
        style: {},
        classList: createClassList(),
        getContext() {
            return context;
        },
        context,
    };
}

function createHarness({
    activeTab = "views",
    activeViewPresetId = "moon",
    isMobile = true,
    isThreeD = false,
} = {}) {
    const state = {
        activeTab,
        activeViewPresetId,
        isMobile,
        isThreeD,
        nowMs: 1000,
    };
    const mobileViewsMoonVisibility = { hidden: true };
    const mobileViewsMoonVisibilitySummary = { textContent: "" };
    const mobileViewsMoonVisibilityHead = { hidden: true };
    const mobileViewsMoonVisibilityValues = { innerHTML: "" };
    const mobileViewsFarSideToggle = createButtonStub();
    const mobileMoonFarSideOverlay = createCanvasStub();
    const rafQueue = [];
    let renderRequests = 0;
    let loopFrames = 0;

    const scene = {
        primaryBody: "MOON",
        latestSceneState: {
            bodies: {
                EARTH: { position: { x: 10, y: 0, z: 0 } },
                MOON: { position: { x: 0, y: 0, z: 0 } },
                SC: { position: { x: 6, y: 0, z: 0 } },
            },
            sunDirection: { x: 0, y: 1, z: 0 },
        },
    };
    const windowRef = {
        innerWidth: 800,
        innerHeight: 600,
        animationScenes: { moon: scene },
        requestAnimationFrame(callback) {
            const id = rafQueue.length + 1;
            rafQueue.push({ id, callback });
            return id;
        },
        cancelAnimationFrame(id) {
            const index = rafQueue.findIndex((entry) => entry.id === id);
            if (index >= 0) {
                rafQueue.splice(index, 1);
            }
        },
    };

    const sync = createMobileMoonVisibilitySync({
        mobileViewsMoonVisibility,
        mobileViewsMoonVisibilitySummary,
        mobileViewsMoonVisibilityHead,
        mobileViewsMoonVisibilityValues,
        mobileViewsFarSideToggle,
        mobileMoonFarSideOverlay,
        resolveActiveScene: () => scene,
        resolveSceneObject: () => null,
        isMobileViewport: () => state.isMobile,
        getActiveTab: () => state.activeTab,
        getActiveViewPresetId: () => state.activeViewPresetId,
        getIsThreeD: () => state.isThreeD,
        onLoopFrame: () => {
            loopFrames += 1;
        },
        requestSceneRender: () => {
            renderRequests += 1;
        },
        windowRef,
        performanceRef: {
            now: () => state.nowMs,
        },
    });

    function flushNextAnimationFrame() {
        const next = rafQueue.shift();
        if (!next) return false;
        next.callback();
        return true;
    }

    return {
        state,
        scene,
        sync,
        rafQueue,
        mobileViewsMoonVisibility,
        mobileViewsMoonVisibilitySummary,
        mobileViewsMoonVisibilityHead,
        mobileViewsMoonVisibilityValues,
        mobileViewsFarSideToggle,
        mobileMoonFarSideOverlay,
        flushNextAnimationFrame,
        get renderRequests() {
            return renderRequests;
        },
        get loopFrames() {
            return loopFrames;
        },
    };
}

describe("createMobileMoonVisibilitySync", () => {
    it("shows and hides the visibility panel based on the active mobile views state", () => {
        const harness = createHarness();

        harness.sync.sync({ force: true });

        expect(harness.mobileViewsMoonVisibility.hidden).toBe(false);
        expect(harness.mobileViewsMoonVisibilityHead.hidden).toBe(false);
        expect(harness.mobileViewsMoonVisibilityValues.innerHTML).toContain("%");
        expect(harness.mobileViewsFarSideToggle.textContent).toBe("Far Side: OFF");
        expect(harness.mobileViewsFarSideToggle.getAttribute("aria-pressed")).toBe("false");
        expect(harness.mobileMoonFarSideOverlay.classList.contains("is-active")).toBe(false);

        harness.state.activeViewPresetId = "earth";
        harness.state.nowMs += 500;
        harness.sync.sync({ force: true });

        expect(harness.mobileViewsMoonVisibility.hidden).toBe(true);
    });

    it("toggles far-side overlay state through the shared button binding", () => {
        const harness = createHarness();
        harness.sync.bind();
        harness.sync.sync({ force: true });

        harness.mobileViewsFarSideToggle.dispatch("click");
        expect(harness.mobileViewsFarSideToggle.textContent).toBe("Far Side: ON");
        expect(harness.mobileViewsFarSideToggle.getAttribute("aria-pressed")).toBe("true");
        expect(harness.renderRequests).toBe(1);

        harness.flushNextAnimationFrame();

        expect(harness.renderRequests).toBe(2);
        expect(harness.sync.isFarSideOverlayEnabled()).toBe(true);
    });

    it("starts the RAF loop only for the mobile views tab and stops when the tab changes", () => {
        const harness = createHarness();

        expect(harness.sync.startLoop()).toBe(true);
        expect(harness.rafQueue).toHaveLength(1);

        harness.flushNextAnimationFrame();
        expect(harness.loopFrames).toBe(1);
        expect(harness.rafQueue).toHaveLength(1);

        harness.state.activeTab = "mission";
        harness.state.nowMs += 500;
        harness.flushNextAnimationFrame();

        expect(harness.loopFrames).toBe(1);
        expect(harness.rafQueue).toHaveLength(0);
        expect(harness.sync.startLoop()).toBe(false);
    });
});
