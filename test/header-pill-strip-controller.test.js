import { describe, expect, it } from "vitest";

import { createHeaderPillStripController } from "../src/platform/js/ui/header-pill-strip-controller.js";

function createClassList(initial = []) {
    const values = new Set(initial);
    return {
        add(value) {
            values.add(value);
        },
        remove(value) {
            values.delete(value);
        },
        contains(value) {
            return values.has(value);
        },
        toggle(value, force) {
            if (force === true) {
                values.add(value);
                return true;
            }
            if (force === false) {
                values.delete(value);
                return false;
            }
            if (values.has(value)) {
                values.delete(value);
                return false;
            }
            values.add(value);
            return true;
        },
    };
}

function createElement(id, options = {}) {
    const listeners = new Map();
    return {
        id,
        textContent: options.textContent || "",
        title: options.title || "",
        scrollLeft: options.scrollLeft || 0,
        classList: createClassList(options.classes || []),
        setAttribute(name, value) {
            this[name] = value;
        },
        addEventListener(type, handler) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(handler);
        },
        dispatchEvent(event) {
            const handlers = listeners.get(event.type) || [];
            handlers.forEach((handler) => handler(event));
        },
    };
}

function createHarness() {
    const windowListeners = new Map();
    let pendingTimeout = null;
    const strip = createElement("header-pill-strip");
    const toggle = createElement("header-pill-strip-toggle", { textContent: "‹" });
    const primary = createElement("header-pill-strip-primary", { scrollLeft: 12 });
    const secondary = createElement("header-pill-strip-secondary", { scrollLeft: 18 });
    const tertiary = createElement("header-pill-strip-tertiary", { scrollLeft: 24 });
    const elements = new Map([
        ["header-pill-strip", strip],
        ["header-pill-strip-toggle", toggle],
        ["header-pill-strip-primary", primary],
        ["header-pill-strip-secondary", secondary],
        ["header-pill-strip-tertiary", tertiary],
    ]);
    const documentRef = {
        getElementById(id) {
            return elements.get(id) || null;
        },
    };
    const windowRef = {
        addEventListener(type, handler) {
            if (!windowListeners.has(type)) windowListeners.set(type, []);
            windowListeners.get(type).push(handler);
        },
        dispatchEvent(event) {
            const handlers = windowListeners.get(event.type) || [];
            handlers.forEach((handler) => handler(event));
        },
    };
    let nowValue = 0;
    const controller = createHeaderPillStripController({
        documentRef,
        nowImpl() {
            return nowValue;
        },
        requestAnimationFrameImpl(callback) {
            callback();
        },
        setTimeoutImpl(callback) {
            pendingTimeout = callback;
            return callback;
        },
        clearTimeoutImpl(handle) {
            if (pendingTimeout === handle) {
                pendingTimeout = null;
            }
        },
        windowRef,
    });

    return {
        controller,
        primary,
        secondary,
        setNow(value) {
            nowValue = value;
        },
        runPendingTimeout() {
            const callback = pendingTimeout;
            pendingTimeout = null;
            callback?.();
        },
        hasPendingTimeout() {
            return pendingTimeout != null;
        },
        strip,
        tertiary,
        toggle,
        windowRef,
    };
}

describe("createHeaderPillStripController", function () {
    it("binds initial expanded UI and resets scroll positions", function () {
        const harness = createHarness();

        harness.controller.bind();

        expect(harness.strip.classList.contains("header-pill-strip--collapsed")).toBe(false);
        expect(harness.toggle.textContent).toBe("‹");
        expect(harness.toggle["aria-expanded"]).toBe("true");
        expect(harness.primary.scrollLeft).toBe(0);
        expect(harness.secondary.scrollLeft).toBe(0);
        expect(harness.tertiary.scrollLeft).toBe(0);
    });

    it("toggles manual collapse from the header button", function () {
        const harness = createHarness();

        harness.controller.bind();
        harness.toggle.dispatchEvent({ type: "click" });

        expect(harness.strip.classList.contains("header-pill-strip--collapsed")).toBe(true);
        expect(harness.toggle.textContent).toBe("›");
        expect(harness.toggle["aria-expanded"]).toBe("false");
    });

    it("restores from auto-collapse when clicked during the reveal grace window", function () {
        const harness = createHarness();

        harness.controller.bind();
        harness.controller.setAutoCollapsedState(true);
        expect(harness.strip.classList.contains("header-pill-strip--collapsed")).toBe(true);

        harness.setNow(100);
        harness.controller.setAutoCollapsedState(false);
        harness.setNow(200);
        harness.toggle.dispatchEvent({ type: "click" });

        expect(harness.controller.isEffectivelyCollapsed()).toBe(false);
        expect(harness.strip.classList.contains("header-pill-strip--collapsed")).toBe(false);
    });

    it("expands all pill groups across the strip and lingers after leaving", function () {
        const harness = createHarness();

        harness.controller.bind();
        harness.strip.dispatchEvent({ type: "pointerenter" });

        expect(harness.strip.classList.contains("header-pill-strip--groups-expanded")).toBe(true);

        harness.strip.dispatchEvent({ type: "pointerleave" });
        expect(harness.hasPendingTimeout()).toBe(true);
        expect(harness.strip.classList.contains("header-pill-strip--groups-expanded")).toBe(true);

        harness.setNow(3000);
        harness.runPendingTimeout();
        expect(harness.strip.classList.contains("header-pill-strip--groups-expanded")).toBe(false);
    });

    it("keeps all groups expanded when the pointer re-enters during the linger window", function () {
        const harness = createHarness();

        harness.controller.bind();
        harness.strip.dispatchEvent({ type: "pointerenter" });
        harness.strip.dispatchEvent({ type: "pointerleave" });
        expect(harness.hasPendingTimeout()).toBe(true);

        harness.strip.dispatchEvent({ type: "pointerenter" });
        expect(harness.hasPendingTimeout()).toBe(false);
        expect(harness.strip.classList.contains("header-pill-strip--groups-expanded")).toBe(true);
    });
});
