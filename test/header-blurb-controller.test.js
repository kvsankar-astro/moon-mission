import { describe, expect, it } from "vitest";

import { createHeaderBlurbController } from "../src/platform/js/ui/header-blurb-controller.js";

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
        tagName: options.tagName || "DIV",
        textContent: options.textContent || "",
        title: options.title || "",
        classList: createClassList(options.classes || []),
        closest(selector) {
            if (options.closestMatches?.some((value) => selector?.includes?.(value))) return this;
            return null;
        },
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

function createHarness(overrides = {}) {
    const documentListeners = new Map();
    const windowListeners = new Map();
    const timers = new Map();
    let nextTimerId = 1;

    const blurb = createElement("blurb", {
        classes: overrides.compactInitially ? ["blurb--compact"] : [],
    });
    const toggle = createElement("blurb-toggle", { tagName: "BUTTON" });
    const controlPanel = createElement("control-panel");
    const body = createElement("body");
    const elements = new Map([
        ["blurb", blurb],
        ["blurb-toggle", toggle],
        ["control-panel", controlPanel],
    ]);

    const documentRef = {
        body,
        getElementById(id) {
            return elements.get(id) || null;
        },
        addEventListener(type, handler) {
            if (!documentListeners.has(type)) documentListeners.set(type, []);
            documentListeners.get(type).push(handler);
        },
        dispatchEvent(event) {
            const handlers = documentListeners.get(event.type) || [];
            handlers.forEach((handler) => handler(event));
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
        setTimeout(callback) {
            const id = nextTimerId++;
            timers.set(id, callback);
            return id;
        },
        clearTimeout(id) {
            timers.delete(id);
        },
    };

    const controller = createHeaderBlurbController({
        autoCollapseDelayMs: 1,
        documentRef,
        isInteractiveInputTarget(target) {
            return target?.tagName === "INPUT";
        },
        isMobileViewport() {
            return !!overrides.mobileViewport;
        },
        meaningfulActivityKeys: new Set([" ", "ArrowLeft"]),
        windowRef,
    });

    function flushTimers() {
        const callbacks = Array.from(timers.values());
        timers.clear();
        callbacks.forEach((callback) => callback());
    }

    return {
        blurb,
        body,
        controller,
        controlPanel,
        documentRef,
        flushTimers,
        toggle,
        windowRef,
    };
}

describe("createHeaderBlurbController", function () {
    it("auto-collapses the blurb after the desktop delay", function () {
        const harness = createHarness();

        harness.controller.bind();
        expect(harness.blurb.classList.contains("blurb--compact")).toBe(false);
        expect(harness.toggle.textContent).toBe("Hide");

        harness.flushTimers();
        expect(harness.blurb.classList.contains("blurb--compact")).toBe(true);
        expect(harness.toggle.textContent).toBe("About");
    });

    it("keeps a manual collapse preference across config updates", function () {
        const harness = createHarness();

        harness.controller.bind();
        harness.toggle.dispatchEvent({
            type: "click",
            preventDefault() {},
            stopPropagation() {},
        });
        expect(harness.blurb.classList.contains("blurb--compact")).toBe(true);

        harness.documentRef.dispatchEvent({
            type: "mission-ui-config-updated",
            detail: { ui: { headerBlurbAutoCollapseEnabled: false } },
        });

        expect(harness.blurb.classList.contains("blurb--compact")).toBe(true);
        harness.flushTimers();
        expect(harness.blurb.classList.contains("blurb--compact")).toBe(true);
    });

    it("collapses on meaningful external interaction but ignores clicks inside the blurb", function () {
        const harness = createHarness();
        const insideBlurb = createElement("inside-blurb", {
            closestMatches: ["#blurb"],
        });
        const controlTarget = createElement("control-target", {
            closestMatches: ["#control-panel"],
        });

        harness.controller.bind();
        harness.documentRef.dispatchEvent({ type: "pointerdown", target: insideBlurb });
        expect(harness.blurb.classList.contains("blurb--compact")).toBe(false);

        harness.documentRef.dispatchEvent({ type: "pointerdown", target: controlTarget });
        expect(harness.blurb.classList.contains("blurb--compact")).toBe(true);
    });
});
